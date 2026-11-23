// Lecture-notes reader: one chapter on its own page, at /theory/<sub-tab>/<chapter>.
// The server answers that address with reader.html (lib/reader-route.js); this script finds the chapter in
// /data/theory.json and renders it with chapter.js (the same numbering as the Theory tab). Light / dark uses the main
// site's saved choice (localStorage THEME_KEY). The site name comes from <meta name="application-name">.
//   contents   every part (sub-tab: I Heat, II Oscillations, …) with its chapters; the open chapter is unfolded into its
//              sections, and the sections of the part being read (h2) unfold into their subsections. Beside the text on
//              wide screens; on phones a slim bar stays at the top with the section being read and opens the same list.
//   place      the address may name a section (#fouriers-law), as "Open in reader" in the Theory tab does: the reader
//              opens there. Without one it goes back to where this chapter was last read, here or in the Theory tab
//              (chapter.js keepPlace, per chapter).
//   parts      the part is named above the title, and previous / next say so when they cross into another part.
import { renderChapter, readerUrl, tabUrl, labelOf, findChapter, allChapters, fitWide, sectionAt, readPlace, keepPlace, placeEl } from "./chapter.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const root = document.documentElement;
const dec = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
const PHONE = matchMedia("(max-width:760px)");
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const partNo = (i) => ROMAN[i] || String(i + 1);
const THEME_KEY = "site_theme"; // the main site's saved light / dark choice (design-system theme.js THEME_KEY)
const SITE = (document.querySelector('meta[name="application-name"]') || {}).content || document.title;
const HOME = "/#theory"; // the Theory tab of the main page

/* ---------- light / dark (same key and attribute as the main site) ---------- */
const prefersDark = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : prefersDark.matches);
const paintTheme = () => $("#rd-theme").setAttribute("aria-pressed", String(isDark()));
$("#rd-theme").addEventListener("click", () => {
  root.dataset.theme = isDark() ? "light" : "dark";
  try { localStorage.setItem(THEME_KEY, root.dataset.theme); } catch (e) { /* works without saving */ }
  paintTheme();
});
// a change in another tab of the site (the main page) follows here
window.addEventListener("storage", (e) => {
  if (e.key !== THEME_KEY) return;
  if (e.newValue === "light" || e.newValue === "dark") root.dataset.theme = e.newValue;
  else delete root.dataset.theme;
  paintTheme();
});
prefersDark.addEventListener("change", paintTheme);
paintTheme();
$("#rd-print").addEventListener("click", () => window.print());

/* ---------- the chapter ---------- */
const doc = $("#rd-doc");
const toc = $("#rd-toc");

function notFound(msg) {
  document.title = `Chapter not found · ${SITE}`;
  toc.hidden = true;
  doc.innerHTML = `<p class="rd-missing">${esc(msg)} <a href="${HOME}">Back to Theory</a></p>`;
  doc.removeAttribute("aria-busy");
}

// the chapter's sections: h2 items, each holding its h3 items (shown for the section being read)
function outlineList(outline) {
  const item = (h) => `<a href="#${esc(h.id)}">${h.num ? `<span class="n">${esc(h.num)}</span>` : ""}<span>${h.html}</span></a>`;
  let out = "", open = false;
  for (const h of outline) {
    if (h.level === 2) { if (open) out += "</ol></li>"; out += `<li class="l2">${item(h)}<ol>`; open = true; }
    else out += `<li class="l3">${item(h)}</li>`;
  }
  if (open) out += "</ol></li>";
  return `<ol class="rd-ol">${out}</ol>`;
}

// every part with its chapters; this chapter unfolded into its sections
function contents(data, s, c, outline) {
  return data.sections.map((x, i) => {
    const first = x.chapters[0], last = x.chapters[x.chapters.length - 1];
    const range = first ? `${labelOf(first)}${last !== first ? "–" + labelOf(last) : ""}` : "";
    const chs = x.chapters.map((y) => {
      const a = `<a href="${readerUrl(x.id, y.id)}"${y === c ? ' aria-current="page"' : ""}><span class="n">${esc(labelOf(y))}</span><span>${esc(y.title)}</span></a>`;
      return y === c ? `<li class="cur">${a}${outline.length ? outlineList(outline) : ""}</li>` : `<li>${a}</li>`;
    }).join("");
    return `<details class="rd-part"${x === s ? " open" : ""}><summary><span class="pn">${partNo(i)}</span><span class="pt">${esc(x.title)}</span><span class="pr">${esc(range)}</span></summary><ol class="rd-chs">${chs}</ol></details>`;
  }).join("");
}

