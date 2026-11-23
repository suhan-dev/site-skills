// Google Calendar link — service account (JWT, RS256) → access token → Calendar API v3.
// The shared calendar is the source of truth for events. The site only reads and writes it; it stores nothing itself.
//
// Cloudflare Pages variables (Settings → Variables and Secrets), see references/setup.md:
//   GOOGLE_SA_JSON       the whole service-account key JSON file (Secret)
//   GOOGLE_CALENDAR_ID   the shared calendar's id (Text)
// Local tests only (never on the live site): GOOGLE_TOKEN_URL, GOOGLE_API_BASE (tools/mock-google.mjs writes them).

// The team's time zone (IANA). Event dates and times on the site are always in this zone.
export const TZ = "{{TIMEZONE}}";
const SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";
const AUD = "https://oauth2.googleapis.com/token";
const enc = new TextEncoder();
// one token per isolate, reused until two minutes before it expires
let tokenCache = { who: "", token: "", exp: 0 };

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// every error the page sees is { error: <code>, message: <English sentence> }; the page maps known codes to its own text
export function fail(e) {
  if (e instanceof ApiError) return json({ error: e.code, message: e.message }, e.status);
  return json({ error: "server", message: String((e && e.message) || e) }, 500);
}

export function configured(env) {
  return !!(env.GOOGLE_SA_JSON && env.GOOGLE_CALENDAR_ID);
}

export function requireConfigured(env) {
  if (!configured(env)) {
    throw new ApiError(503, "not-configured", "Google Calendar is not connected yet (GOOGLE_SA_JSON, GOOGLE_CALENDAR_ID).");
  }
}

export function serviceAccount(env) {
  let o;
  try {
    o = JSON.parse(env.GOOGLE_SA_JSON);
  } catch (e) {
    throw new ApiError(500, "sa-json", "GOOGLE_SA_JSON is not valid JSON. Paste the whole key file as is.");
  }
  if (!o.client_email || !o.private_key) throw new ApiError(500, "sa-json", "GOOGLE_SA_JSON has no client_email or private_key.");
  return o;
}

function b64url(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem) {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function accessToken(env) {
  const sa = serviceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.who === sa.client_email && tokenCache.exp - 120 > now) return tokenCache.token;
  const head = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: sa.private_key_id || undefined })));
  const claim = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: AUD, iat: now, exp: now + 3600 })));
  let key;
  try {
    key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch (e) {
    throw new ApiError(500, "sa-key", "Could not read the service account private_key. Paste the key JSON again.");
  }
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(head + "." + claim));
  const r = await fetch(env.GOOGLE_TOKEN_URL || AUD, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + claim + "." + b64url(sig) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) {
    throw new ApiError(502, "google-auth", "Google sign-in failed: " + (d.error_description || d.error || r.status));
  }
  tokenCache = { who: sa.client_email, token: d.access_token, exp: now + (d.expires_in || 3600) };
  return d.access_token;
}

// what to do about it, in plain words; the page shows the message under "Couldn't connect to Google Calendar."
const HINT = {
  401: "Google refused the credentials. Check the service account key.",
  403: "The service account has no access to this calendar. In the calendar's sharing settings, add the service account email with \"Make changes to events\". Also check that the Google Calendar API is enabled.",
  404: "Calendar or event not found. Check GOOGLE_CALENDAR_ID and the calendar sharing.",
};

// One Calendar API call. Errors keep Google's status in err.google; the page gets code "google-<status>".
// 400/404/409/410/412 pass through as is; anything else (401, 403, 5xx) becomes 502, because it is our server that failed.
export async function gcal(env, path, init = {}) {
  const tok = await accessToken(env);
  const base = (env.GOOGLE_API_BASE || "https://www.googleapis.com/calendar/v3").replace(/\/$/, "");
  const r = await fetch(base + path, {
    ...init,
    headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (r.status === 204) return null;
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    const g = (d && d.error && d.error.message) || "HTTP " + r.status;
    const status = [400, 404, 409, 410, 412].includes(r.status) ? r.status : 502;
    const err = new ApiError(status, "google-" + r.status, (HINT[r.status] ? HINT[r.status] + " " : "") + "(Google: " + g + ")");
    err.google = r.status;
    throw err;
  }
  return d;
}

export function calPath(env, rest = "") {
  return "/calendars/" + encodeURIComponent(env.GOOGLE_CALENDAR_ID) + rest;
}

/* ---------- dates (YYYY-MM-DD and HH:MM, always in TZ) ---------- */
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^\d{2}:\d{2}$/;

export function addDays(ymd, n) {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const zoneFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});
function zoneParts(ms) {
  const p = Object.fromEntries(zoneFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}
// minutes TZ is ahead of UTC at that instant (DST-aware)
function offsetAt(ms) {
  const p = zoneParts(ms);
  return Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000) / 60000);
}

