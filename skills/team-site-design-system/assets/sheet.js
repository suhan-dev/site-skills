// Bottom sheets on phones: the page behind stays still, and a sheet closes with a tap outside or a pull down.
//
// Every <dialog class="dlg"> becomes a bottom sheet at <= 760 px (components.css). The team chat is a sheet too, but
// not a <dialog> (it stays open beside the page on a laptop), so it calls lockPage / pullToClose itself.
//
//   import { sheetDialogs } from "./sheet.js";
//   sheetDialogs();               // once, after the dialogs are in the page
//
// Why each piece exists is in references/mobile.md §2 and §3.

export const PHONE_Q = "(max-width: 760px)";

// In <head>, with the theme's pre-paint script (theme.js PREPAINT already contains it). The iPhone Home Screen app
// runs under the home indicator, but env(safe-area-inset-bottom) stays 0 there because the page does not use
// viewport-fit=cover. --home gives the sheets' last row room for the indicator (tokens.css: --sab).
// Safari, iPads and phones with a home button: nothing is set.
export const HOME_PREPAINT = `try{if((matchMedia("(display-mode: standalone)").matches||navigator.standalone===true)&&/iPhone|iPod/.test(navigator.userAgent)&&Math.max(screen.width,screen.height)>=812)document.documentElement.style.setProperty("--home","34px")}catch(e){}`;

/* ---------- lock the page behind a sheet ---------- */
// overflow:hidden on <html> (html.locked, components.css) is not enough: iPhone Safari and the Home Screen app still
// scroll the page under a finger. So every touchmove is stopped too, unless it scrolls something inside the sheet
// that still has room to move that way. Counted, so two sheets can overlap (a dialog over the chat).
// Chosen over body{position:fixed}, which jumps the page to the top and moves the sticky header.
let locks = 0, lastY = 0, lastX = 0;
const canScroll = (el, dy, dx) => {
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (el.matches("input,textarea,select")) return true; // the caret and text selection
    const s = getComputedStyle(el);
    if (Math.abs(dx) > Math.abs(dy)) {
      if (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1) return true;
      continue;
    }
    if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      if (dy > 0 && el.scrollTop <= 0) return false; // at the top, pulled down: nothing to scroll here
      if (dy < 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) return false; // at the bottom
      return true;
    }
  }
  return false;
};
function touchStart(e) { if (e.touches.length === 1) { lastY = e.touches[0].clientY; lastX = e.touches[0].clientX; } }
function touchMove(e) {
  if (e.touches.length !== 1) return; // two fingers: leave pinch alone (lockPhoneZoom decides about zoom)
  const t = e.touches[0], dy = t.clientY - lastY, dx = t.clientX - lastX;
  lastY = t.clientY; lastX = t.clientX;
  const el = e.target instanceof Element ? e.target : e.target.parentElement;
  if (!canScroll(el, dy, dx) && e.cancelable) e.preventDefault();
}
export function lockPage() {
  if (locks++) return;
  document.documentElement.classList.add("locked");
  document.addEventListener("touchstart", touchStart, { passive: true, capture: true });
  document.addEventListener("touchmove", touchMove, { passive: false, capture: true });
}
export function unlockPage() {
  if (!locks || --locks) return;
  document.documentElement.classList.remove("locked");
  document.removeEventListener("touchstart", touchStart, { capture: true });
  document.removeEventListener("touchmove", touchMove, { capture: true });
}

/* ---------- pull down to close ---------- */
// As on iPhone: from the sheet's top bar, or from anywhere when what is under the finger is scrolled to the top.
// The gesture is decided after 8 px: down only (up or sideways is a scroll), never while text is selected (the finger
// is moving a selection handle), never from inside a text field. Past 110 px, or a flick (> 36 px at > 0.55 px/ms,
// timed with event.timeStamp), closes; less springs back. No half-height state: a sheet is open or closed.
export function pullToClose(sheet, { scroller, close }) {
  let y0 = 0, x0 = 0, t0 = 0, dy = 0, on = false, decided = false;
  const ease = "transform .26s cubic-bezier(.2,.8,.2,1)";
  sheet.addEventListener("touchstart", (e) => {
    on = false;
    if (!matchMedia(PHONE_Q).matches || e.touches.length !== 1) return;
    const tg = e.target;
    if (tg.closest("input,textarea,select,[contenteditable]")) return;
    const sc = scroller ? scroller() : sheet;
    if (sc && sc.contains(tg) && sc.scrollTop > 0) return;
    if (sc !== sheet && sheet.scrollTop > 0) return;
    on = true; decided = false; dy = 0;
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; t0 = e.timeStamp;
  }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    if (!on) return;
    const d = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
    if (!decided) {
      if (Math.abs(d) < 8 && Math.abs(dx) < 8) return;
      decided = true;
      if (d <= 0 || Math.abs(dx) > Math.abs(d)) { on = false; return; } // up or sideways: not a pull
      const sel = getSelection();
      if (sel && !sel.isCollapsed) { on = false; return; }
    }
    dy = Math.max(0, d);
    if (e.cancelable) e.preventDefault();
    sheet.style.transition = "none";
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: false });
  const end = (e) => {
    if (!on) return;
    on = false;
    if (!decided) return;
    const v = dy / Math.max(1, e.timeStamp - t0); // px per ms
    if (dy > 110 || (dy > 36 && v > 0.55)) {
      sheet.style.transition = ease;
      sheet.style.transform = "translateY(100%)";
      setTimeout(() => { close(); sheet.style.transition = ""; sheet.style.transform = ""; }, 240);
    } else {
      sheet.style.transition = ease;
      sheet.style.transform = "";
      setTimeout(() => { sheet.style.transition = ""; }, 280);
    }
  };
  sheet.addEventListener("touchend", end);
  sheet.addEventListener("touchcancel", end);
}

/* ---------- every dialog.dlg ---------- */
// While a dialog is open on a phone the page is locked; a tap on the dim area closes it (a click on the ::backdrop
// reports the dialog itself as its target); so does a pull down. Safe to call twice: a dialog is wired once.
export function sheetDialogs(selector = "dialog.dlg", { tapOutside = true } = {}) {
  document.querySelectorAll(selector).forEach((d) => {
    if (d.dataset.sheet) return;
    d.dataset.sheet = "1";
    let held = false;
    const sync = () => {
      const want = d.open && matchMedia(PHONE_Q).matches;
      if (want && !held) { held = true; lockPage(); } else if (!want && held) { held = false; unlockPage(); }
    };
    new MutationObserver(sync).observe(d, { attributes: true, attributeFilter: ["open"] });
    d.addEventListener("close", sync);
    if (tapOutside) d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    pullToClose(d, { close: () => d.close() });
  });
}
