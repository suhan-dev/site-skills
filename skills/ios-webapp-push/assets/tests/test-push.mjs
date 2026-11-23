// Offline tests for the notifications: lib/webpush.js (RFC 8291 / 8292), lib/push.js (who gets what, when),
// functions/api/push/*, and the tick's secret check that the sign-in gate (google-signin-team-gate) calls.
//   node tests/test-push.mjs        (Node 22.13 or later: node:sqlite)
// A fake clock, a fake Google Calendar and a fake Apple push service stand in for fetch, and D1 is SQLite in memory.
// Every push is decrypted with the device's own key and its VAPID signature checked, so what is asserted is what an
// iPhone would show. Nothing is sent anywhere.
// The code under test is copied into a temporary folder next to two stand-ins (tests/stubs/gcal.js, auth.js) for the
// calendar and sign-in skills, with {{SITE_ORIGIN}} filled in, exactly as a project would have it.
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)), ASSETS = join(HERE, "..");
const ORIGIN = "https://example-lab.pages.dev";
const TMP = mkdtempSync(join(tmpdir(), "push-test-"));
const put = (rel, text) => { mkdirSync(dirname(join(TMP, rel)), { recursive: true }); writeFileSync(join(TMP, rel), text.replaceAll("{{SITE_ORIGIN}}", ORIGIN)); };
for (const f of ["lib/push.js", "lib/webpush.js", "functions/api/push/index.js", "functions/api/push/tick.js"]) put(f, readFileSync(join(ASSETS, f), "utf8"));
for (const f of ["gcal.js", "auth.js"]) put("lib/" + f, readFileSync(join(HERE, "stubs", f), "utf8"));
const load = (rel) => import(pathToFileURL(join(TMP, rel)).href);
const { encryptPayload, b64u, unb64u } = await load("lib/webpush.js");
const push = await load("lib/push.js");
const pushApi = await load("functions/api/push/index.js");
const tickApi = await load("functions/api/push/tick.js");

let pass = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); pass++; console.log("  ✓ " + msg); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); pass++; console.log("  ✓ " + msg); };
const section = (s) => console.log("\n" + s);
const enc = new TextEncoder();

/* ---------- 1. RFC 8291 Appendix A ---------- */
section("RFC 8291 test vector");
{
  const asPub = unb64u("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
  const out = await encryptPayload({
    p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
    auth: "BTBZMqHH6r4Tts7J_aSIgg",
    payload: unb64u("V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24"),
    salt: "DGv6ra1nlYgDCS1FRnbzlw",
    serverKey: { d: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw", x: b64u(asPub.slice(1, 33)), y: b64u(asPub.slice(33)) },
  });
  eq(b64u(out), "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
    "encrypting the RFC's message gives the RFC's bytes");
  ok(push.SUBJECT === ORIGIN, "the VAPID subject is the site's https origin (no email address)");
}

/* ---------- D1 on SQLite ---------- */
class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...a) { return new Stmt(this.db, this.sql, a.map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : v === undefined ? null : v))); }
  async first() { return this.db.prepare(this.sql).get(...this.args) || null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args).map((r) => ({ ...r })) }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.args); return { meta: { changes: Number(r.changes) } }; }
  _exec() { const st = this.db.prepare(this.sql); return /^\s*select/i.test(this.sql) ? { results: st.all(...this.args) } : { meta: { changes: Number(st.run(...this.args).changes) } }; }
}
class D1 {
  constructor() { this.db = new DatabaseSync(":memory:"); }
  prepare(sql) { return new Stmt(this.db, sql); }
  async batch(list) {
    this.db.exec("BEGIN");
    try { const out = list.map((s) => s._exec()); this.db.exec("COMMIT"); return out; } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
  rows(sql) { return this.db.prepare(sql).all().map((r) => ({ ...r })); }
}

/* ---------- the fake world: clock, Google Calendar, Apple's push service ---------- */
let NOW = Date.parse("2026-12-21T09:00:00+09:00"); // a Monday morning in the demo time zone (Asia/Seoul)
const realNow = Date.now;
Date.now = () => NOW;
const MIN = 60_000;
const local = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 19) + "+09:00";

