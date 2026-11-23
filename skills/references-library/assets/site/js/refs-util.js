// Small helpers for the References tab. If your site already has these (a util.js), import from there instead.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Line breaks: keep a number with its label or unit on one line ("Task 3", "260 °C", "40 nm").
// The spaces between them become no-break spaces; code, math and SVG are left alone. Add your own units to UNITS.
const UNITS = "°C|°|%|K|V|mV|kV|nm|µm|um|mm|cm|m|ms|µs|us|ns|s|h|min|kB|MB|GB|Hz|kHz|MHz|GHz|W|mW";
const NB_BEFORE = /([\p{L}\p{N}]) (?=[\d₩$€£])/gu;
const NB_AFTER = new RegExp(`(\\d[\\d.,]*) (?=(?:${UNITS})(?![\\p{L}\\p{N}]))`, "gu");
export const nb = (s) => String(s).replace(NB_BEFORE, "$1 ").replace(NB_AFTER, "$1 ");
export function keepPairs(root) {
  if (!root) return;
  const skip = "code,pre,kbd,script,style,svg,textarea,input,.katex";
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && n.parentElement.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const s = nb(n.nodeValue);
    if (s !== n.nodeValue) n.nodeValue = s;
  }
}
