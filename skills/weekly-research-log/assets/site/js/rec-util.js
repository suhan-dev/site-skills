// Small helpers for the Research log tab. If your site already has these (the calendar's cal-util.js, a util.js),
// import from there instead.
export const $ = (s, el = document) => el.querySelector(s);
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// "today" in the team's zone (records.json carries it), as YYYY-MM-DD, wherever the viewer is
const fmts = new Map();
export function todayIn(tz) {
  if (!fmts.has(tz)) fmts.set(tz, new Intl.DateTimeFormat("en-CA", { timeZone: tz || undefined, year: "numeric", month: "2-digit", day: "2-digit" }));
  return fmts.get(tz).format(new Date());
}

// dates as YYYY-MM-DD strings, computed in UTC so no zone or DST change can shift them
export const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return { y, m: m - 1, d }; };
export const dow = (s) => new Date(s + "T00:00:00Z").getUTCDay();
export function addDays(s, n) { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const diffDays = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5);

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const md = (s) => { const p = parse(s); return `${p.m + 1}.${String(p.d).padStart(2, "0")}`; }; // "1.05", for the templates
export const dShort = (s) => { const p = parse(s); return `${MON[p.m]} ${p.d}`; }; // "Jan 5"
export const dLong = (s) => { const p = parse(s); return `${DOW[dow(s)]}, ${MON[p.m]} ${p.d}`; }; // "Tue, Jan 5"

// Google Calendar colour ids → the design system's --gc-1…11 (member colours, as in the calendar)
export const GCOLORS = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(i + 1), `var(--gc-${i + 1})`]));

// Line breaks: keep a number with its label or unit on one line ("Step 3", "260 °C", "40 nm").
// The spaces between them become no-break spaces; code, math and SVG are left alone. Add your own units to UNITS.
const UNITS = "°C|°|%|K|V|mV|kV|nm|µm|um|mm|cm|m|ms|µs|us|ns|s|h|min|kB|MB|GB|Hz|kHz|MHz|GHz|W|mW";
const NB_BEFORE = /([\p{L}\p{N}]) (?=[\d₩$€£])/gu;
const NB_AFTER = new RegExp(`(\\d[\\d.,]*) (?=(?:${UNITS})(?![\\p{L}\\p{N}]))`, "gu");
export const nb = (s) => String(s).replace(NB_BEFORE, "$1 ").replace(NB_AFTER, "$1 ");
export function keepPairs(root) {
  if (!root) return;
  const skip = "code,pre,kbd,script,style,svg,textarea,.katex";
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && n.parentElement.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const s = nb(n.nodeValue);
    if (s !== n.nodeValue) n.nodeValue = s;
  }
}

// A strip that scrolls sideways (the week tabs): bring the selected item into view, and mark the strip .at-end once
// nothing more is hidden on the right, which turns off its CSS edge fade.
export function sideStrip(el, sel) {
  if (!el) return;
  if (sel) {
    const a = sel.getBoundingClientRect(), b = el.getBoundingClientRect();
    if (a.right > b.right || a.left < b.left) el.scrollLeft += a.left - b.left - 16;
  }
  const upd = () => el.classList.toggle("at-end", el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  if (!el.dataset.strip) {
    el.dataset.strip = "1";
    el.addEventListener("scroll", upd, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(upd).observe(el);
  }
  upd();
}
