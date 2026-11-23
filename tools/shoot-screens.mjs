// Screen-by-screen layout reference: every demo screen at five widths, light and dark side by side, into
// docs/design/screens/<screen>-<width>.jpg (described in docs/design/screens.md).
//
//   node tools/shoot-screens.mjs                         every screen (about 6 minutes; the 3D intro is the slow one)
//   node tools/shoot-screens.mjs calendar-week signin    only these screens
//
// Needs Playwright (require('playwright')), python3 with Pillow (the side-by-side merge), Node 22.13+ (the sign-in demo
// uses node:sqlite) and the demos' vendor files, once:
//   bash skills/weekly-research-log/assets/fetch-vendor.sh
//   bash skills/references-library/assets/fetch-vendor.sh
//   bash skills/lecture-notes-reader/assets/fetch-vendor.sh
//   bash skills/scroll-3d-intro/assets/fetch-vendor.sh
// It starts its own servers: a static server on the repository root, the reader demo (serve.mjs, for /theory/… addresses)
// and the sign-in demo (serve.mjs, the real gate with a mock Google). Nothing leaves this machine.
//
// Each shot: deviceScaleFactor 1, the theme set both as prefers-color-scheme and as localStorage "site_theme" (read by
// the pages before paint), touch and mobile emulation at 760 px and below, reduced motion so dialogs and sheets are
// shot at rest. The light shot goes on the left, the dark one on the right, 16 px apart, saved as JPEG quality 82.
// It also prints a horizontal-overflow check for every shot: document.documentElement.scrollWidth > innerWidth.
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "design", "screens");
const SIZES = [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 640]];
const PHONES = [390, 320];
const GAP = 16;
const QUALITY = 82;
const NOW = "2026-11-25T14:20:00%2B09:00"; // the calendar demo's frozen clock (a Wednesday afternoon)

