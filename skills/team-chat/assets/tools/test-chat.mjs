// Tests for the team chat (lib/chat.js, functions/api/messages.js, and the sign-in gate in front of it when present).
//   node tools/test-chat.mjs        (from the folder that holds functions/ and lib/)
// Runs offline: D1 is SQLite in memory (node:sqlite, Node 22.13+). The members and the address are made up.
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";

const api = await import("../functions/api/messages.js");
const chat = await import("../lib/chat.js");
// The gate comes from google-signin-team-gate; section 10 is skipped when it is not there yet.
const gate = await import("../functions/_middleware.js").catch(() => null);

let pass = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); pass++; console.log("  ✓ " + msg); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); pass++; console.log("  ✓ " + msg); };
const section = (s) => console.log("\n" + s);

/* ---------- D1 on SQLite (same shim as test-push.mjs) ---------- */
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

/* ---------- calling the endpoint ---------- */
const ORIGIN = "https://example-lab.pages.dev";
const EMAIL = "made-up-member@example.edu"; // must never come back or be stored
const user = (member) => ({ email: EMAIL, member });
const seen = []; // every answer body, to look for the address at the end
async function call(env, method, path, { member = "alex", body, raw } = {}) {
  const init = { method, headers: {} };
  if (raw !== undefined) init.body = raw;
  else if (body !== undefined) { init.body = JSON.stringify(body); init.headers["Content-Type"] = "application/json"; }
  const res = await api.onRequest({ request: new Request(ORIGIN + path, init), env, data: member ? { user: user(member) } : {} });
  const text = await res.text();
  seen.push(text);
  return { status: res.status, j: JSON.parse(text), h: res.headers };
}
const post = (env, body, member) => call(env, "POST", "/api/messages", { body, member });
const del = (env, id, member) => call(env, "DELETE", "/api/messages?id=" + id, { member });
const list = (env, q = "", member) => call(env, "GET", "/api/messages" + q, { member });
const MSG_KEYS = ["id", "rev", "ts", "member", "text", "page", "title", "anchor", "quote", "prefix", "suffix"];

/* ---------- 1. who may ask ---------- */
section("Sign-in and database");
let env = { DB: new D1() };
for (const m of ["GET", "POST", "DELETE"]) {
  const r = await call(env, m, "/api/messages?id=1", { member: "", body: m === "POST" ? { text: "hi" } : undefined });
  eq([r.status, r.j.error, typeof r.j.message], [401, "auth", "string"], `${m} without a signed-in member → 401 auth`);
}
eq(env.DB.rows("SELECT name FROM sqlite_master WHERE name = 'chat_messages'").length, 0, "nothing is created for a request that isn't signed in");
let r = await call({}, "GET", "/api/messages");
eq([r.status, r.j.error], [503, "db"], "no D1 binding → 503 db");
r = await call({}, "POST", "/api/messages", { body: { text: "hi" } });
eq([r.status, r.j.error], [503, "db"], "POST without D1 → 503 db too");
r = await call(env, "PUT", "/api/messages", { body: { text: "hi" } });
eq([r.status, r.j.error, r.h.get("Allow")], [405, "method", "GET, POST, DELETE"], "PUT → 405 method, with Allow");

