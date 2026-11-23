// Theory tab: sub-tabs from theory/sections.json, each with chapters from theory/<section>/<label>-slug.md (h1-….md).
// Data comes from /data/theory.json, written by build_theory.py. The chapter text is Markdown with KaTeX,
// numbered by chapter.js (sections, equations, figures). Each chapter also opens alone in the reader (reader.html).
// Deep links: #theory · #theory/<section> · #theory/<section>/<chapter>, e.g. #theory/heat/h1-heat-flow-in-a-rod.
// The page provides #pane-theory holding #th-tabs, #th-layout > (#th-toc, #th-body), and a sticky header .bar.
// "Open in reader" opens the reader at the section on screen; scrolled back to the top, at the place where reading
// stopped (kept per chapter while reading here, chapter.js keepPlace). On wide screens it opens in a new tab and the link
// also stays beside the text, under the chapter list; on phones and in the Home Screen app it opens in the same window
// (the reader's back link returns here).
import { renderChapter, readerUrl, labelOf, fitWide, sectionAt, keepPlace } from "./chapter.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// UI words. Pass your own t(key, vars) for other languages; terms and chapter titles stay as written.
const EN = {
  "tab.theory": "Theory", "th.chapters": "Chapters", "th.no": "Chapter {n}", "th.reader": "Open in reader", "th.prev": "Previous",
  "th.next": "Next", "th.pn": "Previous and next chapter", "th.empty": "Chapters are being written.",
};
const tEN = (k, v = {}) => String(EN[k] || k).replace(/\{(\w+)\}/g, (_, n) => (v[n] != null ? v[n] : ""));