function pnLink(data, x, cls, here) {
  if (!x) return "";
  const word = cls === "prev" ? "Previous" : "Next";
  const cross = x.s.id !== here.id; // the neighbour is in another part
  const head = cross ? `<small>${word} part</small><b>${partNo(data.sections.indexOf(x.s))} · ${esc(x.s.title)}</b>` : `<small>${word}</small>`;
  return `<a class="${cls}${cross ? " cross" : ""}" href="${readerUrl(x.s.id, x.c.id)}" rel="${cls}">${head}<span>${esc(labelOf(x.c))} · ${esc(x.c.title)}</span></a>`;
}

// where the reading eye is: below the top bar on phones, a little below the top on wide screens
const readLine = () => (PHONE.matches ? 48 + 56 : 140);

/* the section being read: marked in both contents lists; its subsections unfold */
function spy(onMove) {
  const lists = [...document.querySelectorAll(".rd-nav")];
  const links = lists.map((l) => [...l.querySelectorAll(".rd-ol a")]);
  const ids = (links[0] || []).map((a) => dec(a.hash.slice(1)));
  const where = $("#rd-where");
  const text = doc.querySelector(".rd-text");
  let last = null, ticking = false;
  const mark = () => {
    ticking = false;
    const at = text ? sectionAt(text, readLine()) : null;
    const cur = at ? ids.indexOf(at.id) : -1; // -1: the text before the first heading
    if (cur !== last) {
      last = cur;
      for (const ls of links) {
        ls.forEach((a, i) => { a.classList.toggle("on", i === cur); if (i === cur) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
        ls.forEach((a) => a.closest(".l2") && a.closest(".l2").classList.remove("open"));
        const on = ls[cur];
        if (on) on.closest(".l2") && on.closest(".l2").classList.add("open");
      }
      // keep the marked line inside the side list on wide screens (the list scrolls on its own, never the page)
      const on = links[0] && links[0][cur];
      if (on && toc.scrollHeight > toc.clientHeight) {
        const r = on.getBoundingClientRect(), t = toc.getBoundingClientRect();
        if (r.top < t.top + 24 || r.bottom > t.bottom - 24) toc.scrollTop += r.top - t.top - toc.clientHeight / 3;
      }
      if (where) {
        const a = links[1] && links[1][cur];
        where.innerHTML = a ? a.innerHTML : `<span class="n">${esc(where.dataset.label)}</span><span>Contents</span>`;
      }
    }
    if (onMove) onMove(at);
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, { passive: true });
  PHONE.addEventListener("change", () => { last = null; mark(); });
  mark();
}

/* ---------- where this chapter was last read ---------- */
// scroll so that `f` (0–1) of section `sec` is at the reading line; once more after the section has been laid out
function goTo(sec, f) {
  const put = () => window.scrollTo(0, Math.max(0, sec.getBoundingClientRect().top + scrollY - readLine() + 8 + f * sec.offsetHeight));
  put();
  requestAnimationFrame(() => requestAnimationFrame(put));
}

/* ---------- phones: the bar at the top and its contents sheet ---------- */
function phoneBar() {
  const bar = $("#rd-bar");
  if (!bar) return;
  const btn = $("#rd-bar-btn"), sheet = $("#rd-sheet"), scrim = $("#rd-scrim");
  const set = (open) => {
    btn.setAttribute("aria-expanded", String(open));
    sheet.hidden = !open;
    scrim.hidden = !open;
    bar.classList.toggle("open", open);
    if (open) {
      // this chapter's line at the top of the sheet; further down only if the section being read would be out of sight
      const ch = sheet.querySelector('.rd-chs a[aria-current="page"]'), on = sheet.querySelector(".rd-ol a.on");
      let top = ch ? ch.offsetTop - 8 : 0;
      if (on && on.offsetTop + on.offsetHeight - top > sheet.clientHeight * 0.7) top = on.offsetTop - sheet.clientHeight / 3;
      sheet.scrollTop = Math.max(0, top);
    }
  };
  btn.addEventListener("click", () => set(sheet.hidden));
  scrim.addEventListener("click", () => set(false));
  sheet.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) { set(false); btn.focus(); } });
  PHONE.addEventListener("change", () => { if (!PHONE.matches) set(false); });
}

