// Team chat and comments on any passage of the site.
//
// The chat button in the header opens the chat: a panel on the right on wide screens (the page makes room for it from
// 1100 px), a full-height sheet from the bottom on phones. Two tabs: All, and This page (the comments on what is on
// screen). Messages come from /api/messages (functions/api/messages.js, D1); the server takes the author from the
// Google sign-in, so nobody types a name. Others' text is only ever put on the page with textContent.
//
// Select text in the Theory chapters, the reader, the Research log or References and a small "Copy · Comment" bar
// appears above the selection with a mouse. On touch screens the phone's own menu already copies, so only one Comment
// button shows, docked at the bottom of the screen (at the top when the selection ends near the bottom). Comment opens
// the chat with the passage quoted. The passage gets a thin underline in the text; a tap on it
// shows the comment, and "Go to text" in the chat comes back to it.
//
// Where comments can go: any element with data-chat-page (a stable key such as theory/<part>/<chapter>,
// log/<week>/<member> or refs) and data-chat-title (the words shown above the quote). The event dialog has its own
// Comment button (calendar.js calls chat.commentOn).
import { $, $$, api, GCOLORS, getPref, setPref, dLong, TIMEZONE } from "./chat-util.js";
import { lockPage, unlockPage, pullToClose } from "./sheet.js"; // the design system's phone sheets
import { t, LANG } from "./i18n.js";
import "./chat-strings.js"; // adds the chat.* strings to both tables

const API = "/api/messages";
const SEEN = "site_chat_seen"; // the newest message id this browser has seen in the open chat
const WIDE = "(min-width: 1100px)"; // the page makes room for the panel
const PHONE = "(max-width: 760px)"; // a sheet from the bottom
const TOUCH = "(hover: none) and (pointer: coarse)";
const SKIP = "script,style,svg,textarea,input,select,button,.katex-mathml,.selpop,.th-pn,.th-mtoc,.refs-jump,[data-chat-skip]";
const BLOCK = "p,li,h1,h2,h3,h4,h5,h6,td,th,dd,dt,figcaption,blockquote,pre,summary,div,section,article,header";
const POLL_OPEN = 4000, POLL_SHUT = 45000, POLL_OFF = 300000;

const norm = (s) => String(s || "").replace(/\s+/g, " ");
const mm = (q) => matchMedia(q).matches;
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const SVG = {
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18.5V6M6.5 11.5 12 6l5.5 5.5"/></svg>',
};
const ymdTZ = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const hmTZ = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });

