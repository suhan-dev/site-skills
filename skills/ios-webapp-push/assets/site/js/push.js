// App & notifications: the sheet behind the bell in the header, and the "Add to Home Screen" pop-up.
// - Registers /sw.js (notifications only, no caching).
// - Two switches, both on by default, saved per device: "New events" and "30 minutes before". Before notifications
//   are on they are only remembered here (PREFS_KEY) and sent along when the device subscribes.
// - iPhone: notifications work only in the app added to the Home Screen (iOS 16.4+). In Safari the sheet shows the four
//   steps; inside KakaoTalk, whose browser can't add to the Home Screen, step 1 is an "Open in Safari" button.
// - The permission is asked from the "Turn on notifications" tap itself (iOS allows it only from a tap).
// - "Add to Home Screen": in an iPhone or iPad browser (Safari, KakaoTalk, …) a sheet with the four steps opens by itself
//   once per member, and the bell opens it there instead of the switches (they can't work before the app is installed).
//   "Once" is kept twice: in this browser (INSTALL_KEY + member) and on the server (/api/me seen.install, any device).
// Server side: functions/api/push/* and lib/push.js. The sheet follows EN / KO; the bell in the header stays English.
//
// Needs: i18n.js from team-site-design-system next to this file (t, D, apply), push-strings.js, push.css, and the
// markup in push-dialogs.html.
import { t, D, apply } from "./i18n.js";
import { pushStrings } from "./push-strings.js";

const PREFS_KEY = "push_prefs";
const INSTALL_KEY = "install_seen_";   // + member id
const WELCOME_KEY = "push_welcomed";   // the installed app opened the sheet once by itself

const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const getPref = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: this visit only */ } };
async function api(path, init = {}) {
  const r = await fetch(path, { credentials: "same-origin", ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.error || "HTTP " + r.status), { status: r.status });
  return body;
}

const UA = navigator.userAgent;
const IOS = /iPhone|iPad|iPod/.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS says "Mac"
const IOS_VER = (() => { const m = UA.match(/OS (\d+)[._](\d+)/); return IOS && m ? +m[1] + +m[2] / 100 : 0; })(); // 16.4 → 16.04
const OLD_IOS = IOS_VER > 0 && IOS_VER < 16.04;
const KAKAO = /KAKAOTALK/i.test(UA);
const CAN_PUSH = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function localPrefs() {
  try {
    const v = JSON.parse(getPref(PREFS_KEY) || "null");
    if (v && typeof v.notifyNew === "boolean" && typeof v.notifyBefore === "boolean") return v;
  } catch (e) { /* default */ }
  return { notifyNew: true, notifyBefore: true };
}
const keepPrefs = (p) => setPref(PREFS_KEY, JSON.stringify({ notifyNew: p.notifyNew, notifyBefore: p.notifyBefore }));
function keyBytes(b64) {
  const s = b64.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
}

/**
 * appName  the Home Screen name (manifest short_name), used in the steps
 * member   the signed-in member's id ("" when unknown): the install pop-up is once per member
 * seen     { install: boolean } from GET /api/me, or null when the server can't say (then the pop-up never opens)
 * onOpen   called with an address ("/?date=…&event=…#calendar") when a notification is tapped while the site is open
 */
