// The few helpers chat.js needs. If your site already has util.js (shared-google-calendar), import from there instead.
import { LANG } from "./i18n.js";

export const TIMEZONE = "Asia/Seoul"; // {{TIMEZONE}}: day labels and times in the chat use the team's zone
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
// member colours: Google Calendar colorId → the design system's --gc-N token
export const GCOLORS = Object.fromEntries(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"].map((k) => [k, `var(--gc-${k})`]));

// fetch JSON from our own API; a 401 "auth" means the session ended, so the page reloads into the sign-in screen
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

// localStorage can be blocked (private windows): then quietly do without
export function getPref(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
export function setPref(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* works without saving */ } }

// "Mon, Dec 22" / "12월 22일 (월)" for a YYYY-MM-DD day
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function dLong(s) {
  const [y, m, d] = s.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return LANG === "ko" ? `${m}월 ${d}일 (${DOW_KO[w]})` : `${DOW_EN[w]}, ${MON[m - 1]} ${d}`;
}
