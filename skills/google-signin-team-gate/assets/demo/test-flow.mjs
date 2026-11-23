// Browser checks of the whole sign-in flow against the demo (serve.mjs: the real gate, a mock Google, D1 in memory).
//   node assets/demo/test-flow.mjs
// Needs Playwright (require("playwright")) and Node 22.13+. Starts its own servers on free ports.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const HERE = path.dirname(fileURLToPath(import.meta.url));

let pass = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); pass++; console.log("  ✓ " + msg); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); pass++; console.log("  ✓ " + msg); };
const section = (s) => console.log("\n" + s);

function start(port, extra = []) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["--no-warnings", path.join(HERE, "serve.mjs"), String(port), ...extra], { stdio: ["ignore", "pipe", "inherit"] });
    p.stdout.on("data", (d) => { if (String(d).includes("gate demo on")) resolve(p); });
    p.on("exit", (c) => reject(new Error("demo server exited " + c)));
  });
}
const PORT = 8300 + Math.floor(Math.random() * 400);
const BASE = `http://localhost:${PORT}`;
const servers = [await start(PORT), await start(PORT + 1, ["--not-set-up"])];

const browser = await chromium.launch();
const errors = [];
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
}
const visible = (p, sel) => p.$eval(sel, (e) => !e.hidden && getComputedStyle(e).display !== "none").catch(() => false);
const text = (p, sel) => p.$eval(sel, (e) => e.textContent.trim()).catch(() => "");

