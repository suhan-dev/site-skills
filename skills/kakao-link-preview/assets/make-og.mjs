// Render the link-preview picture from an HTML template: node make-og.mjs [template.html] [out.jpg]
// 1200 × 630 CSS px at deviceScaleFactor 2 → 2400 × 1260 JPEG, quality 88. Uses the preinstalled Playwright.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const [tpl = "template/og.html", out = "og.jpg", guides = ""] = process.argv.slice(2);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 })).newPage();
await p.goto("file://" + path.resolve(tpl) + (guides ? "?guides" : ""));
await p.waitForTimeout(300);
await p.screenshot({ path: out, type: "jpeg", quality: 88 });
await b.close();
console.log("wrote", out);
