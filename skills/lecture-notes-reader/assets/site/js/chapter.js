// One chapter → numbered HTML. Shared by the Theory tab (theory-tab.js) and the lecture-notes reader (reader.js).
// On top of md.js (Markdown + KaTeX), for a chapter with label L ("H1", from the file name h1-….md):
//   sections    ## and ### get numbers L.1 and L.1.1, and GitHub-style ids (#fouriers-law).
//               If the headings already carry their own numbers ("## 3.1 …"), nothing is added.
//   equations   $$ … \tag{H1.4} $$ keeps its tag. $$ … \label{eq:x} $$ without a \tag gets the next free number L.n.
//               Display math with neither stays unnumbered. A numbered equation gets the id eq-<number> (#eq-H1.4).
//   references  \eqref{eq:x} → "(H1.4)", \ref{eq:x} → "H1.4", both links. A number works as well: \eqref{H1.4},
//               or \eqref{H2.3} for another chapter (found by its label). \ref{fig:<image file name>} → "H1.2".
//   figures     a paragraph holding only an image (![caption](figures/x.svg)), or a <figure>, becomes a numbered
//               figure: "Figure L.n." in front of the caption (the image's alt text, or the <figcaption>). Ids fig-L.n.
//               If the next paragraph starts with an italic "*Figure L.n.*", that paragraph (math included) becomes the
//               caption instead, without its own "Figure L.n."; the alt text stays on the image for screen readers.
//   links       relative links to other chapters (../oscillations/o1-damped-oscillators.md#anchor) stay inside the site.
//               A link to a chapter that is not published yet shows as plain gray text (.soon) until it is.
import { renderMd, resolve, encPath } from "./md.js";

const enc = encodeURIComponent;
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// addresses of a chapter: the reader page, and the Theory tab inside the main page.
// The reader path must match the rewrite in lib/reader-route.js (and the gate, if there is one).
export const READER_PATH = "/theory/";
export const readerUrl = (sec, ch, hash = "") => `${READER_PATH}${enc(sec)}/${enc(ch)}${hash}`;
export const tabUrl = (sec, ch) => "#" + ["theory", sec, ch].filter(Boolean).map(enc).join("/");

export const labelOf = (c) => c.label || String(c.no ?? "");

// every chapter in reading order, with its sub-tab: [{ s, c }]
export const allChapters = (data) => data.sections.flatMap((s) => s.chapters.map((c) => ({ s, c })));

export function findChapter(data, secId, chId) {
  const lo = (x) => String(x || "").normalize("NFC").toLowerCase();
  const s = data.sections.find((x) => x.id === secId) || data.sections.find((x) => lo(x.id) === lo(secId));
  const c = s && (s.chapters.find((x) => x.id === chId) || s.chapters.find((x) => lo(x.id) === lo(chId)));
  return c ? { s, c } : null;
}

// the chapter labelled `label` (H2), preferring the sub-tab `near` (number labels like "2" repeat across sub-tabs)
function byLabel(data, label, near) {
  const all = allChapters(data).filter((x) => labelOf(x.c).toUpperCase() === label.toUpperCase());
  return all.find((x) => x.s.id === near) || all[0] || null;
}

/* ---------- 1. Markdown source: equation numbers and reference placeholders ---------- */
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/; // the same split as md.js: no math or references inside code
const DISPLAY = /\$\$([\s\S]+?)\$\$/g;
const TAG = /\\tag\*?\s*\{([^{}]*)\}/g;
const LABEL = /\\label\s*\{([^{}]*)\}/g;
const REF_MATH = /\$\s*\\(eqref|ref)\s*\{([^{}]+)\}\s*\$/g; // $\eqref{x}$: a reference written as math
const REF = /\\(eqref|ref)\s*\{([^{}]+)\}/g;

