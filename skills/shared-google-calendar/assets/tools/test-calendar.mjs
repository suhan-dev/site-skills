// Offline tests for the shared calendar: the Pages Functions against tools/mock-google.mjs (real JWT signing, real
// request shapes), and the pure layout code (the 07:00 day, lanes, overlap columns).
//   node tools/test-calendar.mjs          (Node 20 or later; no network, nothing to install)
// The placeholders are filled into a temporary copy, as a project would fill them, and the whole run is repeated in
// two zones: Asia/Seoul (no DST) and America/New_York (DST), so nothing assumes a fixed offset.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, failed = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; return; }
  failed++;
  console.error("✗", name, extra === undefined ? "" : JSON.stringify(extra));
}
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { got: a, want: b });

// copy assets/{lib,functions,site/js} into a temp dir with the placeholders filled
function filledCopy(tz) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cal-test-"));
  for (const sub of ["lib", "functions", "site/js"]) {
    for (const f of fs.readdirSync(path.join(ASSETS, sub), { recursive: true })) {
      const src = path.join(ASSETS, sub, f);
      if (fs.statSync(src).isDirectory()) continue;
      const dst = path.join(dir, sub, f);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, fs.readFileSync(src, "utf8").replaceAll("{{TIMEZONE}}", tz));
    }
  }
  return dir;
}

function startMock(port, varsFile, tz) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(ASSETS, "tools/mock-google.mjs"), String(port), varsFile], { env: { ...process.env, MOCK_TZ: tz } });
    p.stdout.on("data", (d) => { if (String(d).includes("mock google on")) resolve(p); });
    p.stderr.on("data", (d) => process.stderr.write(d));
    p.on("exit", (c) => reject(new Error("mock exited " + c)));
  });
}

function readVars(file) {
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^'(.*)'$/, "$1");
  }
  return env;
}

