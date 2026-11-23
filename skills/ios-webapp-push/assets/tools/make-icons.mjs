// App icons from one 1024 × 1024 master, and a contact sheet to judge them at Home Screen size.
// Uses Playwright's Chromium (canvas drawing, no image libraries).
//
//   node make-icons.mjs <master.png> <outdir> [--name Lab] [--bg #111216] [--safe 0.8]
//
// Writes into <outdir>:
//   app-1024.png            the master, square, no transparency (iOS fills transparent pixels with black)
//   app-512.png, app-192.png        manifest icons, purpose "any"
//   apple-touch-icon.png    180 × 180, the one iOS uses on the Home Screen
//   app-maskable-512.png    the master scaled to --safe (0.8) on --bg: Android crops maskable icons to a circle or a
//                           squircle, and only the centre circle (radius 40 % of the width) is always visible
//   contact-sheet.png       the icon at 120, 60 and 30 px on a light and a dark wallpaper, between plain neighbours,
//                           with --name under it as iOS shows it (cut with "…" when it is too long)
// Look at contact-sheet.png at 100 %: the 60 px row is what people see every day. If the subject is not clear there,
// change the master (closer crop, more contrast, fewer details), not the small sizes.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

const [master, out, ...rest] = process.argv.slice(2);
if (!master || !out) { console.error("usage: node make-icons.mjs <master.png> <outdir> [--name Lab] [--bg #111216] [--safe 0.8]"); process.exit(2); }
const o = { name: "App", bg: "#111216", safe: "0.8" };
for (let i = 0; i < rest.length; i++) o[rest[i].replace(/^--/, "")] = rest[++i];
mkdirSync(out, { recursive: true });
const src = "data:image/png;base64," + readFileSync(master).toString("base64");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><body></body>");

// draw the master at a size: halve step by step first, so the small sizes stay sharp and do not alias
const icons = await page.evaluate(async ({ src, bg, safe }) => {
  const img = await createImageBitmap(await (await fetch(src)).blob());
  if (img.width !== img.height) throw new Error(`the master must be square (it is ${img.width} × ${img.height})`);
  if (img.width < 1024) throw new Error(`the master must be at least 1024 px (it is ${img.width})`);
  function scaled(size) {
    let cur = img, w = img.width;
    while (w / 2 >= size * 1.5) {
      w = Math.round(w / 2);
      const c = new OffscreenCanvas(w, w), g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(cur, 0, 0, w, w);
      cur = c;
    }
    return cur;
  }
  async function png(size, { inset = 1 } = {}) {
    const c = new OffscreenCanvas(size, size), g = c.getContext("2d");
    g.fillStyle = bg;                       // never transparent
    g.fillRect(0, 0, size, size);
    const s = Math.round(size * inset), at = Math.round((size - s) / 2);
    g.imageSmoothingQuality = "high";
    g.drawImage(scaled(s), at, at, s, s);
    const b = await c.convertToBlob({ type: "image/png" });
    const bytes = new Uint8Array(await b.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  return {
    "app-1024.png": await png(1024),
    "app-512.png": await png(512),
    "app-192.png": await png(192),
    "apple-touch-icon.png": await png(180),
    "app-maskable-512.png": await png(512, { inset: +safe }),
  };
}, { src, bg: o.bg, safe: o.safe });
for (const [f, b64] of Object.entries(icons)) {
  writeFileSync(join(out, f), Buffer.from(b64, "base64"));
  console.log("→ " + join(out, f));
}

// the contact sheet: iOS rounds the corners (a continuous curve, about 22.4 % of the width); neighbours are plain tiles
const icon = "data:image/png;base64," + icons["apple-touch-icon.png"];
const big = "data:image/png;base64," + icons["app-512.png"];
const mask = "data:image/png;base64," + icons["app-maskable-512.png"];
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const row = (px, label) => {
  const tiles = [["#8e8e93", "Settings"], ["ours", o.name], ["#ffffff", "Notes"], ["#0a84ff", "Mail"]];
  return `<div class="row" style="--s:${px}px">${tiles.map(([c, n]) => `<figure><i style="${c === "ours" ? `background-image:url(${px > 120 ? big : icon})` : `background:${c}`}"></i>${label ? `<figcaption>${esc(n)}</figcaption>` : ""}</figure>`).join("")}</div>`;
};
const panel = (cls) => `<section class="${cls}">${row(120, true)}${row(60, true)}${row(30, false)}</section>`;
await page.setViewportSize({ width: 1040, height: 760 });
await page.setContent(`<!doctype html><meta charset="utf-8"><style>
  body{margin:0;font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;grid-template-columns:760px 280px;grid-template-rows:380px 380px}
  section{display:grid;align-content:center;gap:22px;padding:0 34px}
  .light{background:linear-gradient(160deg,#dfe7f2,#f3e6e6)} .dark{grid-row:2;background:linear-gradient(160deg,#1b1d26,#2b2230)}
  .row{display:flex;gap:calc(var(--s) * .3);align-items:flex-start}
  figure{margin:0;display:grid;justify-items:center;gap:6px;width:calc(var(--s) * 1.25)}
  i{display:block;width:var(--s);height:var(--s);border-radius:calc(var(--s) * .2237);background-size:cover;box-shadow:0 1px 3px rgba(0,0,0,.18)}
  figcaption{width:100%;text-align:center;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .light figcaption{color:#1c1c1e} .dark figcaption{color:#f2f2f7}
  aside{grid-column:2;grid-row:1 / 3;display:grid;align-content:center;justify-items:center;gap:28px;background:#f2f2f7;color:#3a3a3c}
  aside div{display:grid;justify-items:center;gap:8px}
  .m,.q{width:150px;height:150px;background-size:cover;box-shadow:0 0 0 1px rgba(0,0,0,.12)}
  .m{border-radius:50%} .q{border-radius:28%}
</style>${panel("light")}${panel("dark")}<aside><div><b>maskable, circle</b><span class="m" style="background-image:url(${mask})"></span></div><div><b>maskable, squircle</b><span class="q" style="background-image:url(${mask})"></span></div></aside>`);
await page.screenshot({ path: join(out, "contact-sheet.png"), clip: { x: 0, y: 0, width: 1040, height: 760 } });
console.log("→ " + join(out, "contact-sheet.png") + "  (look at the 60 px row)");
await browser.close();
