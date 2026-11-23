// Browser tests for the reader and the Theory tab, on the demo chapters. Uses the Playwright that is already installed.
//   bash assets/fetch-vendor.sh          (once)
//   node assets/demo/test-reader.mjs
// It starts serve.mjs on a free port, opens the pages in Chromium and checks numbering, links, navigation, the kept
// place, the phone bar, wide formulas and print.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8200 + Math.floor(Math.random() * 600);
const BASE = `http://localhost:${PORT}`;
const server = spawn(process.execPath, [path.join(HERE, "serve.mjs"), String(PORT)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 500));

let pass = 0;
const ok = (c, msg) => { assert.ok(c, msg); pass++; console.log("  ✓ " + msg); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); pass++; console.log("  ✓ " + msg); };
const H1 = "/theory/heat/h1-heat-flow-in-a-rod", H2 = "/theory/heat/h2-cooling-of-a-small-body", O1 = "/theory/oscillations/o1-damped-oscillators";

const browser = await chromium.launch();
const errors = [];
async function open(url, { w = 1440, h = 900, ctx = null } = {}) {
  const c = ctx || await browser.newContext({ viewport: { width: w, height: h }, isMobile: w <= 760, hasTouch: w <= 760 });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(BASE + url, { waitUntil: "networkidle" });
  await p.waitForSelector("#rd-doc:not([aria-busy]), #th-body .th-doc, .rd-missing", { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(300);
  return p;
}
const texts = (p, sel) => p.$$eval(sel, (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
const attr = (p, sel, a) => p.$eval(sel, (e, a) => e.getAttribute(a), a);

try {
  console.log("\nNumbering (H1)");
  let p = await open(H1);
  eq(await texts(p, ".rd-toc .rd-ol .l2>a .n"), ["H1.1", "H1.2", "H1.3", "H1.4", "H1.5", "H1.6"], "## sections are numbered H1.1 … H1.6");
  eq(await texts(p, ".rd-toc .rd-ol .l3 a .n"), ["H1.3.1", "H1.5.1"], "### subsections H1.3.1, H1.5.1");
  ok(await p.$("#fouriers-law") && await p.$("#separation-of-variables"), "headings get GitHub-style ids");
  eq(await p.$$eval(".rd-text .katex-display[id]", (els) => els.map((e) => e.id)), ["eq-H1.1", "eq-H1.2", "eq-H1.3", "eq-H1.4", "eq-H1.5", "eq-H1.6"],
    "\\tag keeps its number, \\label gets the next free one (H1.3, H1.4, then H1.6 after the tagged H1.5)");
  eq(await texts(p, '.rd-text a.xref[href="#eq-H1.3"]'), ["(H1.3)", "(H1.3)", "(H1.3)"], "\\eqref{eq:heat} reads (H1.3) and links to it");
  ok((await texts(p, ".rd-text figcaption"))[0].startsWith("Figure H1.1. Temperature along the rod."), "the *Figure H1.1.* paragraph becomes the caption, numbered once");
  eq(await attr(p, ".rd-text figure img", "alt"), "Temperature along the rod at three times", "the alt text stays on the image");
  eq(await texts(p, '.rd-text a.xref[href="#fig-H1.1"]'), ["H1.1"], "\\ref{fig:h1-profiles} reads H1.1");
  ok(await p.$(`.rd-text a[href="${O1}#the-three-regimes"]`), "a relative link to another part's chapter stays in the reader, with its anchor");
  ok(await p.$(`.rd-text a[href="${H2}"]`), "and to a chapter of the same part");
  eq(await p.$$eval(".rd-text .xref.bad", (e) => e.length), 0, "no unknown references");
  eq(await texts(p, ".rd-part-h"), ["Part IHeat and Diffusion"], "the part is named above the title");
  eq(await texts(p, ".rd-toc .rd-part .pr"), ["H1–H2", "O1"], "contents: parts with their chapter ranges");
  eq(await texts(p, ".rd-toc .rd-part .pn"), ["I", "II"], "in roman numerals");
  eq(await p.$$eval(".rd-toc .rd-part", (d) => d.map((x) => x.open)), [true, false], "only the part being read is open");
  eq(await texts(p, ".rd-pn a small"), ["Next"], "H1: only Next, inside the part");
  eq(await p.title(), "H1 · Sample chapter: Heat flow in a rod · Example Lab", "page title: label · title · site");
  ok(await p.$eval(".rd-text .cs", (e) => getComputedStyle(e).contentVisibility === "auto"), "sections are laid out lazily (content-visibility)");
  ok(await p.$eval(".rd-text .cs", (e) => e.style.getPropertyValue("--t") !== ""), "with an estimated height from their content");

  console.log("\nAcross chapters and parts");
  p = await open(H2);
  eq(await texts(p, ".rd-pn a small"), ["Previous", "Next part"], "H2: Previous, and Next part into part II");
  ok((await texts(p, ".rd-pn .next b"))[0] === "II · Oscillations", "Next part names the part");
  ok(await p.$(`.rd-text a.xref[href="${H1}#eq-H1.1"]`), "\\eqref{H1.1} in H2 links to the equation in H1");
  eq(await texts(p, ".rd-text .soon"), ["H3"], "a link to an unpublished chapter is grey text, not a dead link");
  p = await open(O1);
  eq(await texts(p, ".rd-pn a small"), ["Previous part"], "O1: Previous part");
  ok(await p.$('[id="eq-O1.2"]') && await p.$('[id="eq-O1.3"]'), "an align block with two \\tag rows: one anchor per row");
  ok((await texts(p, ".rd-text figcaption"))[0].startsWith("Figure O1.1. Displacement"), "an inline <figure> is numbered too");
  eq(await texts(p, '.rd-text a.xref[href="#fig-O1.1"]'), ["O1.1"], "and found by its id key fig:o1-regimes");
  ok(await p.$(`.rd-text a.xref[href="${H1}#eq-H1.6"]`), "\\eqref{H1.6} from part II links into part I");

  console.log("\nNot found");
  p = await open("/theory/heat/no-such-chapter");
  ok((await texts(p, ".rd-missing"))[0].startsWith("Chapter not found."), "an unknown chapter says so");
  eq(await p.title(), "Chapter not found · Example Lab", "in the title too");
  eq(await attr(p, ".rd-missing a", "href"), "/#theory", "with a link back to the Theory tab");

  console.log("\nPlace");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  p = await open(H1 + "#separation-of-variables", { ctx });
  let top = await p.$eval("#separation-of-variables", (e) => Math.round(e.getBoundingClientRect().top));
  ok(top >= 0 && top <= 80, `opens at the section named in the address (heading at ${top} px)`);
  await p.evaluate(() => window.scrollTo(0, document.getElementById("steady-state").getBoundingClientRect().top + scrollY - 100));
  await p.waitForTimeout(1200);
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("rd_at") || "{}")["heat/h1-heat-flow-in-a-rod"]);
  eq(kept && kept.id, "steady-state", "the place is kept per chapter while reading (localStorage rd_at)");
  ok(await p.$eval('.rd-toc .rd-ol a[href="#steady-state"]', (a) => a.classList.contains("on")), "scroll-spy marks the section being read");
  await p.close();
  p = await open(H1, { ctx });
  top = await p.$eval("#steady-state", (e) => Math.round(e.getBoundingClientRect().top));
  ok(top > 20 && top < 180, `opened again without an anchor, it goes back there (heading at ${top} px)`);
  await p.click("#rd-theme");
  eq(await p.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem("site_theme")]), ["dark", "dark"], "the theme button switches and saves under the site's key");
  await ctx.close();

  console.log("\nPhones");
  p = await open(H1, { w: 390, h: 844 });
  ok(await p.$eval("#rd-bar", (e) => getComputedStyle(e).position === "sticky"), "the section bar is sticky");
  ok(await p.$eval(".rd-toc", (e) => getComputedStyle(e).display === "none"), "the side contents is hidden");
  await p.evaluate(() => window.scrollTo(0, document.getElementById("fouriers-law").getBoundingClientRect().top + scrollY - 60));
  await p.waitForTimeout(300);
  eq(await texts(p, "#rd-where .n"), ["H1.2"], "the bar shows the section being read");
  ok(await p.$eval("#rd-bar", (e) => Math.round(e.getBoundingClientRect().top) === 0), "and stays at the top");
  await p.click("#rd-bar-btn");
  ok(await p.$eval("#rd-sheet", (e) => !e.hidden) && await attr(p, "#rd-bar-btn", "aria-expanded") === "true", "tapping it opens the contents");
  await p.keyboard.press("Escape");
  ok(await p.$eval("#rd-sheet", (e) => e.hidden), "Esc closes it");
  await p.evaluate(() => document.getElementById("eq-H1.5").scrollIntoView());
  await p.waitForTimeout(400);
  ok(await p.$eval('[id="eq-H1.5"]', (e) => e.classList.contains("wide") && e.classList.contains("sx")), "a formula wider than the column is marked wide and scrolls sideways");
  ok(await p.$eval('[id="eq-H1.5"] + .eq-n', (e) => getComputedStyle(e).display === "block" && e.textContent === "(H1.5)"), "its number moves to the line below");
  ok(await p.$eval('[id="eq-H1.1"]', (e) => !e.classList.contains("wide")), "a narrow formula keeps its number beside it");
  eq(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "nothing widens the page");
  ok(await p.$eval("#fouriers-law", (e) => parseFloat(getComputedStyle(e).scrollMarginTop) >= 64), "anchors clear the bar (scroll-margin-top 64 px)");
  ok(await p.$eval("#rd-back", (e) => getComputedStyle(e).display !== "none"), "the back link shows on phones");
  await p.close();

  console.log("\nTheory tab");
  p = await open("/#theory/heat/h1-heat-flow-in-a-rod");
  eq(await texts(p, ".th-tabs a .th-full"), ["Heat and Diffusion", "Oscillations"], "sub-tabs are the parts (full names; short names on phones)");
  eq(await texts(p, "#th-body .eyebrow"), ["Heat and Diffusion · Chapter H1"], "eyebrow: part · Chapter label");
  eq(await p.$$eval("#th-body .katex-display[id]", (els) => els.length), 6, "the same numbering as the reader");
  ok(await p.$('#th-body a[href="#theory/oscillations/o1-damped-oscillators"]'), "chapter links stay in the tab (#theory/…)");
  await p.evaluate(() => window.scrollTo(0, document.getElementById("steady-state").getBoundingClientRect().top + scrollY - 150));
  await p.waitForTimeout(200);
  await p.dispatchEvent("#th-body .th-open", "pointerdown");
  eq(await attr(p, "#th-body .th-open", "href"), H1 + "#steady-state", "Open in reader points at the section being read");
  eq(await attr(p, "#th-body .th-open", "target"), "_blank", "and opens a new tab on a wide screen");
  await p.waitForTimeout(900);
  eq(await p.evaluate(() => JSON.parse(localStorage.getItem("rd_at") || "{}")["heat/h1-heat-flow-in-a-rod"]?.id), "steady-state", "reading in the tab keeps the place too (same key)");

  console.log("\nPrint");
  p = await open(H1);
  await p.emulateMedia({ media: "print" });
  ok(await p.$eval(".rd-toc", (e) => getComputedStyle(e).display === "none") && await p.$eval(".rd-tools", (e) => getComputedStyle(e).display === "none"), "paper has no contents and no tools");
  ok(await p.$eval(".rd-text .cs", (e) => getComputedStyle(e).contentVisibility !== "auto"), "and lays out every section");
  eq(await p.$eval("body", (e) => getComputedStyle(e).backgroundColor), "rgb(255, 255, 255)", "white paper");

  eq(errors, [], "no page errors");
  console.log(`\n${pass} checks passed`);
} finally {
  await browser.close();
  server.kill();
}
