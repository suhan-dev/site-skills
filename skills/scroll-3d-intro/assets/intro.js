/* Intro controller: headlines, scene dots, Skip, replay, the sign-in arrival and the end fade. The three.js picture is
   in intro-scene.js and is imported only when the intro is shown.
   - Scroll is the story axis: the stage is position: sticky inside a tall section. The run is STORY screens of story
     (every camera position is a function of scroll, so scrolling back replays the same picture), then HOLD screens on
     the last beat (the drift goes on), then FADE screens where the picture brightens and melts into the page colour.
     Small things also move in time (an arrival move, a slow drift, short beat events); scroll never moves on its own.
   - At the end of the run the intro folds away in one step: the page is already the page colour, and the app fades in
     at the top. Skip (top right) plays the same fade on a timer. The site name in the header ([data-replay]) plays the
     intro again: the app fades to the page colour and the picture comes out of it. Reduced motion: no clock, no moves,
     every switch is instant.
   - The app stays out of the page flow while the intro is on, so nothing slides up from below the stage.
   - Without WebGL the stage shows the poster (a still) and the headlines still follow the scroll.
   - Frames: at most 60 per second while something moves (also on 120 Hz screens), 30 when only the slow drift runs.
   - Not on phones (≤760 px wide, or a phone on its side): they open on the app, and the site name goes home there.
     Portrait tablets and windows get their own framing and the lighter render tier (see intro-scene.js).
   - Shown once per tab, only on "/" with no #hash in the address (the head script in intro-markup.html decides).
   - Arriving from the sign-in page (html.ix-login): the stage starts on the sign-in background (the poster), dimmed;
     with the first frame it brightens and the title rises. Signed-in visitors see the title from the first paint.
   - Stills: ?t=3 freezes the clock and draws on demand (window.introDebug.snap({ p, t, ev, end, light })), ?p=0.42
     jumps there, ?tier=low|high forces the tier, ?fx=0..3 and ?dpr= fix the quality, ?ui=0 hides all text,
     ?arrive=login plays the sign-in arrival. */
import { RUN, BEATS } from "./intro-story.js";

const html = document.documentElement;
const sec = document.getElementById("intro");
const stage = sec.querySelector(".ix-stage");
const endEl = sec.querySelector(".ix-end");
const heads = [...sec.querySelectorAll(".ix-heads > *")];
const dotsEl = sec.querySelector(".ix-dots");
const RMQ = matchMedia("(prefers-reduced-motion: reduce)");
const DARKQ = matchMedia("(prefers-color-scheme: dark)");
const PHONEQ = matchMedia("(max-width: 760px), (pointer: coarse) and (max-height: 500px)"); // no intro there (head script)
const Q = new URLSearchParams(location.search);
const qP = Q.has("p") && isFinite(+Q.get("p")) && Q.get("p") !== "" ? +Q.get("p") : null;
const SEEN_KEY = "intro_seen"; // sessionStorage: shown once per tab (the head script reads the same key)

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* the run, in screen heights. Keep in sync with the height of .ix in intro.css: 100svh × (1 + STORY + HOLD + FADE) */
const { STORY, HOLD, FADE } = RUN;
const RUNLEN = STORY + HOLD + FADE, S_HOLD = STORY / RUNLEN, S_FADE = (STORY + HOLD) / RUNLEN;
const OUT_S = 0.5, IN_S = 0.65, LEAVE_MS = 260;   // Skip fade, replay fade-in (s), app fade-out before a replay (ms)
if (heads.length !== BEATS.length) console.warn(`Intro: ${heads.length} headlines but ${BEATS.length} beats in intro-story.js.`);

/* ---------- scroll ---------- */
// Measured on resize only, so a frame never forces layout. The document may end before the section does (phones with a
// collapsed toolbar have a taller viewport than 100svh), so the run ends where scrolling ends.
let secTop = 0, runPx = 1;
function measure() {
  if (!html.classList.contains("intro-on")) return;
  secTop = sec.offsetTop;
  const room = sec.offsetHeight - stage.offsetHeight;
  const docEnd = html.scrollHeight - innerHeight - secTop;
  runPx = Math.max(1, Math.min(room, docEnd));
  const want = Math.round(stage.offsetHeight * RUNLEN);
  if (Math.abs(room - want) > 2) console.warn(`Intro: .ix height gives ${room}px of run, intro-story.js wants ${want}px.`);
}
addEventListener("resize", measure);
const runPos = () => clamp((scrollY - secTop) / runPx);           // 0 → 1 over the whole run
const storyP = (s) => clamp(s / S_HOLD);                           // the story: 0 → 1, then it holds on the last beat
const endOf = (s) => clamp((s - S_FADE) / (1 - S_FADE));           // the fade into the page: 0 → 1
const scrollToP = (p) => scrollTo({ top: secTop + p * S_HOLD * runPx, behavior: RMQ.matches ? "auto" : "smooth" });

