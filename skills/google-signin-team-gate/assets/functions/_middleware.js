import { googleOn, googleAuthUrl, verifyIdToken, startSession, currentUser, endSession, sessionCookie, nonceCookie, randomToken,
  readCookie as cookieOf, NONCE, AUTH_PATH } from "../lib/auth.js";
// Optional, from other skills (uncomment when you add them, and see REWRITES, MACHINE and HEAD_EXTRA below):
// import { readerRewrite } from "../lib/reader-route.js";   // lecture-notes-reader
// import { tickAllowed } from "../lib/push.js";              // ios-webapp-push
// import { ogTags } from "../lib/og-tags.js";                // kakao-link-preview

// The site's gate. Every request (pages, files, API) passes through here first.
// Sign in with Google (lib/auth.js): only the addresses on ALLOWED_EMAILS get in, for 180 days, in the browser and in
// the Home Screen app alike. The signed-in member reaches the functions as context.data.user ({ email, member });
// the team chat, the calendar and /api/me all take the author or the reader from there, never from the page.
// It needs GOOGLE_CLIENT_ID and the D1 binding DB; without them nobody gets in and the page says what is missing.

/* ---------- configuration ---------- */
const SITE_NAME = "{{SITE_NAME}}";
// the name under the icon on the Home Screen (iOS cuts it after about 12 characters)
const APP_TITLE = "{{SITE_SHORT_NAME}}";
const DESCRIPTION = `Team site of ${SITE_NAME}.`;

// The sign-in background. Best: a still of the intro's settled first frame (scroll-3d-intro), a landscape one and a
// portrait one for phones, so signing in and the intro read as one scene. Swap them together with the intro's poster.
const GATE_BG = "/assets/poster.svg";
const GATE_BG_TALL = "/assets/poster-tall.svg";

// Open without signing in. Link previews (KakaoTalk etc.) fetch the picture; the sign-in page shows the background; the
// web app's manifest, its icons and the service worker are fetched by browsers without cookies. None of them is private.
const PUBLIC = new Set(["/robots.txt", "/favicon.svg", "/assets/og.jpg", GATE_BG, GATE_BG_TALL, "/manifest.webmanifest", "/sw.js"]);
const PUBLIC_ICON = /^\/icons\/[a-z0-9-]+\.png$/;

// Paths a machine calls without a session, each passed only with its own secret header (checked in constant time by
// its owner). ios-webapp-push: "/api/push/tick": { header: "X-Push-Tick", allowed: tickAllowed }
export const MACHINE = {
};

// Signed-in rewrites, tried in order: each returns a Response or null. lecture-notes-reader: readerRewrite
// (/theory/<part>/<chapter> → the reader page). They run only after the sign-in, so a signed-out visitor gets the
// sign-in page first and comes back to the same address.
export const REWRITES = [
];

// Extra tags for the sign-in page's <head>, e.g. the link-preview tags (kakao-link-preview):
//   const HEAD_EXTRA = (origin) => ogTags(origin, { siteName: SITE_NAME, title: SITE_NAME, description: DESCRIPTION });
const HEAD_EXTRA = (origin) => `<meta name="description" content="${esc(DESCRIPTION)}">`;

// the one line for anyone who isn't on the team list (and for a token that doesn't check out, a plain "try again")
const TEAM_ONLY = `This site is for the ${SITE_NAME} team only.`;
const TRY_AGAIN = "Couldn't sign in. Try again.";
const NOT_SET_UP = "Sign-in isn't set up yet: GOOGLE_CLIENT_ID and the D1 binding DB.";

/* ---------- local preview ---------- */
// wrangler pages dev: DEV_MEMBER=alex signs every request in as that member, so pages can be checked and screenshotted
// without Google. It needs the variable and a localhost address both, so it never works on the live site (and the live
// site never has DEV_MEMBER).
const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);
function devUser(env, url) {
  const m = String((env && env.DEV_MEMBER) || "").trim().toLowerCase();
  return m && LOCAL.has(url.hostname) && /^[a-z0-9_-]{1,32}$/.test(m) ? { email: "", member: m } : null;
}

/* ---------- helpers ---------- */
function safeNext(v) {
  const s = String(v || "/");
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") && !s.startsWith("/__") ? s : "/";
}