// a sideways strip (the sub-tabs on phones): bring the selected item into view, and mark "at-end" when scrolled to the
// end, so the CSS stops fading the right edge
function sideStrip(el, sel) {
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

const link = (...ids) => "#" + ["theory", ...ids].map(encodeURIComponent).join("/");

// t: the UI words (default English). Re-renders on the window event "site:lang" (fire it after a language switch).
export function createTheory({ t = tEN } = {}) {
  let data = null;
  let sec = null; // id of the sub-tab on screen
  const chap = {}; // last chapter shown in each sub-tab
  let drawn = ""; // what is on screen now ("section/chapter"), to skip needless redraws
  let seq = 0;
  let unfit = null; // stops fitWide for the chapter drawn before

  async function ensure() {
    if (!data) data = await fetch("/data/theory.json", { cache: "no-cache" }).then((r) => r.json()).catch(() => null);
    if (!data || !Array.isArray(data.sections)) data = { sections: [] };
    return data;
  }

  function chapterList(s, cur) {
    return s.chapters.map((c) => `<a href="${link(s.id, c.id)}"${c.id === cur.id ? ' class="on" aria-current="page"' : ""}><span class="n">${esc(labelOf(c))}</span><span>${esc(c.title)}</span></a>`).join("");
  }

  async function render(force) {
    const S = data.sections;
    const s = S.find((x) => x.id === sec) || S[0];
    const c = s && (s.chapters.find((x) => x.id === chap[s.id]) || s.chapters[0]);
    const key = `${s ? s.id : ""}/${c ? c.id : ""}`;
    if (!force && key === drawn) return false;
    const my = ++seq;
    if (s) { sec = s.id; if (c) chap[s.id] = c.id; }

    const tabs = S.length ? `<nav class="th-tabs" role="tablist" aria-label="${esc(t("tab.theory"))}">${S.map((x) =>
      `<a role="tab" href="${link(x.id)}" aria-selected="${x === s}"${x.short ? ` title="${esc(x.title)}"><span class="th-full">${esc(x.title)}</span><span class="th-short">${esc(x.short)}</span>` : `>${esc(x.title)}`}</a>`).join("")}</nav>` : "";
    let toc = "", body;
    if (!c) body = `<p class="th-empty">${esc(t("th.empty"))}</p>`;
    else {
      const i = s.chapters.indexOf(c);
      const prev = s.chapters[i - 1], next = s.chapters[i + 1];
      const pn = (x, cls, k) => (x ? `<a class="${cls}" href="${link(s.id, x.id)}"><small>${esc(t(k))}</small><span>${esc(labelOf(x))} · ${esc(x.title)}</span></a>` : "");
      const { html: md } = await renderChapter(data, s, c, { mode: "tab" });
      if (my !== seq) return false; // a newer render started while this one waited
      toc = `<b>${esc(t("th.chapters"))}</b>${chapterList(s, c)}<a class="th-open th-open-side" href="${readerUrl(s.id, c.id)}" target="_blank" rel="noopener">${esc(t("th.reader"))}<span class="ext" aria-hidden="true">↗</span></a>`;
      body = `<details class="th-mtoc"><summary>${esc(t("th.chapters"))}</summary>${chapterList(s, c)}</details>
        <header><p class="eyebrow">${esc(s.title)} · ${esc(t("th.no", { n: labelOf(c) }))}</p>
          <div class="th-title"><h1 class="page-h">${esc(c.title)}</h1><a class="th-open" href="${readerUrl(s.id, c.id)}" target="_blank" rel="noopener">${esc(t("th.reader"))}<span class="ext" aria-hidden="true">↗</span></a></div></header>
        <div class="doc th-doc">${md}</div>
        ${prev || next ? `<nav class="th-pn" aria-label="${esc(t("th.pn"))}">${pn(prev, "prev", "th.prev")}${pn(next, "next", "th.next")}</nav>` : ""}`;
    }
    $("#th-tabs").innerHTML = tabs;
    sideStrip($("#th-tabs .th-tabs"), $("#th-tabs [aria-selected=true]"));
    $("#th-layout").classList.toggle("empty", !c);
    $("#th-toc").innerHTML = toc;
    $("#th-toc").setAttribute("aria-label", t("th.chapters"));
    $("#th-body").innerHTML = body;
    if (unfit) unfit();
    const text = $("#th-body .th-doc");
    unfit = text ? fitWide(text) : null;
    drawn = key;
    return true;
  }

  // section and chapter come from the address (#theory/<section>/<chapter>); missing parts keep the last choice
  async function show(sectionId, chapterId) {
    await ensure();
    const before = drawn;
    if (sectionId && data.sections.some((x) => x.id === sectionId)) sec = sectionId;
    if (chapterId && sec) chap[sec] = chapterId;
    // a new chapter starts at the top of the page
    if ((await render()) && before) window.scrollTo(0, 0);
  }

  // links inside a chapter (#eq-B3.4, #fig-B3.1, #section-id) scroll there instead of changing the tab address
  $("#th-body").addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    let id = a.getAttribute("href").slice(1);
    try { id = decodeURIComponent(id); } catch (err) { /* keep as is */ }
    const el = id && !/^theory(\/|$)/.test(id) ? $("#th-body").querySelector(`[id="${CSS.escape(id)}"]`) : null;
    if (!el) return;
    e.preventDefault();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches; // added in the skill
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: el.matches("h2, h3") ? "start" : "center" });
    el.classList.remove("hit");
    void el.offsetWidth; // restart the highlight
    el.classList.add("hit");
  });

  // "Open in reader": point it at the section being read just before it is followed (click, middle click, long press)
  const SAME = matchMedia("(max-width:760px), (display-mode: standalone)");
  // the reading line: a quarter of the way down the part of the window under the site header
  const line = () => { const bar = document.querySelector(".bar"); const top = bar ? bar.getBoundingClientRect().bottom : 0; return top + (innerHeight - top) / 4; };
  const aim = (e) => {
    const a = e.target.closest && e.target.closest(".th-open");
    if (!a) return;
    const text = $("#th-body .th-doc");
    const at = text ? sectionAt(text, line()) : null;
    const [sid, cid] = drawn.split("/");
    a.href = readerUrl(sid, cid, at && at.id ? "#" + encodeURIComponent(at.id) : "");
    if (SAME.matches || navigator.standalone === true) { a.removeAttribute("target"); a.removeAttribute("rel"); }
    else { a.target = "_blank"; a.rel = "noopener"; }
  };
  for (const ev of ["pointerdown", "click", "auxclick", "contextmenu", "focusin"]) $("#pane-theory").addEventListener(ev, aim, true);

  // keep the place while reading here (a moment after scrolling stops); the top of the chapter is not kept, so scrolling
  // back up to "Open in reader" still opens the reader where reading stopped
  let tm = 0;
  addEventListener("scroll", () => {
    clearTimeout(tm);
    tm = setTimeout(() => {
      const text = $("#th-body .th-doc");
      if (!text || !text.offsetParent || !drawn) return;
      const at = sectionAt(text, line());
      if (at) keepPlace(drawn, at, line());
    }, 700);
  }, { passive: true });

  window.addEventListener("site:lang", () => { if (drawn) render(true); });
  return { show, ensure };
}
