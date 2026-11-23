// Small helpers: DOM, dates in the team's zone (strings YYYY-MM-DD), the API call, saved preferences, colours.
import { TIMEZONE } from "./cal-config.js";

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const todayYMD = () => dayFmt.format(new Date());
export const mins = (hm) => { const [h, m] = String(hm || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
// minutes since midnight, now, in the team's zone
export const nowMins = () => mins(hmFmt.format(new Date())) % 1440;
// "2:20 PM" (the sync note)
export const clock12 = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIMEZONE });

// plain calendar arithmetic on YYYY-MM-DD strings (UTC inside, so no zone or DST can shift a day)
export const ymd = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
export const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return { y, m: m - 1, d }; };
export const dow = (s) => new Date(s + "T00:00:00Z").getUTCDay();
export function addDays(s, n) { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const diffDays = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5);
export const pad2 = (n) => String(n).padStart(2, "0");

// Google Calendar colour ids → the site's own calm palette (CSS variables --gc-1 … --gc-11, light and dark, in tokens.css)
export const GCOLORS = Object.fromEntries(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"].map((k) => [k, `var(--gc-${k})`]));

// fetch JSON from our own API. A 401 {error:"auth"} means the sign-in expired: reload, and the sign-in page shows.
export async function api(path, opts = {}) {
  const r = await fetch(path, { credentials: "same-origin", ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  let d = null;
  try { d = await r.json(); } catch (e) { /* no body */ }
  if (r.status === 401 && d && d.error === "auth") { location.reload(); throw new Error("Signed out."); }
  if (!r.ok || !d) {
    const e = new Error((d && d.message) || (r.status === 404 ? "API not found." : "HTTP " + r.status));
    e.status = r.status;
    e.code = d && d.error;
    throw e;
  }
  return d;
}

// localStorage can be blocked (private windows etc.): then quietly do without
export function getPref(key) {
  try { return window.localStorage.getItem(key); } catch (e) { return null; }
}
export function setPref(key, val) {
  try { window.localStorage.setItem(key, val); } catch (e) { /* works without saving */ }
}
