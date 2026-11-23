// GET /api/status — the Google Calendar connection (the card under "Upcoming", the sync note and the banner)
//   { configured, now }                                         variables missing: the page shows the preview
//   { configured, ok: true, calendarName, calendarId, timeZone, seeded, serviceAccount }
//   { configured, ok: false, error, code }                      connected but failing: the page says why
import { json, configured, serviceAccount, gcal, calPath, listRange } from "../../lib/gcal.js";
import { seedEvents } from "../../lib/seed.js";

export async function onRequestGet({ env }) {
  const out = { configured: configured(env), now: Date.now() };
  if (!out.configured) return json(out);
  try {
    out.serviceAccount = serviceAccount(env).client_email;
    out.calendarId = env.GOOGLE_CALENDAR_ID;
    const c = await gcal(env, calPath(env));
    out.calendarName = c.summary || "";
    out.timeZone = c.timeZone || "";
    out.ok = true;
    // "seeded": the first official event exists (by its fixed id), or a hand-made one of the same kind is on its day
    // (the seed button would skip it, so the card should not keep offering the button)
    const first = seedEvents()[0];
    try {
      const e = await gcal(env, calPath(env, "/events/" + first.id));
      out.seeded = e.status !== "cancelled";
    } catch (e) {
      if (e.google === 404) out.seeded = false;
      else throw e;
    }
    if (!out.seeded) {
      const items = await listRange(env, first.start, first.start, { orderBy: null, maxResults: null });
      out.seeded = items.some((e) => first.match.test(e.summary || ""));
    }
  } catch (e) {
    out.ok = false;
    out.error = e.message;
    out.code = e.code || "";
  }
  return json(out);
}