/* ---------- 2. post and read ---------- */
section("Post and read");
r = await list(env);
eq(r.j, { messages: [], rev: 0, me: "alex" }, "an empty table: no messages, rev 0, me = the signed-in member");
eq(r.h.get("Cache-Control"), "no-store", "answers are not cached");
ok(/^application\/json/.test(r.h.get("Content-Type")), "answers are JSON");
const before = Date.now();
r = await post(env, { text: "  Hello team  ", member: "casey", name: "Someone", email: "other@example.com", id: 99, rev: 99, ts: 1, deleted: 1 });
eq(r.status, 201, "POST → 201");
const m1 = r.j.message;
eq(Object.keys(m1), MSG_KEYS, "the message has exactly the Msg fields, in order");
eq([m1.member, m1.text, m1.page, m1.quote], ["alex", "Hello team", "", ""], "member comes from the sign-in (not the body), text is trimmed, empty fields are \"\"");
ok(m1.id !== 99 && m1.rev === 1 && r.j.rev === 1, "id, rev and deleted in the body are ignored; the first rev is 1");
ok(typeof m1.ts === "number" && m1.ts >= before && m1.ts <= Date.now(), "ts is the time in ms");
r = await post(env, { text: "On this paragraph", page: "/theory/basics/a1-sample-chapter", title: "A1 Sample chapter", anchor: "sec-2", quote: "the second sample sentence", prefix: "Here is ", suffix: " of the chapter" }, "blair");
const m2 = r.j.message;
eq([m2.member, m2.page, m2.title, m2.anchor, m2.quote, m2.prefix, m2.suffix],
  ["blair", "/theory/basics/a1-sample-chapter", "A1 Sample chapter", "sec-2", "the second sample sentence", "Here is ", " of the chapter"],
  "a comment keeps its page, title, anchor, quote, prefix and suffix (prefix and suffix untrimmed)");
r = await list(env, "", "casey");
eq(r.j.messages.map((m) => m.id), [m1.id, m2.id], "GET returns both, oldest first");
eq([r.j.rev, r.j.me], [2, "casey"], "rev is the highest rev; me is whoever asks");
eq(r.j.messages[0], m1, "GET returns the same Msg as POST did");

/* ---------- 3. text rules ---------- */
section("Text rules");
for (const [what, body] of [["empty text", { text: "" }], ["spaces and new lines only", { text: " \n\t " }], ["control characters only", { text: "\u0000\u0007\u001b" }],
  ["no text", { page: "/x" }], ["text that isn't a string", { text: 42 }]]) {
  r = await post(env, body);
  eq([r.status, r.j.error], [400, "text"], `${what} → 400 text`);
}
r = await post(env, { text: "x".repeat(4001) });
eq([r.status, r.j.error], [400, "text"], "4001 characters → 400 text");
r = await post(env, { text: "x".repeat(4000) });
eq([r.status, r.j.message.text.length], [201, 4000], "exactly 4000 characters is fine");
r = await post(env, { text: "😀".repeat(4000) });
eq([r.status, [...r.j.message.text].length], [201, 4000], "4000 emoji count as 4000 characters (code points)");
r = await post(env, { text: "😀".repeat(4001) });
eq(r.status, 400, "4001 emoji are too long");
r = await post(env, { text: "  " + "x".repeat(4000) + "\n\n" });
eq(r.status, 201, "the limit counts after trimming");
for (const [what, raw] of [["not JSON", "hello"], ["empty body", ""], ["JSON null", "null"], ["a JSON array", "[1,2]"], ["a JSON string", '"hi"']]) {
  r = await call(env, "POST", "/api/messages", { raw });
  eq([r.status, r.j.error], [400, "json"], `${what} → 400 json`);
}

/* ---------- 4. cutting and cleaning ---------- */
section("Cutting and control characters");
const longPrefix = "a".repeat(100) + "…the words just before";
const longSuffix = "the words just after…" + "z".repeat(100);
r = await post(env, {
  text: "cut", quote: "q".repeat(2500), title: "t".repeat(400), page: "p".repeat(250), anchor: "n".repeat(250), prefix: longPrefix, suffix: longSuffix,
});
let m = r.j.message;
eq([r.status, m.quote.length, m.title.length, m.page.length, m.anchor.length, m.prefix.length, m.suffix.length], [201, 2000, 300, 200, 200, 80, 80],
  "long fields are cut, not refused: quote 2000, title 300, page and anchor 200, prefix and suffix 80");
