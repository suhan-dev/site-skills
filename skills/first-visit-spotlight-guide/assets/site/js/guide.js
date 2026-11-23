// First-visit guide: a dim layer with a rounded hole over the real page (the spotlight) and a small panel with a
// title, one or two sentences, Skip, Back / Next and step dots. On phones (≤ 760 px) the panel is a bottom sheet.
//
// - It starts by itself once per member (picked(id)), a moment after the member is known, never for the ids in noAuto.
//   "Seen" is kept in this browser (localStorage) and, when the site has the sign-in gate, on the server for the member
//   (GET /api/me seen.guide, POST /api/me { seen: "guide" }), so a second device or a cleared browser doesn't show it again.
// - It reopens from a "Site guide" item in the member's menu (menuItem).
// - Read-only: the page under it can't be clicked, scrolled by the user or focused (inert), so nothing is changed by
//   accident. Esc, Skip and Done all end it and all count as seen.
// - Keys: → and Enter go on, ← goes back, Esc skips; Tab stays inside the panel.
// Look: css/guide.css (design-system tokens, light and dark).
//
// createGuide({ steps, me, ... }) → { start, stop, picked, isOpen }.
// A step: { at: [selectors], alt: "selector", tight: bool, title, text }
//   at:    the elements to spotlight (the visible ones are joined into one hole);
//   alt:   a visible container to spotlight when none of them shows (e.g. a button hidden on phones);
//   tight: spotlight the words, not the whole box (a header tab that is 52 px tall);
//   title, text: strings, or functions ({ name, phone }) → string.
//   No `at`, or nothing visible: no hole, and the panel is centred.

const PHONE = "(max-width: 760px)";
const EASE = 280; // spotlight and panel movement between steps, ms
const PAD = 6; // around the spotlit element, px

const $ = (q, root = document) => (typeof q === "string" ? root.querySelector(q) : q);
const getPref = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* works without saving */ } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const phone = () => matchMedia(PHONE).matches;
const easeOut = (x) => 1 - (1 - x) ** 3;
const mix = (a, b, k) => a + (b - a) * k;
const point = (r) => { const x = (r.l + r.r) / 2, y = (r.t + r.b) / 2; return { l: x, t: y, r: x, b: y }; };

/* ---------- finding what to spotlight ---------- */
function rectOf(el, tight) {
  if (!el || !el.isConnected || getComputedStyle(el).visibility === "hidden") return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2 || r.right <= 0 || r.left >= innerWidth) return null;
  if (tight) {
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const w = rg.getBoundingClientRect();
    if (w.width > 2 && w.height > 2) return { l: w.left - 2, t: w.top - 3, r: w.right + 2, b: w.bottom + 3 };
  }
  return { l: r.left, t: r.top, r: r.right, b: r.bottom };
}
function union(rs) {
  rs = rs.filter(Boolean);
  if (!rs.length) return null;
  return { l: Math.min(...rs.map((r) => r.l)), t: Math.min(...rs.map((r) => r.t)), r: Math.max(...rs.map((r) => r.r)), b: Math.max(...rs.map((r) => r.b)) };
}