const req = (url, method = "GET", body) => new Request("http://site.test" + url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
const out = async (res) => ({ status: res.status, body: await res.json() });

async function serverTests(tz, port) {
  const dir = filledCopy(tz);
  const vars = path.join(dir, ".dev.vars");
  const mock = await startMock(port, vars, tz);
  try {
    const env = readVars(vars);
    const imp = (p) => import(pathToFileURL(path.join(dir, p)).href);
    const gcal = await imp("lib/gcal.js");
    const status = await imp("functions/api/status.js");
    const events = await imp("functions/api/events/index.js");
    const one = await imp("functions/api/events/[id].js");
    const seed = await imp("functions/api/seed.js");
    const seedLib = await imp("lib/seed.js");
    const signedIn = { user: { member: "alex" } };
    const T = (s) => `[${tz}] ${s}`;

    // zone offsets, DST included
    if (tz === "Asia/Seoul") eq(gcal.zonedISO("2026-12-22"), "2026-12-22T00:00:00+09:00", T("zonedISO Seoul"));
    if (tz === "America/New_York") {
      eq(gcal.zonedISO("2027-03-14"), "2027-03-14T00:00:00-05:00", T("zonedISO before DST"));
      eq(gcal.zonedISO("2027-03-15"), "2027-03-15T00:00:00-04:00", T("zonedISO after DST"));
    }

    // status: not configured, then connected
    let r = await out(await status.onRequestGet({ env: {} }));
    eq(r.body.configured, false, T("status without variables"));
    r = await out(await status.onRequestGet({ env }));
    ok(r.body.ok === true && r.body.calendarName === "Example Lab (mock)", T("status connected"), r.body);
    eq(r.body.seeded, false, T("not seeded yet"));

    // events: not configured → 503 not-configured
    r = await out(await events.onRequestGet({ request: req("/api/events?from=2026-12-01&to=2026-12-31"), env: {} }));
    eq([r.status, r.body.error], [503, "not-configured"], T("events without variables"));

    // create a timed event: "added by" comes from the session, not from the body
    r = await out(await events.onRequestPost({ request: req("/api/events", "POST", { title: "Design review", start: "2026-12-22", end: "2026-12-22", startTime: "10:00", endTime: "11:30", owner: "alex", colorId: "7", who: "casey" }), env, data: signedIn }));
    eq(r.status, 201, T("create timed"));
    const timed = r.body.event;
    eq([timed.start, timed.startTime, timed.end, timed.endTime, timed.author, timed.owner, timed.colorId], ["2026-12-22", "10:00", "2026-12-22", "11:30", "alex", "alex", "7"], T("timed event fields"));
    // without a session the body's who is used (local runs)
    r = await out(await events.onRequestPost({ request: req("/api/events", "POST", { title: "Lab session", start: "2026-12-23", startTime: "13:00", endTime: "14:00", who: "blair" }), env }));
    eq(r.body.event.author, "blair", T("who without a session"));

    // a late night across midnight keeps its real dates
    r = await out(await events.onRequestPost({ request: req("/api/events", "POST", { title: "Late run", start: "2026-12-22", end: "2026-12-23", startTime: "23:30", endTime: "01:30" }), env, data: signedIn }));
    eq([r.body.event.start, r.body.event.startTime, r.body.event.end, r.body.event.endTime], ["2026-12-22", "23:30", "2026-12-23", "01:30"], T("late night"));

    // all-day over three days: Google's exclusive end date becomes an inclusive one
    r = await out(await events.onRequestPost({ request: req("/api/events", "POST", { title: "Retreat", allDay: true, start: "2026-12-24", end: "2026-12-26" }), env, data: signedIn }));
    eq([r.body.event.allDay, r.body.event.start, r.body.event.end], [true, "2026-12-24", "2026-12-26"], T("all-day range"));

    // list one day: the timed event and the late night (it overlaps the 22nd), not the 24th
    r = await out(await events.onRequestGet({ request: req("/api/events?from=2026-12-22&to=2026-12-22"), env }));
    eq(r.body.events.map((e) => e.title).sort(), ["Design review", "Late run"], T("list one day"));
    r = await out(await events.onRequestGet({ request: req("/api/events?from=2026-12-31&to=2026-12-01"), env }));
    eq([r.status, r.body.error], [400, "range"], T("bad range"));

    // validation
    r = await out(await events.onRequestPost({ request: req("/api/events", "POST", { title: " ", start: "2026-12-22" }), env }));
    eq([r.status, r.body.error], [400, "title"], T("no title"));
    r = await out(await events.onRequestPost({ request: req("/api/events", "POST", { title: "x", start: "2026-12-22", startTime: "11:00", endTime: "10:00" }), env }));
    eq([r.status, r.body.error], [400, "time"], T("end before start"));

    // edit: timed → all day (the other kind of date is cleared), editor from the session
    r = await out(await one.onRequestPatch({ request: req("/api/events/" + timed.id, "PATCH", { title: "Design review", allDay: true, start: "2026-12-22", end: "2026-12-22", owner: "team" }), env, params: { id: timed.id }, data: { user: { member: "casey" } } }));
    eq([r.status, r.body.event.allDay, r.body.event.editor, r.body.event.owner], [200, true, "casey", "team"], T("edit to all day"));
    // and back to timed
    r = await out(await one.onRequestPatch({ request: req("/api/events/" + timed.id, "PATCH", { title: "Design review", start: "2026-12-22", startTime: "15:00", endTime: "16:00" }), env, params: { id: timed.id }, data: signedIn }));
    eq([r.body.event.allDay, r.body.event.startTime], [false, "15:00"], T("edit back to timed"));

    // delete twice: the second answers the same (Google says 410 Gone)
    r = await out(await one.onRequestDelete({ env, params: { id: timed.id } }));
    eq(r.body.deleted, timed.id, T("delete"));
    r = await out(await one.onRequestDelete({ env, params: { id: timed.id } }));
    eq([r.status, r.body.deleted], [200, timed.id], T("delete again"));
    r = await out(await one.onRequestGet({ env, params: { id: "bad id!" } }));
    eq([r.status, r.body.error], [400, "id"], T("invalid id"));

    // DST day: a 09:00 event on the day the clocks change stays 09:00
    r = await out(await events.onRequestPost({ request: req("/api/events", "POST", { title: "Reading group", start: "2027-03-14", startTime: "09:00", endTime: "10:00" }), env }));
    r = await out(await events.onRequestGet({ request: req("/api/events?from=2027-03-14&to=2027-03-14"), env }));
    eq(r.body.events.map((e) => [e.start, e.startTime, e.endTime]), [["2027-03-14", "09:00", "10:00"]], T("DST day keeps local times"));

    // seed: a hand-made kickoff on the kickoff day counts as seeded and is skipped
    const list = seedLib.seedEvents();
    await events.onRequestPost({ request: req("/api/events", "POST", { title: "Kickoff (hand-made)", allDay: true, start: list[0].start }), env });
    r = await out(await status.onRequestGet({ env }));
    eq(r.body.seeded, true, T("hand-made twin counts as seeded"));
    r = await out(await seed.onRequestPost({ request: req("/api/seed", "POST", {}), env, data: signedIn }));
    eq(r.body, { added: list.length - 1, restored: 0, kept: 0, skipped: 1 }, T("seed first press"));
    r = await out(await seed.onRequestPost({ request: req("/api/seed", "POST", {}), env, data: signedIn }));
    eq(r.body, { added: 0, restored: 0, kept: list.length - 1, skipped: 1 }, T("seed again adds nothing"));
    await one.onRequestDelete({ env, params: { id: list[1].id } });
    r = await out(await seed.onRequestPost({ request: req("/api/seed", "POST", {}), env, data: signedIn }));
    eq(r.body, { added: 0, restored: 1, kept: list.length - 2, skipped: 1 }, T("seed restores a deleted one"));
    r = await out(await seed.onRequestGet());
    ok(r.body.events.length === list.length && !("match" in r.body.events[0]), T("seed preview has no regexes"));

    // error mapping: wrong id, no sharing, broken key
    r = await out(await status.onRequestGet({ env: { ...env, GOOGLE_CALENDAR_ID: "other-calendar" } }));
    eq([r.body.ok, r.body.code], [false, "google-404"], T("status 404"));
    ok(/Check GOOGLE_CALENDAR_ID/.test(r.body.error), T("404 hint"), r.body.error);
    r = await out(await events.onRequestGet({ request: req("/api/events?from=2026-12-01&to=2026-12-02"), env: { ...env, GOOGLE_CALENDAR_ID: "forbidden-calendar" } }));
    eq([r.status, r.body.error], [502, "google-403"], T("events 403 → 502 google-403"));
    ok(/Make changes to events/.test(r.body.message), T("403 hint"), r.body.message);
    r = await out(await status.onRequestGet({ env: { ...env, GOOGLE_SA_JSON: "{not json" } }));
    eq([r.body.ok, r.body.code], [false, "sa-json"], T("broken key JSON"));
  } finally {
    mock.kill();
  }
}

async function layoutTests() {
  const dir = filledCopy("Asia/Seoul");
  const L = await import(pathToFileURL(path.join(dir, "site/js/cal-layout.js")).href);
  const ev = (o) => ({ title: "x", allDay: false, location: "", ...o });
  eq(L.DAY0, 420, "DAY0 is 07:00");
  eq(L.off(420), 0, "off(07:00) = 0");
  eq(L.off(60), 1080, "off(01:00) = 18 h after 07:00");
  // 02:00 on the 23rd belongs to the calendar day of the 22nd
  let p = L.place(ev({ start: "2026-12-23", end: "2026-12-23", startTime: "02:00", endTime: "03:00" }));
  eq(p, { ds: "2026-12-22", de: "2026-12-22", grid: true, top: 1140, end: 1200 }, "02:00 sits on the day before");
  // 23:30 → 01:30 stays one block on the 22nd
  p = L.place(ev({ start: "2026-12-22", end: "2026-12-23", startTime: "23:30", endTime: "01:30" }));
  eq(p, { ds: "2026-12-22", de: "2026-12-22", grid: true, top: 990, end: 1110 }, "late night is one block");
  // 06:00 → 08:00 crosses the 07:00 edge: a bar over two calendar days
  p = L.place(ev({ start: "2026-12-22", end: "2026-12-22", startTime: "06:00", endTime: "08:00" }));
  eq([p.ds, p.de, p.grid], ["2026-12-21", "2026-12-22", false], "crossing 07:00 becomes a bar");
  p = L.place(ev({ allDay: true, start: "2026-12-24", end: "2026-12-26", startTime: "" }));
  eq([p.ds, p.de, p.grid], ["2026-12-24", "2026-12-26", false], "all-day range");
  p = L.place(ev({ start: "2026-12-22", end: "2026-12-22", startTime: "10:00", endTime: "" }));
  eq(p.end - p.top, 60, "no end time = one hour");
  // overlap columns
  const cols = L.packDay([{ s: 60, en: 120 }, { s: 90, en: 150 }, { s: 130, en: 200 }, { s: 300, en: 360 }]);
  eq(cols.map((c) => [c.k, c.n]), [[0, 2], [1, 2], [0, 2], [0, 1]], "packDay columns");
  eq(cols.map((c) => c.g), [0, 0, 0, 1], "packDay overlap groups (phones draw a group of two or more as one block)");
  // lanes: four all-day bars on one day → three shown, "+1 more"
  const bars = [1, 2, 3, 4].map((i) => ev({ title: "Bar " + i, allDay: true, start: "2026-12-22", end: "2026-12-22", startTime: "" }));
  const lw = L.layoutWeek("2026-12-20", bars);
  eq(lw.items.map((i) => i.lane), [0, 1, 2, 3], "lanes in order");
  eq(lw.hiddenPerDay, [0, 0, 1, 0, 0, 0, 0], "+1 more on Tuesday");
  // a bar from the week before is cut at the week's first day
  const long = L.layoutWeek("2026-12-20", [ev({ allDay: true, start: "2026-12-18", end: "2026-12-21", startTime: "" })]);
  eq([long.items[0].s, long.items[0].en], [0, 1], "bar clipped to the week");
  // hidden owners
  eq(L.layoutWeek("2026-12-20", bars, () => false).items.length, 0, "hidden owners drop out");
}

await layoutTests();
await serverTests("Asia/Seoul", 18790);
await serverTests("America/New_York", 18791);
console.log(failed ? `✗ ${failed} failed, ${pass} passed` : `✓ all ${pass} calendar tests passed`);
process.exit(failed ? 1 : 0);