/* ---------- the screens ---------- */
// base: "static" (repository root), "reader" (lecture-notes-reader serve.mjs) or "gate" (google-signin-team-gate serve.mjs)
// ready(page, { w, phone }): bring the page into the state to shoot. widths: only these widths.
const SCREENS = [
  { name: "styleguide", base: "static", url: "/skills/team-site-design-system/assets/demo/",
    ready: (p) => p.waitForSelector("#gc .swatch") },
  { name: "styleguide-sheet", base: "static", url: "/skills/team-site-design-system/assets/demo/#sheet",
    ready: (p) => p.waitForSelector("#sheet[open]") },
  { name: "calendar-week", base: "static", url: `/skills/shared-google-calendar/assets/demo/?now=${NOW}`,
    ready: calendarReady },
  { name: "calendar-month", base: "static", url: `/skills/shared-google-calendar/assets/demo/?now=${NOW}`,
    ready: async (p) => { await calendarReady(p); await p.evaluate(() => window.demoCal.setView("month")); await p.waitForSelector(".lanes .ev"); } },
  { name: "calendar-event", base: "static", url: `/skills/shared-google-calendar/assets/demo/?now=${NOW}`,
    ready: async (p) => {
      await calendarReady(p);
      await p.evaluate(() => window.demoCal.openEditor(window.demoCal.state.events.find((e) => e.title === "Design review")));
      await p.waitForSelector("#ev-dlg[open]");
    } },
  { name: "research-log", base: "static", url: "/skills/weekly-research-log/assets/demo/",
    ready: (p) => p.waitForSelector("#week-body .doc") },
  { name: "references", base: "static", url: "/skills/references-library/assets/demo/",
    ready: (p) => p.waitForSelector(".refs-sec .facts") },
  { name: "references-papers", base: "static", url: "/skills/references-library/assets/demo/?at=sec-papers",
    ready: (p) => p.waitForSelector(".papers .paper") },
  { name: "theory-tab", base: "reader", url: "/#theory/heat/h1-heat-flow-in-a-rod",
    ready: (p) => p.waitForSelector("#th-body h1") },
  { name: "reader", base: "reader", url: "/theory/heat/h1-heat-flow-in-a-rod",
    ready: (p) => p.waitForSelector(".rd-text h2") },
  { name: "reader-contents", base: "reader", url: "/theory/heat/h1-heat-flow-in-a-rod", widths: PHONES,
    ready: async (p) => {
      await p.waitForSelector(".rd-text h2");
      // read on to the second section, so the bar is stuck at the top and names the section being read
      await p.evaluate(() => { const h = document.querySelectorAll(".rd-text h2")[1]; window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 40); });
      await p.waitForTimeout(300);
      await p.click(".rd-bar-btn");
      await p.waitForSelector(".rd-sheet:not([hidden])");
    } },
  { name: "chat-open", base: "static", url: "/skills/team-chat/assets/demo/?state=open",
    ready: (p) => p.waitForSelector(".chat.in .cm") },
  { name: "chat-quote", base: "static", url: "/skills/team-chat/assets/demo/?state=quote",
    ready: (p) => p.waitForSelector(".chat.in .chat-q:not([hidden])") },
  { name: "signin", base: "gate", url: "/",
    ready: (p) => p.waitForSelector(".pill") },
  { name: "gate-home", base: "gate", url: "/",
    ready: async (p) => {
      await p.click("#gbtn");
      await p.waitForURL(/__mock\/google/);
      await Promise.all([p.waitForNavigation(), p.click("button[value='0']")]); // Alex, on the list
      await p.waitForFunction(() => /Signed in as/.test(document.getElementById("who")?.textContent || ""));
    } },
  { name: "push-sheet", base: "static", url: "/skills/ios-webapp-push/assets/demo/?state=on&prefs=10&open=push",
    ready: (p) => p.waitForFunction(() => /on for this device/.test(document.getElementById("push-status")?.textContent || "")) },
  { name: "push-install", base: "static", url: "/skills/ios-webapp-push/assets/demo/?ua=ios&open=install",
    ready: (p) => p.waitForSelector("#install-dlg[open]") },
  { name: "guide", base: "static", url: "/skills/first-visit-spotlight-guide/assets/demo/?reset&as=alex",
    ready: async (p) => {
      await p.waitForSelector(".guide:not(.is-off)");
      await p.keyboard.press("ArrowRight"); // step 2 of 6: the shared calendar
      await p.waitForTimeout(700); // the hole eases for 280 ms; the page may scroll first
    } },
  // the intro is never shown at 760 px and below (phones open on the app); WebGL runs on SwiftShader in headless Chromium
  { name: "intro", base: "static", url: "/skills/scroll-3d-intro/assets/demo/?again", widths: [1440, 1024], motion: "no-preference", scan: false,
    ready: async (p) => { await p.waitForFunction(() => document.documentElement.classList.contains("ix-go")); await p.waitForTimeout(4500); } },
];

async function calendarReady(p) {
  await p.waitForSelector(".wv-ev, .lanes .ev");
  await p.waitForFunction(() => /Synced/.test(document.getElementById("sync")?.textContent || ""));
}

/* ---------- servers ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".md": "text/markdown; charset=utf-8", ".csv": "text/csv; charset=utf-8",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".glb": "model/gltf-binary", ".hdr": "application/octet-stream" };

function staticServer() {
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { p = "/"; }
    if (p.endsWith("/")) p += "index.html";
    const f = path.normalize(path.join(ROOT, p));
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(fs.readFileSync(f));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

async function demoServer(script, ready) {
  const port = await freePort();
  const child = spawn(process.execPath, ["--no-warnings", path.join(ROOT, script), String(port)], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((resolve, reject) => {
    child.stdout.on("data", (d) => { if (String(d).includes(ready)) resolve(); });
    child.on("exit", (c) => reject(new Error(`${script} exited ${c}`)));
  });
  return { child, base: `http://localhost:${port}` };
}

/* ---------- one shot ---------- */
async function shoot(browser, bases, screen, w, h, theme) {
  const phone = w <= 760;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: theme,
    reducedMotion: screen.motion || "reduce", hasTouch: phone, isMobile: phone });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem("site_theme", t); } catch {}
    const set = () => { document.documentElement.dataset.theme = t; };
    if (document.documentElement) set();
    else new MutationObserver((_, o) => { if (document.documentElement) { set(); o.disconnect(); } }).observe(document, { childList: true });
  }, theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(bases[screen.base] + screen.url, { waitUntil: "networkidle" });
    if (screen.ready) await screen.ready(page, { w, phone });
    await page.waitForTimeout(screen.wait ?? 450);
    const buf = await page.screenshot();
    // after the shot: read on to the end of the page in half-screen steps, so sections that are laid out only near the
    // screen (content-visibility) are measured too; the widest scrollWidth counts
    const fit = await page.evaluate(async (scan) => {
      const de = document.documentElement;
      let sw = de.scrollWidth;
      if (scan) {
        for (let y = 0; y < de.scrollHeight; y += innerHeight / 2) {
          window.scrollTo(0, y);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          sw = Math.max(sw, de.scrollWidth);
        }
      }
      return { sw, iw: innerWidth };
    }, screen.scan !== false);
    return { buf, fit, errors };
  } finally {
    await ctx.close();
  }
}

