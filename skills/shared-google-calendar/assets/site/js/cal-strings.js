// Every word the calendar shows, in one place (English). To translate, copy D and the date names and switch on a language.
// The static words in calendar.html (Week, Month, Title, Starts …) are in the markup itself.
import { parse, dow } from "./cal-util.js";

const D = {
  "sync.loading": "Loading", "sync.busy": "Syncing", "sync.ok": "Synced {t}", "sync.okTitle": "Refreshes every minute and when you return to this tab",
  "sync.preview": "Not connected", "sync.error": "Calendar error",
  "banner.noapi": "Couldn't reach the events API.",
  "banner.preview": "Google Calendar isn't connected yet. Striped events are a preview of the official schedule.",
  "banner.error": "Couldn't connect to Google Calendar.",
  "cal.more": "+{n} more", "cal.allday": "All day",
  "side.none": "Nothing scheduled.",
  "gcal.h": "Google Calendar", "gcal.live": "Connected to <b>{name}</b>. Changes here go straight to Google Calendar, and edits there show up here within a minute.",
  "gcal.open": "Open in Google Calendar", "gcal.seed": "Add official schedule", "gcal.seeding": "Adding…", "gcal.fail": "Failed: {m}",
  "gcal.preview": "Not connected yet.", "gcal.checking": "Checking the connection…", "gcal.retry": "Try again", "gcal.shared": "Shared calendar",
  "ev.new": "New event", "ev.edit": "Edit event", "ev.view": "Event",
  "ev.delete": "Delete", "ev.deleteSure": "Click again to delete", "ev.save": "Save", "ev.comment": "Comment", "ev.saving": "Saving…",
  "ev.by": "Added by {n}", "ev.editedBy": "Edited by {n}", "ev.recurring": "Recurring event: changes apply to this one only.",
  "ev.readonly": "Read only until Google Calendar is connected.",
  "err.title": "Add a title.", "err.date": "Pick a date.", "err.endDate": "The end date is before the start.", "err.endTime": "The end time is before the start.",
  "err.save": "Couldn't save: {m}", "err.delete": "Couldn't delete: {m}",
};

// server error codes (lib/gcal.js) → what to do, in words a teammate can act on
const ERR = {
  "not-configured": "Google Calendar is not connected yet.",
  "sa-json": "GOOGLE_SA_JSON is not valid. Paste the whole key file again.",
  "sa-key": "Couldn't read the service account key. Paste the key JSON again.",
  "google-auth": "Google sign-in failed. Check the service account key.",
  "google-401": "Google refused the credentials. Check the service account key.",
  "google-403": "The service account has no access to this calendar. Share the calendar with the service account email (\"Make changes to events\").",
  "google-404": "Calendar not found. Check GOOGLE_CALENDAR_ID and the sharing.",
};

export const t = (key, vars) => {
  const s = D[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "")) : s;
};
export const errText = (code, fallback) => (code && ERR[code]) || fallback || "";
// a plain label, or { en, … } (team.json labels may carry several languages)
export const L = (v) => (v && typeof v === "object" ? v.en ?? "" : v ?? "");

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const dows = () => DOW;
// "Dec 22"
export const dShort = (s) => { const p = parse(s); return `${MON[p.m]} ${p.d}`; };
// "Tue, Dec 22"
export const dLong = (s) => { const p = parse(s); return `${DOW[dow(s)]}, ${MON[p.m]} ${p.d}`; };
// "December 2026"
export const monthTitle = (y, m) => `${MONTH[m]} ${y}`;
// the date stamp in a list: { big: "22", small: "Dec Tue" }
export const stamp = (s) => { const p = parse(s); return { big: String(p.d), small: `${MON[p.m]} ${DOW[dow(s)]}` }; };
