// GET    /api/push               { publicKey, ready } — ready: the server can send (the D1 database DB is bound)
// POST   /api/push               { endpoint, keys, notifyNew?, notifyBefore?, who? } → save this device and its settings
//                                 (with Google sign-in `who` is the signed-in member, not the body's)
// POST   /api/push?read          { endpoint, keys } → { registered, notifyNew, notifyBefore } (nothing is changed)
// DELETE /api/push               { endpoint } → forget this device
// Behind the sign-in like every other API (functions/_middleware.js). Logic: lib/push.js. JSON helpers: lib/gcal.js.
import { json, fail, ApiError } from "../../../lib/gcal.js";
import { hasStore, publicKey, subFrom, saveSub, readSub, deleteSub, pushHostOk } from "../../../lib/push.js";

async function body(request) {
  if ((request.headers.get("Content-Type") || "").split(";")[0].trim() !== "application/json") throw new ApiError(415, "json", "Send JSON.");
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== "object") throw new ApiError(400, "json", "A JSON body is required.");
  return b;
}
function store(env) {
  if (!hasStore(env)) throw new ApiError(503, "push-off", "Notifications aren't set up on the server yet.");
}

export async function onRequestGet({ env }) {
  try {
    return json({ ready: hasStore(env), publicKey: hasStore(env) ? await publicKey(env) : null });
  } catch (e) {
    return fail(e);
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    store(env);
    const b = await body(request);
    // signed in with Google: the device belongs to that member, whatever the page says (lib/auth.js)
    if (data && data.user) b.who = data.user.member;
    const sub = subFrom(b);
    if (!sub) throw new ApiError(400, "push-sub", "Not a push subscription from a supported browser.");
    if (new URL(request.url).searchParams.has("read")) return json(await readSub(env, sub));
    return json(await saveSub(env, sub, b));
  } catch (e) {
    return fail(e);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    store(env);
    const b = await body(request);
    if (!pushHostOk(b.endpoint)) throw new ApiError(400, "push-sub", "Unknown endpoint.");
    await deleteSub(env, b.endpoint);
    return json({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
