// Screenshot helper for skill demos. Uses the Playwright that is already installed (require('playwright')).
// node tools/shoot.mjs <url> <out.png> [--w 1440] [--h 900] [--theme light|dark] [--dpr 2] [--full] [--wait 400] [--eval "js"]
// The theme is set both as prefers-color-scheme and as <html data-theme>, so pages that use either follow it.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const [url, out, ...rest] = process.argv.slice(2);
if (!url || !out) { console.error("usage: node tools/shoot.mjs <url> <out.png> [--w 1440] [--h 900] [--theme light|dark] [--dpr 2] [--full] [--wait ms] [--eval js]"); process.exit(2); }
const opt = { w: 1440, h: 900, theme: "light", dpr: 2, full: false, wait: 400, eval: "" };
for (let i = 0; i < rest.length; i++) {
  const k = rest[i].replace(/^--/, "");
  if (k === "full") opt.full = true; else opt[k] = rest[++i];
}
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +opt.w, height: +opt.h }, deviceScaleFactor: +opt.dpr, colorScheme: opt.theme,
  hasTouch: +opt.w <= 760, isMobile: +opt.w <= 760 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.addInitScript((t) => {
  try { localStorage.setItem("site_theme", t); } catch {}
  const set = () => { document.documentElement.dataset.theme = t; };
  if (document.documentElement) set();
  else new MutationObserver((_, o) => { if (document.documentElement) { set(); o.disconnect(); } }).observe(document, { childList: true });
}, opt.theme);
await page.goto(url, { waitUntil: "networkidle" });
if (opt.eval) await page.evaluate(opt.eval);
await page.waitForTimeout(+opt.wait);
await page.screenshot({ path: out, fullPage: opt.full });
await browser.close();
console.log("wrote", out);
