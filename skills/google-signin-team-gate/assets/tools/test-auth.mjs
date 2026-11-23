// Tests for Google sign-in (lib/auth.js, the gate in functions/_middleware.js, and functions/api/me.js).
//   node tools/test-auth.mjs        (from the folder that holds lib/ and functions/; Node 22.13+)
// Runs offline: Google's key list is a fake one made here (fetch is stubbed), D1 is SQLite in memory (node:sqlite),
// and the addresses are made up. Every token is a real RS256 JWT signed with the fake key.
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";

const auth = await import("../lib/auth.js");
const gate = await import("../functions/_middleware.js");
const me = await import("../functions/api/me.js");

let pass = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); pass++; console.log("  ✓ " + msg); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); pass++; console.log("  ✓ " + msg); };
const section = (s) => console.log("\n" + s);
const enc = new TextEncoder();

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

/* ---------- the fake Google: an RSA key, its JWKS, signed ID tokens ---------- */
const b64u = (u8) => Buffer.from(u8).toString("base64url");
const rsa = () => crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pair = await rsa();
const other = await rsa();
const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
let certCalls = 0;
globalThis.fetch = async (url) => {
  if (String(url) === "https://www.googleapis.com/oauth2/v3/certs") {
    certCalls++;
    return new Response(JSON.stringify({ keys: [{ kty: "RSA", alg: "RS256", use: "sig", kid: "k1", n: jwk.n, e: jwk.e }] }),
      { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=20000" } });
  }
  throw new Error("unexpected fetch " + url);
};
const CID = "test-client.apps.googleusercontent.com";
let NOW = Date.parse("2026-12-21T09:00:00+09:00");
const realNow = Date.now;
Date.now = () => NOW;
async function idToken(over = {}, { key = pair.privateKey, kid = "k1", alg = "RS256" } = {}) {
  const claims = {
    iss: "https://accounts.google.com", aud: CID, sub: "g-200", email: "blair@example.edu", email_verified: true, hd: "example.edu",
    nonce: "n0", iat: Math.floor(NOW / 1000) - 5, exp: Math.floor(NOW / 1000) + 3600, name: "Blair", ...over,
  };
  for (const k of Object.keys(claims)) if (claims[k] === undefined) delete claims[k];
  const head = b64u(enc.encode(JSON.stringify({ alg, kid, typ: "JWT" })));
  const body = b64u(enc.encode(JSON.stringify(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(head + "." + body)));
  return head + "." + body + "." + b64u(sig);
}

// made-up addresses; a real list lives only in Cloudflare
const LIST = "alex@example.edu=alex, blair@example.edu=blair\ncasey@example.edu = casey";
const db = new D1();
const env = { GOOGLE_CLIENT_ID: CID, GOOGLE_HD: "example.edu", ALLOWED_EMAILS: LIST, DB: db };
const html = []; // every HTML page the gate answers, to look for addresses at the end

/* ---------- 1. the allow-list ---------- */
section("Allow-list and settings");
eq([...auth.allowList(env)], [["alex@example.edu", "alex"], ["blair@example.edu", "blair"], ["casey@example.edu", "casey"]],
  "ALLOWED_EMAILS reads address=member, by commas and lines");
eq([...auth.allowList({ ALLOWED_EMAILS: "ALEX@example.edu : ALEX; nobody; =x; casey@example.edu=Casey Smith" })], [["alex@example.edu", "alex"]],
  "case is ignored, \":\" and \";\" work, and malformed entries are skipped");
ok(auth.googleOn(env) && !auth.googleOn({ ...env, GOOGLE_CLIENT_ID: "" }) && !auth.googleOn({ ...env, DB: undefined }),
  "Google sign-in is on only with GOOGLE_CLIENT_ID and DB");
eq(auth.allowedMembers({ ...env, GOOGLE_CLIENT_ID: "" }), null, "with sign-in not set up (local preview) nobody is left out");
eq([...auth.allowedMembers(env)], ["alex", "blair", "casey"], "with it, the members on the list");
eq([auth.hostedDomain(env), auth.hostedDomain({ GOOGLE_HD: " Example.EDU " }), auth.hostedDomain({ GOOGLE_HD: "not a domain" }), auth.hostedDomain({})],
  ["example.edu", "example.edu", "", ""], "GOOGLE_HD is read as a lower-case domain, or nothing");

/* ---------- 2. the ID token ---------- */
section("ID token checks");
const v = (tok, nonce = "n0", e = env) => auth.verifyIdToken(e, tok, nonce);
let r = await v(await idToken());
eq([r.ok, r.member, r.email], [true, "blair", "blair@example.edu"], "a good token from a listed account passes as its member");
eq(certCalls, 1, "Google's keys were fetched once");
await v(await idToken());
eq(certCalls, 1, "and then come from memory");
eq((await v(await idToken({ aud: "someone-else.apps.googleusercontent.com" }))).why, "token", "wrong aud fails");
eq((await v(await idToken({ iss: "https://evil.example.com" }))).why, "token", "wrong iss fails");
eq((await v(await idToken(), "other-nonce")).why, "token", "wrong nonce fails");
eq((await v(await idToken(), "")).why, "token", "no nonce cookie fails");
eq((await v(await idToken({ exp: Math.floor(NOW / 1000) - 120 }))).why, "token", "an expired token fails");
eq((await v(await idToken({ iat: Math.floor(NOW / 1000) + 600 }))).why, "token", "a token from the future fails");
eq((await v(await idToken({}, { key: other.privateKey }))).why, "token", "a token signed with another key fails");
eq((await v(await idToken({}, { kid: "nope" }))).why, "token", "an unknown key id fails");
eq((await v(await idToken({}, { alg: "HS256" }))).why, "token", "another algorithm in the header fails");
eq((await v((await idToken()).split(".").slice(0, 2).join(".") + ".")).why, "token", "a token without a signature fails");
eq((await v("x.y.z")).why, "token", "garbage fails");
{
  const t = await idToken();
  const [h, b, s] = t.split(".");
  const forged = JSON.parse(Buffer.from(b, "base64url").toString());
  forged.email = "alex@example.edu";
  eq((await v(h + "." + b64u(enc.encode(JSON.stringify(forged))) + "." + s)).why, "token", "a token with changed claims fails");
}
eq((await v(await idToken({ email_verified: false }))).why, "verified", "email_verified false fails");
eq((await v(await idToken({ email_verified: "true" }))).why, "verified", "email_verified as a string fails");
eq((await v(await idToken({ email: "blair@example.com", hd: undefined }))).why, "team", "a personal account outside the domain is refused");
eq((await v(await idToken({ hd: "example.org", email: "blair@example.org" }))).why, "team", "another Workspace is refused");
eq((await v(await idToken({ hd: undefined }))).why, "team", "a token without hd is refused");
eq((await v(await idToken({ email: "stranger@example.edu" }))).why, "team", "an account in the domain but not on the list is refused");
eq((await v(await idToken({ email: "BLAIR@example.edu" }))).member, "blair", "addresses compare without case");
for (const [email, member] of [["alex@example.edu", "alex"], ["casey@example.edu", "casey"]]) {
  eq((await v(await idToken({ email, sub: "g-" + member }))).member, member, `${member} gets in as ${member}`);
}
{
  const anyAccount = { ...env, GOOGLE_HD: "", ALLOWED_EMAILS: LIST + ", casey@example.com=casey" };
  eq((await v(await idToken({ email: "casey@example.com", hd: undefined, sub: "g-c2" }), "n0", anyAccount)).member, "casey",
    "without GOOGLE_HD any Google account on the list gets in");
  eq((await v(await idToken({ email: "stranger@example.com", hd: undefined }), "n0", anyAccount)).why, "team", "and the list still decides");
  const u = new URL(auth.googleAuthUrl(anyAccount, "https://example-lab.pages.dev", "abc"));
  ok(!u.searchParams.has("hd"), "and the sign-in address carries no hd");
}

/* ---------- 3. the gate ---------- */
section("Gate with Google sign-in");
const ORIGIN = "https://example-lab.pages.dev";
const jar = new Map();
function setCookies(res) {
  for (const c of res.headers.getSetCookie()) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    const name = kv.slice(0, i), val = kv.slice(i + 1);
    if (/Max-Age=0/.test(c)) jar.delete(name); else jar.set(name, val);
  }
}
const cookieHeader = () => [...jar].map(([k, v2]) => k + "=" + v2).join("; ");
async function call(path, init = {}, e = env) {
  let reached = false, seen = null;
  const headers = new Headers(init.headers || {});
  if (jar.size && !headers.has("Cookie")) headers.set("Cookie", cookieHeader());
  const ctx = { request: new Request(ORIGIN + path, { ...init, headers }), env: e, data: {}, next: async () => { reached = true; seen = ctx.data.user; return new Response("ok"); } };
  const res = await gate.onRequest(ctx);
  setCookies(res);
  const isHtml = (res.headers.get("Content-Type") || "").includes("html");
  const text = isHtml ? await res.text() : "";
  if (isHtml) html.push(text);
  return { reached, user: seen, status: res.status, res, text };
}
const nonceNow = () => decodeURIComponent(jar.get("site_nonce") || "").split("|")[0];
let g = await call("/");
ok(!g.reached && g.status === 200 && g.text.includes(">Sign in with Google<") && !g.text.includes("gsi/client") && !/type="password"/.test(g.text),
  "signed out, \"/\" is the sign-in page with our own button (no Google script) and no password field");
const href = new URL((g.text.match(/id="gbtn" href="([^"]+)"/) || [])[1].replace(/&amp;/g, "&"));
const nonce = nonceNow();
eq([href.origin + href.pathname, ...["client_id", "redirect_uri", "response_type", "response_mode", "scope", "hd", "prompt"].map((k) => href.searchParams.get(k))],
  ["https://accounts.google.com/o/oauth2/v2/auth", CID, ORIGIN + "/__auth/google", "id_token", "form_post", "openid email", "example.edu", "select_account"],
  "the button goes to Google's sign-in: ID token posted back to /__auth/google, the Workspace's accounts only");
ok(/^[a-f0-9]{32}$/.test(nonce) && href.searchParams.get("nonce") === nonce && href.searchParams.get("state") === nonce, "with a fresh nonce, the same one as in its cookie, as nonce and state");
const nc = g.res.headers.get("Set-Cookie");
ok(/Path=\/__auth\/google/.test(nc) && /HttpOnly/.test(nc) && /SameSite=None; Secure/.test(nc) && /Max-Age=600/.test(nc),
  "the nonce cookie is HttpOnly, 10 minutes, only for /__auth/google, and survives Google's cross-site post");
ok(["X-Robots-Tag", "Referrer-Policy", "X-Content-Type-Options", "X-Frame-Options"].every((h) => g.res.headers.get(h)) && g.res.headers.get("Cache-Control") === "no-store",
  "the sign-in page carries the security headers and is never cached");
g = await call("/api/events?from=2026-12-21&to=2026-12-27");
eq([g.reached, g.status, g.res.headers.get("Content-Type").includes("json")], [false, 401, true], "the API answers 401 JSON when signed out");
g = await call("/js/app.js");
eq([g.reached, g.status], [false, 401], "site files need the sign-in too");
const before = jar.get("site_nonce");
await call("/favicon.ico", { headers: { "Sec-Fetch-Dest": "image" } });
await call("/apple-touch-icon-precomposed.png");
eq(jar.get("site_nonce"), before, "the browser's side requests don't reset the nonce the page is waiting with");
await call("/", { headers: { "Sec-Fetch-Dest": "document" } });
eq(jar.get("site_nonce"), before, "a second sign-in tab keeps the same nonce, so both work");
for (const p of ["/manifest.webmanifest", "/sw.js", "/icons/app-192.png", "/assets/og.jpg", "/assets/poster.svg", "/assets/poster-tall.svg", "/robots.txt", "/favicon.svg"]) {
  ok((await call(p)).reached, `${p} stays public`);
}
ok(!(await call("/icons/../secret.png")).reached && !(await call("/assets/other.jpg")).reached, "nothing else under /icons/ or /assets/ is");

// what Google posts back (response_mode=form_post); the browser sends the nonce cookie with it
const post = (fields) => call("/__auth/google", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields).toString() });
const signIn = async (tok, state) => post({ id_token: tok, state: state || nonceNow() });
const TRY = "Couldn&#39;t sign in. Try again.", TEAM = "team only.";
g = await signIn(await idToken({ nonce }), "0".repeat(32));
ok(g.status === 403 && g.text.includes(TRY) && !jar.has("site_sid"), "a post whose state isn't this browser's sign-in is refused");
g = await signIn(await idToken({ nonce: "wrong" }));
ok(g.status === 403 && g.text.includes(TRY), "a token with someone else's nonce asks to try again");
g = await signIn(await idToken({ nonce, email: "stranger@example.edu" }));
ok(g.status === 403 && g.text.includes(TEAM) && g.text.includes(">Sign in with Google<"), "an account not on the list gets the one line, under the button");
ok(!jar.has("site_sid"), "and no session");
g = await post({ error: "access_denied", state: nonce });
ok(g.status === 200 && !g.text.includes(TRY) && g.text.includes(">Sign in with Google<"), "Cancel at Google comes back to the plain sign-in page");
g = await post({ error: "server_error", state: nonce });
ok(g.text.includes(TRY), "another error from Google asks to try again");
g = await call("/__auth/google");
eq([g.status, g.res.headers.get("Location")], [303, ORIGIN + "/"], "a GET on the sign-in return address only goes back to the start");
g = await signIn(await idToken({ nonce }));
eq([g.status, g.res.headers.get("Location")], [303, "/"], "a listed account signs in and goes on");
const sid = jar.get("site_sid");
const sc = g.res.headers.getSetCookie().find((c) => c.startsWith("site_sid="));
ok(/^[a-f0-9]{64}$/.test(sid) && /Max-Age=15552000/.test(sc) && /HttpOnly/.test(sc) && /SameSite=Lax/.test(sc) && /Secure/.test(sc),
  "the session cookie: 64 hex, 180 days, HttpOnly, SameSite=Lax, Secure");
ok(!jar.has("site_nonce"), "the nonce is used up");
eq(db.rows("SELECT count(*) n FROM auth_sessions WHERE token_hash = '" + sid + "'")[0].n, 0, "D1 does not keep the token itself");
eq(db.rows("SELECT count(*) n FROM auth_sessions")[0].n, 1, "only its hash");
g = await call("/");
eq([g.reached, g.user && g.user.member], [true, "blair"], "signed in, the page opens and the functions see the member");
ok(g.res.headers.get("X-Frame-Options") === "SAMEORIGIN" && g.res.headers.get("X-Robots-Tag").includes("noindex"), "signed-in answers carry the security headers too");

section("Who is here (/api/me) and shown once per member");
{
  const user = (member) => ({ data: { user: { email: member + "@example.edu", member } } });
  const j = await (await me.onRequestGet({ env, ...user("blair") })).json();
  eq(j, { auth: "google", member: "blair", seen: { install: false, guide: false } }, "/api/me names the member and never the address");
  ok(!JSON.stringify(j).includes("@"), "and no address anywhere in it");
  eq(await (await me.onRequestGet({ env, data: {} })).json(), { auth: "none", member: "", seen: null }, "/api/me without a member says so");
  const postMe = (member, body) => me.onRequestPost({ env, ...user(member), request: new Request(ORIGIN + "/api/me", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }) });
  const seenOf = async (member, e = env) => (await (await me.onRequestGet({ env: e, ...user(member) })).json()).seen;
  let res = await postMe("alex", { seen: "guide" });
  eq([res.status, (await res.json()).seen], [200, { install: false, guide: true }], "POST { seen: \"guide\" } records it");
  eq(await seenOf("alex"), { install: false, guide: true }, "so the next page load (any device, cleared storage) knows");
  eq([await seenOf("blair"), await seenOf("casey")], [{ install: false, guide: false }, { install: false, guide: false }], "each member on their own");
  res = await postMe("alex", { seen: "guide" });
  eq([res.status, db.rows("SELECT count(*) n FROM member_seen WHERE member = 'alex'")[0].n], [200, 1], "recording it again changes nothing");
  eq((await postMe("casey", { seen: "anything" })).status, 400, "a name not in ONCE is refused");
  eq((await postMe("casey", "nope")).status, 400, "and so is a body that isn't JSON");
  eq(await seenOf("casey"), { install: false, guide: false }, "and records nothing");
  eq((await me.onRequestPost({ env, data: {}, request: new Request(ORIGIN + "/api/me", { method: "POST", body: "{}" }) })).status, 401, "nobody signed in → 401");
  eq((await me.onRequestPost({ env: { ...env, DB: undefined }, ...user("casey"), request: new Request(ORIGIN + "/api/me", { method: "POST", body: "{\"seen\":\"guide\"}" }) })).status, 503, "no database → 503");
  eq(await seenOf("casey", { ...env, DB: undefined }), null, "without D1 the page is told it can't know (and shows nothing)");
  ok(!db.rows("SELECT * FROM member_seen").some((row) => JSON.stringify(row).includes("@")), "D1 keeps the member id, not the address");
}

