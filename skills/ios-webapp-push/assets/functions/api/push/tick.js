// POST /api/push/tick — the minute tick (push-cron/worker.js calls it every minute with the header X-Push-Tick).
// The sign-in gate (functions/_middleware.js, its MACHINE entry with tickAllowed) lets it past only with that header; it is
// checked again here.
import { json, fail } from "../../../lib/gcal.js";
import { tickAllowed, tick } from "../../../lib/push.js";

export async function onRequestPost({ request, env }) {
  try {
    if (!(await tickAllowed(env, request))) return json({ error: "forbidden" }, 403);
    return json(await tick(env));
  } catch (e) {
    return fail(e);
  }
}