/* ---------- scene dots ---------- */
const dots = BEATS.map((b, i) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", heads[i] ? heads[i].textContent.trim() : `Scene ${i + 1}`);
  btn.addEventListener("click", () => scrollToP(i === 0 ? 0 : (b[0] + b[1]) / 2 + 0.01));
  dotsEl.appendChild(btn);
  return btn;
});

let lastDot = -1, lastEnd = "";
function ui(p, e, light) {
  let cur = 0;
  heads.forEach((h, i) => {
    const [a, b, c, d] = BEATS[i] || [9, 9, 9, 9];
    const o = i === 0 ? 1 - sstep(c, d, p) : sstep(a, b, p) * (1 - sstep(c, d, p));
    const s = o.toFixed(3);
    if (h._o !== s) {
      h._o = s;
      h.style.opacity = s;
      // arriving: from 24 px below; leaving: 14 px up
      const dy = (1 - o) * (p < (b + c) / 2 ? 24 : -14);
      h.style.transform = RMQ.matches ? "none" : `translateY(${dy.toFixed(1)}px)`;
    }
    if (p >= (i === 0 ? -1 : a)) cur = i;
  });
  if (cur !== lastDot) {
    lastDot = cur;
    dots.forEach((d, i) => (i === cur ? d.setAttribute("aria-current", "step") : d.removeAttribute("aria-current")));
  }
  // the text leaves first; the page colour comes over the picture once the scene has brightened (in light mode it
  // first washes out)
  const v = (light ? sstep(0.22, 0.96, e) : sstep(0.12, 0.92, e)).toFixed(3);
  if (v !== lastEnd) { lastEnd = v; endEl.style.opacity = v; stage.style.setProperty("--ix-ui", (1 - sstep(0, 0.4, e)).toFixed(3)); }
}
const isLight = () => (html.dataset.theme ? html.dataset.theme !== "dark" : !DARKQ.matches);

/* ---------- the scene (loaded on demand) ---------- */
let scene = null, loading = null;
function load() {
  if (!loading) {
    loading = import("./intro-scene.js")
      .then((m) => { scene = m.default; window.introDebug.tier = scene.tier; })
      .catch((e) => { console.warn("Intro: showing the still instead of the 3D scene.", e); html.classList.add("ix-nogl", "ix-go"); });
  }
  return loading;
}

/* ---------- loop ---------- */
let running = false, raf = 0, lastT = 0, acc = 0, sS = 0, drawn = false;
let leaving = null, outT = 0;        // Skip: the timed fade into the page
let inT = 0, inAt = 0, fresh = true; // replay: the timed fade out of the page, once the scene has drawn again
function loop(now) {
  if (!running) return;
  const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.016;
  lastT = now;
  const rm = RMQ.matches, snapMode = scene && scene.snapMode;
  const sT = runPos();
  // the scroll is followed with a short exponential ease (time constant 1/7 s), never ahead of it
  if (rm || snapMode) sS = sT;
  else { sS += (sT - sS) * (1 - Math.exp(-dt * 7)); if (Math.abs(sT - sS) < 1e-5) sS = sT; }
  if (leaving) outT = Math.min(1, outT + dt / OUT_S);
  if (inT > 0 && (!fresh || html.classList.contains("ix-nogl") || now - inAt > 3000)) inT = Math.max(0, inT - dt / IN_S);
  const p = storyP(sS), light = isLight();
  const e = Math.max(endOf(sS), outT * outT * (3 - 2 * outT), inT * inT);
  // draw at most 60 frames a second while anything moves, 30 while only the slow drift runs
  const moving = sT !== sS || leaving || inT > 0 || e > 0;
  const busy = moving || !scene || scene.busy();
  acc += dt;
  if (scene && (!snapMode || !drawn) && (acc >= (busy ? 0.0125 : 0.029) || !drawn || fresh)) {
    if (snapMode) scene.snap({ p }); else scene.frame(p, acc, { end: e, light, idle: !busy });
    acc = 0; fresh = false;
    if (!drawn) { drawn = true; html.classList.add("ix-go"); }
  }
  ui(p, e, light);
  if (leaving && outT >= 1) { finish(leaving); return; }
  if (!leaving && endOf(sT) >= 0.995 && (rm || endOf(sS) >= 0.985)) { finish(); return; }
  raf = requestAnimationFrame(loop);
}
function start() {
  if (running || !html.classList.contains("intro-on") || document.hidden) return;
  running = true;
  lastT = 0;
  raf = requestAnimationFrame(loop);
}
function stop() { running = false; cancelAnimationFrame(raf); }