async function main() {
  const parts = location.pathname.split("/").filter(Boolean).map(dec); // ["theory", sub-tab, chapter]
  const data = await fetch("/data/theory.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!data || !Array.isArray(data.sections)) return notFound("Couldn't load the chapters.");
  const hit = parts[0] === "theory" && parts.length >= 3 ? findChapter(data, parts[1], parts[2]) : null;
  if (!hit) return notFound("Chapter not found.");
  const { s, c } = hit;
  const label = labelOf(c);
  const part = data.sections.indexOf(s);

  const { html, outline } = await renderChapter(data, s, c, { mode: "reader" });
  const all = allChapters(data);
  const i = all.findIndex((x) => x.c === c);
  const prev = all[i - 1], next = all[i + 1];

  document.title = `${label} · ${c.title} · ${SITE}`;
  const back = tabUrl(s.id, c.id);
  $("#rd-crumbs").insertAdjacentHTML("beforeend", `<i aria-hidden="true">·</i><a href="/${back}">${esc(s.title)}</a>`);
  const bk = $("#rd-back");
  bk.href = "/" + back;
  // back to the Theory tab: when this page was opened from it in the same window, go back to the very spot
  bk.addEventListener("click", (e) => {
    let ref = null;
    try { ref = document.referrer ? new URL(document.referrer) : null; } catch (err) { /* none */ }
    if (ref && ref.origin === location.origin && ref.pathname === "/" && history.length > 1) { e.preventDefault(); history.back(); }
  });

  const nav = `<p class="rd-toc-h">Contents</p>${contents(data, s, c, outline)}`;
  toc.innerHTML = nav;
  toc.classList.add("rd-nav");
  doc.innerHTML = `
    <header class="rd-head">
      <p class="rd-part-h"><span class="pn">Part ${partNo(part)}</span><a href="/${back}">${esc(s.title)}</a></p>
      <h1><span class="hn">${esc(label)}</span>${esc(c.title)}</h1>
    </header>
    <div class="rd-bar" id="rd-bar">
      <button class="rd-bar-btn" type="button" id="rd-bar-btn" aria-expanded="false" aria-controls="rd-sheet" aria-label="Contents">
        <span class="rd-where" id="rd-where" data-label="${esc(label)}"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
      </button>
      <nav class="rd-sheet rd-nav" id="rd-sheet" aria-label="Contents" hidden>${contents(data, s, c, outline)}</nav>
    </div>
    <div class="doc rd-text">${html}</div>
    ${prev || next ? `<nav class="rd-pn" aria-label="Previous and next chapter">${pnLink(data, prev, "prev", s)}${pnLink(data, next, "next", s)}</nav>` : ""}`;
  document.body.insertAdjacentHTML("beforeend", '<div class="rd-scrim" id="rd-scrim" hidden></div>');
  doc.removeAttribute("aria-busy");

  const text = doc.querySelector(".rd-text");
  fitWide(text);
  phoneBar();

  // the place to open at: a section (or equation, figure) named in the address, else where this chapter was last read
  const key = `${s.id}/${c.id}`;
  const target = location.hash.length > 1 && document.getElementById(dec(location.hash.slice(1)));
  if (target) {
    location.replace(location.hash);
  } else {
    const at = readPlace(key);
    const sec = placeEl(text, at);
    if (sec) goTo(sec, Math.min(1, Math.max(0, +at.f || 0)));
  }

  // remember the place while reading (a moment after scrolling stops, and when the page is left)
  let tm = 0, now = null;
  const keep = () => {
    clearTimeout(tm);
    keepPlace(key, now && scrollY >= 80 ? now : null, readLine()); // back at the top: nothing to come back to
  };
  let ready = false;
  setTimeout(() => { ready = true; }, 600); // the jump at load is not reading
  spy((at) => { now = at; if (ready) { clearTimeout(tm); tm = setTimeout(keep, 400); } });
  addEventListener("pagehide", () => { if (ready) keep(); });
  document.addEventListener("visibilitychange", () => { if (ready && document.hidden) keep(); });
}

main();
