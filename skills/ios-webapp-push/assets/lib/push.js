// Notifications for the installed app (web push): who gets what, and when.
//
//   New event      — an event appears on the shared Google Calendar for the first time, added on the site or in Google
//                    Calendar. Site-added events go out right away (notifyCreated, from POST /api/events); the rest are
//                    found by the minute tick with an incremental Google list (syncToken). The very first tick only
//                    records what is already there, so deploys and existing events never notify. The member who added it
//                    on the site is skipped. A recurring series is one event. More than BULK at once → one summary.
//   30 minutes     — timed events only. Each tick reads the next 31 minutes from Google and queues one reminder per
//                    device for an event starting 24–30.5 minutes from now. The key (event, start, device) makes it once;
//                    a moved event has a new start, so it gets a new reminder; before sending, the start is checked
//                    again, so a moved or deleted event's old reminder is dropped.
//   Devices        — with the Google sign-in gate (lib/auth.js, skill google-signin-team-gate) a device belongs to the
//                    signed-in member; once that member is off ALLOWED_EMAILS, the next tick forgets the device.
//
// Needs from the calendar layer (lib/gcal.js, skill shared-google-calendar): gcal, calPath, configured, fromGoogle.
// Without the sign-in gate, replace the auth import with: const allowedMembers = () => null;
//
// Storage: the D1 database bound to the Pages project as DB. The tables are created on first use. It also keeps the
// VAPID key pair and the tick secret (made on first use), so nothing secret lives in the repository or in variables.
// The tick is POST /api/push/tick with the header X-Push-Tick, sent every minute by push-cron/ (Pages has no cron).
import { allowedMembers } from "./auth.js";
import { gcal, calPath, configured, fromGoogle, TZ } from "./gcal.js";
import { b64u, newVapidKeys, sendPush } from "./webpush.js";