eq([m.prefix, m.suffix], [longPrefix.slice(-80), longSuffix.slice(0, 80)], "prefix keeps its end, suffix keeps its start");
ok(m.prefix.endsWith("the words just before") && m.suffix.startsWith("the words just after"), "so both still touch the quote");
r = await post(env, { text: "emoji", prefix: "x" + "😀".repeat(80), suffix: "😀".repeat(80) + "x", quote: "😀".repeat(2001) });
m = r.j.message;
eq([[...m.prefix].length, [...m.suffix].length, [...m.quote].length], [80, 80, 2000], "cuts count code points");
ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(m.prefix + m.suffix + m.quote), "and never split an emoji");
r = await post(env, {
  text: "a\u0000b\u0007c\r\nd\te\u001b[0m\u007f\u0085\u009f!",
  title: "Ti\u0000tle\n", page: "/p\u0008age", anchor: "an\u001fchor", quote: "q\u0001uo\tte", prefix: "pre\u000bfix", suffix: "suf\u000cfix",
});
m = r.j.message;
eq([m.text, m.title, m.page, m.anchor, m.quote, m.prefix, m.suffix], ["abc\nd\te[0m!", "Title\n", "/page", "anchor", "quo\tte", "prefix", "suffix"],
  "control characters are stripped from every field; new lines and tabs stay");
r = await post(env, { text: "types", page: 5, title: { x: 1 }, quote: ["a"], prefix: null, suffix: true });
m = r.j.message;
eq([m.page, m.title, m.quote, m.prefix, m.suffix], ["", "", "", "", ""], "fields that aren't strings are stored as \"\"");
const stored = env.DB.rows(`SELECT * FROM chat_messages WHERE id = ${m.id}`)[0];
ok(Object.entries(stored).every(([k, v]) => v !== null), "no NULL in the stored row");

/* ---------- 5. delete ---------- */
section("Delete");
r = await list(env);
const revBeforeDelete = r.j.rev;
r = await del(env, m1.id, "blair");
eq([r.status, r.j.error], [403, "owner"], "someone else's message → 403 owner");
eq(env.DB.rows(`SELECT deleted, text FROM chat_messages WHERE id = ${m1.id}`)[0], { deleted: 0, text: "Hello team" }, "and it is untouched");
r = await del(env, m2.id, "blair");
eq([r.status, r.j.deleted], [200, m2.id], "the author deletes their own → { deleted: id }");
eq(r.j.rev, revBeforeDelete + 1, "a delete takes the next rev");
const row2 = env.DB.rows(`SELECT * FROM chat_messages WHERE id = ${m2.id}`)[0];
eq([row2.deleted, row2.rev, row2.text, row2.quote, row2.prefix, row2.suffix, row2.title], [1, r.j.rev, "", "", "", "", ""],
  "soft delete: the row stays with deleted = 1, a new rev, and its words cleared");
r = await del(env, m2.id, "blair");
eq([r.status, r.j.error], [404, "none"], "deleting it again → 404 none");
r = await del(env, m2.id, "alex");
eq([r.status, r.j.error], [404, "none"], "someone else deleting a deleted message → 404 none");
for (const id of ["999999", "0", "abc", "-1", ""]) {
  r = await del(env, id);
  eq([r.status, r.j.error], [404, "none"], `id=${JSON.stringify(id)} → 404 none`);
}
r = await call(env, "DELETE", "/api/messages");
eq([r.status, r.j.error], [404, "none"], "no id → 404 none");
r = await list(env);
ok(!r.j.messages.some((x) => x.id === m2.id), "GET without since leaves the deleted message out");
ok(r.j.messages.every((x) => !("deleted" in x)), "and holds only Msg rows");