function prep(src, label) {
  const pieces = String(src || "").split(CODE);
  const eqs = new Map(); // \label key → equation number
  const used = new Set(); // every explicit \tag, so an automatic number never repeats one
  for (let i = 0; i < pieces.length; i += 2) {
    for (const m of pieces[i].matchAll(DISPLAY)) for (const t of m[1].matchAll(TAG)) used.add(t[1].trim());
  }
  const own = new RegExp(`^${escRe(label)}\\.(\\d+)$`, "i");
  let last = 0; // the highest L.n so far, so automatic numbers follow the explicit ones in order
  const ref = (_, kind, key) => `<a class="xref" data-kind="${kind}" data-ref="${escHtml(key.trim())}">${escHtml(key.trim())}</a>`;
  for (let i = 0; i < pieces.length; i += 2) {
    pieces[i] = pieces[i]
      .split(/(\$\$[\s\S]+?\$\$)/)
      .map((seg, j) => {
        if (j % 2) {
          let body = seg.slice(2, -2);
          const tags = [...body.matchAll(TAG)].map((t) => t[1].trim());
          const keys = [...body.matchAll(LABEL)].map((l) => l[1].trim());
          body = body.replace(LABEL, ""); // KaTeX has no \label
          if (!tags.length && keys.length) {
            let n = last + 1;
            while (used.has(`${label}.${n}`)) n++;
            tags.push(`${label}.${n}`);
            used.add(tags[0]);
            body = body.replace(/\s*$/, ` \\tag{${tags[0]}}`);
          }
          for (const t of tags) { const m = t.match(own); if (m) last = Math.max(last, +m[1]); }
          keys.forEach((k, n) => eqs.set(k, tags[Math.min(n, tags.length - 1)]));
          return `$$${body}$$`;
        }
        // text: references, but not inside inline math ($a \ref{x}$ is left to KaTeX)
        return seg.replace(REF_MATH, ref).split(/(\$[^$\n]+?\$)/).map((s, k) => (k % 2 ? s : s.replace(REF, ref))).join("");
      })
      .join("");
  }
  return { md: pieces.join(""), eqs };
}

/* ---------- 2. rendered HTML: headings, equations, figures, references ---------- */
// GitHub's heading ids: lower case, punctuation dropped, spaces → hyphens; repeats get -1, -2
const ghSlug = (s) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
const textOf = (el) => {
  const x = el.cloneNode(true);
  x.querySelectorAll(".katex-mathml").forEach((m) => m.remove());
  return x.textContent.replace(/\s+/g, " ").trim();
};

function numberHeadings(root, label) {
  const hs = [...root.querySelectorAll("h2, h3")];
  const handNumbered = hs.some((h) => /^\s*[A-Za-z]?\d+\.(?:\d+\.?)*\s/.test(textOf(h))); // "3.1 …", "H1.1 …", "1. …"
  const ids = new Set();
  const outline = [];
  let a = 0, b = 0;
  for (const h of hs) {
    const base = ghSlug(textOf(h)) || "section";
    let id = base;
    for (let n = 1; ids.has(id); n++) id = `${base}-${n}`;
    ids.add(id);
    h.id = id;
    let num = "";
    if (!handNumbered) {
      if (h.tagName === "H2") { a++; b = 0; num = `${label}.${a}`; }
      else if (a) { b++; num = `${label}.${a}.${b}`; }
    } else {
      // a number written in the heading ("1.2 Plane waves") gets the same quiet style as an added one
      const tn = h.firstChild;
      const m = tn && tn.nodeType === 3 && tn.data.match(/^\s*([A-Za-z]?\d+(?:\.\d+)*\.?)\s+/);
      if (m) { tn.data = tn.data.slice(m[0].length); num = m[1]; }
    }
    const html = h.innerHTML;
    if (num) h.insertAdjacentHTML("afterbegin", `<span class="hn">${escHtml(num)}</span> `);
    outline.push({ level: h.tagName === "H2" ? 2 : 3, id, num, html });
  }
  return outline;
}

// each numbered display equation gets the id eq-<tag>; rows of an align with several tags get an empty anchor each
function numberEquations(root) {
  const doc = root.ownerDocument;
  const seen = new Set();
  for (const d of root.querySelectorAll(".katex-display")) {
    const tag = d.querySelector(".katex-html .tag");
    if (!tag) continue;
    for (const [, t] of tag.textContent.matchAll(/\(([^()]+)\)/g)) {
      const id = "eq-" + t.replace(/[\s​]+/g, "");
      if (seen.has(id)) continue;
      seen.add(id);
      if (!d.id) d.id = id;
      else { const s = doc.createElement("span"); s.className = "eq-anchor"; s.id = id; d.prepend(s); }
    }
    // the number again, under the formula: shown instead of KaTeX's own when the formula is too wide for the column
    // (fitWide), so the number never sits on top of the formula
    const n = doc.createElement("span");
    n.className = "eq-n";
    n.setAttribute("aria-hidden", "true");
    n.textContent = [...tag.textContent.matchAll(/\([^()]+\)/g)].map((x) => x[0].replace(/[\s\u200b]+/g, "")).join(", ");
    d.after(n);
  }
}