// VAPID "sub": RFC 8292 allows an https URL instead of a mailto address (no personal email anywhere)
export const SUBJECT = "{{SITE_ORIGIN}}";
const MIN = 60_000;
const NEW_WINDOW = 12 * 60 * MIN; // a "new" event was created at most this long ago (a late tick never sends stale news)
const LEAD_MIN = 24 * MIN, LEAD_MAX = 30.5 * MIN; // reminder window before the start
const BULK = 3; // more new events than this in one pass → one "N new events" message
const LEASE = 90_000; // a job being sent is held this long, so two ticks never send it twice
const MAX_TRIES = 4;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS push_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)",
  `CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    who TEXT NOT NULL DEFAULT '', notify_new INTEGER NOT NULL DEFAULT 1, notify_before INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  "CREATE TABLE IF NOT EXISTS push_seen (event_id TEXT PRIMARY KEY, at INTEGER NOT NULL)",
  // next_at > 0: waiting (or leased) · next_at = 0: done, kept until expires_at so it is never queued again
  `CREATE TABLE IF NOT EXISTS push_jobs (kind TEXT NOT NULL, event_id TEXT NOT NULL, start_ms INTEGER NOT NULL,
    endpoint TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT NOT NULL, tag TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    PRIMARY KEY (kind, event_id, start_ms, endpoint))`,
  "CREATE INDEX IF NOT EXISTS push_jobs_next ON push_jobs (next_at)",
];

let schemaReady = null;
async function ready(env) {
  const d = env.DB;
  if (!d) return null;
  if (!schemaReady) schemaReady = d.batch(SCHEMA.map((s) => d.prepare(s))).catch((e) => { schemaReady = null; throw e; });
  await schemaReady;
  return d;
}
export const hasStore = (env) => !!env.DB;

/* ---------- meta: keys, secret, sync state ---------- */
async function meta(d, k) {
  const r = await d.prepare("SELECT v FROM push_meta WHERE k = ?").bind(k).first();
  return r ? r.v : null;
}
async function setMeta(d, k, v) {
  await d.prepare("INSERT INTO push_meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v").bind(k, String(v)).run();
}
// made once: whoever inserts first wins, everyone reads the same value
async function once(d, k, make) {
  const have = await meta(d, k);
  if (have != null) return have;
  await d.prepare("INSERT OR IGNORE INTO push_meta (k, v) VALUES (?, ?)").bind(k, await make()).run();
  return meta(d, k);
}
const randomToken = () => b64u(crypto.getRandomValues(new Uint8Array(32)));

async function vapid(d) {
  const v = JSON.parse(await once(d, "vapid", async () => JSON.stringify(await newVapidKeys())));
  return { subject: SUBJECT, publicKey: v.publicKey, privateJwk: v.privateJwk };
}
export async function publicKey(env) {
  const d = await ready(env);
  return d ? (await vapid(d)).publicKey : null;
}

function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
/** The minute tick's header matches the secret in D1 (constant-time). push-cron/worker.js reads the same row. */
export async function tickAllowed(env, request) {
  const given = request.headers.get("X-Push-Tick") || "";
  if (!given || request.method !== "POST") return false;
  const d = await ready(env);
  if (!d) return false;
  return same(given, await once(d, "tick_secret", async () => randomToken()));
}

/* ---------- subscriptions ---------- */
// Only real push services: Apple (iPhone), Google (Chrome), Mozilla, Microsoft
export function pushHostOk(endpoint) {
  try {
    const u = new URL(endpoint);
    const h = u.hostname;
    const known = h === "web.push.apple.com" || h.endsWith(".push.apple.com") || h === "fcm.googleapis.com" || h === "android.googleapis.com"
      || h === "updates.push.services.mozilla.com" || h.endsWith(".notify.windows.com");
    return known && u.protocol === "https:" && !u.port && !u.username && !u.password && endpoint.length <= 1400;
  } catch (e) {
    return false;
  }
}
/** { endpoint, p256dh, auth } from a PushSubscription's JSON, or null. */
export function subFrom(b) {
  const endpoint = b && typeof b.endpoint === "string" ? b.endpoint : "";
  const k = (b && b.keys) || {};
  if (!pushHostOk(endpoint) || !/^[A-Za-z0-9_-]{87}$/.test(k.p256dh || "") || !/^[A-Za-z0-9_-]{22}$/.test(k.auth || "")) return null;
  return { endpoint, p256dh: k.p256dh, auth: k.auth };
}
const prefsOut = (r) => ({ registered: !!r, notifyNew: r ? !!r.notify_new : true, notifyBefore: r ? !!r.notify_before : true });
const whoOk = (w) => (/^[a-z0-9_-]{1,32}$/.test(String(w || "")) ? String(w) : "");

export async function readSub(env, sub) {
  const d = await ready(env);
  const r = await d.prepare("SELECT notify_new, notify_before FROM push_subs WHERE endpoint = ? AND auth = ?").bind(sub.endpoint, sub.auth).first();
  return prefsOut(r);
}

/** Save a device (new or changed keys) and any of its settings: { notifyNew, notifyBefore, who }. */
export async function saveSub(env, sub, b, now = Date.now()) {
  const d = await ready(env);
  const nn = typeof b.notifyNew === "boolean" ? (b.notifyNew ? 1 : 0) : null;
  const nb = typeof b.notifyBefore === "boolean" ? (b.notifyBefore ? 1 : 0) : null;
  const who = b.who === undefined ? null : whoOk(b.who);
  await d.prepare(`INSERT INTO push_subs (endpoint, p256dh, auth, who, notify_new, notify_before, created_at, updated_at)
      VALUES (?1, ?2, ?3, coalesce(?4, ''), coalesce(?5, 1), coalesce(?6, 1), ?7, ?7)
      ON CONFLICT (endpoint) DO UPDATE SET p256dh = ?2, auth = ?3, who = coalesce(?4, who),
        notify_new = coalesce(?5, notify_new), notify_before = coalesce(?6, notify_before), updated_at = ?7`)
    .bind(sub.endpoint, sub.p256dh, sub.auth, who, nn, nb, now).run();
  // a switch turned off also drops what is still waiting for that device
  if (nn === 0) await d.prepare("DELETE FROM push_jobs WHERE endpoint = ? AND kind = 'new' AND next_at > 0").bind(sub.endpoint).run();
  if (nb === 0) await d.prepare("DELETE FROM push_jobs WHERE endpoint = ? AND kind = 'rem' AND next_at > 0").bind(sub.endpoint).run();
  return readSub(env, sub);
}

export async function deleteSub(env, endpoint) {
  const d = await ready(env);
  await d.batch([
    d.prepare("DELETE FROM push_jobs WHERE endpoint = ?").bind(endpoint),
    d.prepare("DELETE FROM push_subs WHERE endpoint = ?").bind(endpoint),
  ]);
}

/* ---------- what a notification says ---------- */
// "Tue 12/22 · 10:50 · Weekly sync" (the team's time zone, TZ). No location, notes or names: a lock screen is public.
function whenText(ev) {
  const [y, m, dd] = ev.start.split("-").map(Number);
  const day = `${DOW[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]} ${m}/${dd}`;
  return ev.allDay ? day : `${day} · ${ev.startTime}`;
}
const short = (s, n = 70) => { s = String(s || "").replace(/\s+/g, " ").trim() || "(no title)"; return s.length > n ? s.slice(0, n - 1) + "…" : s; };
// a tap opens the app on that day with the event open (the #calendar hash skips the intro)
const openUrl = (id, date) => `/?event=${encodeURIComponent(id)}&date=${date}#calendar`;
const tagOf = (s) => s.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);