section("Writes from other sites, machine paths, rewrites");
g = await call("/api/messages?id=1", { method: "DELETE", headers: { Origin: "https://evil.example.com" } });
eq([g.status, g.reached], [403, false], "a write request from another origin is refused (403 origin)");
g = await call("/api/me", { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: "{}" });
ok(g.reached, "the same request from this site goes on");
gate.MACHINE["/api/test/tick"] = { header: "X-Test-Tick", allowed: async (e, req) => req.headers.get("X-Test-Tick") === "right" };
{
  const saved = new Map(jar);
  jar.clear();
  g = await call("/api/test/tick", { method: "POST", headers: { "X-Test-Tick": "right" } });
  ok(g.reached && !g.user, "a machine path passes with its secret header, without a session");
  g = await call("/api/test/tick", { method: "POST", headers: { "X-Test-Tick": "wrong" } });
  eq([g.status, g.reached], [403, false], "with a wrong one it is refused");
  g = await call("/api/test/tick", { method: "POST" });
  eq([g.status, g.reached], [401, false], "and without the header it is an ordinary API path (sign in first)");
  for (const [k, val] of saved) jar.set(k, val);
}
gate.REWRITES.push(async ({ request }) => (new URL(request.url).pathname.startsWith("/theory/") ? new Response("reader page") : null));
g = await call("/theory/heat/h1-heat-flow-in-a-rod");
eq([g.status, g.reached, await g.res.text()], [200, false, "reader page"], "a signed-in rewrite (the lecture reader) answers its addresses");

