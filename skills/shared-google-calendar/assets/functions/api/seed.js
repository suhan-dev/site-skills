// GET  /api/seed  the official schedule (also the striped preview before Google Calendar is connected)
// POST /api/seed  put the official schedule into the shared calendar. Safe to press any number of times:
//   - our own events (fixed ids) that already exist are kept; ones that were deleted are restored;
//   - if someone already added an event of the same kind on that day by hand (e.g. "Kickoff" on the kickoff day),
//     that one is skipped, so the button never makes a second copy.
//   Answer: { added, restored, kept, skipped }
import { json, fail, requireConfigured, gcal, calPath, toGoogle, fromGoogle, listRange } from "../../lib/gcal.js";
import { seedEvents } from "../../lib/seed.js";
import { whoFrom } from "./events/index.js";

const plain = ({ match, ...e }) => e; // regexes stay on the server

export async function onRequestGet() {
  return json({ events: seedEvents().map(plain) });
}

export async function onRequestPost({ request, env, data }) {
  try {
    requireConfigured(env);
    const b = await request.json().catch(() => ({}));
    const list = seedEvents().sort((x, y) => x.start.localeCompare(y.start));
    // every event in the program range, in one paged list call
    const have = (await listRange(env, list[0].start, list[list.length - 1].start, { showDeleted: "false" })).map(fromGoogle);
    const res = { added: 0, restored: 0, kept: 0, skipped: 0 };
    for (const s of list) {
      // a hand-made event of the same kind that covers that date
      const twin = have.find((e) => e.id !== s.id && e.start <= s.start && s.start <= e.end && s.match && s.match.test(e.title));
      if (twin) { res.skipped++; continue; }
      const body = { id: s.id, ...toGoogle(plain(s), { who: whoFrom(data, b) || "" }) };
      try {
        await gcal(env, calPath(env, "/events"), { method: "POST", body: JSON.stringify(body) });
        res.added++;
      } catch (e) {
        if (e.google !== 409) throw e; // 409: that id exists (maybe deleted, which Google keeps as "cancelled")
        const cur = await gcal(env, calPath(env, "/events/" + s.id));
        if (cur.status === "cancelled") {
          await gcal(env, calPath(env, "/events/" + s.id), { method: "PATCH", body: JSON.stringify({ ...toGoogle(plain(s), { patch: true }), status: "confirmed" }) });
          res.restored++;
        } else res.kept++;
      }
    }
    return json(res);
  } catch (e) {
    return fail(e);
  }
}