function newMessage(g) {
  const ev = fromGoogle(g);
  return { title: "New event", body: `${whenText(ev)} · ${short(ev.title)}`, url: openUrl(ev.id, ev.start), tag: tagOf("new-" + ev.id) };
}

/* ---------- queue ---------- */
const INSERT_JOB = `INSERT OR IGNORE INTO push_jobs (kind, event_id, start_ms, endpoint, title, body, url, tag, attempts, next_at, expires_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`;

async function queueNew(d, events, now) {
  if (!events.length) return 0;
  const { results: subs } = await d.prepare("SELECT endpoint, who FROM push_subs WHERE notify_new = 1").all();
  if (!subs.length) return 0;
  let items;
  if (events.length > BULK) {
    // e.g. the official schedule added at once: one message, opening the earliest day
    const evs = events.map(fromGoogle).sort((a, b) => a.start.localeCompare(b.start));
    const first = evs[0];
    items = [{ id: "bulk-" + first.id, author: "", msg: {
      title: "New events", body: `${events.length} events added · from ${whenText({ ...first, allDay: true })}`,
      url: `/?date=${first.start}#calendar`, tag: tagOf("new-bulk-" + now) } }];
  } else {
    items = events.map((g) => ({ id: g.id, author: (g.extendedProperties && g.extendedProperties.shared && g.extendedProperties.shared.author) || "", msg: newMessage(g) }));
  }
  const stmts = [];
  for (const it of items) {
    for (const s of subs) {
      if (it.author && s.who && it.author === s.who) continue; // the member who added it on the site
      stmts.push(d.prepare(INSERT_JOB).bind("new", it.id, 0, s.endpoint, it.msg.title, it.msg.body, it.msg.url, it.msg.tag, now, now + 2 * 86400e3));
    }
  }
  if (stmts.length) await d.batch(stmts);
  return items.length;
}

// record events as seen; returns the ones seen for the first time (in order)
async function markSeen(d, events, now) {
  if (!events.length) return [];
  const res = await d.batch(events.map((g) => d.prepare("INSERT OR IGNORE INTO push_seen (event_id, at) VALUES (?, ?)").bind(g.id, now)));
  return events.filter((_, i) => res[i] && res[i].meta && res[i].meta.changes > 0);
}

/* ---------- new events found in Google Calendar ---------- */
const SYNC_FIELDS = "nextPageToken,nextSyncToken,items(id,status,summary,start,end,created,recurringEventId,extendedProperties/shared)";

