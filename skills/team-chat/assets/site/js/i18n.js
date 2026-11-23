// UI strings in two languages, side by side. English is the default; the second language is chosen with the EN/KO
// control in the header and kept in this browser (LANG_KEY).
//
// Rules (see references/language.md):
// - Sections marked data-lang-fixed (intro, sign-in, header, the main screen) always use English.
// - Terms and proper names stay English in both tables.
// - Markup: data-i18n="key" (textContent), data-i18n-html, data-i18n-title, data-i18n-ph (placeholder), data-i18n-aria.
// - Every key exists in both tables; check() lists the missing ones.
import { LANG_KEY, getPref, setPref } from "./theme.js";

export const D = {
  en: {
    "tab.calendar": "Calendar", "tab.records": "Research log", "tab.refs": "References", "tab.theory": "Theory",
    "theme": "Light or dark", "logout": "Sign out", "lang": "Language",
  },
  ko: {
    "tab.calendar": "캘린더", "tab.records": "연구기록", "tab.refs": "자료", "tab.theory": "이론",
    "theme": "밝게 또는 어둡게", "logout": "로그아웃", "lang": "언어",
  },
};

export let LANG = getPref(LANG_KEY) === "ko" ? "ko" : "en";
const fill = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (_, k) => (k in v ? v[k] : `{${k}}`)) : s);
export const t = (k, v) => fill((D[LANG] && D[LANG][k]) ?? D.en[k] ?? k, v);
export const EN = { t: (k, v) => fill(D.en[k] ?? k, v) };

export function apply(root = document) {
  root.querySelectorAll("[data-i18n],[data-i18n-html],[data-i18n-title],[data-i18n-ph],[data-i18n-aria]").forEach((el) => {
    const fixed = el.closest("[data-lang-fixed]");
    const tr = fixed ? EN.t : t;
    if (el.dataset.i18n) el.textContent = tr(el.dataset.i18n);
    if (el.dataset.i18nHtml) el.innerHTML = tr(el.dataset.i18nHtml);
    if (el.dataset.i18nTitle) el.title = tr(el.dataset.i18nTitle);
    if (el.dataset.i18nPh) el.placeholder = tr(el.dataset.i18nPh);
    if (el.dataset.i18nAria) el.setAttribute("aria-label", tr(el.dataset.i18nAria));
  });
}

export function setLang(l) {
  LANG = l === "ko" ? "ko" : "en";
  setPref(LANG_KEY, LANG);
  document.documentElement.lang = LANG;
  apply();
  window.dispatchEvent(new CustomEvent("site:lang", { detail: LANG }));
}

export const check = () => Object.keys(D.en).filter((k) => !(k in D.ko)).concat(Object.keys(D.ko).filter((k) => !(k in D.en)));

// The header's one language button (#lang-btn): it reads EN or KO, the language in use, and a tap switches to the other.
// Its own words stay English in both languages, like the rest of the header.
export function wireLangButton(b = document.getElementById("lang-btn")) {
  if (!b) return;
  const paint = () => {
    b.textContent = LANG === "ko" ? "KO" : "EN";
    b.title = LANG === "ko" ? "Switch to English" : "Switch to Korean";
    b.setAttribute("aria-label", LANG === "ko" ? "Language: Korean. Switch to English" : "Language: English. Switch to Korean");
  };
  b.addEventListener("click", () => { setLang(LANG === "ko" ? "en" : "ko"); paint(); });
  paint();
}
