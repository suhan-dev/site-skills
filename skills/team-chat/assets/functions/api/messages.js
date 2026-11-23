// The team chat and page comments. Storage and field rules: lib/chat.js.
//   GET    /api/messages            → { messages: [Msg], rev, me }  the newest 500 messages (not deleted), oldest first
//   GET    /api/messages?since=REV  → { messages: [Msg | Gone], rev, me }  every row with rev > REV, by rev (1000 at most)
//   POST   /api/messages  { text, page?, title?, anchor?, quote?, prefix?, suffix? } → 201 { message: Msg, rev }
//   DELETE /api/messages?id=ID      → { deleted: ID, rev }  only the author; 403 "owner" otherwise, 404 "none" if gone
//   Msg  = { id, rev, ts, member, text, page, title, anchor, quote, prefix, suffix }   Gone = { id, rev, deleted: true }
//   rev  = the highest rev in the table (0 when empty); me = the signed-in member.
//          A since answer cut at 1000 rows gives the last row's rev instead, so polling with since = rev skips nothing.
// The author is the signed-in member (functions/_middleware.js puts it on data.user). Names typed by the page are not
// read, and no email address is stored or sent. Behind the sign-in like every other API; the middleware also refuses
// writes from another origin. Answers are never cached.
import { readMessage, recent, since, add, remove } from "../../lib/chat.js";

// JSON answer, never cached
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const err = (status, error, message) => json({ error, message }, status);
// a whole number written in digits, or null
function count(v) {
  if (v == null || !/^\d+$/.test(v)) return null;
  return Math.min(Number(v), Number.MAX_SAFE_INTEGER);
}

export async function onRequest({ request, env, data }) {
  const user = data && data.user;
  if (!user || !user.member) return err(401, "auth", "Please sign in again.");
  if (!env || !env.DB) return err(503, "db", "No database.");
  const url = new URL(request.url);
  const me = user.member;
  try {
    if (request.method === "GET") {
      const after = count(url.searchParams.get("since"));
      const out = after == null ? await recent(env) : await since(env, after);
      return json({ messages: out.messages, rev: out.rev, me });
    }

    if (request.method === "POST") {
      const b = await request.json().catch(() => null);
      if (!b || typeof b !== "object" || Array.isArray(b)) return err(400, "json", "A JSON body is required.");
      const r = readMessage(b);
      if (r.error) return err(400, "text", r.error);
      const message = await add(env, me, r.msg);
      return json({ message, rev: message.rev }, 201);
    }

    if (request.method === "DELETE") {
      const id = count(url.searchParams.get("id"));
      const r = id ? await remove(env, me, id) : { error: "none" };
      if (r.error === "owner") return err(403, "owner", "Only the author can delete this message.");
      if (r.error) return err(404, "none", "No such message.");
      return json({ deleted: id, rev: r.rev });
    }
  } catch (e) {
    console.warn("chat", e && e.message);
    return err(500, "server", "The database didn't answer. Try again.");
  }

  const res = err(405, "method", "Use GET, POST or DELETE.");
  res.headers.set("Allow", "GET, POST, DELETE");
  return res;
}