const G = { events: new Map(), instances: [], ver: 0, fail410: false, calls: 0 };
let nid = 0;
function gPut(e) { G.ver++; e._v = G.ver; e.updated = new Date(NOW).toISOString(); G.events.set(e.id, e); return e; }
function gAdd({ title, start, minutes = 60, allDay = false, author = "", created = NOW, id }) {
  id = id || "ev" + (++nid);
  const e = { id, status: "confirmed", summary: title, created: new Date(created).toISOString() };
  if (allDay) {
    const day = typeof start === "number" ? local(start).slice(0, 10) : start;
    e.start = { date: day };
    e.end = { date: new Date(Date.parse(day + "T00:00:00Z") + 86400e3).toISOString().slice(0, 10) }; // exclusive, as Google
  } else { e.start = { dateTime: local(start) }; e.end = { dateTime: local(start + minutes * MIN) }; }
  if (author) e.extendedProperties = { shared: { author, owner: author } };
  return gPut(e);
}
function gMove(id, start) { const e = G.events.get(id); e.start = { dateTime: local(start) }; e.end = { dateTime: local(start + 60 * MIN) }; gPut(e); }
function gDelete(id) { const e = G.events.get(id); e.status = "cancelled"; gPut(e); }
const startMs = (x) => Date.parse(x.dateTime || x.date + "T00:00:00+09:00");
const strip = (e) => { const { _v, ...o } = e; return o; };

function googleList(url) {
  G.calls++;
  const q = url.searchParams;
  const page = (items, extra) => {
    const at = +(q.get("pageToken") || 0), size = 3; // small pages, so paging is exercised
    const slice = items.slice(at, at + size).map(strip);
    return at + size < items.length ? { items: slice, nextPageToken: String(at + size) } : { items: slice, ...extra };
  };
  if (q.get("syncToken")) {
    if (G.fail410) return [410, { error: { message: "Sync token is no longer valid, a full sync is required." } }];
    const since = +q.get("syncToken").slice(1);
    return [200, page([...G.events.values()].filter((e) => e._v > since), { nextSyncToken: "t" + G.ver })];
  }
  if (q.get("singleEvents") === "true") {
    const lo = Date.parse(q.get("timeMin")), hi = Date.parse(q.get("timeMax"));
    const all = [...[...G.events.values()].filter((e) => !e.recurrence), ...G.instances]
      .filter((e) => e.status !== "cancelled" && startMs(e.end) > lo && startMs(e.start) < hi)
      .sort((a, b) => startMs(a.start) - startMs(b.start));
    return [200, { items: all.map(strip) }];
  }
  return [200, page([...G.events.values()].filter((e) => e.status !== "cancelled"), { nextSyncToken: "t" + G.ver })];
}

