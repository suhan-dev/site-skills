// Test stand-in for lib/gcal.js (the real one is in the shared-google-calendar skill). Same exports and the same
// error shape (err.google = Google's HTTP status), but no service-account JWT: the fake Google in test-push.mjs
// answers any bearer token. fromGoogle converts times into TZ with Intl, as the real one does.
export const TZ = "Asia/Seoul";
export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
export function fail(e) {
  if (e instanceof ApiError) return json({ error: e.code, message: e.message }, e.status);
  return json({ error: "server", message: String((e && e.message) || e) }, 500);
}
export const configured = (env) => !!(env.GOOGLE_SA_JSON && env.GOOGLE_CALENDAR_ID);
export async function gcal(env, path, init = {}) {
  const r = await fetch("https://www.googleapis.com/calendar/v3" + path, { ...init, headers: { Authorization: "Bearer test", "Content-Type": "application/json", ...(init.headers || {}) } });
  if (r.status === 204) return null;
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new ApiError([400, 404, 409, 410, 412].includes(r.status) ? r.status : 502, "google-" + r.status, (d && d.error && d.error.message) || "HTTP " + r.status);
    err.google = r.status;
    throw err;
  }
  return d;
}
export const calPath = (env, rest = "") => "/calendars/" + encodeURIComponent(env.GOOGLE_CALENDAR_ID) + rest;
const addDays = (ymd, n) => { const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const zoned = (dt) => {
  const t = new Date(dt);
  if (isNaN(t)) return { date: "", time: "" };
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(t).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
export function fromGoogle(e) {
  const allDay = !!(e.start && e.start.date);
  let start, end, startTime = "", endTime = "";
  if (allDay) { start = e.start.date; end = addDays((e.end && e.end.date) || addDays(start, 1), -1); if (end < start) end = start; }
  else { const s = zoned(e.start.dateTime), t = zoned((e.end && e.end.dateTime) || e.start.dateTime); start = s.date; startTime = s.time; end = t.date; endTime = t.time; }
  const sh = (e.extendedProperties && e.extendedProperties.shared) || {};
  return { id: e.id, title: e.summary || "(no title)", allDay, start, end, startTime, endTime, owner: sh.owner || "", author: sh.author || "" };
}