// A paragraph that starts with an italic "Figure H1.1." is the long caption of the figure just above it.
// Returns { p, num } with that leading "Figure H1.1." (and the space after it) already taken out, or null.
function longCaption(p) {
  if (!p || p.tagName !== "P") return null;
  let first = p.firstChild;
  while (first && first.nodeType === 3 && !first.textContent.trim()) first = first.nextSibling;
  if (!first || !/^(EM|I)$/.test(first.nodeName)) return null;
  const m = first.textContent.trim().match(/^Figure\s+([A-Za-z]*\d+\.\d+)\.?$/);
  if (!m) return null;
  const after = first.nextSibling;
  first.remove();
  if (after && after.nodeType === 3) after.textContent = after.textContent.replace(/^[\s.:\u2014\u2013-]+/, "");
  return { p, num: m[1] };
}

function numberFigures(root, label, dir, base) {
  const doc = root.ownerDocument;
  // raw <img src="figures/x.svg"> is not rewritten by md.js: point it at the copy under `base` (/repo/) too
  for (const img of root.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src");
    if (!/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(src)) img.setAttribute("src", base + encPath(resolve(dir, src)));
  }
  // a paragraph that holds only an image becomes a figure; the alt text is its caption
  for (const p of root.querySelectorAll("p")) {
    const kids = [...p.childNodes].filter((n) => !(n.nodeType === 3 && !n.textContent.trim()));
    if (kids.length !== 1 || kids[0].nodeName !== "IMG") continue;
    const img = kids[0];
    const fig = doc.createElement("figure");
    fig.append(img);
    const alt = (img.getAttribute("alt") || "").trim();
    const long = longCaption(p.nextElementSibling);
    if (long) {
      // the next paragraph is the full caption ("*Figure H1.1.* (a) … $T_0$ …"): it becomes the figcaption, math and all,
      // without its own "Figure H1.1." (the number below is the one shown). The alt text stays on the image.
      const cap = doc.createElement("figcaption");
      cap.className = "long";
      cap.append(...long.p.childNodes);
      fig.append(cap);
      fig.dataset.given = long.num;
      long.p.remove();
    } else if (alt) { const cap = doc.createElement("figcaption"); cap.textContent = alt; fig.append(cap); }
    p.replaceWith(fig);
  }
  const figs = new Map(); // ref key → { num, id }
  let n = 0;
  for (const f of root.querySelectorAll("figure")) {
    const num = `${label}.${++n}`;
    if (f.dataset.given && f.dataset.given !== num) console.warn(`Figure ${num}: its caption says Figure ${f.dataset.given}`);
    const given = f.id;
    f.id = `fig-${num}`;
    let cap = [...f.children].find((x) => x.tagName === "FIGCAPTION");
    if (!cap) { cap = doc.createElement("figcaption"); f.append(cap); }
    cap.insertAdjacentHTML("afterbegin", `<span class="fn">Figure ${escHtml(num)}.</span> `);
    const entry = { num, id: f.id };
    if (given) figs.set(given, entry);
    const img = f.querySelector("img[src]");
    if (img) {
      let stem = img.getAttribute("src").split(/[?#]/)[0].split("/").pop().replace(/\.[^.]+$/, "");
      try { stem = decodeURIComponent(stem); } catch (e) { /* keep as is */ }
      figs.set("fig:" + stem, entry);
    }
  }
  return figs;
}

function resolveRefs(root, { eqs, figs, data, s, label, mode }) {
  const doc = root.ownerDocument;
  for (const a of root.querySelectorAll("a.xref[data-ref]")) {
    const key = a.dataset.ref;
    let num = null, href = null;
    if (eqs.has(key)) { num = eqs.get(key); href = "#eq-" + num; }
    else if (figs.has(key)) { ({ num } = figs.get(key)); href = "#" + figs.get(key).id; }
    else {
      const m = key.match(/^([A-Za-z]?\d+)\.\d+[a-z]?$/); // an equation number: H1.4 here, H2.3 in chapter H2
      if (m && m[1].toUpperCase() === label.toUpperCase()) { num = key; href = "#eq-" + key; }
      else if (m) {
        const o = byLabel(data, m[1], s.id);
        if (o) { num = key; href = mode === "reader" ? readerUrl(o.s.id, o.c.id, "#eq-" + key) : tabUrl(o.s.id, o.c.id); }
      }
    }
    if (!href) {
      const bad = doc.createElement("span");
      bad.className = "xref bad";
      bad.title = "Unknown reference: " + key;
      bad.textContent = "(??)";
      a.replaceWith(bad);
      continue;
    }
    a.href = href;
    a.textContent = a.dataset.kind === "eqref" && !key.startsWith("fig:") ? `(${num})` : num;
    a.removeAttribute("data-kind");
    a.removeAttribute("data-ref");
  }
}

// Long chapters: the text is cut into <section class="cs"> at every h2 and h3 (the text before the first heading is one
// too; a section that starts at an h3 also gets "cs3"). reader.css and theory.css give each one content-visibility:auto,
// so the browser lays out only the sections near the screen. Until a section is laid out it takes an estimated height
// from its text length, display equations, figures and table rows (--t --e --f --r, fitted to the real heights).
function sectionize(root) {
  const doc = root.ownerDocument;
  const secs = [];
  let cur = null;
  for (const n of [...root.childNodes]) {
    const head = n.nodeType === 1 && (n.tagName === "H2" || n.tagName === "H3");
    if (!cur || head) {
      cur = doc.createElement("section");
      cur.className = head && n.tagName === "H3" ? "cs cs3" : "cs";
      root.insertBefore(cur, n);
      secs.push(cur);
    }
    cur.append(n);
  }
  for (const sec of secs) {
    let t = sec.textContent.length;
    for (const m of sec.querySelectorAll(".katex-mathml")) t -= m.textContent.length; // KaTeX's hidden MathML copy
    const e = sec.querySelectorAll(".katex-display").length;
    const f = sec.querySelectorAll("figure").length;
    const r = sec.querySelectorAll("tr").length;
    sec.style.cssText = `--t:${t};--e:${e};--f:${f};--r:${r}`;
  }
}

/* ---------- the whole chapter ---------- */
const NOT_YET = "#not-published-yet";
// mode "tab": chapter links become #theory/<sub-tab>/<chapter>; mode "reader": /theory/<sub-tab>/<chapter>#anchor.
// data.root is the chapters' folder in the repository ("theory"), data.base where the build copied the figures ("/repo/"),
// data.repo / data.branch the GitHub repository for links to other files (optional).
// Returns { html, outline: [{ level 2|3, id, num, html }] }.
export async function renderChapter(data, s, c, { mode = "tab" } = {}) {
  const label = labelOf(c);
  const root0 = data.root || "theory";
  const base = data.base || "/repo/";
  const dir = root0 + "/" + s.id;
  const { md, eqs } = prep(c.md, label);
  const inRoot = new RegExp(`^${escRe(root0)}\\/([^/]+)\\/([^/]+)\\.md$`, "i");
  const link = (path, hash) => {
    const m = path.match(inRoot);
    const o = m && findChapter(data, m[1], m[2]);
    if (!o) return m ? NOT_YET : null; // a chapter that is planned but not published yet: plain text below, no dead link
    return mode === "reader" ? readerUrl(o.s.id, o.c.id, hash) : tabUrl(o.s.id, o.c.id);
  };
  const tpl = document.createElement("template"); // inert: nothing loads before the HTML is placed in the page
  tpl.innerHTML = await renderMd(md, { dir, repo: data.repo || "", branch: data.branch || "main", link, base });
  const root = tpl.content;
  for (const a of root.querySelectorAll(`a[href="${NOT_YET}"]`)) {
    const sp = document.createElement("span");
    sp.className = "soon";
    sp.title = "Not published yet";
    sp.append(...a.childNodes);
    a.replaceWith(sp);
  }
  const outline = numberHeadings(root, label);
  numberEquations(root);
  const figs = numberFigures(root, label, dir, base);
  resolveRefs(root, { eqs, figs, data, s, label, mode });
  sectionize(root);
  return { html: tpl.innerHTML, outline };
}

/* ---------- on screen: formulas and tables wider than the column ---------- */
// A display formula too wide for the column gets "wide": it starts at the left and scrolls sideways, and its number moves
// to the line under it (.eq-n), so the number never covers the formula. The test uses the formula's own width and the
// number's width as first measured, so switching does not change the answer. Anything that scrolls sideways (formulas,
// tables, code) gets "sx", and "sx-l" / "sx-r" while there is more to see on that side: the CSS fades that edge.
// Sections far from the screen are not laid out (content-visibility), so each block is measured when it is.
// Returns a function that stops watching (the Theory tab draws a new chapter into the same place).
export function fitWide(root) {
  const edge = (el) => {
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle("sx", max > 1);
    el.classList.toggle("sx-l", max > 1 && el.scrollLeft > 1);
    el.classList.toggle("sx-r", max > 1 && el.scrollLeft < max - 1);
  };
  const fit = (el) => {
    if (!el.clientWidth || (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true }))) return;
    if (el.classList.contains("katex-display")) {
      const html = el.querySelector(".katex-html");
      const bases = html ? html.querySelectorAll(":scope>.base") : [];
      if (bases.length) {
        const tag = html.querySelector(":scope>.tag");
        if (tag && el._tw == null && !el.classList.contains("wide")) el._tw = tag.getBoundingClientRect().width;
        const w = bases[bases.length - 1].getBoundingClientRect().right - bases[0].getBoundingClientRect().left;
        el.classList.toggle("wide", w + (tag ? 2 * (el._tw || 0) + 16 : 0) > el.clientWidth + 0.5);
      }
    }
    edge(el);
  };
  const ro = new ResizeObserver((list) => list.forEach((x) => fit(x.target)));
  root.querySelectorAll(".katex-display, table, pre").forEach((el) => ro.observe(el));
  const onScroll = (e) => { const el = e.target; if (el.classList && el.classList.contains("sx")) edge(el); };
  root.addEventListener("scroll", onScroll, { capture: true, passive: true });
  return () => { ro.disconnect(); root.removeEventListener("scroll", onScroll, { capture: true }); };
}