/* ---------- text ↔ character positions inside one comment root ---------- */
// The root's text as one string with runs of white space made single, and for each character the text node and
// offset it came from. A space is put between blocks. Quotes are found again in this string by their own text and
// the words just before and after them, so a comment survives small edits to the rest of the page.
function textMap(root) {
  let s = "", ws = true, prevBlk = null;
  const at = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const v = n.nodeValue, blk = n.parentElement.closest(BLOCK);
    if (blk !== prevBlk && !ws && /\S/.test(v)) { s += " "; at.push([n, 0, 1]); ws = true; }
    if (/\S/.test(v)) prevBlk = blk;
    for (let i = 0; i < v.length; i++) {
      const c = v.charAt(i);
      if (/\s/.test(c)) { if (ws) continue; ws = true; s += " "; } else { ws = false; s += c; }
      at.push([n, i]);
    }
  }
  return { s, at };
}
function locate(map, q) {
  const s = map.s, want = norm(q.quote).trim();
  if (!want) return null;
  let best = -1, score = -1, from = 0, i;
  while ((i = s.indexOf(want, from)) >= 0) {
    let sc = 0;
    const p = q.prefix || "", x = q.suffix || "";
    const a = s.slice(Math.max(0, i - p.length), i);
    for (let k = 1; k <= Math.min(a.length, p.length) && a.charAt(a.length - k) === p.charAt(p.length - k); k++) sc++;
    const b = s.slice(i + want.length, i + want.length + x.length);
    for (let j = 0; j < Math.min(b.length, x.length) && b.charAt(j) === x.charAt(j); j++) sc++;
    if (sc > score) { score = sc; best = i; }
    from = i + 1;
  }
  return best < 0 ? null : [best, best + want.length - 1];
}
// Wraps characters si..ei in <mark class="cm-mark">, one per text node. Math (KaTeX) is not split, so it stays whole.
function wrap(map, si, ei, id, title) {
  const segs = [];
  let cur = null;
  for (let k = si; k <= ei; k++) {
    const a = map.at[k];
    if (a[2]) continue;
    if (!cur || cur.n !== a[0]) { cur = { n: a[0], a: a[1], b: a[1] + 1 }; segs.push(cur); } else cur.b = a[1] + 1;
  }
  segs.forEach((g) => {
    if (g.n.parentElement && g.n.parentElement.closest(".katex,mark.cm-mark")) return;
    let mid = g.n;
    if (g.a > 0) mid = mid.splitText(g.a);
    if (g.b - g.a < mid.nodeValue.length) mid.splitText(g.b - g.a);
    const mk = el("mark", "cm-mark");
    mk.dataset.id = id;
    mk.title = title;
    mid.parentNode.insertBefore(mk, mid);
    mk.appendChild(mid);
  });
}
function unmark(root) {
  root.querySelectorAll("mark.cm-mark").forEach((m) => {
    const p = m.parentNode;
    while (m.firstChild) p.insertBefore(m.firstChild, m);
    p.removeChild(m);
    p.normalize();
  });
}
const rootOf = (n) => { const e = n && (n.nodeType === 1 ? n : n.parentElement); return e ? e.closest("[data-chat-page]") : null; };
const visible = (e) => e.isConnected && e.getClientRects().length > 0 && !e.closest("[hidden],dialog:not([open])");

