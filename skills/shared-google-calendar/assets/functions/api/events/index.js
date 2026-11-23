// GET  /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD   the events in that range (dates and times in the team's zone)
// POST /api/events  {title, allDay, start, end, startTime, endTime, location, memo, owner, colorId, who}
//   "added by" comes from the signed-in session (context.data.user.member, set by the sign-in middleware);
//   the `who` the page sends is used only when there is no session (local runs without sign-in).
import { json, fail, requireConfigured, gcal, calPath, fromGoogle, toGoogle, listRange, ApiError } from "../../../lib/gcal.js";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const whoFrom = (data, b) => (data && data.user ? data.user.member : b.who);

export async function onRequestGet({ request, env }) {
  try {
    requireConfigured(env);
    const u = new URL(request.url);
    const from = u.searchParams.get("from") || "", to = u.searchParams.get("to") || "";
    if (!YMD.test(from) || !YMD.test(to) || to < from) throw new ApiError(400, "range", "Give from and to as YYYY-MM-DD.");
    if ((new Date(to) - new Date(from)) / 864e5 > 400) throw new ApiError(400, "range", "At most 400 days per request.");
    const items = await listRange(env, from, to);
    return json({ events: items.map(fromGoogle), now: Date.now() });
  } catch (e) {
    return fail(e);
  }
}

export async function onRequestPost({ request, env, data /*, waitUntil */ }) {
  try {
    requireConfigured(env);
    const b = await request.json().catch(() => null);
    if (!b) throw new ApiError(400, "json", "A JSON body is required.");
    const ev = await gcal(env, calPath(env, "/events"), { method: "POST", body: JSON.stringify(toGoogle(b, { who: whoFrom(data, b) })) });
    // With the ios-webapp-push skill: tell everyone else's installed app, after the answer is sent
    //   import { notifyCreated } from "../../../lib/push.js";
    //   if (env.DB) waitUntil(notifyCreated(env, ev).catch((e) => console.warn("push", e && e.message)));
    return json({ event: fromGoogle(ev) }, 201);
  } catch (e) {
    return fail(e);
  }
}
