// Screenshot of the print styles (what paper gets), for the skill's screenshots folder.
//   node assets/demo/shoot-print.mjs http://localhost:8123/theory/heat/h1-heat-flow-in-a-rod out.png
// A4 at 96 dpi is 794 px wide; the shot is the first page's height (1123 px). Same Playwright as tools/shoot.mjs.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2, colorScheme: "dark" })).newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector("#rd-doc:not([aria-busy])");
await page.emulateMedia({ media: "print" });
// @page margins do not apply to a screenshot: show them as padding so the shot looks like the sheet
await page.addStyleTag({ content: "body{padding:18mm 18mm 20mm!important}" });
await page.waitForTimeout(500);
await page.screenshot({ path: out });
await browser.close();
console.log("wrote", out);