/* ---------- the chat ---------- */
export function createChat({ team, openEvent } = {}) {
  const btn = $("#chat-btn");
  if (!btn) return null;
  const dot = $(".chat-dot", btn);
  const members = (team && team.members) || [];
  const isIndex = !!$("#pane-calendar");

  // panel
  const box = el("aside", "chat");
  box.id = "chat";
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.innerHTML = `
    <div class="chat-grab" aria-hidden="true"></div>
    <div class="chat-h">
      <h2 class="chat-ttl"></h2>
      <div class="chat-tabs" role="tablist"><button type="button" role="tab" data-f="all"></button><button type="button" role="tab" data-f="here"><span></span> <b class="n"></b></button></div>
      <button class="icon-btn chat-x" type="button">${SVG.x}</button>
    </div>
    <p class="chat-st" role="status" hidden></p>
    <ol class="chat-list" aria-live="polite"></ol>
    <form class="chat-f" autocomplete="off">
      <div class="chat-q" hidden><span class="chat-ql"></span><q></q><button class="chat-qx" type="button">${SVG.x}</button></div>
      <div class="chat-in"><textarea rows="1" enterkeyhint="send"></textarea><button class="chat-send" type="submit">${SVG.up}</button></div>
      <p class="chat-err" role="alert"></p>
    </form>`;
  const scrim = el("div", "chat-scrim");
  scrim.hidden = true;
  document.body.append(scrim, box);
  const list = $(".chat-list", box), st = $(".chat-st", box), form = $(".chat-f", box), ta = $("textarea", box);
  const qbox = $(".chat-q", box), err = $(".chat-err", box), sendB = $(".chat-send", box);

  // the Copy · Comment bar
  const pop = el("div", "selpop");
  pop.hidden = true;
  pop.setAttribute("role", "toolbar");
  pop.innerHTML = '<button type="button" data-a="copy"></button><i aria-hidden="true"></i><button type="button" data-a="comment"></button>';
  document.body.appendChild(pop);

  /* ---------- state ---------- */
  let msgs = [], byId = new Map(), rev = 0, me = "", filter = "all", isOpen = false, off = false, timer = 0;
  let pending = null; // the quoted passage for the next message
  let eventCtx = null; // an event the chat was opened from: { page, title }
  let jumpTo = null; // { id, until }: scroll to this comment's mark once its page is drawn
  const sigs = new WeakMap(); // root → what is marked in it now
  const comments = () => msgs.filter((m) => m.quote && m.page);

  const who = (id) => members.find((m) => m.id === id);
  const nameOf = (id) => { const m = who(id); return m ? (LANG === "ko" ? m.full || m.name || id : m.en || m.name || id) : id; };
  const herePages = () => {
    const set = new Set($$("[data-chat-page]").filter(visible).map((r) => r.dataset.chatPage));
    if (eventCtx) set.add(eventCtx.page);
    return set;
  };

  /* ---------- words (EN / KO; the header button stays English) ---------- */
  function paintWords() {
    box.setAttribute("aria-label", t("chat.title"));
    $(".chat-ttl", box).textContent = t("chat.title");
    $('[data-f="all"]', box).textContent = t("chat.all");
    $('[data-f="here"] span', box).textContent = t("chat.here");
    $(".chat-x", box).setAttribute("aria-label", t("chat.close"));
    $(".chat-x", box).title = t("chat.close");
    $(".chat-ql", box).textContent = t("chat.quoting");
    $(".chat-qx", box).setAttribute("aria-label", t("chat.unquote"));
    ta.placeholder = t("chat.ph");
    ta.setAttribute("aria-label", t("chat.ph"));
    sendB.setAttribute("aria-label", t("chat.send"));
    sendB.title = t("chat.send");
    $('[data-a="copy"]', pop).textContent = t("chat.copy");
    $('[data-a="comment"]', pop).textContent = t("chat.comment");
    if (off) st.textContent = t("chat.off");
    $$("mark.cm-mark").forEach((m) => (m.title = t("chat.markTitle")));
  }
  paintWords();
  window.addEventListener("site:lang", () => { paintWords(); if (isOpen) render(); });

  /* ---------- talking to the server ---------- */
  function merge(arr) {
    let fresh = 0;
    for (const m of arr || []) {
      if (m.deleted) { if (byId.has(m.id)) { byId.delete(m.id); fresh++; } continue; }
      if (!byId.has(m.id)) fresh++;
      byId.set(m.id, m);
    }
    msgs = [...byId.values()].sort((a, b) => a.id - b.id);
    return fresh;
  }
  let busy = false;
  async function load() {
    if (busy) return;
    busy = true;
    try {
      const d = await api(API + (rev ? "?since=" + rev : ""), { cache: "no-store" });
      const first = !rev && !me;
      me = d.me || me;
      const fresh = merge(d.messages);
      rev = Math.max(rev, d.rev || 0);
      if (off) { off = false; st.hidden = true; }
      if (first && getPref(SEEN) == null) setPref(SEEN, String(maxId())); // a first visit starts with nothing unread
      if (fresh || first) { if (isOpen) render(); marks(); }
    } catch (e) {
      if (e.status === 503 || e.status === 404 || !e.status) { off = true; st.textContent = t("chat.off"); st.hidden = false; }
    } finally {
      busy = false;
      unread();
      schedule();
    }
  }
  const maxId = () => msgs.reduce((a, m) => Math.max(a, m.id), 0);
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { if (document.visibilityState === "visible") load(); else schedule(); }, off ? POLL_OFF : isOpen ? POLL_OPEN : POLL_SHUT);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load(); });

  function unread() {
    if (isOpen) setPref(SEEN, String(maxId()));
    const seen = +(getPref(SEEN) || 0);
    const n = msgs.filter((m) => m.id > seen && m.member !== me).length;
    if (dot) dot.hidden = !n;
    btn.setAttribute("aria-label", n ? `Team chat, ${n} new` : "Team chat");
  }

  /* ---------- drawing the list ---------- */
  function linkify(p, text) {
    const re = /https?:\/\/[^\s<>"')\]]+/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) p.appendChild(document.createTextNode(text.slice(last, m.index)));
      const a = el("a", "", m[0]);
      a.href = m[0];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      p.appendChild(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) p.appendChild(document.createTextNode(text.slice(last)));
  }
  function dayLabel(ymd) {
    const today = ymdTZ.format(new Date()), yest = ymdTZ.format(new Date(Date.now() - 864e5));
    return ymd === today ? t("chat.today") : ymd === yest ? t("chat.yesterday") : dLong(ymd);
  }
  function item(m) {
    const li = el("li", "cm" + (m.member === me ? " mine" : ""));
    li.id = "cm-" + m.id;
    const hd = el("div", "cm-h");
    const mem = who(m.member);
    const d = el("i", "cm-dot");
    if (mem) d.style.setProperty("--c", GCOLORS[mem.colorId]);
    hd.appendChild(d);
    hd.appendChild(el("b", "cm-n", nameOf(m.member)));
    const tm = el("time", "cm-t", hmTZ.format(new Date(m.ts)));
    tm.dateTime = new Date(m.ts).toISOString();
    hd.appendChild(tm);
    if (m.member === me) {
      const del = el("button", "cm-del", t("chat.delete"));
      del.type = "button";
      del.addEventListener("click", () => remove(m, del));
      hd.appendChild(del);
    }
    li.appendChild(hd);
    if (m.quote) {
      const q = el("a", "cm-q");
      q.href = hrefOf(m);
      if (m.title) q.appendChild(el("span", "cm-at", m.title));
      q.appendChild(el("q", "", m.quote));
      q.appendChild(el("span", "cm-go", t("chat.go")));
      q.addEventListener("click", (e) => { if (goTo(m)) e.preventDefault(); });
      li.appendChild(q);
    }
    const p = el("p", "cm-x");
    linkify(p, m.text);
    li.appendChild(p);
    return li;
  }
  function render() {
    const keep = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    const here = herePages();
    const mine = comments().filter((m) => here.has(m.page));
    $('[data-f="here"] .n', box).textContent = mine.length ? String(mine.length) : "";
    const show = filter === "all" ? msgs : mine;
    list.textContent = "";
    if (!show.length) {
      const touch = mm(TOUCH);
      list.appendChild(el("li", "chat-empty", filter === "all" ? t(touch ? "chat.emptyTouch" : "chat.empty") : t(touch ? "chat.emptyHereTouch" : "chat.emptyHere")));
    }
    let day = "";
    for (const m of show) {
      const d = ymdTZ.format(new Date(m.ts));
      if (d !== day) { day = d; list.appendChild(el("li", "chat-day", dayLabel(d))); }
      list.appendChild(item(m));
    }
    if (keep) list.scrollTop = list.scrollHeight;
  }
  function flash(node) {
    if (!node) return;
    node.classList.remove("flash");
    void node.offsetWidth;
    node.classList.add("flash");
  }

  /* ---------- marks in the text ---------- */
  let markT = 0;
  function marks() {
    clearTimeout(markT);
    markT = setTimeout(markNow, 60);
  }
  function markNow() {
    const all = comments();
    for (const root of $$("[data-chat-page]")) {
      const page = root.dataset.chatPage;
      const mine = all.filter((m) => m.page === page);
      const sig = page + ":" + mine.map((m) => m.id).join(",");
      if (sigs.get(root) === sig) continue;
      if (sigs.has(root) || root.querySelector("mark.cm-mark")) unmark(root);
      sigs.set(root, sig);
      for (const m of mine) {
        const map = textMap(root), hit = locate(map, m);
        if (hit) wrap(map, hit[0], hit[1], m.id, t("chat.markTitle"));
      }
    }
    if (jumpTo) {
      const mk = $(`mark.cm-mark[data-id="${jumpTo.id}"]`);
      if (mk && visible(mk)) {
        const id = jumpTo.id;
        jumpTo = null;
        requestAnimationFrame(() => {
          mk.scrollIntoView({ block: "center", behavior: mm("(prefers-reduced-motion: reduce)") ? "auto" : "smooth" });
          $$(`mark.cm-mark[data-id="${id}"]`).forEach(flash);
        });
      } else if (Date.now() > jumpTo.until) jumpTo = null;
    }
    // what is on screen changed (another tab, chapter or week): the This page list follows
    const here = [...herePages()].sort().join(" ");
    if (here !== lastHere) { lastHere = here; if (isOpen) render(); }
  }
  let lastHere = "";
  // tabs, chapters and weeks are drawn by other scripts: mark whatever comes on screen (changes inside the chat
  // itself and the bar are not the page's)
  new MutationObserver((recs) => {
    if (recs.some((r) => !box.contains(r.target) && !pop.contains(r.target))) marks();
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => { eventCtx = null; marks(); });

  /* ---------- where a comment lives ---------- */
  function hrefOf(m) {
    const [kind, a, b] = (m.page || "").split("/");
    const c = "c=" + m.id;
    if (kind === "theory") return `/theory/${a}/${b}?${c}`;
    if (kind === "log") return `/?${c}#records/${a}/${b}`;
    if (kind === "refs") return `/?${c}#refs`;
    if (kind === "event") return `/?event=${encodeURIComponent(a)}&date=${encodeURIComponent(m.anchor || "")}#calendar`;
    return "/";
  }
  // Same page: scroll to the passage (opening the tab, chapter or week first). Returns false to follow the link.
  function goTo(m) {
    const [kind, a, b] = (m.page || "").split("/");
    if (kind === "event") {
      if (!openEvent) return false;
      if (mm(PHONE)) close();
      openEvent(m.anchor, a);
      return true;
    }
    const root = $$("[data-chat-page]").find((r) => r.dataset.chatPage === m.page);
    if (!root && !isIndex) return false;
    if (mm(PHONE)) close();
    jumpTo = { id: m.id, until: Date.now() + 6000 };
    if (!root || !visible(root)) {
      const want = kind === "theory" ? `#theory/${a}/${b}` : kind === "log" ? `#records/${a}/${b}` : kind === "refs" ? "#refs" : "";
      if (!want) return false;
      if (location.hash !== want) location.hash = want;
    }
    marks();
    return true;
  }
  // a link from another page: /?c=<id>#… or /theory/<part>/<chapter>?c=<id>
  {
    const q = new URLSearchParams(location.search);
    const c = parseInt(q.get("c") || "", 10);
    if (c > 0) {
      jumpTo = { id: c, until: Date.now() + 10000 };
      q.delete("c");
      const rest = q.toString();
      history.replaceState(history.state, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
    }
  }

  /* ---------- open and close ---------- */
  let locked = false, pageY = 0;
  function place() {
    // wide screens: a panel under the header (or beside it when the page makes room)
    const head = $(".bar") || $(".rd-top");
    const top = head && !mm(WIDE) ? Math.max(0, head.getBoundingClientRect().bottom) : 0;
    box.style.setProperty("--chat-top", top + "px");
    // phones: the sheet keeps its full height; only while the keyboard is up does it fit the part of the screen the
    // keyboard leaves (and the room kept for the home indicator goes, since the keyboard covers it)
    const vv = window.visualViewport;
    const kb = !!(vv && mm(PHONE) && vv.height < innerHeight - 120);
    box.classList.toggle("kb", kb);
    if (kb) {
      box.style.setProperty("--vv-h", vv.height + "px");
      box.style.setProperty("--vv-t", vv.offsetTop + "px");
    } else {
      box.style.removeProperty("--vv-h");
      box.style.removeProperty("--vv-t");
    }
  }
  // iPhone settles the keyboard over a few frames and does not always say when it is done: look again a little later
  const settle = () => { place(); setTimeout(place, 120); setTimeout(place, 400); setTimeout(place, 800); };
  function open(f) {
    if (f) setFilter(f, true);
    if (!isOpen) {
      isOpen = true;
      place();
      box.hidden = false;
      scrim.hidden = !mm(PHONE);
      if (mm(PHONE) && !locked) { locked = true; pageY = scrollY; lockPage(); }
      document.documentElement.classList.add("chat-open");
      btn.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => box.classList.add("in"));
    }
    render();
    list.scrollTop = list.scrollHeight;
    unread();
    load();
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    eventCtx = null;
    if (document.activeElement === ta) ta.blur();
    box.classList.remove("in");
    scrim.hidden = true;
    if (locked) {
      locked = false;
      unlockPage();
      if (Math.abs(scrollY - pageY) > 2) scrollTo(0, pageY); // the keyboard may have moved the page: put it back
    }
    document.documentElement.classList.remove("chat-open");
    btn.setAttribute("aria-expanded", "false");
    setTimeout(() => { if (!isOpen) box.hidden = true; }, 260);
    schedule();
  }
  pullToClose(box, { scroller: () => list, close });
  ta.addEventListener("focus", () => { if (isOpen) settle(); });
  ta.addEventListener("blur", () => { if (isOpen) settle(); });
  function setFilter(f, quiet) {
    filter = f === "here" ? "here" : "all";
    $$(".chat-tabs button", box).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.f === filter)));
    if (!quiet) render();
  }
  setFilter("all", true);
  btn.addEventListener("click", () => (isOpen ? close() : (open(), mm(TOUCH) || ta.focus())));
  $(".chat-x", box).addEventListener("click", close);
  scrim.addEventListener("click", close);
  $$(".chat-tabs button", box).forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.f)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen && !document.querySelector("dialog[open]")) close(); });
  addEventListener("resize", () => {
    if (!isOpen) return;
    place();
    scrim.hidden = !mm(PHONE);
    // turned or resized across the phone width: lock or free the page to match
    if (mm(PHONE) && !locked) { locked = true; pageY = scrollY; lockPage(); }
    else if (!mm(PHONE) && locked) { locked = false; unlockPage(); }
  });
  if (window.visualViewport) {
    const vvp = () => { if (isOpen && mm(PHONE)) place(); };
    visualViewport.addEventListener("resize", vvp);
    visualViewport.addEventListener("scroll", vvp);
  }
  addEventListener("scroll", () => { if (isOpen && !mm(PHONE) && !mm(WIDE)) place(); }, { passive: true });

  // a tap on a marked passage: its comment
  document.addEventListener("click", (e) => {
    const mk = e.target.closest && e.target.closest("mark.cm-mark");
    if (!mk) return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed) return;
    open("here");
    const li = $("#cm-" + mk.dataset.id, box);
    if (li) { li.scrollIntoView({ block: "nearest" }); flash(li); }
  });

  /* ---------- writing ---------- */
  function setQuote(q) {
    pending = q;
    qbox.hidden = !q;
    $("q", qbox).textContent = q ? q.quote : "";
  }
  $(".chat-qx", box).addEventListener("click", () => { setQuote(null); ta.focus(); });
  function grow() {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 132) + "px";
  }
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", (e) => {
    // Enter sends on a keyboard (Shift+Enter: a new line); on touch screens Enter is a new line and the arrow sends.
    // Never while a Korean syllable is still being composed.
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && !mm(TOUCH)) {
      e.preventDefault();
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    err.textContent = "";
    if (!text) { ta.focus(); return; }
    const q = pending || {};
    const body = { text };
    if (pending) Object.assign(body, { page: q.page, title: q.title, anchor: q.anchor || "", quote: q.quote, prefix: q.prefix || "", suffix: q.suffix || "" });
    sendB.disabled = true;
    try {
      const d = await api(API, { method: "POST", body: JSON.stringify(body) });
      if (d.message) { merge([d.message]); me = d.message.member || me; }
      ta.value = "";
      grow();
      setQuote(null);
      render();
      list.scrollTop = list.scrollHeight;
      marks();
      unread();
    } catch (x) {
      err.textContent = t("chat.err");
    } finally {
      sendB.disabled = false;
    }
  });
  async function remove(m, b) {
    if (!b.classList.contains("armed")) {
      b.classList.add("armed");
      b.textContent = t("chat.deleteSure");
      setTimeout(() => { b.classList.remove("armed"); b.textContent = t("chat.delete"); }, 3000);
      return;
    }
    try {
      await api(API + "?id=" + m.id, { method: "DELETE" });
      byId.delete(m.id);
      msgs = msgs.filter((x) => x.id !== m.id);
      render();
      marks();
    } catch (x) {
      err.textContent = t("chat.errDel");
    }
  }

  /* ---------- select → Copy · Comment ---------- */
  function capture() {
    const sel = getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    const root = rootOf(r.commonAncestorContainer);
    if (!root) return null;
    const raw = norm(sel.toString()).trim();
    if (!raw) return null;
    const map = textMap(root), L = map.at.length;
    const before = (k) => { const a = map.at[k]; try { return r.comparePoint(a[0], a[1]) < 0; } catch (e) { return true; } };
    const inside = (k) => { const a = map.at[k]; try { return r.comparePoint(a[0], a[2] ? a[1] : a[1] + 1) <= 0; } catch (e) { return false; } };
    let lo = 0, hi = L;
    while (lo < hi) { const m = (lo + hi) >> 1; if (before(m)) lo = m + 1; else hi = m; }
    let si = lo;
    lo = si; hi = L;
    while (lo < hi) { const m = (lo + hi) >> 1; if (inside(m)) lo = m + 1; else hi = m; }
    let ei = lo - 1;
    const q = { page: root.dataset.chatPage, quote: raw, prefix: "", suffix: "", anchor: "" };
    if (si < L && ei >= si) {
      while (si <= ei && map.s.charAt(si) === " ") si++;
      while (ei >= si && map.s.charAt(ei) === " ") ei--;
      if (ei >= si) {
        q.quote = map.s.slice(si, ei + 1);
        q.prefix = map.s.slice(Math.max(0, si - 40), si);
        q.suffix = map.s.slice(ei + 1, ei + 41);
      }
    }
    // the heading the passage sits under
    let h = null;
    for (const x of root.querySelectorAll("h1,h2,h3,h4")) {
      if (x.closest(SKIP)) continue;
      if (x.contains(r.startContainer) || x.compareDocumentPosition(r.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING) h = x;
      else break;
    }
    const base = root.dataset.chatTitle || "";
    const ht = h ? norm(h.textContent).trim().slice(0, 80) : "";
    const idEl = h && (h.id ? h : h.closest("[id]"));
    q.anchor = idEl && root.contains(idEl) && idEl !== root ? idEl.id : "";
    q.title = ht && !base.endsWith(ht) ? (base ? base + " › " : "") + ht : base;
    return q;
  }
  let lastQ = null; // the passage as it was when the bar appeared (a tap on the bar may clear the selection first)
  const hidePop = () => { pop.hidden = true; pop.classList.remove("done"); };
  function showPop() {
    const sel = getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return hidePop();
    const r = sel.getRangeAt(0);
    if (!rootOf(r.commonAncestorContainer) || !norm(sel.toString()).trim()) return hidePop();
    pop.hidden = false;
    pop.classList.remove("done");
    $('[data-a="copy"]', pop).textContent = t("chat.copy");
    if (mm(TOUCH)) {
      // Touch screens: the phone's own menu (Copy, Look Up, …) sits by the selection, so only Comment shows here, as
      // one bar at the bottom of the screen; at the top instead when the selection ends near the bottom
      lastQ = capture();
      const rs = r.getClientRects(), last = rs[rs.length - 1] || r.getBoundingClientRect();
      pop.classList.add("dock");
      pop.classList.toggle("up", last.bottom > innerHeight - 120);
      pop.style.left = pop.style.top = "";
      return;
    }
    pop.classList.remove("dock", "up");
    const rects = r.getClientRects(), first = rects[0] || r.getBoundingClientRect(), last = rects[rects.length - 1] || first;
    const pw = pop.offsetWidth, ph = pop.offsetHeight, vw = document.documentElement.clientWidth;
    const head = $(".bar") || $(".rd-top"), topSafe = head ? Math.max(0, head.getBoundingClientRect().bottom) : 0;
    let x, y;
    if (first.top - ph - 10 < topSafe) { x = last.right - pw / 2; y = last.bottom + 10; } else { x = first.left + first.width / 2 - pw / 2; y = first.top - ph - 8; }
    x = Math.max(8, Math.min(vw - pw - 8 - (isOpen && !mm(WIDE) ? box.offsetWidth : 0), x));
    pop.style.left = Math.round(x + scrollX) + "px";
    pop.style.top = Math.round(y + scrollY) + "px";
  }
  let popT = 0;
  const soon = () => { clearTimeout(popT); popT = setTimeout(showPop, mm(TOUCH) ? 400 : 10); };
  document.addEventListener("mouseup", (e) => { if (!pop.contains(e.target)) soon(); });
  document.addEventListener("keyup", (e) => { if (e.shiftKey || e.key === "Shift") soon(); });
  document.addEventListener("selectionchange", () => {
    const sel = getSelection();
    if (!sel || sel.isCollapsed) { clearTimeout(popT); popT = setTimeout(() => { const s2 = getSelection(); if (!s2 || s2.isCollapsed) hidePop(); }, 150); }
    else if (mm(TOUCH)) soon();
  });
  document.addEventListener("mousedown", (e) => { if (!pop.contains(e.target)) hidePop(); });
  pop.addEventListener("mousedown", (e) => e.preventDefault()); // keep the selection when a button is pressed
  pop.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const sel = getSelection();
    if (b.dataset.a === "copy") {
      const txt = sel ? sel.toString() : "";
      const ok = () => { pop.classList.add("done"); b.textContent = t("chat.copied"); setTimeout(hidePop, 900); };
      const legacy = () => { try { document.execCommand("copy"); } catch (x) { /* blocked */ } ok(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, legacy);
      else legacy();
      return;
    }
    const q = capture() || (pop.classList.contains("dock") ? lastQ : null);
    hidePop();
    lastQ = null;
    if (!q) return;
    if (sel) sel.removeAllRanges();
    eventCtx = null;
    setQuote(q);
    open();
    ta.focus();
  });

  /* ---------- the event dialog's Comment button (calendar.js) ---------- */
  // ev: the event; quote: the words selected in its title or notes (or the title); then the dialog closes first,
  // because a modal dialog keeps everything else out of reach.
  function commentOn(ev, quote) {
    const page = "event/" + ev.id;
    eventCtx = { page };
    const q = norm(quote || ev.title || "").trim().slice(0, 2000);
    // above the quote: the event's date, and its title too when the quote is only part of it or from the notes
    const when = ev.start ? dLong(ev.start) : "";
    const title = [t("chat.event"), when, q === norm(ev.title).trim() ? "" : ev.title].filter(Boolean).join(" · ");
    setQuote({ page, title, anchor: ev.start || "", quote: q, prefix: "", suffix: "" });
    open();
    ta.focus();
  }
  const countFor = (page) => comments().filter((m) => m.page === page).length;

  load();
  return { open, close, commentOn, countFor };
}