/* ---------- light | dark, side by side ---------- */
const MERGE = `
import json, os, sys
from PIL import Image
for job in json.load(open(sys.argv[1])):
    a = Image.open(job["light"]).convert("RGB")
    b = Image.open(job["dark"]).convert("RGB")
    gap = job["gap"]
    c = Image.new("RGB", (a.width + gap + b.width, max(a.height, b.height)), (142, 142, 147))
    c.paste(a, (0, 0))
    c.paste(b, (a.width + gap, 0))
    c.save(job["out"], "JPEG", quality=job["quality"], optimize=True, progressive=True)
    print("wrote %s (%d KB)" % (os.path.relpath(job["out"]), os.path.getsize(job["out"]) // 1024))
`;

async function main() {
  const only = process.argv.slice(2);
  const unknown = only.filter((n) => !SCREENS.some((s) => s.name === n));
  if (unknown.length) { console.error("unknown screen:", unknown.join(", "), "\nscreens:", SCREENS.map((s) => s.name).join(" ")); process.exit(2); }
  const todo = SCREENS.filter((s) => !only.length || only.includes(s.name));
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "screens-"));
  const st = await staticServer();
  const reader = await demoServer("skills/lecture-notes-reader/assets/demo/serve.mjs", "demo on");
  const gate = await demoServer("skills/google-signin-team-gate/assets/demo/serve.mjs", "gate demo on");
  const bases = { static: st.base, reader: reader.base, gate: gate.base };
  const browser = await chromium.launch();
  const jobs = [];
  const report = [];
  try {
    for (const screen of todo) {
      for (const [w, h] of SIZES) {
        if (screen.widths && !screen.widths.includes(w)) continue;
        const files = {};
        for (const theme of ["light", "dark"]) {
          const r = await shoot(browser, bases, screen, w, h, theme);
          files[theme] = path.join(tmp, `${screen.name}-${w}-${theme}.png`);
          fs.writeFileSync(files[theme], r.buf);
          report.push({ shot: `${screen.name}-${w}-${theme}`, ...r.fit, errors: r.errors });
          if (r.errors.length) console.warn(`  ${screen.name} ${w} ${theme}: page error: ${r.errors.join(" | ")}`);
        }
        jobs.push({ light: files.light, dark: files.dark, out: path.join(OUT, `${screen.name}-${w}.jpg`), gap: GAP, quality: QUALITY });
        console.log(`shot ${screen.name} ${w}`);
      }
    }
  } finally {
    await browser.close();
    st.server.close();
    reader.child.kill();
    gate.child.kill();
  }
  const list = path.join(tmp, "jobs.json");
  fs.writeFileSync(list, JSON.stringify(jobs));
  const py = spawnSync("python3", ["-c", MERGE, list], { stdio: "inherit" });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (py.status !== 0) { console.error("the merge failed (python3 with Pillow is needed)"); process.exit(1); }

  console.log("\nhorizontal overflow (scrollWidth > innerWidth):");
  const over = report.filter((r) => r.sw > r.iw);
  if (!over.length) console.log("  none");
  for (const r of over) console.log(`  ${r.shot}: scrollWidth ${r.sw} > innerWidth ${r.iw} (+${r.sw - r.iw} px)`);
  const bytes = fs.readdirSync(OUT).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`\n${fs.readdirSync(OUT).length} files in docs/design/screens, ${(bytes / 1048576).toFixed(2)} MB`);
}

await main();