section("Sessions over time");
g = await signIn(await idToken({ nonce, sub: "g-999" }), nonce);
eq(g.status, 403, "(the nonce is single use: an old one can't be replayed)");
{
  // another device: a fresh sign-in page, then a token for the same address but another Google account
  const saved = jar.get("site_sid");
  jar.delete("site_sid");
  await call("/");
  g = await signIn(await idToken({ nonce: nonceNow(), sub: "g-999" }));
  ok(g.status === 403 && g.text.includes(TEAM), "the address stays pinned to the Google account that first signed in");
  jar.set("site_sid", saved);
}
g = await call("/", {}, { ...env, ALLOWED_EMAILS: LIST.replace("blair@example.edu=blair", "") });
eq([g.reached, g.status], [false, 200], "an address taken off the list is signed out on its next request");
g = await call("/");
ok(g.reached, "put back on the list, the same session works again");
NOW += 181 * 86400e3;
g = await call("/");
ok(!g.reached, "after 180 days the session has ended");
NOW -= 181 * 86400e3;
g = await call("/__logout");
eq([g.status, g.res.headers.get("Location")], [303, "/"], "sign out goes back to the start");
ok(!jar.has("site_sid") && g.res.headers.getSetCookie().some((c) => c.startsWith("site_sid=;") && /Max-Age=0/.test(c)), "and deletes the cookie");
eq(db.rows("SELECT count(*) n FROM auth_sessions")[0].n, 0, "and the session in D1");
jar.set("site_sid", sid);
g = await call("/");
ok(!g.reached, "the old cookie no longer works anywhere");
jar.delete("site_sid");