export function createGuide({
  steps,
  me = () => null, // → { id, name } of the member, or null
  serverSeen = () => null, // → true / false from GET /api/me seen.guide, or null when the server can't say
  markSeen = () => {}, // (id) → record it on the server, e.g. POST /api/me { seen: "guide" }
  noAuto = [], // member ids that never get it by themselves (the site's owner, who knows it)
  app = "#app", // the page under the guide: made inert while it is open
  bar = ".bar", // the sticky header: a target below it is never spotlit under it
  home = null, // { pane, hash }: if that pane is hidden, switch to it (location.replace(hash)) while the tour runs
  returnFocus = "#me-btn", // focus goes here when the guide ends
  menuItem = null, // a button (or selector) that opens the guide again, e.g. "Site guide" in the name menu
  blocked = () => document.documentElement.classList.contains("intro-on") || !!document.querySelector("dialog[open]"),
  key = (id) => `site_guide_v1_${id}`,
  delay = 400, // after the member is known
  words = { skip: "Skip", back: "Back", next: "Next", done: "Done", step: (n, of) => `Step ${n} of ${of}` },
} = {}) {
  let root = null, hole, panel, hEl, pEl, dots, srStep, skipB, backB, nextB;
  let active = false, i = 0, raf = 0, t0 = 0, timer = 0;
  let from = null, cur = null, pFrom = null, pCur = null, memo = null;
  const NO_AUTO = new Set(noAuto);
  const ctx = () => { const m = me(); return { name: m ? m.name || m.id : "", phone: phone() }; };
  const val = (v) => (typeof v === "function" ? v(ctx()) : v);

  /** The step's target: its rectangle (viewport px) and whether it sits in the header. */
  function target(s) {
    if (!s.at) return null;
    const els = s.at.map((q) => $(q));
    let r = union(els.map((el) => rectOf(el, s.tight)));
    let el = els.find((e) => rectOf(e));
    if (!r && s.alt) { el = $(s.alt); r = rectOf(el); }
    return r ? { ...r, inBar: !!(bar && el.closest(bar)) } : null;
  }
  /** Bottom of the header while it stays on screen (sticky or fixed). */
  function barBottom() {
    const b = bar && $(bar);
    if (!b || !/sticky|fixed/.test(getComputedStyle(b).position)) return 0;
    return Math.max(0, b.getBoundingClientRect().bottom);
  }

  /* ---------- panel ---------- */
  function build() {
    root = document.createElement("div");
    root.className = "guide is-off";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "guide-h");
    root.setAttribute("aria-describedby", "guide-p");
    root.setAttribute("data-lang-fixed", "");
    root.innerHTML = `<div class="guide-hole none" aria-hidden="true"></div>
      <section class="guide-panel">
        <div class="guide-top"><h2 class="guide-h" id="guide-h"></h2><button type="button" class="guide-skip"></button></div>
        <p class="guide-p" id="guide-p" aria-live="polite"></p>
        <div class="guide-foot">
          <button type="button" class="guide-back"></button>
          <div class="guide-dots"><span class="guide-sr"></span>${steps.map(() => '<i aria-hidden="true"></i>').join("")}</div>
          <button type="button" class="guide-next"></button>
        </div>
      </section>`;
    hole = $(".guide-hole", root);
    panel = $(".guide-panel", root);
    hEl = $(".guide-h", root);
    pEl = $(".guide-p", root);
    dots = [...root.querySelectorAll(".guide-dots i")];
    srStep = $(".guide-sr", root);
    skipB = $(".guide-skip", root);
    backB = $(".guide-back", root);
    nextB = $(".guide-next", root);
    skipB.textContent = words.skip;
    backB.textContent = words.back;
    skipB.addEventListener("click", () => stop());
    backB.addEventListener("click", () => { if (i > 0) go(i - 1); });
    nextB.addEventListener("click", () => (i < steps.length - 1 ? go(i + 1) : stop()));
    // the page under the guide neither scrolls nor takes clicks, and the dim layer never takes focus
    const still = (e) => { if (!(panel.contains(e.target) && panel.scrollHeight > panel.clientHeight)) e.preventDefault(); };
    root.addEventListener("wheel", still, { passive: false });
    root.addEventListener("touchmove", still, { passive: false });
    root.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) e.preventDefault(); });
    document.body.appendChild(root);
  }

  function go(n) {
    i = n;
    const s = steps[n];
    hEl.textContent = val(s.title);
    pEl.textContent = val(s.text);
    srStep.textContent = words.step(n + 1, steps.length);
    dots.forEach((d, k) => d.classList.toggle("on", k === n));
    backB.disabled = n === 0;
    nextB.textContent = n === steps.length - 1 ? words.done : words.next;
    from = cur && { ...cur };
    pFrom = pCur && { ...pCur };
    t0 = performance.now();
    reveal(target(s));
    nextB.focus({ preventScroll: true });
  }

  /** Scroll the page so the target sits between the header and the panel (the sheet on phones). */
  function reveal(tg) {
    if (!tg || tg.inBar) return;
    const top = barBottom() + 12;
    const bottom = (phone() ? panel.getBoundingClientRect().top : innerHeight) - 12;
    // a little more air than needed, so the next step's neighbour fits too
    const room = bottom - top, h = tg.b - tg.t, air = Math.min(16, (room - h) / 2);
    let dy = 0;
    if (h <= room) { if (tg.t < top) dy = tg.t - top - air; else if (tg.b > bottom) dy = tg.b - bottom + air; }
    else if (tg.t < top || tg.t > top + room * 0.4) dy = tg.t - top; // taller than the room: show its top part
    if (Math.abs(dy) > 1) window.scrollBy({ top: dy, behavior: reduced() ? "auto" : "smooth" });
  }

  /** Desktop: the first place next to the hole where the whole panel fits without covering it (below or above
      first, above first when the hole is in the lower half; then right, then left). If there is none, the panel sits
      at the bottom and the hole ends above it (a target as tall as the screen, like a calendar). No hole: centred. */
  function place(h, W, H) {
    const M = 16, G = 14, bw = panel.offsetWidth, bh = panel.offsetHeight;
    const cx = (v) => clamp(v, M, W - bw - M), cy = (v) => clamp(v, M, H - bh - M);
    if (!h) return { x: cx((W - bw) / 2), y: cy((H - bh) / 2), h };
    const o = { l: h.l - 8, t: h.t - 8, r: h.r + 8, b: h.b + 8 };
    const fits = ([x, y]) => x >= M && y >= M && x + bw <= W - M && y + bh <= H - M && !(x < o.r && x + bw > o.l && y < o.b && y + bh > o.t);
    const hx = (h.l + h.r) / 2, hy = (h.t + h.b) / 2;
    const below = [cx(hx - bw / 2), h.b + G], above = [cx(hx - bw / 2), h.t - G - bh];
    const right = [h.r + G, cy(hy - bh / 2)], left = [h.l - G - bw, cy(hy - bh / 2)];
    const p = (hy > H / 2 ? [above, below, right, left] : [below, above, right, left]).find(fits);
    if (p) return { x: p[0], y: p[1], h };
    const y = H - M - bh;
    if (y - G - h.t >= 40) return { x: cx(hx - bw / 2), y, h: { ...h, b: Math.min(h.b, y - G) } };
    return { x: cx((W - bw) / 2), y: cy((H - bh) / 2), h: null };
  }

  /* ---------- every frame: follow the target (it may move while the page scrolls), ease between steps ---------- */
  function frame(now) {
    if (!active) return;
    raf = requestAnimationFrame(frame);
    const W = innerWidth, H = innerHeight, ph = phone();
    const tg = target(steps[i]);
    let want = null;
    if (tg) {
      const top = tg.inBar ? 4 : barBottom() + 4;
      const bottom = ph ? panel.getBoundingClientRect().top - 10 : H - 4;
      want = { l: Math.max(4, tg.l - PAD), t: Math.max(top, tg.t - PAD), r: Math.min(W - 4, tg.r + PAD), b: Math.min(bottom, tg.b + PAD) };
      if (want.r - want.l < 16 || want.b - want.t < 16) want = null;
    }
    let pos = null;
    if (!ph) { const p = place(want, W, H); pos = { x: p.x, y: p.y }; want = p.h; }

    const k = reduced() ? 1 : easeOut(clamp((now - t0) / EASE, 0, 1));
    if (!from || (want && from.r - from.l < 1)) from = want ? point(want) : point({ l: 0, t: 0, r: W, b: H }); // open from the target's centre
    const goal = want || point(from); // no target: the hole closes where it was
    cur = { l: mix(from.l, goal.l, k), t: mix(from.t, goal.t, k), r: mix(from.r, goal.r, k), b: mix(from.b, goal.b, k) };
    const w = cur.r - cur.l, h = cur.b - cur.t;
    hole.style.transform = `translate(${cur.l.toFixed(1)}px,${cur.t.toFixed(1)}px)`;
    hole.style.width = `${w.toFixed(1)}px`;
    hole.style.height = `${h.toFixed(1)}px`;
    hole.style.borderRadius = `${Math.min(12, w / 2, h / 2).toFixed(1)}px`;
    hole.classList.toggle("none", w < 4 || h < 4);

    if (pos) {
      const pf = pFrom || pos;
      pCur = { x: mix(pf.x, pos.x, k), y: mix(pf.y, pos.y, k) };
      panel.style.transform = `translate(${Math.round(pCur.x)}px,${Math.round(pCur.y)}px)`;
    } else {
      pCur = null;
      panel.style.transform = "";
    }
  }

  /* ---------- keys and focus: Esc skips, ← → step, Enter goes on; Tab stays in the panel ---------- */
  function onKey(e) {
    if (!active) return;
    const btn = e.target instanceof Element && e.target.closest(".guide button");
    const eat = () => { e.preventDefault(); e.stopPropagation(); };
    switch (e.key) {
      case "Escape": eat(); stop(); return;
      case "ArrowRight": eat(); if (i < steps.length - 1) go(i + 1); return;
      case "ArrowLeft": eat(); if (i > 0) go(i - 1); return;
      case "Enter": if (btn) { e.stopPropagation(); return; } eat(); nextB.click(); return;
      case " ": if (btn) { e.stopPropagation(); return; } eat(); return;
      case "Tab": {
        eat();
        const f = [skipB, backB, nextB].filter((b) => !b.disabled);
        const at = f.indexOf(document.activeElement);
        f[at < 0 ? 0 : (at + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
        return;
      }
      case "ArrowUp": case "ArrowDown": case "PageUp": case "PageDown": case "Home": case "End": eat(); return;
      default: e.stopPropagation(); // the page's own shortcuts stay quiet while the guide is open
    }
  }
  function onFocus(e) {
    if (active && root && !root.contains(e.target)) nextB.focus({ preventScroll: true });
  }

  function start() {
    clearTimeout(timer);
    if (active || blocked()) return;
    active = true;
    from = cur = pFrom = pCur = null;
    const a = $(app), pane = home && $(home.pane);
    memo = { hash: pane && pane.hidden ? location.hash : null, y: scrollY, inert: a ? a.inert : false };
    if (memo.hash !== null) location.replace(home.hash); // the steps are on that pane
    build();
    if (a) a.inert = true;
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    go(0);
    raf = requestAnimationFrame(frame);
    requestAnimationFrame(() => root && root.classList.remove("is-off"));
  }

  /** Done, Skip and Esc all end here, and all mark the guide seen for this member. */
  function stop() {
    if (!active) return;
    active = false;
    const m = me();
    if (m) {
      setPref(key(m.id), new Date().toISOString());
      try { markSeen(m.id); } catch (e) { /* this browser remembers it */ }
    }
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey, true);
    document.removeEventListener("focusin", onFocus);
    const a = $(app);
    if (a) a.inert = memo.inert;
    const r = root;
    root = null;
    if (reduced()) r.remove();
    else { r.classList.add("is-off"); setTimeout(() => r.remove(), 240); }
    // back to the tab and the place the page was at (after the router has switched the tab back)
    const y = memo.y, back = () => window.scrollTo({ top: y, behavior: "auto" });
    if (memo.hash !== null && memo.hash !== location.hash) {
      window.addEventListener("hashchange", () => requestAnimationFrame(back), { once: true });
      location.replace(memo.hash || "#");
    } else back();
    const f = $(returnFocus);
    if (f) f.focus({ preventScroll: true });
  }

  /** Once the member is known (signed in, or picked their name): start once, unless seen here or on the server. */
  function picked(id) {
    clearTimeout(timer);
    if (!id || NO_AUTO.has(id) || getPref(key(id)) || serverSeen() === true) return;
    timer = setTimeout(start, delay);
  }

  const item = menuItem && $(menuItem);
  if (item) {
    item.addEventListener("click", () => {
      const d = item.closest("dialog");
      if (d && d.open) d.close();
      clearTimeout(timer);
      timer = setTimeout(start, 120); // after the menu has closed
    });
  }

  return { start, stop, picked, isOpen: () => active };
}