/* Debug and stills (see references/quality.md).
   snap(o): draw one frame ({ p, t, ev, end, light }) — with ?t= the clock is frozen and nothing else draws.
   go(p, o): scroll to story progress p (so the headline and dots match) and snap there.
   run(s): scroll to run position s (0 → 1 over story + hold + fade); fadeAt(e): the run position where the end fade is e. */
window.introDebug = {
  snap: (o) => (scene ? scene.snap(o) : Promise.resolve(false)),
  go: (p, o = {}) => { measure(); scrollTo(0, secTop + clamp(p) * S_HOLD * runPx); return scene ? scene.snap({ p, ...o }) : Promise.resolve(false); },
  ready: () => load(),
  frames: () => (scene ? scene.frames() : 0),
  quality: () => (scene ? scene.quality() : null),
  run: (s) => { measure(); scrollTo(0, secTop + clamp(s) * runPx); },
  fadeAt: (e) => S_FADE + clamp(e) * (1 - S_FADE),
  tier: null,
};

/* ---------- end: the picture has melted into the page; the intro folds away and the app fades in at the top ---------- */
function finish(toHash) {
  try { sessionStorage.setItem(SEEN_KEY, "1"); } catch (e) { /* ignore */ }
  stop();
  leaving = null; outT = 0; inT = 0;
  html.classList.remove("intro-on", "ix-login");
  html.classList.add("intro-off", "intro-arrive");
  setTimeout(() => html.classList.remove("intro-arrive"), 600);
  if (toHash && toHash !== "#" && location.hash !== toHash) location.hash = toHash;
  window.scrollTo(0, 0);
  calm();
  window.dispatchEvent(new Event("intro:done"));
}
// the wheel or swipe that ended the intro must not go on to scroll the app: swallow it until it stops (at most 1.5 s)
function calm() {
  const opt = { passive: false }, until = performance.now() + 1500;
  let t = 0;
  const off = () => { clearTimeout(t); removeEventListener("wheel", eat, opt); removeEventListener("touchmove", eat, opt); };
  const eat = (e) => { if (performance.now() > until) { off(); return; } e.preventDefault(); clearTimeout(t); t = setTimeout(off, 180); };
  addEventListener("wheel", eat, opt); addEventListener("touchmove", eat, opt);
  t = setTimeout(off, 400);
}

/* ---------- replay: back to the first frame, out of the page colour ---------- */
function enter(fadeIn) {
  html.classList.remove("intro-off", "ix-login", "ix-leave");
  html.classList.add("intro-on");
  measure();
  window.scrollTo(0, 0);
  sS = 0; leaving = null; outT = 0;
  inT = fadeIn ? 1 : 0; inAt = performance.now(); fresh = true;
  lastEnd = ""; endEl.style.opacity = fadeIn ? "1" : "0"; stage.style.setProperty("--ix-ui", fadeIn ? "0" : "1");
  if (scene) scene.restart();
  load();
  start();
}

document.addEventListener("click", (e) => {
  const sk = e.target.closest("[data-skip]");
  if (sk && html.classList.contains("intro-on")) {
    e.preventDefault();
    const to = sk.getAttribute("href") || "#";
    if (RMQ.matches || !running) finish(to);
    else if (!leaving) { leaving = to; outT = 0; }
    return;
  }
  const rp = e.target.closest("[data-replay]");
  if (rp && !html.classList.contains("intro-on")) { // the site name in the header: play the intro again from the top
    e.preventDefault();
    if (PHONEQ.matches) { // phones have no intro: the name goes home (the top of the app)
      window.scrollTo({ top: 0, behavior: RMQ.matches ? "auto" : "smooth" });
      return;
    }
    if (RMQ.matches || html.classList.contains("ix-leave")) { enter(false); return; }
    html.classList.add("ix-leave");                    // the app fades to the page colour first
    setTimeout(() => enter(true), LEAVE_MS);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop(); else start();
});

if (html.classList.contains("intro-on")) {
  measure();
  window.scrollTo(0, qP != null ? secTop + clamp(qP) * S_HOLD * runPx : 0);
  sS = runPos();
  setTimeout(() => html.classList.add("ix-go"), 4000); // never leave the arrival dimmed if the scene is slow to start
  load();
  start();
}