section("Back where it started (browser and installed app alike)");
await call("/records?week=3");
const n3 = decodeURIComponent(jar.get("site_nonce")).split("|");
eq(n3[1], "/records?week=3", "the nonce cookie remembers where the page was going");
g = await signIn(await idToken({ nonce: n3[0], sub: "g-200" }));
eq([g.status, g.res.headers.get("Location")], [303, "/records?week=3"], "signed in, it goes back there");
jar.delete("site_sid");
await call("/theory/heat/h1-heat-flow-in-a-rod");
g = await signIn(await idToken({ nonce: nonceNow(), sub: "g-200" }));
eq(g.res.headers.get("Location"), "/theory/heat/h1-heat-flow-in-a-rod", "a reader chapter opened signed out comes back to that chapter");
jar.delete("site_sid");
await call("//evil.example.com/x");
g = await signIn(await idToken({ nonce: nonceNow(), sub: "g-200" }));
eq(g.res.headers.get("Location"), "/", "an address that would leave the site (//host) comes back to / instead");
jar.delete("site_sid");
await call("/__debug");
g = await signIn(await idToken({ nonce: nonceNow(), sub: "g-200" }));
eq(g.res.headers.get("Location"), "/", "and so does one of the gate's own addresses");
jar.clear();

section("Without Google sign-in nobody gets in");
const off = { ...env, GOOGLE_CLIENT_ID: "" };
g = await call("/", {}, off);
ok(!g.reached && g.status === 503 && g.text.includes("GOOGLE_CLIENT_ID") && !g.text.includes(">Sign in with Google<") && !/type="password"/.test(g.text),
  "no GOOGLE_CLIENT_ID → a setup message, no button and no password field");
