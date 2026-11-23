// Browser checks of the guide on the demo page: once per member, keys, focus trap, read-only page, placement,
// phone sheet, reopen from the menu, reduced motion.
//   node assets/demo/test-guide.mjs        (Playwright; serves the skills/ folder itself)
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { serveSkills } from "./shoot.mjs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

let pass = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); pass++; console.log("  ✓ " + msg); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); pass++; console.log("  ✓ " + msg); };
const section = (s) => console.log("\n" + s);

const { server, base } = await serveSkills();
const browser = await chromium.launch();
const errors = [];
async function open(query = "", opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts.context });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + query);
  return page;
}
const isOpen = (p) => p.evaluate(() => !!document.querySelector(".guide") && window.demoGuide.isOpen());
const title = (p) => p.$eval(".guide-h", (e) => e.textContent);
const rect = (p, sel) => p.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
const settle = (p) => p.waitForTimeout(450);
const focusIn = (p) => p.evaluate(() => document.activeElement && document.activeElement.className);

try {
  section("Starts once, by itself");
  let p = await open("?reset&as=alex");
  await p.waitForSelector(".guide:not(.is-off)", { timeout: 4000 });
  ok(await isOpen(p), "a new member gets the tour shortly after the page is up");
  eq(await title(p), "Welcome, Alex", "step 1 greets the member by name");
  ok(await p.$eval(".guide", (e) => e.getAttribute("role") === "dialog" && e.getAttribute("aria-modal") === "true"), "it is a modal dialog for screen readers");
  eq(await p.$eval(".guide-sr", (e) => e.textContent), "Step 1 of 6", "with the step spoken");
  ok(await p.$eval(".guide-hole", (e) => e.classList.contains("none")), "step 1 has no hole (only the dim)");
  let pr = await rect(p, ".guide-panel");
  ok(Math.abs((pr.l + pr.r) / 2 - 720) < 2 && Math.abs((pr.t + pr.b) / 2 - 450) < 2, "and its panel is centred");
  ok(await p.evaluate(() => document.getElementById("app").inert), "the page under it is inert");
  ok(await p.evaluate(() => document.elementFromPoint(200, 300).closest(".guide") !== null), "a click on the page lands on the guide, not the page");
  eq(await focusIn(p), "guide-next", "focus is on Next");
  ok(await p.$eval(".guide-back", (e) => e.disabled && getComputedStyle(e).visibility === "hidden"), "Back is hidden on step 1");
  eq(await p.$$eval(".guide-dots i", (d) => d.length), 6, "one dot per step");

  section("Keys and focus");
  await p.keyboard.press("ArrowRight");
  await settle(p);
  eq(await title(p), "Shared calendar", "→ goes on");
  const hole = await rect(p, ".guide-hole"), grid = await rect(p, "#cal-grid");
  ok(Math.abs(hole.l - (grid.l - 6)) < 1.5 && Math.abs(hole.r - (grid.r + 6)) < 1.5, "the hole wraps the calendar with 6 px to spare");
  ok(hole.t >= (await rect(p, ".bar")).b, "and never goes under the sticky header");
  pr = await rect(p, ".guide-panel");
  ok(pr.r < hole.l - 8 || pr.l > hole.r + 8 || pr.b < hole.t - 8 || pr.t > hole.b + 8 || pr.t >= hole.b - 8, "the panel does not cover the hole");
  await p.keyboard.press("ArrowLeft");
  await settle(p);
  eq(await title(p), "Welcome, Alex", "← goes back");
  await p.keyboard.press("Enter");
  eq(await title(p), "Shared calendar", "Enter goes on");
  const seenFocus = [];
  for (let k = 0; k < 4; k++) { await p.keyboard.press("Tab"); seenFocus.push(await focusIn(p)); }
  eq(seenFocus, ["guide-skip", "guide-back", "guide-next", "guide-skip"], "Tab cycles Skip → Back → Next inside the panel");
  await p.keyboard.press("Shift+Tab");
  eq(await focusIn(p), "guide-next", "Shift+Tab goes the other way");
  const y0 = await p.evaluate(() => scrollY);
  await p.keyboard.press("PageDown");
  await p.mouse.wheel(0, 600);
  await settle(p);
  eq(await p.evaluate(() => scrollY), y0, "the page does not scroll under it (wheel, PageDown)");
  await p.focus("#me-btn").catch(() => {});
  ok(["guide-next", "guide-skip", "guide-back"].includes(await focusIn(p)), "focus cannot leave the panel");

  section("Placement");
  await p.keyboard.press("ArrowRight");
  await settle(p);
  eq(await title(p), "Add a meeting", "step 3 spotlights New event");
  const add = await rect(p, "#cal-add"), h3 = await rect(p, ".guide-hole");
  ok(h3.l <= add.l - 5 && h3.r >= add.r + 5 && h3.t <= add.t - 5 && h3.b >= add.b + 5, "the hole fits the button");
  pr = await rect(p, ".guide-panel");
  ok(pr.t >= h3.b + 8 && pr.l >= 16 && pr.r <= 1440 - 16, "the panel sits below it, inside a 16 px margin");
  await p.keyboard.press("ArrowRight");
  await settle(p);
  const tabs = await rect(p, '.tabs [data-tab="records"]'), h4 = await rect(p, ".guide-hole");
  ok(h4.h < tabs.h - 10, "the tabs step spotlights the words (tight), not the 52 px link");
  await p.keyboard.press("ArrowRight");
  await settle(p);
  const h5 = await rect(p, ".guide-hole"), me = await rect(p, "#me-btn"), th = await rect(p, "#theme-btn");
  ok(h5.l <= me.l && h5.r >= th.r, "step 5 joins name, language and theme into one hole");
  await p.keyboard.press("ArrowRight");
  await settle(p);
  eq([await title(p), await p.$eval(".guide-next", (e) => e.textContent)], ["You're set", "Done"], "the last step says Done");
  ok(await p.$eval(".guide-hole", (e) => e.classList.contains("none")), "and closes the hole");

  section("Done marks it seen, here and on the server");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".guide", { state: "detached" });
  ok(!(await isOpen(p)), "Done closes it");
  ok(await p.evaluate(() => !document.getElementById("app").inert), "the page is live again");
  eq(await focusIn(p), "me set", "focus goes to the name button");
  ok(await p.evaluate(() => !!localStorage.getItem("site_guide_v1_alex")), "this browser remembers it");
  eq(await p.evaluate(() => JSON.parse(localStorage.getItem("demo_server_seen")).alex), ["guide"], "the server was told (POST /api/me { seen: \"guide\" })");
  await p.goto(base + "?as=alex");
  await p.waitForTimeout(1500);
  ok(!(await isOpen(p)), "a reload does not start it again");
  await p.evaluate(() => localStorage.removeItem("site_guide_v1_alex"));
  await p.reload();
  await p.waitForTimeout(1500);
  ok(!(await isOpen(p)), "nor does a second device (browser record gone, server still knows)");

  section("Reopen from the name menu");
  await p.click("#me-btn");
  await p.click("#menu-guide");
  await p.waitForSelector(".guide:not(.is-off)");
  ok(await isOpen(p) && !(await p.$eval("#me-dlg", (d) => d.open)), "Site guide closes the menu and starts the tour");
  await p.keyboard.press("Escape");
  await p.waitForSelector(".guide", { state: "detached" });
  ok(!(await isOpen(p)), "Esc ends it");
  await p.context().close();

  section("Skip and Esc count as seen; the owner is never toured by itself");
  p = await open("?reset&as=blair");
  await p.waitForSelector(".guide:not(.is-off)");
  await p.click(".guide-skip");
  await p.waitForSelector(".guide", { state: "detached" });
  eq(await p.evaluate(() => JSON.parse(localStorage.getItem("demo_server_seen")).blair), ["guide"], "Skip marks it seen");
  await p.context().close();
  p = await open("?reset&as=casey");
  await p.waitForTimeout(1500);
  ok(!(await isOpen(p)), "the owner (noAuto) gets no tour by itself");
  await p.click("#me-btn");
  await p.click("#menu-guide");
  await p.waitForSelector(".guide:not(.is-off)");
  eq(await title(p), "Welcome, Casey", "but can open it from the menu");
  await p.context().close();

  section("Not over a dialog, back to where the page was");
  p = await open("?reset&as=alex#refs");
  await p.waitForSelector(".guide:not(.is-off)");
  ok(await p.evaluate(() => !document.getElementById("pane-calendar").hidden && location.hash === "#calendar"), "from another tab it switches to the calendar while touring");
  await p.keyboard.press("Escape");
  await p.waitForSelector(".guide", { state: "detached" });
  await p.waitForTimeout(100);
  eq(await p.evaluate(() => location.hash), "#refs", "and goes back to that tab after");
  await p.click("#me-btn");
  await p.evaluate(() => window.demoGuide.start());
  ok(!(await isOpen(p)), "it never starts while a dialog is open");
  await p.context().close();

  section("Phones");
  p = await open("?reset&as=alex", { context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } });
  await p.waitForSelector(".guide:not(.is-off)");
  await p.keyboard.press("ArrowRight");
  await settle(p);
  pr = await rect(p, ".guide-panel");
  eq([Math.round(pr.l), Math.round(pr.r), Math.round(pr.b)], [0, 390, 844], "the panel is a sheet across the bottom");
  const hp = await rect(p, ".guide-hole");
  ok(hp.b <= pr.t - 10 + 0.5, "the spotlight stays above the sheet");
  ok(await p.$eval(".guide-panel", (e) => getComputedStyle(e).borderTopLeftRadius === "14px" && getComputedStyle(e).borderBottomLeftRadius === "0px"), "rounded on top only");
  await p.keyboard.press("ArrowRight");
  await settle(p);
  eq(await p.$eval(".guide-p", (e) => e.textContent.startsWith("Tap an empty slot. Your name")), true, "phone wording (no New event button there)");
  const h3p = await rect(p, ".guide-hole"), gridp = await rect(p, "#cal-grid");
  ok(Math.abs(h3p.l - (gridp.l - 6)) < 1.5, "the hidden button falls back to the calendar (alt)");
  for (const b of [".guide-skip", ".guide-back", ".guide-next"]) {
    const r = await rect(p, b);
    ok(r.h >= 44 && r.w >= 44, `${b.slice(7)} is a 44 px target`);
  }
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "nothing wider than the screen");
  await p.context().close();

  section("Reduced motion");
  p = await open("?reset&as=alex", { context: { reducedMotion: "reduce" } });
  await p.waitForSelector(".guide:not(.is-off)");
  eq(await p.$eval(".guide", (e) => getComputedStyle(e).transitionDuration), "0s", "no fade");
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(50);
  const g2 = await rect(p, "#cal-grid"), h2 = await rect(p, ".guide-hole");
  ok(Math.abs(h2.l - (g2.l - 6)) < 1.5, "the spotlight jumps, no easing");
  await p.context().close();

  eq(errors, [], "no page errors");
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${pass} checks passed`);
