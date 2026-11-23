// Screenshots of the guide on the demo page, into the skill's screenshots/ folder.
//   node assets/demo/shoot.mjs
// Serves the skills/ folder itself (the demo links the design system by a relative path), opens the demo as a new
// member, and steps through the tour with the keyboard.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS = path.resolve(HERE, "..", "..", "..");
const OUT = path.join(HERE, "..", "..", "screenshots");

export function serveSkills() {
  const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = path.normalize(path.join(SKILLS, p));
    if (!f.startsWith(SKILLS + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(fs.readFileSync(f));
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, base: `http://localhost:${server.address().port}/first-visit-spotlight-guide/assets/demo/` })));
}

async function main() {
  const { server, base } = await serveSkills();
  const browser = await chromium.launch();
  async function shot(name, { w, h, theme, step, as = "alex" }) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: theme, isMobile: w <= 760, hasTouch: w <= 760 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("pageerror:", e.message));
    await page.addInitScript((t) => { try { localStorage.setItem("site_theme", t); } catch (e) {} }, theme);
    await page.goto(`${base}?reset&as=${as}`);
    await page.waitForSelector(".guide:not(.is-off)");
    for (let k = 0; k < step; k++) await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(700); // the spotlight eases for 280 ms, smooth scrolling a little longer
    await page.screenshot({ path: path.join(OUT, name) });
    await ctx.close();
    console.log("wrote", name);
  }
  try {
    await shot("guide-calendar-1440-light.png", { w: 1440, h: 900, theme: "light", step: 1 });
    await shot("guide-header-1440-dark.png", { w: 1440, h: 900, theme: "dark", step: 4 });
    await shot("guide-welcome-1440-dark.png", { w: 1440, h: 900, theme: "dark", step: 0, as: "blair" });
    await shot("guide-tabs-390-light.png", { w: 390, h: 844, theme: "light", step: 3 });
    await shot("guide-add-390-dark.png", { w: 390, h: 844, theme: "dark", step: 2 });
  } finally {
    await browser.close();
    server.close();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