function secure(res) {
  const r = new Response(res.body, res);
  r.headers.set("X-Robots-Tag", "noindex, nofollow");
  r.headers.set("Referrer-Policy", "same-origin");
  r.headers.set("X-Content-Type-Options", "nosniff");
  r.headers.set("X-Frame-Options", "SAMEORIGIN");
  return r;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const jsonRes = (data, status) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

/* ---------- the sign-in page ---------- */
// The "Sign in with Google" button (google = { href, next }), or only a message when sign-in isn't set up.
// Always dark: it sits on the poster, whatever the system's light or dark setting (color-scheme: dark).
export function gatePage(url, { status = 200, msg = "", google = null, headers = {} } = {}) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(SITE_NAME)}</title>
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#111216">
${HEAD_EXTRA(url.origin)}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="${esc(APP_TITLE)}">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
:root{--sky:#111216;--ink:#f5f5f7;--ink2:#a1a1a6;--bad:#ff6961;color-scheme:dark}
*{box-sizing:border-box}
html,body{height:100%;background:var(--sky)}
body{margin:0;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Pretendard Variable",Pretendard,"Segoe UI",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;overflow:hidden;letter-spacing:-.01em}
/* the poster under the same shade and dim the intro shows on arrival (scroll-3d-intro, html.ix-login) */
.bg{position:fixed;inset:0;background:var(--sky) url(${GATE_BG}) 50% 50%/cover no-repeat}
.bg::before{content:"";position:absolute;inset:0;background:radial-gradient(85% 70% at 0% 100%,rgba(10,11,14,.74) 0,rgba(10,11,14,.40) 40%,rgba(10,11,14,0) 74%)}
.bg::after{content:"";position:absolute;inset:0;background:#0b0c0f;opacity:.6}
@media (max-aspect-ratio:4/5),(max-width:700px){.bg::before{background:linear-gradient(to top,rgba(10,11,14,.78) 0,rgba(10,11,14,.42) 26%,rgba(10,11,14,0) 52%)}}
@media (max-aspect-ratio:4/5){.bg{background-image:url(${GATE_BG_TALL})}}
/* one translucent grey pill in the middle: "Sign in with Google", or "Open in Safari" inside KakaoTalk */
.g{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(320px,calc(100vw - 48px));display:grid;justify-items:center}
.pill{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-width:232px;height:44px;padding:0 22px;border-radius:999px;
  background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);color:var(--ink);
  -webkit-backdrop-filter:blur(20px) saturate(1.4);backdrop-filter:blur(20px) saturate(1.4);
  font-size:15px;font-weight:500;letter-spacing:-.01em;text-decoration:none;-webkit-tap-highlight-color:transparent;
  transition:background-color .2s ease,border-color .2s ease,transform .15s ease,opacity .3s ease}
.pill svg{width:17px;height:17px;flex:none;opacity:.92}
@media (hover:hover){.pill:hover{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.24)}}
.pill:active{transform:scale(.98)}
.pill:focus-visible{outline:2px solid rgba(255,255,255,.7);outline-offset:3px}
.pill.go{opacity:.5;pointer-events:none}
@media (prefers-reduced-motion:reduce){.pill{transition:none}}
.hint{margin:12px 0 0;font-size:13px;line-height:1.45;text-align:center;color:var(--ink2)}
.msg{margin:14px 0 0;font-size:13px;line-height:1.45;text-align:center;color:var(--bad)}
.msg:empty{display:none}
.g [hidden]{display:none}
</style></head>
<body>
<div class="bg" aria-hidden="true"></div>
${google ? googleBody(google, msg) : `<main class="g"><p class="msg" role="alert">${esc(msg)}</p></main>`}
</body></html>`;
  const h = new Headers({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "same-origin", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN" });
  for (const [k, v] of Object.entries(headers)) h.append(k, v);
  return new Response(html, { status, headers: h });
}

// The sign-in body: one button in the middle, the message under it. The button is a plain link to Google's sign-in,
// which comes back to AUTH_PATH (works without JavaScript, in the browser and the installed app alike).
// Google's own button script (GIS) is not used: its button cannot be restyled to sit on the poster.
// In KakaoTalk (and other in-app browsers) Google refuses to sign in, so the first step there is to open Safari.
const G_MARK = `<svg viewBox="0 0 18 18" aria-hidden="true" fill="currentColor"><path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.87 2.69-6.62z"/><path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z"/><path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/></svg>`;
function googleBody({ href, next }, msg) {
  return `<main class="g" id="g">
  <a class="pill" id="gbtn" href="${esc(href)}" data-next="${esc(next)}">${G_MARK}<span>Sign in with Google</span></a>
  <a class="pill" id="open" href="#" hidden>Open in Safari</a>
  <p class="hint" id="hint" hidden></p>
  <p class="msg" role="alert">${esc(msg)}</p>
</main>
<script>
(function () {
  var ua = navigator.userAgent, $ = function (id) { return document.getElementById(id); }, b = $("gbtn");
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var kakao = /KAKAOTALK/i.test(ua), inApp = kakao || /NAVER\\(inapp|Instagram|FBAN|FBAV|Line\\/|DaumApps|everytimeApp|; wv\\)/i.test(ua);
  if (inApp) {
    b.hidden = true;
    if (kakao) {
      var o = $("open");
      o.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
      o.textContent = ios ? "Open in Safari" : "Open in browser";
      o.hidden = false;
    }
    var h = $("hint");
    h.textContent = ios ? "Google sign-in works in Safari, not inside this app." : "Google sign-in works in your browser, not inside this app.";
    h.hidden = false;
    return;
  }
  // back from Google, "/" starts the intro on this same still (scroll-3d-intro reads intro_arrive)
  b.addEventListener("click", function (e) {
    if (b.classList.contains("go")) return e.preventDefault();
    b.classList.add("go");
    try { sessionStorage.removeItem("intro_seen"); if (b.getAttribute("data-next") === "/") sessionStorage.setItem("intro_arrive", "1"); } catch (err) {}
  });
  // coming back with the browser's Back button: the button works again
  addEventListener("pageshow", function () { b.classList.remove("go"); });
})();
</script>`;
}

/* ---------- every request ---------- */
export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const url = new URL(request.url);
  const path = url.pathname;

  if (PUBLIC.has(path) || PUBLIC_ICON.test(path)) return secure(await next());
  const machine = Object.prototype.hasOwnProperty.call(MACHINE, path) ? MACHINE[path] : null;
  if (machine && request.headers.get(machine.header)) {
    if (await Promise.resolve(machine.allowed(env, request)).catch(() => false)) return secure(await next());
    return jsonRes({ error: "forbidden" }, 403);
  }

  const dev = devUser(env, url);
  if (dev) {
    ctx.data = ctx.data || {};
    ctx.data.user = dev;
    return signedIn(ctx, url, path);
  }
  if (!googleOn(env)) return gatePage(url, { status: 503, msg: NOT_SET_UP });
  return googleGate(ctx, url, path);
}

// a signed-in request goes on to the page, file or API
async function signedIn(ctx, url, path) {
  const { request, next } = ctx;
  // write requests only from this site
  if (path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return jsonRes({ error: "origin" }, 403);
  }
  for (const rewrite of REWRITES) {
    const res = await rewrite(ctx);
    if (res) return secure(res);
  }
  return secure(await next());
}

function signInAgain() {
  return jsonRes({ error: "auth", message: "Please sign in again." }, 401);
}

// signed in → on to the page; signed out → the sign-in page (a page load) or 401 (anything else)
async function googleGate(ctx, url, path) {
  const { request, env } = ctx;
  if (path === AUTH_PATH) return googleSignIn(request, env, url);
  if (path === "/__logout") {
    await endSession(env, request).catch(() => {});
    const h = new Headers({ Location: "/", "Cache-Control": "no-store" });
    h.append("Set-Cookie", sessionCookie(request, "", 0));
    return new Response(null, { status: 303, headers: h });
  }

  const user = await currentUser(env, request).catch((e) => { console.warn("auth", e && e.message); return null; });
  if (user) {
    ctx.data = ctx.data || {};
    ctx.data.user = user;
    return signedIn(ctx, url, path);
  }
  if (path.startsWith("/api/")) return signInAgain();
  // only a page load gets the sign-in page: the browser's own requests on the side (/favicon.ico, Safari's
  // /apple-touch-icon-precomposed.png …) must not reset the nonce the open sign-in page is waiting with
  const dest = request.headers.get("Sec-Fetch-Dest");
  const page = dest ? dest === "document" : !/\.[a-z0-9]{2,5}$/i.test(path) || /\.html?$/i.test(path);
  if (!page) return new Response("Sign in first.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  return googleGatePage(request, env, url, { next: safeNext(path + url.search) });
}

// the sign-in page with its nonce (its cookie also carries where to go afterwards).
// A nonce still in its 10 minutes is kept, so two open sign-in tabs both work.
function googleGatePage(request, env, url, { next = "/", msg = "", status = 200 } = {}) {
  const kept = cookieOf(request, NONCE).split("|")[0];
  const nonce = /^[a-f0-9]{32}$/.test(kept) ? kept : randomToken(16);
  return gatePage(url, {
    status, msg, google: { href: googleAuthUrl(env, url.origin, nonce), next },
    headers: { "Set-Cookie": nonceCookie(request, nonce + "|" + next) },
  });
}

// Google posts back here (OpenID Connect, response_mode=form_post): id_token and state, or error (e.g. Cancel).
async function googleSignIn(request, env, url) {
  if (request.method !== "POST") return Response.redirect(url.origin + "/", 303);
  const [nonce, nextRaw] = cookieOf(request, NONCE).split("|");
  const next = safeNext(nextRaw);
  const f = await request.formData().catch(() => null);
  const field = (k) => String((f && f.get(k)) || "");
  if (field("error")) return googleGatePage(request, env, url, { next, msg: field("error") === "access_denied" ? "" : TRY_AGAIN });
  // state is the nonce of the sign-in page that started this, so a post this browser didn't start is refused
  const credential = nonce && field("state") === nonce ? field("id_token") : "";
  const idt = await verifyIdToken(env, credential, nonce || "").catch((e) => { console.warn("auth", e && e.message); return { ok: false, why: "token" }; });
  const token = idt.ok ? await startSession(env, idt).catch((e) => { console.warn("auth", e && e.message); return null; }) : null;
  if (!token) {
    const msg = idt.ok || idt.why === "team" || idt.why === "verified" ? TEAM_ONLY : TRY_AGAIN;
    return googleGatePage(request, env, url, { next, msg, status: 403 });
  }
  const h = new Headers({ Location: next, "Cache-Control": "no-store" });
  h.append("Set-Cookie", sessionCookie(request, token));
  h.append("Set-Cookie", nonceCookie(request, "", 0));
  return new Response(null, { status: 303, headers: h });
}
