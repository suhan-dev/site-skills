// Stills and motion metrics for the scroll intro, rendered headless with WebGL on SwiftShader (slow, but the same
// shaders as a real GPU). Uses Playwright and its Chromium. The page must load intro.js (window.introDebug).
//
//   node intro-frames.mjs <url> <outdir> [--w 1440] [--h 900] [--dpr 1] [--t 4] [--theme dark|light]
//        [--p 0,0.3,0.55,0.95] [--ui 1|0] [--prefix f] [--end 0.5] [--metrics 51] [--tier high|low]
//
//   --p        story progress values to shoot (files <prefix>00.png, <prefix>01.png …)
//   --t        the frozen clock in seconds (4 = the arrival has settled); the page gets ?t=<t>
//   --ui 0     hide all text (posters: --ui 0 --dpr 2, then convert the PNG to WebP)
//   --end e    also shoot the end fade at e (0 → 1): <prefix>-end.png
//   --metrics N  render N frames from p 0 to 1 (UI hidden) and write metrics.txt: the mean absolute pixel difference
//              between neighbours (is anything moving?) and the share of non-background pixels (is the subject there?)
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

const [url, out, ...rest] = process.argv.slice(2);
if (!url || !out) { console.error("usage: node intro-frames.mjs <url> <outdir> [--w 1440] [--h 900] [--p 0,0.5,1] [--metrics 51] …"); process.exit(2); }
const o = { w: 1440, h: 900, dpr: 1, t: 4, theme: "dark", p: "", ui: "1", prefix: "f", end: "", metrics: 0, tier: "" };
for (let i = 0; i < rest.length; i++) o[rest[i].replace(/^--/, "")] = rest[++i];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const ctx = await browser.newContext({ viewport: { width: +o.w, height: +o.h }, deviceScaleFactor: +o.dpr, colorScheme: o.theme });
const T0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s] ${s}`);

async function open(ui) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") console.error("console:", m.text()); });
  await page.addInitScript((t) => { const set = () => { document.documentElement.dataset.theme = t; }; if (document.documentElement) set(); else document.addEventListener("readystatechange", set, { once: true }); }, o.theme);
  const u = new URL(url);
  u.searchParams.set("t", String(o.t));
  u.searchParams.set("dpr", String(o.dpr));
  if (o.tier) u.searchParams.set("tier", o.tier);
  if (ui === "0") u.searchParams.set("ui", "0");
  await page.goto(u.href, { waitUntil: "load" });
  await page.waitForFunction(() => window.introDebug || document.documentElement.classList.contains("intro-off"), null, { timeout: 30000 });
  if (await page.evaluate(() => document.documentElement.classList.contains("intro-off")))
    throw new Error("the intro is off at this size (phones: ≤760 px wide or a short touch screen) or was already seen in this tab");
  await page.evaluate(() => window.introDebug.ready());
  await page.waitForFunction(() => window.introDebug.frames() > 0 || document.documentElement.classList.contains("ix-nogl"), null, { timeout: 300000, polling: 500 });
  if (await page.evaluate(() => document.documentElement.classList.contains("ix-nogl"))) throw new Error("no WebGL in this browser");
  log("scene ready: " + JSON.stringify(await page.evaluate(() => window.introDebug.quality())));
  return page;
}
const shot = (page) => page.screenshot({ clip: { x: 0, y: 0, width: +o.w, height: +o.h } });

if (o.p) {
  const page = await open(o.ui);
  const ps = o.p.split(",").map(Number);
  for (let i = 0; i < ps.length; i++) {
    await page.evaluate((p) => window.introDebug.go(p), ps[i]);
    await page.waitForTimeout(250);   // headline transitions are CSS-free (inline opacity), one frame is enough
    const f = join(out, `${o.prefix}${String(i).padStart(2, "0")}.png`);
    writeFileSync(f, await shot(page));
    log(`p ${ps[i]} → ${f}`);
  }
  if (o.end !== "") {
    const e = +o.end;
    await page.evaluate(({ e, light }) => { const d = window.introDebug; d.run(d.fadeAt(e)); return d.snap({ p: 1, end: e, light }); }, { e, light: o.theme === "light" });
    await page.waitForTimeout(300);
    const f = join(out, `${o.prefix}-end.png`);
    writeFileSync(f, await shot(page));
    log(`end ${e} → ${f}`);
  }
  await page.close();
}

if (+o.metrics > 1) {
  const n = +o.metrics, page = await open("0"), imgs = [];
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1);
    await page.evaluate((p) => window.introDebug.go(p), p);
    imgs.push((await shot(page)).toString("base64"));
    if (i % 10 === 0) log(`metrics frame ${i + 1}/${n}`);
  }
  await page.close();
  // measure in a blank page: decode, downscale to 480 px wide, compare
  const calc = await ctx.newPage();
  const bg = [0x11, 0x12, 0x16];
  const stats = await calc.evaluate(async ({ imgs, bg }) => {
    const px = [];
    for (const b64 of imgs) {
      const bmp = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
      const w = 480, h = Math.round(480 * bmp.height / bmp.width), c = new OffscreenCanvas(w, h), g = c.getContext("2d");
      g.drawImage(bmp, 0, 0, w, h);
      px.push(g.getImageData(0, 0, w, h).data);
    }
    return px.map((d, i) => {
      let lum = 0, diff = 0;
      for (let k = 0; k < d.length; k += 4) {
        if (Math.abs(d[k] - bg[0]) > 10 || Math.abs(d[k + 1] - bg[1]) > 10 || Math.abs(d[k + 2] - bg[2]) > 10) lum++;
        if (i < px.length - 1) { const e = px[i + 1]; diff += Math.abs(d[k] - e[k]) + Math.abs(d[k + 1] - e[k + 1]) + Math.abs(d[k + 2] - e[k + 2]); }
      }
      const n = d.length / 4;
      return { lum: lum / n, diff: i < px.length - 1 ? diff / (n * 3) : null };
    });
  }, { imgs, bg });
  const diffs = stats.map((s) => s.diff).filter((x) => x != null), sorted = [...diffs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)], thr = Math.max(0.5, 0.15 * median);
  let run = 0, longest = 0;
  for (const d of diffs) { run = d < thr ? run + 1 : 0; longest = Math.max(longest, run); }
  const low = stats.map((s, i) => [i, s.lum]).filter(([, l]) => l < 0.35).map(([i]) => i);
  const lines = [
    `${o.w}x${o.h}, DPR ${o.dpr}, clock t = ${o.t} s, UI hidden, ${n} frames, p step ${(1 / (n - 1)).toFixed(3)}`,
    "diff = mean absolute pixel difference to the next frame (RGB, 0-255 levels, measured at 480 px wide)",
    "lum  = share of pixels that differ from the stage colour #111216 by more than 10 levels",
    `near-zero threshold: diff < ${thr.toFixed(2)} levels (15% of the median step, floor 0.5)`, "",
    "  i   p      diff    lum",
    ...stats.map((s, i) => `${String(i).padStart(3)}  ${(i / (n - 1)).toFixed(2)}  ${s.diff == null ? "     -" : s.diff.toFixed(2).padStart(6)}  ${s.lum.toFixed(3)}`), "",
    `median diff ${median.toFixed(2)}, min ${sorted[0].toFixed(2)}, max ${sorted[sorted.length - 1].toFixed(2)}`,
    `longest run of near-zero steps: ${longest} (pass needs < 4)`,
    `frames with lum < 0.35: [${low.join(", ")}]`,
    longest < 4 && !low.length ? "PASS" : "CHECK: a dead stretch or an empty frame (a deliberate final hold may be fine)",
  ];
  writeFileSync(join(out, "metrics.txt"), lines.join("\n") + "\n");
  log("metrics → " + join(out, "metrics.txt") + "\n" + lines.slice(-4).join("\n"));
}
await browser.close();