// the section being read: the last section of the text whose top is above `line` (px from the top of the window).
// Returns { el, id } (id of its heading, "" for the text before the first heading) or null above the first one.
export function sectionAt(root, line) {
  const secs = root.querySelectorAll(".cs");
  let hit = null;
  for (const sec of secs) {
    if (sec.getBoundingClientRect().top >= line) break;
    hit = sec;
  }
  if (!hit) return null;
  const h = hit.firstElementChild;
  return { el: hit, id: h && /^H[23]$/.test(h.tagName) ? h.id : "" };
}

// where a chapter was last read, kept per chapter ("<sub-tab>/<chapter>") in localStorage, shared by the Theory tab and
// the reader: { id: heading id of the section ("" before the first heading), f: how far into that section, 0–1, t: time }.
// The 60 most recent chapters are kept.
export const AT_KEY = "rd_at";
const allPlaces = () => { try { return JSON.parse(localStorage.getItem(AT_KEY) || "{}") || {}; } catch (e) { return {}; } };
export const readPlace = (key) => allPlaces()[key] || null;
export function keepPlace(key, at, line) {
  try {
    const all = allPlaces();
    if (at) {
      const r = at.el.getBoundingClientRect();
      all[key] = { id: at.id, f: +Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height))).toFixed(3), t: Date.now() };
    } else delete all[key];
    const keep = Object.entries(all).sort((a, b) => (b[1].t || 0) - (a[1].t || 0)).slice(0, 60);
    localStorage.setItem(AT_KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch (e) { /* works without saving */ }
}
// the section of a kept place in `root`, or null
export function placeEl(root, at) {
  if (!at) return null;
  const h = at.id ? root.querySelector(`[id="${CSS.escape(at.id)}"]`) : null;
  return h ? h.closest(".cs") : at.id === "" ? root.querySelector(".cs") : null;
}