for (const [p, init] of [["/api/events", {}], ["/__auth/google", { method: "POST" }], ["/js/app.js", {}]]) {
  ok(!(await call(p, init, off)).reached, `and ${p} stays shut`);
}
g = await call("/", {}, { ...env, DB: undefined });
ok(!g.reached && g.status === 503, "no DB binding → the same");

section("Local preview (DEV_MEMBER)");
async function local(host, path, e, init = {}) {
  let reached = false, seen = null;
  const ctx = { request: new Request(`http://${host}${path}`, init), env: e, data: {}, next: async () => { reached = true; seen = ctx.data.user; return new Response("ok"); } };
  const res = await gate.onRequest(ctx);
  if ((res.headers.get("Content-Type") || "").includes("html")) html.push(await res.clone().text());
  return { reached, user: seen, status: res.status, res };
}
g = await local("localhost:8788", "/", { ...off, DEV_MEMBER: "casey" });
eq([g.reached, g.user && g.user.member], [true, "casey"], "on localhost DEV_MEMBER signs in as that member, without Google");
g = await local("127.0.0.1:8788", "/api/events", { ...env, DEV_MEMBER: "alex" });
eq([g.reached, g.user && g.user.member], [true, "alex"], "127.0.0.1 too, and the functions see the member");
g = await local("localhost:8788", "/api/messages?id=1", { ...off, DEV_MEMBER: "alex" }, { method: "DELETE", headers: { Origin: "https://evil.example" } });
eq([g.status, g.reached], [403, false], "the origin check still applies locally");
g = await local("example-lab.pages.dev", "/", { ...env, DEV_MEMBER: "alex" });
ok(!g.reached && g.status === 200 && !g.user, "on the live address DEV_MEMBER does nothing: the sign-in page");
g = await local("localhost:8788", "/", { ...off, DEV_MEMBER: "x y" });
ok(!g.reached && g.status === 503, "a malformed DEV_MEMBER is ignored");
g = await local("localhost:8788", "/", env);
ok(!g.reached && /SameSite=None; Secure/.test(g.res.headers.get("Set-Cookie")), "without it localhost needs Google like the live site (nonce cookie works there too)");

section("No address on any page");
ok(html.length > 15 && html.every((t) => !/[a-z0-9._-]+@example\.(edu|com|org)/i.test(t)), `none of the ${html.length} pages holds an address`);

Date.now = realNow;
console.log(`\n${pass} checks passed`);
