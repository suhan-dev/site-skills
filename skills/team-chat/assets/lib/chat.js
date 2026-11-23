// The team chat and page comments (functions/api/messages.js uses this).
//
// One D1 table, chat_messages, in the database bound as DB. It is created on first use.
// The author is the signed-in member (lib/auth.js). Nobody types a name, and no email address is stored or sent.
//
// rev is a change counter for the whole table. Each insert and each delete takes MAX(rev) + 1 inside the same single
// statement, so D1 (one writer at a time) never gives two changes the same rev. A page polls with ?since=REV and gets
// every row changed after REV: new messages, and deleted ones as { id, rev, deleted: true }.
// A delete is soft: the row stays as a marker with deleted = 1 and its words cleared (text, quote, prefix, suffix, title).
//
// "Characters" here are Unicode code points, so a cut never splits an emoji in half.

export const MAX_TEXT = 4000;
export const RECENT = 500; // GET without since: the newest this many messages that are not deleted
export const SINCE_MAX = 1000; // GET with since: at most this many changed rows
// the other fields are cut to these lengths, not refused
export const LIMITS = { quote: 2000, title: 300, page: 200, anchor: 200, prefix: 80, suffix: 80 };

const COLS = "id, rev, ts, member, text, page, title, anchor, quote, prefix, suffix, deleted";
const NEXT_REV = "(SELECT COALESCE(MAX(rev), 0) + 1 FROM chat_messages)";
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, rev INTEGER NOT NULL,
    ts INTEGER NOT NULL, member TEXT NOT NULL, text TEXT NOT NULL, page TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '', anchor TEXT NOT NULL DEFAULT '', quote TEXT NOT NULL DEFAULT '',
    prefix TEXT NOT NULL DEFAULT '', suffix TEXT NOT NULL DEFAULT '', deleted INTEGER NOT NULL DEFAULT 0)`,
  "CREATE INDEX IF NOT EXISTS chat_messages_rev ON chat_messages (rev)",
];

// the tables once per isolate (and again for another DB, or after a failure)
let made = null;
async function db(env) {
  if (!made || made.db !== env.DB) {
    const d = env.DB;
    const m = { db: d, p: d.batch(SCHEMA.map((s) => d.prepare(s))) };
    m.p.catch(() => { if (made === m) made = null; });
    made = m;
  }
  await made.p;
  return env.DB;
}

/* ---------- fields ---------- */

// control characters (C0, DEL, C1) except new line and tab
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

/** Any value → a string without control characters (a non-string is ""). */
export function clean(v) {
  return typeof v === "string" ? v.replace(CONTROL, "") : "";
}

// n code points take at most 2n UTF-16 units, so the cheap slice first keeps Array.from small on a huge input
/** The first n characters. */
export function keepStart(s, n) {
  if (s.length <= n) return s;
  return Array.from(s.slice(0, 2 * n)).slice(0, n).join("");
}
/** The last n characters. */
export function keepEnd(s, n) {
  if (s.length <= n) return s;
  const a = Array.from(s.slice(-2 * n));
  return a.slice(Math.max(0, a.length - n)).join("");
}

/**
 * A posted body → { msg } ready to store, or { error } (the text is empty or too long).
 * text is trimmed; the other fields are cut. prefix keeps its end and suffix its start: they are the words just
 * before and just after a quote. Unknown fields are ignored.
 */
export function readMessage(b) {
  const text = clean(b.text).trim();
  if (!text) return { error: "The message is empty." };
  if (keepStart(text, MAX_TEXT) !== text) return { error: `The message is longer than ${MAX_TEXT} characters.` };
  return {
    msg: {
      text,
      page: keepStart(clean(b.page), LIMITS.page),
      title: keepStart(clean(b.title), LIMITS.title),
      anchor: keepStart(clean(b.anchor), LIMITS.anchor),
      quote: keepStart(clean(b.quote), LIMITS.quote),
      prefix: keepEnd(clean(b.prefix), LIMITS.prefix),
      suffix: keepStart(clean(b.suffix), LIMITS.suffix),
    },
  };
}

/* ---------- rows → answers ---------- */
const str = (v) => (v == null ? "" : String(v));

/** A stored row → Msg, or Gone for a deleted one. */
export function shape(r) {
  if (Number(r.deleted)) return { id: Number(r.id), rev: Number(r.rev), deleted: true };
  return {
    id: Number(r.id), rev: Number(r.rev), ts: Number(r.ts), member: str(r.member), text: str(r.text),
    page: str(r.page), title: str(r.title), anchor: str(r.anchor), quote: str(r.quote), prefix: str(r.prefix), suffix: str(r.suffix),
  };
}

const maxRev = (d) => d.prepare("SELECT COALESCE(MAX(rev), 0) AS rev FROM chat_messages");

/** { messages, rev }: the newest RECENT messages that are not deleted, oldest first; rev is the highest in the table. */
export async function recent(env) {
  const d = await db(env);
  // one batch is one transaction, so the rows and rev agree
  const [rows, top] = await d.batch([
    d.prepare(`SELECT ${COLS} FROM chat_messages WHERE deleted = 0 ORDER BY id DESC LIMIT ?`).bind(RECENT),
    maxRev(d),
  ]);
  return { messages: rows.results.reverse().map(shape), rev: Number(top.results[0].rev) };
}

/**
 * { messages, rev }: every row with rev > since, by rev, at most SINCE_MAX; deleted rows as Gone.
 * rev is the highest in the table. When the answer is cut at SINCE_MAX rows, it is the last row's rev instead, so the
 * next poll with since = rev picks up where this one stopped and nothing is skipped.
 */
export async function since(env, after) {
  const d = await db(env);
  const [rows, top] = await d.batch([
    d.prepare(`SELECT ${COLS} FROM chat_messages WHERE rev > ? ORDER BY rev LIMIT ?`).bind(after, SINCE_MAX),
    maxRev(d),
  ]);
  const list = rows.results;
  const rev = list.length >= SINCE_MAX ? Number(list[list.length - 1].rev) : Number(top.results[0].rev);
  return { messages: list.map(shape), rev };
}

/** Store a message from readMessage → Msg as stored. */
export async function add(env, member, msg, now = Date.now()) {
  const d = await db(env);
  const row = await d.prepare(
    `INSERT INTO chat_messages (rev, ts, member, text, page, title, anchor, quote, prefix, suffix)
     VALUES (${NEXT_REV}, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${COLS}`
  ).bind(now, member, msg.text, msg.page, msg.title, msg.anchor, msg.quote, msg.prefix, msg.suffix).first();
  return shape(row);
}

/** Delete the member's own message → { rev } or { error: "none" | "owner" }. */
export async function remove(env, member, id) {
  const d = await db(env);
  const row = await d.prepare(
    `UPDATE chat_messages SET deleted = 1, text = '', quote = '', prefix = '', suffix = '', title = '', rev = ${NEXT_REV}
     WHERE id = ? AND member = ? AND deleted = 0 RETURNING rev`
  ).bind(id, member).first();
  if (row) return { rev: Number(row.rev) };
  const was = await d.prepare("SELECT deleted FROM chat_messages WHERE id = ?").bind(id).first();
  return { error: !was || Number(was.deleted) ? "none" : "owner" };
}