/* ---------- 6. since ---------- */
section("Polling with since");
const R0 = r.j.rev;
r = await list(env, "?since=" + R0);
eq(r.j, { messages: [], rev: R0, me: "alex" }, "nothing changed → no rows, the same rev");
const a = (await post(env, { text: "new one" })).j.message;
const b2 = (await post(env, { text: "new two" }, "casey")).j.message;
r = await list(env, "?since=" + R0);
eq(r.j.messages, [a, b2], "since returns the new messages in rev order");
eq(r.j.rev, b2.rev, "and rev = the newest rev");
const d1 = (await del(env, a.id)).j;
r = await list(env, "?since=" + b2.rev);
eq(r.j.messages, [{ id: a.id, rev: d1.rev, deleted: true }], "after a delete, since returns it as Gone { id, rev, deleted: true }");
r = await list(env, "?since=" + R0);
eq(r.j.messages.map((x) => [x.id, !!x.deleted]), [[b2.id, false], [a.id, true]], "from further back: the live one, then the deleted one at its new rev");
r = await list(env, "?since=0");
eq(r.j.messages.length, env.DB.rows("SELECT count(*) n FROM chat_messages")[0].n, "since=0 returns every row, deleted ones too");
ok(r.j.messages.every((x, i, all) => i === 0 || all[i - 1].rev < x.rev), "in strictly increasing rev order");
r = await list(env, "?since=99999999");
eq([r.j.messages.length, r.j.rev], [0, d1.rev], "a since past the end → no rows and the real rev (a reset table is noticed)");
for (const q of ["?since=", "?since=abc", "?since=-3"]) {
  r = await list(env, q);
  ok(r.j.messages.every((x) => !x.deleted) && r.j.rev === d1.rev, `${q} is not a number: the plain list`);
}

/* ---------- 7. rev ---------- */
section("rev");
const revs = env.DB.rows("SELECT rev FROM chat_messages ORDER BY rev").map((x) => x.rev);
eq(new Set(revs).size, revs.length, "no two rows share a rev");
ok(revs[revs.length - 1] === d1.rev, "the last change holds the highest rev");
let last = d1.rev;
for (let i = 0; i < 5; i++) {
  const p = await post(env, { text: "tick " + i });
  ok(p.j.rev === last + 1 && p.j.message.rev === p.j.rev, `post ${i + 1}: rev ${p.j.rev} = previous + 1, the same in message and answer`);
  last = p.j.rev;
}

/* ---------- 8. 500 newest, 1000 per poll ---------- */
section("Many messages");
env = { DB: new D1() };
for (let i = 1; i <= 1200; i++) await chat.add(env, i % 2 ? "alex" : "casey", { text: "m" + i, page: "", title: "", anchor: "", quote: "", prefix: "", suffix: "" }, 1_700_000_000_000 + i);
await del(env, 1200, "casey");
await del(env, 1199, "alex");
await del(env, 5, "alex");
r = await list(env);
eq(r.j.messages.length, 500, "GET without since returns 500 messages");
eq([r.j.messages[0].text, r.j.messages[499].text], ["m699", "m1198"], "the newest 500 that are not deleted (m699 … m1198), oldest first");
ok(r.j.messages.every((x, i, all) => i === 0 || all[i - 1].id < x.id), "in ascending order");
eq(r.j.rev, 1203, "rev = 1200 posts + 3 deletes");
r = await list(env, "?since=0");
eq([r.j.messages.length, r.j.messages[0].rev, r.j.messages[999].rev], [1000, 1, 1001], "since=0 returns 1000 rows at most, from the start");
ok(!r.j.messages.some((x) => x.id === 5), "m5 was deleted last, so it is not at its old rev 5: a row shows once, at its newest rev");
eq(r.j.rev, r.j.messages[999].rev, "cut at 1000 rows: rev is the last row's, so the next poll goes on from there");
const r2 = await list(env, "?since=" + r.j.rev);
eq([r2.j.messages.length, r2.j.rev], [200, 1203], "the next poll gets the remaining 200 changes and the real rev");
eq(r2.j.messages.slice(-3).map((x) => [x.id, x.deleted || false]), [[1200, true], [1199, true], [5, true]], "ending with the three deletes");
const both = [...r.j.messages, ...r2.j.messages];
eq([both.length, new Set(both.map((x) => x.id)).size], [1200, 1200], "together the two polls name every row exactly once");
eq(both.find((x) => x.id === 5), { id: 5, rev: 1203, deleted: true }, "m5 among them as Gone at rev 1203");