const devices = new Map();
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
const cat = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
async function decrypt(dev, body) {   // what the phone does: RFC 8291 in reverse, with the device's private key
  const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, dev.priv, 256));
  const ikm = await hmac(await hmac(dev.auth, ecdh), cat(enc.encode("WebPush: info\0"), dev.pub, asPub, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ct));
  let end = pt.length - 1;
  while (end >= 0 && pt[end] === 0) end--;
  assert.equal(pt[end], 2, "last-record delimiter");
  return JSON.parse(new TextDecoder().decode(pt.slice(0, end)));
}
async function pushService(url, init) {
  const dev = devices.get(url);
  if (!dev) return [404, null];
  const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(init.headers.Authorization || "");
  assert.ok(m, "VAPID header shape");
  const key = await crypto.subtle.importKey("raw", unb64u(m[4]), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  assert.ok(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, unb64u(m[3]), enc.encode(m[1] + "." + m[2])), "VAPID signature verifies");
  const claim = JSON.parse(new TextDecoder().decode(unb64u(m[2])));
  assert.equal(claim.aud, "https://web.push.apple.com");
  assert.equal(claim.sub, ORIGIN);
  assert.ok(claim.exp * 1000 > NOW && claim.exp * 1000 <= NOW + 24 * 3600e3, "JWT exp within 24 h");
  assert.equal(init.headers["Content-Encoding"], "aes128gcm");
  const msg = await decrypt(dev, new Uint8Array(init.body));
  // dev.replies: answers to give instead of 201, each a status or { status, title } (only for that kind of message)
  const i = dev.replies.findIndex((x) => typeof x === "number" || x.title === msg.title);
  const reply = i < 0 ? 201 : [dev.replies.splice(i, 1)[0]].map((x) => (typeof x === "number" ? x : x.status))[0];
  if (reply === 201) dev.inbox.push({ ...msg, ttl: +init.headers.TTL, urgency: init.headers.Urgency, at: NOW });
  return [reply, null];
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  let status, body;
  if (url.hostname === "web.push.apple.com") [status, body] = await pushService(url.href, init);
  else if (url.pathname.includes("/calendar/v3/calendars/") && url.pathname.endsWith("/events")) [status, body] = googleList(url);
  else throw new Error("unexpected fetch " + url.href);
  return new Response(body == null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
};

async function device(name) {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const d = { name, endpoint: `https://web.push.apple.com/3/device/${name}`, priv: kp.privateKey, pub, auth, inbox: [], replies: [] };
  d.json = { endpoint: d.endpoint, expirationTime: null, keys: { p256dh: b64u(pub), auth: b64u(auth) } };
  devices.set(d.endpoint, d);
  return d;
}

const env = { DB: new D1(), GOOGLE_SA_JSON: "{}", GOOGLE_CALENDAR_ID: "demo-calendar" };
const db = env.DB;
const tick = async () => push.tick(env, NOW);
const inboxes = () => Object.fromEntries([...devices.values()].map((d) => [d.name, d.inbox.length]));
// reminders only (adding an event in these tests also sends "New event")
const reminders = () => Object.fromEntries([...devices.values()].map((d) => [d.name, d.inbox.filter((m) => m.title === "In 30 minutes").length]));
const clear = () => devices.forEach((d) => { d.inbox = []; });
const post = (path, body, headers = {}) => new Request(ORIGIN + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

try {
/* ---------- 2. first tick: a baseline only ---------- */
section("First run");
gAdd({ title: "Kickoff meeting", start: Date.parse("2026-12-22T10:50:00+09:00") });
for (let i = 0; i < 4; i++) gAdd({ title: "Lab session", start: Date.parse("2026-12-29T00:00:00+09:00") + i * 7 * 86400e3, allDay: true });
const [A, B, C] = [await device("A"), await device("B"), await device("C")];
let r = await tick();
ok(r.sync.baseline && r.sync.found === 0, "the first tick records the existing events and finds nothing new");
eq(db.rows("SELECT count(*) n FROM push_seen")[0].n, 5, "all five existing events are in the seen list (read across pages)");

/* ---------- 3. subscribing through the API ---------- */
section("Subscribing (POST /api/push)");
let res = await pushApi.onRequestGet({ env });
let j = await res.json();
ok(j.ready && /^[\w-]{87}$/.test(j.publicKey), "GET /api/push gives a VAPID public key (made on first use, kept in D1)");
res = await pushApi.onRequestPost({ request: post("/api/push", { ...A.json, who: "alex", notifyNew: true, notifyBefore: true }), env });
eq(await res.json(), { registered: true, notifyNew: true, notifyBefore: true }, "device A (alex) is saved with both switches on");
await pushApi.onRequestPost({ request: post("/api/push", { ...B.json, who: "blair" }), env });
await pushApi.onRequestPost({ request: post("/api/push", { ...C.json, who: "casey", notifyNew: false }), env });
res = await pushApi.onRequestPost({ request: post("/api/push?read", C.json), env });
eq(await res.json(), { registered: true, notifyNew: false, notifyBefore: true }, "?read returns device C's switches (new events off)");
res = await pushApi.onRequestPost({ request: post("/api/push", { endpoint: "https://evil.example/x", keys: A.json.keys }), env });
eq(res.status, 400, "an endpoint that isn't a known push service is refused");
res = await pushApi.onRequestPost({ request: post("/api/push", { ...A.json, who: "mallory" }), env, data: { user: { member: "alex" } } });
eq(db.rows("SELECT who FROM push_subs WHERE endpoint = 'https://web.push.apple.com/3/device/A'")[0].who, "alex", "signed in, the device belongs to the session's member, whatever the body says");
res = await pushApi.onRequestGet({ env: {} });
j = await res.json();
eq([j.ready, j.publicKey], [false, null], "without the DB binding GET says not ready (the sheet: \"aren't set up on the server yet\")");
res = await pushApi.onRequestPost({ request: post("/api/push", A.json), env: {} });
eq(res.status, 503, "and POST answers 503");
r = await tick();
eq(inboxes(), { A: 0, B: 0, C: 0 }, "a tick with nothing new sends nothing (a deploy never notifies)");

/* ---------- 4. new events ---------- */
section("New event added in Google Calendar");
NOW += 5 * MIN;
gAdd({ title: "Design review", start: Date.parse("2026-12-23T14:00:00+09:00") });
r = await tick();
eq(inboxes(), { A: 1, B: 1, C: 0 }, "A and B get one notification; C (new events off) gets none");
eq([A.inbox[0].title, A.inbox[0].body], ["New event", "Wed 12/23 · 14:00 · Design review"], "title and body read 'New event' / 'Wed 12/23 · 14:00 · Design review'");
ok(A.inbox[0].url.startsWith("/?event=ev6&date=2026-12-23#"), "the tap opens that day with the event (and skips the intro)");
await tick(); NOW += MIN; await tick();
eq(inboxes(), { A: 1, B: 1, C: 0 }, "later ticks never send it again");
clear();

section("New event added on the site (the events API calls notifyCreated)");
const site = gAdd({ title: "Reading group", start: Date.parse("2026-12-24T19:00:00+09:00"), author: "alex" });
await push.notifyCreated(env, strip(site), NOW);
eq(inboxes(), { A: 0, B: 1, C: 0 }, "it goes out right away to B; A (alex) added it, so A gets nothing");
eq(B.inbox[0].body, "Thu 12/24 · 19:00 · Reading group", "body 'Thu 12/24 · 19:00 · Reading group'");
NOW += MIN; await tick();
eq(inboxes(), { A: 0, B: 1, C: 0 }, "the next tick sees it in Google and does not send it again");
clear();

section("A site-added event the tick finds first");
gAdd({ title: "Blair adds this", start: Date.parse("2026-12-26T11:00:00+09:00"), author: "blair" });
await tick();
eq(inboxes(), { A: 1, B: 0, C: 0 }, "the author (blair, device B) is still skipped");
clear();

section("Recurring series and bulk adds");
const master = gAdd({ title: "Weekly sync", start: Date.parse("2026-12-28T21:00:00+09:00") });
master.recurrence = ["RRULE:FREQ=WEEKLY;COUNT=3"];
for (let i = 0; i < 3; i++) G.instances.push({ id: `${master.id}_2026122${8 + i}T120000Z`, recurringEventId: master.id, status: "confirmed", summary: "Weekly sync", start: { dateTime: local(startMs(master.start) + i * 7 * 86400e3) }, end: { dateTime: local(startMs(master.start) + i * 7 * 86400e3 + 3600e3) } });
await tick();
eq(inboxes(), { A: 1, B: 1, C: 0 }, "a recurring series is one notification");
clear();
for (let i = 0; i < 5; i++) gAdd({ title: "Imported " + i, start: Date.parse("2027-01-05T00:00:00+09:00") + i * 86400e3, allDay: true });
await tick();
eq(inboxes(), { A: 1, B: 1, C: 0 }, "five events at once are one summary");
eq([A.inbox[0].title, A.inbox[0].body], ["New events", "5 events added · from Tue 1/5"], "summary reads 'New events' / '5 events added · from Tue 1/5'");
clear();

section("Old events and an expired sync token");
gAdd({ title: "Made two days ago", start: Date.parse("2027-01-12T10:00:00+09:00"), created: NOW - 2 * 86400e3 });
await tick();
eq(inboxes(), { A: 0, B: 0, C: 0 }, "an event first seen now but created days ago is not news");
G.fail410 = true;
gAdd({ title: "During the reset", start: Date.parse("2027-01-13T10:00:00+09:00") });
await tick();
G.fail410 = false;
eq(inboxes(), { A: 1, B: 1, C: 0 }, "after Google drops the sync token, a full list still finds only the one new event");
clear();

/* ---------- 5. reminders ---------- */
section("30 minutes before");
NOW = Date.parse("2026-12-22T09:30:00+09:00"); // Tuesday; the kickoff is at 10:50
for (let m = 0; m <= 80; m++) { await tick(); NOW += MIN; }
eq(inboxes(), { A: 1, B: 1, C: 1 }, "one reminder per device across 80 one-minute ticks (C too: only its new-event switch is off)");
const first = A.inbox[0];
eq([first.title, first.body], ["In 30 minutes", "Tue 12/22 · 10:50 · Kickoff meeting"], "title and body read 'In 30 minutes' / 'Tue 12/22 · 10:50 · Kickoff meeting'");
eq(local(first.at).slice(11, 16), "10:20", "it is sent at 10:20, thirty minutes before");
ok(first.ttl > 0 && first.ttl <= 30 * 60 && first.urgency === "high", "its TTL ends at the start time and urgency is high");
ok(!/location|notes|@/.test(JSON.stringify(first)), "the message carries no place, notes or address");
clear();

section("Moved, deleted, all-day and switched-off events");
const mv = gAdd({ title: "Moves later", start: NOW + 29 * MIN });
await tick();
eq(reminders(), { A: 1, B: 1, C: 1 }, "an event 29 minutes away gets its reminder");
clear();
gMove(mv.id, NOW + 120 * MIN);
for (let m = 0; m < 95; m++) { NOW += MIN; await tick(); }
eq(reminders(), { A: 1, B: 1, C: 1 }, "moved two hours later, it gets one new reminder at the new time");
eq(local(A.inbox.filter((m) => m.title === "In 30 minutes")[0].at).slice(11, 16), local(startMs(G.events.get(mv.id).start) - 30 * MIN).slice(11, 16), "at the new start minus 30 minutes");
clear();
const fl = gAdd({ title: "Flaky", start: NOW + 29 * MIN });
A.replies.push({ status: 500, title: "In 30 minutes" }); // Apple fails once for A's reminder
await tick();
eq(reminders(), { A: 0, B: 1, C: 1 }, "A's send fails once and waits to retry");
gMove(fl.id, NOW + 240 * MIN);
NOW += MIN; await tick(); NOW += MIN; await tick();
eq(reminders(), { A: 0, B: 1, C: 1 }, "the event moved before the retry: the old reminder is dropped, not sent late");
clear();
const del = gAdd({ title: "Deleted", start: NOW + 45 * MIN });
NOW += 5 * MIN; await tick();
gDelete(del.id);
for (let m = 0; m < 20; m++) { NOW += MIN; await tick(); }
eq(reminders(), { A: 0, B: 0, C: 0 }, "a deleted event gets no reminder");
gAdd({ title: "All day", start: NOW, allDay: true });
gAdd({ title: "Timed, but B is off", start: NOW + 40 * MIN });
await pushApi.onRequestPost({ request: post("/api/push", { ...B.json, notifyBefore: false }), env });
for (let m = 0; m < 20; m++) { NOW += MIN; await tick(); }
eq(reminders(), { A: 1, B: 0, C: 1 }, "all-day events get none; B with the switch off gets none");
clear();

/* ---------- 6. gone devices and members ---------- */
section("Unsubscribed devices and members who left");
C.replies.push({ status: 410, title: "In 30 minutes" });
gAdd({ title: "C is gone", start: Date.parse("2027-01-20T10:00:00+09:00") });
NOW += MIN; await tick();
eq(db.rows("SELECT count(*) n FROM push_subs WHERE who = 'casey'")[0].n, 1, "C still exists while it has nothing to receive");
gAdd({ title: "Soon", start: NOW + 29 * MIN });
await tick();
eq(db.rows("SELECT count(*) n FROM push_subs WHERE who = 'casey'")[0].n, 0, "Apple answers 410 for C: the device is forgotten");
const D2 = await device("D");
await pushApi.onRequestPost({ request: post("/api/push", { ...D2.json, who: "casey" }), env });
const signed = { ...env, GOOGLE_CLIENT_ID: "test-client", ALLOWED_EMAILS: "alex@example.com=alex, blair@example.com=blair" };
await push.tick(signed, NOW);
eq(db.rows("SELECT who FROM push_subs ORDER BY who").map((x) => x.who), ["alex", "blair"], "casey is off ALLOWED_EMAILS: the next tick forgets casey's new device");
res = await pushApi.onRequestDelete({ request: new Request(ORIGIN + "/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: B.endpoint }) }), env });
eq(db.rows("SELECT count(*) n FROM push_subs")[0].n, 1, "DELETE /api/push forgets device B");

/* ---------- 7. the minute tick and the sign-in gate ---------- */
section("Tick secret (the gate's MACHINE entry: \"/api/push/tick\": { header: \"X-Push-Tick\", allowed: tickAllowed })");
const tickReq = (init) => new Request(ORIGIN + "/api/push/tick", init);
eq(await push.tickAllowed(env, tickReq({ method: "POST", headers: { "X-Push-Tick": "wrong" } })), false, "the tick with a wrong secret is refused");
eq(await push.tickAllowed(env, tickReq({ method: "POST" })), false, "the tick without the header is refused (the gate then asks for a session)");
const secret = db.rows("SELECT v FROM push_meta WHERE k = 'tick_secret'")[0]?.v;
ok(secret && secret.length >= 43, "the tick secret was made on first use (32 random bytes)");
eq(await push.tickAllowed(env, tickReq({ method: "POST", headers: { "X-Push-Tick": secret } })), true, "the tick with the secret passes");
eq(await push.tickAllowed(env, tickReq({ method: "GET", headers: { "X-Push-Tick": secret } })), false, "only POST");
// in this library the sign-in gate skill sits next door: it must leave the web app's files open
const GATE = join(ASSETS, "..", "..", "google-signin-team-gate", "assets", "functions", "_middleware.js");
if (existsSync(GATE)) {
  const src = readFileSync(GATE, "utf8");
  const pub = /const PUBLIC = new Set\(\[([^\]]*)\]\)/.exec(src)?.[1] || "";
  const icon = /const PUBLIC_ICON = (\/.+\/);/.exec(src)?.[1] || "";
  ok(pub.includes('"/manifest.webmanifest"') && pub.includes('"/sw.js"') && new RegExp(icon.slice(1, -1)).test("/icons/apple-touch-icon.png"),
    "the sign-in gate opens the manifest, the service worker and /icons/*.png without signing in");
}
res = await tickApi.onRequestPost({ request: new Request(ORIGIN + "/api/push/tick", { method: "POST", headers: { "X-Push-Tick": secret } }), env });
eq(res.status, 200, "and the tick endpoint runs");
res = await tickApi.onRequestPost({ request: new Request(ORIGIN + "/api/push/tick", { method: "POST", headers: { "X-Push-Tick": "nope" } }), env });
eq(res.status, 403, "the endpoint checks the secret again");
} finally {
  Date.now = realNow;
  rmSync(TMP, { recursive: true, force: true });
}
console.log(`\n${pass} checks passed (Google was asked ${G.calls} times)`);
