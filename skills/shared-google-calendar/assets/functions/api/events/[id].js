// GET    /api/events/:id
// PATCH  /api/events/:id   {…the event's fields}   (on a recurring event, only this occurrence changes)
// DELETE /api/events/:id
import { json, fail, requireConfigured, gcal, calPath, fromGoogle, toGoogle, ApiError } from "../../../lib/gcal.js";
import { whoFrom } from "./index.js";

function eventPath(env, params) {
  const id = String(params.id || "");
  if (!/^[A-Za-z0-9_\-]{1,1024}$/.test(id)) throw new ApiError(400, "id", "Invalid event id.");
  return calPath(env, "/events/" + encodeURIComponent(id));
}

export async function onRequestGet({ env, params }) {
  try {
    requireConfigured(env);
    return json({ event: fromGoogle(await gcal(env, eventPath(env, params))) });
  } catch (e) {
    return fail(e);
  }
}

async function update({ request, env, params, data }) {
  try {
    requireConfigured(env);
    const b = await request.json().catch(() => null);
    if (!b) throw new ApiError(400, "json", "A JSON body is required.");
    const ev = await gcal(env, eventPath(env, params), { method: "PATCH", body: JSON.stringify(toGoogle(b, { patch: true, who: whoFrom(data, b) })) });
    return json({ event: fromGoogle(ev) });
  } catch (e) {
    return fail(e);
  }
}
export const onRequestPatch = update;
export const onRequestPut = update;

export async function onRequestDelete({ env, params }) {
  try {
    requireConfigured(env);
    await gcal(env, eventPath(env, params), { method: "DELETE" });
    return json({ deleted: params.id });
  } catch (e) {
    if (e.google === 410) return json({ deleted: params.id }); // already deleted: the same result
    return fail(e);
  }
}