export function createPush({ appName = "{{SITE_SHORT_NAME}}", member = "", seen = null, onOpen = null } = {}) {
  const words = pushStrings(appName);
  Object.assign(D.en, words.en);
  Object.assign(D.ko, words.ko);
  const dlg = $("#push-dlg");
  const inst = $("#install-dlg");
  apply(dlg);
  apply(inst);

  const S = {
    server: null,      // { ready, publicKey } from GET /api/push
    sub: null,         // this device's PushSubscription, when there is one
    active: false,     // the server has this device
    prefs: localPrefs(),
    busy: false,
    note: "",          // a passing message under the switches (saving, error)
  };
  const reg = CAN_PUSH ? navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => null) : Promise.resolve(null);
  if (CAN_PUSH && onOpen) {
    navigator.serviceWorker.addEventListener("message", (e) => {
      const d = e.data || {};
      if (d.type === "app:open" && typeof d.url === "string" && d.url.startsWith("/")) onOpen(d.url);
    });
  }

  // what this device can do right now; every state has one status line
  function mode() {
    if (IOS && !standalone()) return KAKAO ? "kakao" : OLD_IOS ? "oldios" : "install";
    if (OLD_IOS) return "oldios";
    if (!CAN_PUSH) return "nosupport";
    if (!S.server) return "checking";
    if (!S.server.ready || !S.server.publicKey) return "server";
    if (Notification.permission === "denied") return "denied";
    return S.active ? "on" : "off";
  }
  // an iPhone or iPad browser that could install the app and get notifications there
  const installMode = () => ["install", "kakao"].includes(mode());
  const STATUS = { kakao: "push.stKakao", oldios: "push.stOldIos", install: "push.stInstall", nosupport: "push.stNoSupport",
    checking: "push.stChecking", server: "push.stServer", denied: IOS ? "push.stDeniedIos" : "push.stDenied", off: "push.stOff", on: "push.stOn" };

  function paint() {
    const m = mode();
    const st = $("#push-status");
    st.textContent = S.note || t(STATUS[m]);
    st.dataset.state = S.note ? "note" : m;
    const usable = ["on", "off"].includes(m);
    $$(".push-row", dlg).forEach((b) => {
      b.setAttribute("aria-checked", String(!!S.prefs[b.dataset.pref]));
      b.disabled = !usable || S.busy;
    });
    const onBtn = $("#push-on");
    onBtn.hidden = m !== "off";
    onBtn.disabled = S.busy || (!S.prefs.notifyNew && !S.prefs.notifyBefore);
    // iPhone steps: open in an iPhone browser that hasn't installed the app, folded elsewhere, gone inside the app
    const ios = $("#push-ios");
    ios.hidden = standalone();
    if (!ios.dataset.touched) ios.open = IOS && !standalone();
    $("#push-s1").hidden = KAKAO;
    $("#push-s1k").hidden = !KAKAO;
  }
  $("#push-ios").addEventListener("toggle", (e) => { e.currentTarget.dataset.touched = "1"; });
  // KakaoTalk's in-app browser opens this address in Safari
  const SAFARI = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.origin + "/");
  $("#push-safari").href = SAFARI;
  $("#install-safari").href = SAFARI;

  const subJson = () => S.sub.toJSON();

  // read where this device stands: the server's key, this device's subscription and its saved switches
  async function refresh() {
    if (!CAN_PUSH || (IOS && !standalone())) { paint(); return; }
    try {
      S.server = await api("/api/push");
      const r = await reg;
      S.sub = r ? await r.pushManager.getSubscription() : null;
      if (S.sub && Notification.permission === "granted" && S.server.ready) {
        const saved = await api("/api/push?read", { method: "POST", body: JSON.stringify(subJson()) });
        S.active = !!saved.registered;
        if (S.active) { S.prefs = { notifyNew: saved.notifyNew, notifyBefore: saved.notifyBefore }; keepPrefs(S.prefs); }
      } else S.active = false;
    } catch (e) {
      S.server = S.server || { ready: false };
    }
    paint();
  }

  async function open() {
    if (installMode()) { openInstall(); return; }
    S.note = "";
    paint();
    if (!dlg.open) {
      dlg.showModal();
      dlg.focus({ preventScroll: true }); // the sheet, not its close button: no focus ring after a tap; Tab still reaches it
    }
    await refresh();
  }

  // "Turn on notifications": ask (straight from the tap, before anything is awaited), subscribe, save on the server
  function turnOn() {
    if (S.busy || mode() !== "off") return;
    S.busy = true;
    S.note = t("push.stSaving");
    paint();
    const asked = Notification.permission === "granted" ? Promise.resolve("granted") : Notification.requestPermission();
    asked.then(async (perm) => {
      if (perm !== "granted") { S.note = ""; return; }
      const r = await navigator.serviceWorker.ready;
      S.sub = (await r.pushManager.getSubscription())
        || (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(S.server.publicKey) }));
      const saved = await api("/api/push", { method: "POST", body: JSON.stringify({ ...subJson(), ...S.prefs, who: member }) });
      S.active = !!saved.registered;
      S.prefs = { notifyNew: saved.notifyNew, notifyBefore: saved.notifyBefore };
      keepPrefs(S.prefs);
      S.note = "";
    }).catch(() => { S.note = t("push.stErr"); })
      .finally(() => { S.busy = false; paint(); });
  }

  async function toggle(pref) {
    if (S.busy) return;
    const next = { ...S.prefs, [pref]: !S.prefs[pref] };
    if (!S.active) { S.prefs = next; keepPrefs(next); paint(); return; }
    S.busy = true;
    S.prefs = next; // the switch moves at once; it goes back if saving fails
    paint();
    try {
      const saved = await api("/api/push", { method: "POST", body: JSON.stringify({ ...subJson(), [pref]: next[pref] }) });
      S.prefs = { notifyNew: saved.notifyNew, notifyBefore: saved.notifyBefore };
      keepPrefs(S.prefs);
    } catch (e) {
      S.prefs = { ...next, [pref]: !next[pref] };
      S.note = t("push.stErr");
    } finally {
      S.busy = false;
      paint();
    }
  }

  dlg.addEventListener("click", (e) => {
    const row = e.target.closest(".push-row");
    if (row) toggle(row.dataset.pref);
    if (e.target.closest("[data-close]")) dlg.close();
  });
  $("#push-on").addEventListener("click", turnOn);
  $$("[data-push-open]").forEach((b) => b.addEventListener("click", open)); // the bell, and a menu entry if you add one
  window.addEventListener("site:lang", () => { if (dlg.open) paint(); });

  /** The member changed (a shared device, a new name): the server skips the author for events they add. */
  async function whoChanged(id) {
    member = id || "";
    if (!S.active || !S.sub) return;
    try { await api("/api/push", { method: "POST", body: JSON.stringify({ ...subJson(), who: member }) }); } catch (e) { /* next save carries it */ }
  }
  // at load: learn whether this device is on (quietly), so a name change reaches the server
  if (CAN_PUSH && (!IOS || standalone())) {
    reg.then(async (r) => {
      const sub = r && await r.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") { S.sub = sub; S.active = true; }
    }).catch(() => {});
  }

  /* ---------- Add to Home Screen ---------- */
  let afterInstall = null;
  function openInstall(after) {
    afterInstall = after || null;
    ["#install-s1", "#install-s2"].forEach((q) => { $(q).hidden = KAKAO; });
    ["#install-s1k", "#install-s2k"].forEach((q) => { $(q).hidden = !KAKAO; });
    if (!inst.open) {
      inst.showModal();
      inst.focus({ preventScroll: true }); // the sheet, not its first button: no focus ring on a tap-first screen
    }
  }
  $$("[data-install-close]", inst).forEach((b) => b.addEventListener("click", () => inst.close()));
  inst.addEventListener("close", () => {
    const f = afterInstall;
    afterInstall = null;
    if (f) setTimeout(f, 300);
  });

  /** Once per member in an iPhone or iPad browser: the sheet now, then `after` when it closes (the site guide, say).
   *  False if it doesn't show: inside the app, on other phones and computers, when either record says it was shown,
   *  when the server can't say, or while another dialog is open. */
  function offerInstall(after) {
    if (!installMode() || !member || !seen || seen.install !== false || getPref(INSTALL_KEY + member) || document.querySelector("dialog[open]")) return false;
    seen.install = true;
    setPref(INSTALL_KEY + member, "1");
    api("/api/me", { method: "POST", body: JSON.stringify({ seen: "install" }) }).catch(() => { /* this browser remembers it */ });
    openInstall(after);
    return true;
  }

  /** The installed app's first start on this device: open the sheet once, so "Turn on notifications" is one tap away. */
  function welcome() {
    if (!standalone() || getPref(WELCOME_KEY) || document.querySelector("dialog[open]")) return false;
    setPref(WELCOME_KEY, "1");
    setTimeout(open, 400);
    return true;
  }

  return { open, openInstall, offerInstall, welcome, whoChanged, standalone, mode: () => mode() };
}