// "2026-12-22", "09:30" → "2026-12-22T09:30:00+09:00" (an RFC 3339 time in TZ, for timeMin / timeMax)
export function zonedISO(ymd, hm = "00:00") {
  const [y, mo, d] = ymd.split("-").map(Number), [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let off = offsetAt(guess - offsetAt(guess) * 60000);
  const sign = off < 0 ? "-" : "+", a = Math.abs(off);
  return `${ymd}T${hm}:00${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

// a time from Google (with its offset) → { date, time } in TZ
function local(dt) {
  const t = new Date(dt).getTime();
  if (isNaN(t)) return { date: "", time: "" };
  const p = zoneParts(t), z = (n) => String(n).padStart(2, "0");
  return { date: `${p.y}-${z(p.mo)}-${z(p.d)}`, time: `${z(p.h)}:${z(p.mi)}` };
}

function addMinutes(hm, n) {
  const [h, m] = hm.split(":").map(Number);
  const t = Math.min(h * 60 + m + n, 23 * 60 + 59);
  return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
}

/* ---------- event shape: Google ↔ site ---------- */
// The site's event: { id, title, allDay, start, end (inclusive dates), startTime, endTime ("HH:MM" or ""), location, memo,
// colorId, owner, author, editor, link, recurring, updated }. owner/author/editor live in extendedProperties.shared.
export function fromGoogle(e) {
  const allDay = !!(e.start && e.start.date);
  let start, end, startTime = "", endTime = "";
  if (allDay) {
    start = e.start.date;
    end = addDays((e.end && e.end.date) || addDays(start, 1), -1); // Google's end date is the day after (exclusive)
    if (end < start) end = start;
  } else {
    const s = local(e.start && e.start.dateTime), t = local((e.end && e.end.dateTime) || (e.start && e.start.dateTime));
    start = s.date; startTime = s.time; end = t.date; endTime = t.time;
  }
  const sh = (e.extendedProperties && e.extendedProperties.shared) || {};
  return {
    id: e.id,
    title: e.summary || "(no title)",
    allDay, start, end, startTime, endTime,
    location: e.location || "",
    memo: e.description || "",
    colorId: e.colorId || "",
    owner: sh.owner || "",
    author: sh.author || "",
    editor: sh.editor || "",
    link: e.htmlLink || "",
    recurring: !!e.recurringEventId,
    updated: e.updated || "",
  };
}

function text(v, max) {
  return String(v == null ? "" : v).slice(0, max);
}

// What the page sent → a Google event. patch=true clears the other kind of date with null (needed when an event
// switches between all day and timed). who = the member who adds (author) or edits (editor) it, set by the server.
export function toGoogle(b, { patch = false, who = "" } = {}) {
  const title = text(b.title, 300).trim();
  if (!title) throw new ApiError(400, "title", "Add a title.");
  const start = text(b.start, 10), end = text(b.end || b.start, 10);
  if (!YMD.test(start) || !YMD.test(end)) throw new ApiError(400, "date", "Dates must be YYYY-MM-DD.");
  if (end < start) throw new ApiError(400, "date", "The end date is before the start.");
  const out = {
    summary: title,
    location: text(b.location, 500),
    description: text(b.memo, 8000),
  };
  if (b.allDay) {
    out.start = { date: start };
    out.end = { date: addDays(end, 1) };
    if (patch) {
      out.start.dateTime = null; out.start.timeZone = null;
      out.end.dateTime = null; out.end.timeZone = null;
    }
  } else {
    const st = HM.test(b.startTime || "") ? b.startTime : "09:00";
    let et = HM.test(b.endTime || "") ? b.endTime : addMinutes(st, 60);
    if (end === start && et <= st) throw new ApiError(400, "time", "The end time is before the start.");
    // a local time plus the zone name: Google applies the right offset, DST included
    out.start = { dateTime: `${start}T${st}:00`, timeZone: TZ };
    out.end = { dateTime: `${end}T${et}:00`, timeZone: TZ };
    if (patch) { out.start.date = null; out.end.date = null; }
  }
  // member colours: Google's event colour ids 1–11 (the page maps them to its own palette)
  const color = String(b.colorId || "");
  if (/^(?:[1-9]|1[01])$/.test(color)) out.colorId = color;
  const shared = { owner: text(b.owner, 32) };
  if (who) shared[patch ? "editor" : "author"] = text(who, 32);
  out.extendedProperties = { shared };
  return out;
}

// every non-cancelled event from `from` 00:00 to the end of `to`, in TZ (paged, at most 5 × 2500).
// extra: more query parameters, or null to drop one of the defaults
export async function listRange(env, from, to, extra = {}) {
  const q = new URLSearchParams({
    timeMin: zonedISO(from),
    timeMax: zonedISO(addDays(to, 1)),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "2500",
    timeZone: TZ,
  });
  for (const [k, v] of Object.entries(extra)) v == null ? q.delete(k) : q.set(k, v); // null drops a default
  const items = [];
  for (let i = 0; i < 5; i++) {
    const d = await gcal(env, calPath(env, "/events?" + q));
    items.push(...((d && d.items) || []));
    if (!d || !d.nextPageToken) break;
    q.set("pageToken", d.nextPageToken);
  }
  return items.filter((e) => e.status !== "cancelled");
}
