// Light/dark, language and the phone viewport — the three things every page of the site needs before first paint.
//
// 1. Put PREPAINT (below, minified) in an inline <script> in <head>, BEFORE the stylesheets, so a saved choice applies
//    before anything is drawn (no flash of the wrong theme).
// 2. Import this module and call initTheme({ button }) and lockPhoneZoom() once the page is up.
//
// The saved choice lives in localStorage under THEME_KEY ("light" | "dark"). With no saved choice the page follows the
// system (prefers-color-scheme). tokens.css reads <html data-theme> and falls back to the media query.

export const THEME_KEY = "site_theme";
export const LANG_KEY = "site_lang";

// Inline this in <head> (keep the keys in sync with the two constants above). The second try{} is sheet.js
// HOME_PREPAINT: room for the home indicator under bottom sheets in the iPhone Home Screen app (tokens.css --sab).
export const PREPAINT = `try{var t=localStorage.getItem("site_theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);if(localStorage.getItem("site_lang")==="ko")document.documentElement.lang="ko"}catch(e){}
try{if((matchMedia("(display-mode: standalone)").matches||navigator.standalone===true)&&/iPhone|iPod/.test(navigator.userAgent)&&Math.max(screen.width,screen.height)>=812)document.documentElement.style.setProperty("--home","34px")}catch(e){}`;

const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export function isDark() {
  const root = document.documentElement;
  return root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

// The moon/sun button: aria-pressed=true means dark. One click flips and saves the choice.
export function initTheme({ button } = {}) {
  const paint = () => button && button.setAttribute("aria-pressed", String(isDark()));
  paint();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paint);
  button && button.addEventListener("click", () => {
    const root = document.documentElement;
    root.dataset.theme = isDark() ? "light" : "dark";
    set(THEME_KEY, root.dataset.theme);
    paint();
    window.dispatchEvent(new CustomEvent("site:theme", { detail: root.dataset.theme }));
  });
}

// Installed Home Screen app: the status bar takes the colour of what is under it. Call once in standalone mode.
export function paintStatusBar(darkSceneClass = "intro-on", darkSceneColor = "#111216") {
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
  const bar = metas[0] || document.head.appendChild(document.createElement("meta"));
  bar.name = "theme-color";
  bar.removeAttribute("media");
  metas.slice(1).forEach((m) => m.remove());
  const paint = () => {
    bar.content = document.documentElement.classList.contains(darkSceneClass) ? darkSceneColor : getComputedStyle(document.body).backgroundColor;
  };
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paint);
  paint();
}

// A phone held upright does not zoom (no pinch, no double tap): the layout is made for its width. iOS ignores
// user-scalable, so pinches are also stopped at gesturestart; components.css sets touch-action. Landscape and wider
// screens keep zoom for accessibility.
export function lockPhoneZoom() {
  const m = document.querySelector('meta[name="viewport"]');
  if (!m) return;
  const q = matchMedia("(max-width:760px) and (orientation:portrait)");
  const base = "width=device-width,initial-scale=1";
  const apply = () => m.setAttribute("content", q.matches ? base + ",maximum-scale=1,user-scalable=no" : base);
  apply();
  q.addEventListener("change", apply);
  document.addEventListener("gesturestart", (e) => { if (q.matches) e.preventDefault(); }, { passive: false });
}

export const getPref = get;
export const setPref = set;
