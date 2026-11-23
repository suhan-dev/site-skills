// Screenshots of the sign-in page from the demo (serve.mjs), into the skill's screenshots/ folder.
//   node assets/demo/shoot.mjs
// tools/shoot.mjs can't set a user agent or click through the mock Google, so the sign-in states are shot here.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "..", "screenshots");
const PORT = 8700 + Math.floor(Math.random() * 200);
const BASE = `http://localhost:${PORT}`;
const server = await new Promise((resolve, reject) => {
  const p = spawn(process.execPath, ["--no-warnings", path.join(HERE, "serve.mjs"), String(PORT)], { stdio: ["ignore", "pipe", "inherit"] });
  p.stdout.on("data", (d) => { if (String(d).includes("gate demo on")) resolve(p); });
  p.on("exit", (c) => reject(new Error("demo server exited " + c)));
});

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE };
const browser = await chromium.launch();
async function shot(name, opts, go) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(BASE + "/");
  if (go) await go(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, name) });
  await ctx.close();
  console.log("wrote", name);
}
try {
  await shot("signin-1440-dark.png", { ...DESK, colorScheme: "dark" });
  await shot("signin-1440-light.png", { ...DESK, colorScheme: "light" }); // the same page: it is always dark
  await shot("signin-390-dark.png", { ...PHONE, colorScheme: "dark" });
  await shot("refusal-390-dark.png", { ...PHONE, colorScheme: "dark" }, async (p) => {
    await p.click("#gbtn");
    await p.waitForURL(/__mock\/google/);
    await Promise.all([p.waitForNavigation(), p.click("button[value='3']")]); // an account not on the list
    await p.waitForSelector(".msg:not(:empty)");
  });
  await shot("kakaotalk-390-dark.png", { ...PHONE, colorScheme: "dark", userAgent: IPHONE + " KAKAOTALK 10.8.5" });
} finally {
  await browser.close();
  server.kill();
}
// the gradient makes big PNGs; keep each under 1 MB (needs Pillow)
const names = ["signin-1440-dark.png", "signin-1440-light.png", "signin-390-dark.png", "refusal-390-dark.png", "kakaotalk-390-dark.png"];
const r = spawnSync("python3", [path.join(HERE, "shrink_png.py"), ...names.map((n) => path.join(OUT, n))], { stdio: "inherit" });
if (r.status !== 0) console.warn("could not shrink the PNGs (python3 with Pillow needed); check their sizes");