try {
  section("Signed out");
  let p = await newPage();
  let res = await p.goto(BASE + "/");
  eq(res.status(), 200, "\"/\" answers 200 with the sign-in page (link previews need a 200, not a redirect)");
  ok(await visible(p, "#gbtn") && (await text(p, "#gbtn")) === "Sign in with Google", "one pill: Sign in with Google");
  ok(!(await p.$("input[type=password]")) && !(await p.$("script[src*='gsi/client']")), "no password field, no Google script");
  const box = await p.$eval("#gbtn", (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; });
  ok(Math.abs(box.x - 720) < 2 && Math.abs(box.y - 450) < 30 && box.h === 44 && box.w >= 232, "centred, 44 px high, at least 232 px wide");
  const href = new URL(await p.$eval("#gbtn", (e) => e.href));
  eq(["response_type", "response_mode", "scope", "prompt", "hd"].map((k) => href.searchParams.get(k)), ["id_token", "form_post", "openid email", "select_account", "example.edu"],
    "the link asks for an ID token posted back, any account chooser, the Workspace domain");
  ok(!(await p.$eval(".msg", (e) => getComputedStyle(e).display !== "none")), "no message yet");
  await p.keyboard.press("Tab");
  ok(await p.evaluate(() => document.activeElement.id === "gbtn"), "Tab reaches the pill first");
  ok(await p.$eval("#gbtn", (e) => getComputedStyle(e).outlineStyle === "solid"), "with a visible focus ring");
  eq((await p.request.get(BASE + "/api/me")).status(), 401, "the API is shut (401)");

  section("Sign in (mock Google)");
  await p.click("#gbtn");
  await p.waitForURL(/__mock\/google/);
  eq(await p.evaluate(() => sessionStorage.getItem("intro_arrive")), "1", "the click marks the arrival for the intro (scroll-3d-intro)");
  await p.click("button[value='0']"); // Alex
  await p.waitForURL(BASE + "/");
  await p.waitForFunction(() => document.getElementById("who").textContent.startsWith("Signed in"));
  eq(await text(p, "#who"), "Signed in as alex.", "back on the site, signed in as alex");
  ok(!(await text(p, "#raw")).includes("@"), "/api/me carries the member id, no address");
  const cookies = await p.context().cookies();
  const sid = cookies.find((c) => c.name === "site_sid");
  ok(sid && sid.httpOnly && sid.sameSite === "Lax" && /^[a-f0-9]{64}$/.test(sid.value), "a 64-hex session cookie, HttpOnly, SameSite=Lax");
  ok(sid.expires * 1000 - Date.now() > 179 * 86400e3, "that lasts 180 days");
  ok(!cookies.some((c) => c.name === "site_nonce"), "the nonce cookie is gone");
  ok(!(await p.evaluate(() => document.cookie.includes("site_sid"))), "and scripts can't read the session");

  section("Sign out");
  await p.click("#out");
  await p.waitForSelector("#gbtn");
  ok(await visible(p, "#gbtn"), "Sign out goes back to the sign-in page");
  ok(!(await p.context().cookies()).some((c) => c.name === "site_sid"), "and the session cookie is deleted");

  section("Refused and cancelled");
  await p.click("#gbtn");
  await p.waitForURL(/__mock\/google/);
  res = await Promise.all([p.waitForNavigation(), p.click("button[value='3']")]); // Dana, not on the list
  await p.waitForSelector("#gbtn");
  eq(await text(p, ".msg"), "This site is for the Example Lab team only.", "an account not on the list gets the one line");
  ok(await visible(p, "#gbtn"), "under the same button, to try another account");
  const msgBox = await p.$eval(".msg", (e) => { const r = e.getBoundingClientRect(); return { top: r.top, color: getComputedStyle(e).color }; });
  ok(msgBox.top > box.y && msgBox.color === "rgb(255, 105, 97)", "in red, under the pill");
  await p.click("#gbtn");
  await p.waitForURL(/__mock\/google/);
  await p.click("button[value='cancel']");
  await p.waitForSelector("#gbtn");
  eq(await text(p, ".msg"), "", "Cancel at Google comes back to the plain page, no message");

  section("Back where it started");
  await p.goto(BASE + "/records?week=3");
  await p.click("#gbtn");
  await p.waitForURL(/__mock\/google/);
  await p.click("button[value='1']"); // Blair
  await p.waitForURL(/\/records\?week=3$/);
  ok(true, "a deep link opened signed out comes back to the same address after signing in");
  await p.context().close();

  section("Phones and in-app browsers");
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  p = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: iphone });
  await p.goto(BASE + "/");
  ok(await visible(p, "#gbtn") && !(await visible(p, "#open")), "Safari on iPhone: the same pill");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "nothing wider than the screen");
  await p.context().close();
  p = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: iphone + " KAKAOTALK 10.8.5" });
  await p.goto(BASE + "/");
  ok(!(await visible(p, "#gbtn")) && await visible(p, "#open") && (await text(p, "#open")) === "Open in Safari", "KakaoTalk on iPhone: Open in Safari instead");
  ok((await p.$eval("#open", (e) => e.getAttribute("href"))).startsWith("kakaotalk://web/openExternal?url=" + encodeURIComponent(BASE + "/")), "which hands this address to Safari");
  eq(await text(p, "#hint"), "Google sign-in works in Safari, not inside this app.", "with one line why");
  await p.context().close();
  p = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 KAKAOTALK 10.8.5" });
  await p.goto(BASE + "/");
  eq(await text(p, "#open"), "Open in browser", "KakaoTalk on Android: Open in browser");
  await p.context().close();
  p = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, userAgent: iphone.replace("Safari/604.1", "Instagram 300.0") });
  await p.goto(BASE + "/");
  ok(!(await visible(p, "#gbtn")) && !(await visible(p, "#open")) && (await text(p, "#hint")).includes("Safari"), "other in-app browsers: only the hint");
  await p.context().close();

  section("Not set up");
  p = await newPage();
  res = await p.goto(`http://localhost:${PORT + 1}/`);
  ok(res.status() === 503 && !(await p.$("#gbtn")) && (await text(p, ".msg")).includes("GOOGLE_CLIENT_ID"), "without GOOGLE_CLIENT_ID: 503, a setup line, no button");
  await p.context().close();

  eq(errors, [], "no page errors");
} finally {
  await browser.close();
  for (const s of servers) s.kill();
}
console.log(`\n${pass} checks passed`);
