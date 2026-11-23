// GET /api/me → { auth: "google", member, seen }: the member signed in with Google (lib/auth.js). Without one (which the
// gate in functions/_middleware.js never lets through, except on a misconfigured route) { auth: "none", member: "",
// seen: null }. The page uses it to know who is here. No address is ever sent.
// seen: what this member has already been shown once, e.g. { install: false, guide: true }, or null when D1 can't say
// (then the page shows nothing once-only).
// POST /api/me { seen: "guide" } records it (only names listed in ONCE in lib/auth.js).
import { seenFor, markSeen } from "../../lib/auth.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export async function onRequestGet({ env, data }) {
  const u = data && data.user;
  const seen = u && env && env.DB ? await seenFor(env, u.member).catch(() => null) : null;
  return json({ auth: u ? "google" : "none", member: u ? u.member : "", seen });
}

export async function onRequestPost({ request, env, data }) {
  const u = data && data.user;
  if (!u) return json({ error: "auth", message: "Please sign in again." }, 401);
  if (!env || !env.DB) return json({ error: "db", message: "No database." }, 503);
  let body = null;
  try { body = await request.json(); } catch (e) { /* not JSON */ }
  const what = body && typeof body.seen === "string" ? body.seen : "";
  if (!(await markSeen(env, u.member, what))) return json({ error: "bad", message: "Unknown item." }, 400);
  return json({ ok: true, seen: await seenFor(env, u.member) });
}