async function listChanges(env, token) {
  const items = [];
  let page = "";
  for (let i = 0; i < 40; i++) {
    const q = new URLSearchParams({ maxResults: "250", fields: SYNC_FIELDS });
    if (token) q.set("syncToken", token);
    if (page) q.set("pageToken", page);
    const r = await gcal(env, calPath(env, "/events?" + q));
    items.push(...((r && r.items) || []));
    if (r && r.nextPageToken) { page = r.nextPageToken; continue; }
    return { items, next: (r && r.nextSyncToken) || "" };
  }
  throw new Error("too many pages");
}

async function syncNew(env, d, now) {
  const first = !(await meta(d, "baseline_at"));
  let token = first ? "" : (await meta(d, "sync_token")) || "";
  let got;
  try {
    got = await listChanges(env, token);
  } catch (e) {
    if (e.google !== 410 || !token) throw e;
    got = await listChanges(env, ""); // the token expired: list everything again; the seen table still knows the old ones
  }
  // a recurring series counts once: its master event, never the changed single dates (recurringEventId)
  const live = got.items.filter((g) => g.id && g.status !== "cancelled" && !g.recurringEventId);
  const fresh = (await markSeen(d, live, now)).filter((g) => !first && now - (Date.parse(g.created || "") || 0) <= NEW_WINDOW);
  const queued = await queueNew(d, fresh, now);
  if (got.next && got.next !== token) await setMeta(d, "sync_token", got.next);
  if (first) await setMeta(d, "baseline_at", now);
  return { baseline: first, found: fresh.length, queued };
}

/** With Google sign-in a device belongs to a member on ALLOWED_EMAILS; one whose member left the list is forgotten. */
async function prune(env, d) {
  const keep = allowedMembers(env);
  if (!keep) return;
  const list = [...keep];
  if (!list.length) { await d.prepare("DELETE FROM push_subs").run(); return; }
  await d.prepare(`DELETE FROM push_subs WHERE who NOT IN (${list.map(() => "?").join(", ")})`).bind(...list).run();
}

/** POST /api/events made a new event: tell everyone else right away (the tick would find it within a minute anyway). */
export async function notifyCreated(env, g, now = Date.now()) {
  const d = await ready(env);
  if (!d || !g || !g.id) return;
  await prune(env, d);
  const fresh = await markSeen(d, [g], now);
  if (!fresh.length) return;
  await queueNew(d, fresh, now);
  await deliver(env, d, now, null);
}

/* ---------- reminders ---------- */
async function queueReminders(env, d, now) {
  const q = new URLSearchParams({
    timeMin: new Date(now).toISOString(), timeMax: new Date(now + 31 * MIN).toISOString(),
    singleEvents: "true", orderBy: "startTime", maxResults: "100", timeZone: TZ,
    fields: "items(id,status,summary,start,end,recurringEventId)",
  });
  const r = await gcal(env, calPath(env, "/events?" + q));
  const upcoming = new Map(); // event id → start (ms), timed events only: what a waiting reminder is checked against
  const due = [];
  for (const g of (r && r.items) || []) {
    if (g.status === "cancelled" || !g.start || !g.start.dateTime) continue; // all-day events get no reminder
    const at = Date.parse(g.start.dateTime);
    if (!isFinite(at)) continue;
    upcoming.set(g.id, at);
    if (at - now > LEAD_MIN && at - now <= LEAD_MAX) due.push([g, at]);
  }
  const { results: subs } = due.length ? await d.prepare("SELECT endpoint FROM push_subs WHERE notify_before = 1").all() : { results: [] };
  const stmts = [];
  for (const [g, at] of due) {
    const ev = fromGoogle(g);
    const msg = { title: "In 30 minutes", body: `${whenText(ev)} · ${short(ev.title)}`, url: openUrl(ev.id, ev.start), tag: tagOf(`rem-${ev.id}-${at}`) };
    for (const s of subs) stmts.push(d.prepare(INSERT_JOB).bind("rem", g.id, at, s.endpoint, msg.title, msg.body, msg.url, msg.tag, now, at + 60 * MIN));
  }
  if (stmts.length) await d.batch(stmts);
  return { upcoming, due: due.length };
}

