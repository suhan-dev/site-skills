// An in-page stand-in for the Pages Functions, so the demo runs on any static server.
// It answers /api/status, /api/events (GET, POST), /api/events/:id (PATCH, DELETE) and /api/seed (GET, POST) like the
// real ones, from placeholder events built around "now" (the demo week always has every case on screen).
//   ?mode=preview  Google not connected (striped official schedule, read only)
//   ?mode=error    connected but the service account has no access (red banner, Try again)
import { addDays, dow, ymd, parse } from "../site/js/cal-util.js";
import { calToday } from "../site/js/cal-layout.js";

const q = new URLSearchParams(location.search);
const MODE = q.get("mode") || "live";
const ws = addDays(calToday(), -dow(calToday())); // Sunday of the week on screen
const d = (n) => addDays(ws, n);
let seq = 0;
const ev = (o) => ({
  id: "demo" + (++seq), allDay: false, startTime: "", endTime: "", location: "", memo: "", colorId: "", owner: "team",
  author: "alex", editor: "", link: "https://calendar.google.com/", recurring: false, updated: "", end: o.start, ...o,
});

const events = [
  // Monday: the weekly sync, then two overlapping blocks side by side
  ev({ title: "Weekly sync", start: d(1), startTime: "09:00", endTime: "10:00", owner: "team", location: "Room 101", recurring: true }),
  ev({ title: "Design review", start: d(1), startTime: "10:30", endTime: "12:00", owner: "alex", location: "Room 204", memo: "Bring the two layout drafts.", author: "blair" }),
  ev({ title: "Data check", start: d(1), startTime: "11:00", endTime: "12:30", owner: "casey" }),
  // Tuesday: a long block and an official all-day deadline
  ev({ title: "Lab session", start: d(2), startTime: "13:00", endTime: "15:30", owner: "blair", location: "Lab B" }),
  ev({ title: "Report due", start: d(2), allDay: true, owner: "official", colorId: "11", author: "" }),
  // Wednesday: a short one and an evening one
  ev({ title: "Stand-up", start: d(3), startTime: "09:00", endTime: "09:30", owner: "team" }),
  ev({ title: "Reading group", start: d(3), startTime: "19:00", endTime: "20:30", owner: "casey", location: "Zoom" }),
  // Thursday: an afternoon block, and a late night after midnight that stays on Thursday
  ev({ title: "Office hours", start: d(4), startTime: "16:00", endTime: "17:00", owner: "alex" }),
  ev({ title: "Late simulation run", start: d(4), end: d(5), startTime: "23:00", endTime: "01:30", owner: "blair", memo: "Runs overnight; check the log in the morning." }),
  // multi-day: from last week into Monday (cut at the week's edge), Thursday to Saturday, and a timed night that crosses 07:00
  ev({ title: "Equipment booked", start: d(-2), end: d(1), allDay: true, owner: "casey" }),
  ev({ title: "Workshop", start: d(4), end: d(6), allDay: true, owner: "team", location: "Main hall" }),
  ev({ title: "Long measurement", start: d(5), end: d(6), startTime: "18:00", endTime: "10:00", owner: "alex" }),
  ev({ title: "Draft deadline", start: d(5), allDay: true, owner: "official", colorId: "11", author: "" }),
  ev({ title: "Poster print", start: d(5), allDay: true, owner: "casey" }),
];
// the weeks around it, so the month view and "Upcoming" have something
for (let w = -4; w <= 5; w++) {
  if (w === 0) continue;
  events.push(ev({ id: "sync_" + d(7 * w + 1), title: "Weekly sync", start: d(7 * w + 1), startTime: "09:00", endTime: "10:00", owner: "team", location: "Room 101", recurring: true }));
  if (w % 2) events.push(ev({ title: "Reading group", start: d(7 * w + 3), startTime: "19:00", endTime: "20:30", owner: "casey", location: "Zoom" }));
  if (w === 1 || w === -2) events.push(ev({ title: "Lab session", start: d(7 * w + 2), startTime: "13:00", endTime: "15:30", owner: "blair" }));
  if (w === 2) events.push(ev({ title: "Field trip", start: d(7 * w + 4), end: d(7 * w + 5), allDay: true, owner: "team" }));
}

// the official schedule (placeholder): what "Add official schedule" adds, and the striped preview
const first = ymd(parse(ws).y, parse(ws).m + 2, 1);
const seedList = [
  { id: "seed1", title: "Kickoff", start: d(9), allDay: true },
  { id: "seed2", title: "Weekly session (Tue)", start: d(2), allDay: true },
  { id: "seed3", title: "Weekly session (Tue)", start: d(16), allDay: true },
  { id: "seed4", title: "Last day", start: first, allDay: true },
].map((e) => ev({ ...e, owner: "official", colorId: "11", author: "" }));
let seeded = false;

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const real = window.fetch.bind(window);

window.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === "string" ? input : input.url, location.href);
  if (!u.pathname.startsWith("/api/")) return real(input, init);
  await wait(120);
  const method = (init.method || "GET").toUpperCase();
  const body = init.body ? JSON.parse(init.body) : null;
  if (u.pathname === "/api/status") {
    if (MODE === "preview") return json({ configured: false, now: Date.now() });
    if (MODE === "error") return json({ configured: true, ok: false, code: "google-403", error: "The service account has no access to this calendar." });
    return json({ configured: true, ok: true, calendarName: "Example Lab", calendarId: "demo-calendar", timeZone: "Asia/Seoul", seeded });
  }
  if (u.pathname === "/api/seed") {
    if (method === "POST") { seeded = true; for (const s of seedList) if (!events.some((e) => e.id === s.id)) events.push(s); return json({ added: seedList.length, restored: 0, kept: 0, skipped: 0 }); }
    return json({ events: seedList });
  }
  if (u.pathname === "/api/events" && method === "GET") {
    const from = u.searchParams.get("from"), to = u.searchParams.get("to");
    return json({ events: events.filter((e) => e.start <= to && e.end >= from), now: Date.now() });
  }
  if (u.pathname === "/api/events" && method === "POST") {
    const e = ev({ ...body, author: "alex", end: body.end || body.start });
    if (e.allDay) { e.startTime = ""; e.endTime = ""; }
    events.push(e);
    return json({ event: e }, 201);
  }
  const m = u.pathname.match(/^\/api\/events\/(.+)$/);
  if (m) {
    const i = events.findIndex((e) => e.id === decodeURIComponent(m[1]));
    if (i < 0) return json({ error: "google-404", message: "Not found" }, 404);
    if (method === "DELETE") { const [x] = events.splice(i, 1); return json({ deleted: x.id }); }
    // a new object, so the layout cache (a WeakMap per event object) sees the new times
    events[i] = { ...events[i], ...body, editor: "alex" };
    if (events[i].allDay) { events[i].startTime = ""; events[i].endTime = ""; }
    return json({ event: events[i] });
  }
  return json({ error: "server", message: "Not in the demo" }, 404);
};