/* ---------- 9. the table is made once, and again after a failure ---------- */
section("Table setup");
class FlakyD1 extends D1 {
  constructor() { super(); this.fails = 1; this.batches = 0; }
  async batch(list) { this.batches++; if (this.fails > 0) { this.fails--; throw new Error("D1 is busy"); } return super.batch(list); }
}
env = { DB: new FlakyD1() };
const warn = console.warn;
console.warn = () => {}; // the endpoint logs the failure; keep the output clean
r = await list(env);
console.warn = warn;
eq([r.status, r.j.error], [500, "server"], "a database error → 500 server");
r = await list(env);
eq([r.status, r.j.rev], [200, 0], "the next request makes the table and works");
const n = env.DB.batches;
await post(env, { text: "x" }); await list(env); await list(env, "?since=0");
eq(env.DB.batches - n, 2, "later requests don't create the table again (only the two GETs batch)");
eq(env.DB.rows("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'chat_messages' AND name NOT LIKE 'sqlite_%'").map((x) => x.name), ["chat_messages_rev"], "rev has its index");

/* ---------- 10. through the gate ---------- */
const local = { DB: new D1(), DEV_MEMBER: "alex" };
if (!gate) {
  section("Through the gate: skipped (no functions/_middleware.js yet; add google-signin-team-gate)");
  await local.DB.prepare("SELECT 1").first();
  await chat.add(local, "alex", { text: "local", page: "", title: "", anchor: "", quote: "", prefix: "", suffix: "" }, Date.now());
} else {
  section("Through the gate (functions/_middleware.js)");
  async function viaGate(genv, url, init = {}) {
    const ctx = { request: new Request(url, init), env: genv, data: {} };
    ctx.next = () => api.onRequest(ctx);
    const res = await gate.onRequest(ctx);
    const text = await res.text();
    seen.push(text);
    let j = null;
    try { j = JSON.parse(text); } catch (e) { /* not JSON */ }
    return { status: res.status, j };
  }
  let g = await viaGate(local, "http://localhost:8788/api/messages", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:8788" }, body: JSON.stringify({ text: "local" }) });
  eq([g.status, g.j.message.member], [201, "alex"], "locally with DEV_MEMBER=alex, a post is by alex");
  g = await viaGate(local, "http://localhost:8788/api/messages");
  eq([g.status, g.j.me, g.j.messages.length], [200, "alex", 1], "and GET answers with me = alex");
  g = await viaGate(local, "http://localhost:8788/api/messages?id=1", { method: "DELETE", headers: { Origin: "https://evil.example" } });
  eq([g.status, g.j.error], [403, "origin"], "a delete from another origin is refused by the gate");
  eq(local.DB.rows("SELECT deleted FROM chat_messages")[0].deleted, 0, "and nothing is deleted");
  const live = { DB: new D1(), GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com", DEV_MEMBER: "alex" };
  g = await viaGate(live, ORIGIN + "/api/messages");
  eq([g.status, g.j.error], [401, "auth"], "on the live address (DEV_MEMBER ignored) without a session → 401 from the gate");
}

/* ---------- 11. no address anywhere ---------- */
section("No email address");
ok(seen.length > 50 && seen.every((t) => !t.includes(EMAIL) && !t.includes("@")), `none of the ${seen.length} answers holds an email address`);
const tableCols = local.DB.rows("PRAGMA table_info(chat_messages)").map((c) => c.name);
eq(tableCols, ["id", "rev", "ts", "member", "text", "page", "title", "anchor", "quote", "prefix", "suffix", "deleted"], "the table has no email column");

console.log(`\n${pass} checks passed`);