/* ---------- sending ---------- */
// upcoming: the map from queueReminders (reminders are sent only when it is there, so their start can be checked)
async function deliver(env, d, now, upcoming) {
  const { results: jobs } = await d.prepare(`SELECT j.*, s.p256dh, s.auth, s.notify_new, s.notify_before FROM push_jobs j
      JOIN push_subs s ON s.endpoint = j.endpoint WHERE j.next_at > 0 AND j.next_at <= ? AND (j.kind <> 'rem' OR ?)
      ORDER BY j.next_at LIMIT 60`).bind(now, upcoming ? 1 : 0).all();
  if (!jobs.length) return { sent: 0, failed: 0, dropped: 0 };
  const keys = await vapid(d);
  const out = { sent: 0, failed: 0, dropped: 0 };
  await Promise.allSettled(jobs.map(async (j) => {
    const where = "WHERE kind = ? AND event_id = ? AND start_ms = ? AND endpoint = ?";
    const pk = [j.kind, j.event_id, j.start_ms, j.endpoint];
    const lease = now + LEASE;
    const got = await d.prepare(`UPDATE push_jobs SET next_at = ? ${where} AND next_at = ?`).bind(lease, ...pk, j.next_at).run();
    if (!got.meta.changes) return; // another tick has it
    const done = () => d.prepare(`UPDATE push_jobs SET next_at = 0 ${where} AND next_at = ?`).bind(...pk, lease).run();
    const reminder = j.kind === "rem";
    const on = reminder ? j.notify_before : j.notify_new;
    if (!on || (reminder && (j.start_ms <= now || upcoming.get(j.event_id) !== j.start_ms))) {
      out.dropped++;
      await done(); // switched off, moved, deleted or already started
      return;
    }
    let status = 0;
    try {
      status = await sendPush({ endpoint: j.endpoint, p256dh: j.p256dh, auth: j.auth }, { title: j.title, body: j.body, url: j.url, tag: j.tag }, {
        vapid: keys,
        ttl: reminder ? Math.max(60, (j.start_ms - now) / 1000) : 86400,
        urgency: reminder ? "high" : "normal",
      });
    } catch (e) {
      console.warn("push send failed", e && e.name);
    }
    if (status >= 200 && status < 300) { out.sent++; await done(); return; }
    if (status === 404 || status === 410) { out.dropped++; await deleteSub(env, j.endpoint); return; } // the device unsubscribed
    out.failed++;
    const next = now + 2 ** j.attempts * 60_000; // 1, 2, 4, 8 minutes
    if (j.attempts + 1 >= MAX_TRIES || [400, 403, 413].includes(status) || (reminder && next >= j.start_ms)) { await done(); return; }
    await d.prepare(`UPDATE push_jobs SET attempts = attempts + 1, next_at = ? ${where} AND next_at = ?`).bind(next, ...pk, lease).run();
  }));
  return out;
}

/** The minute tick: find new events, queue reminders, send what is due, forget old jobs. `now` is for tests. */
export async function tick(env, now = Date.now()) {
  const d = await ready(env);
  const out = { now };
  let upcoming = null;
  await prune(env, d);
  if (configured(env)) {
    try { out.sync = await syncNew(env, d, now); } catch (e) { out.syncError = String(e.message || e); }
    try {
      const r = await queueReminders(env, d, now);
      upcoming = r.upcoming;
      out.reminders = r.due;
    } catch (e) { out.reminderError = String(e.message || e); }
  }
  out.delivery = await deliver(env, d, now, upcoming);
  await d.batch([
    d.prepare("DELETE FROM push_jobs WHERE expires_at < ?").bind(now),
    d.prepare("DELETE FROM push_jobs WHERE endpoint NOT IN (SELECT endpoint FROM push_subs)"),
  ]);
  return out;
}
