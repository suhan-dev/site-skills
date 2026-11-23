// The minute clock for notifications. Cloudflare Pages has no cron, so this small Worker (its own project in the same
// Cloudflare account) calls the site's tick every minute: POST /api/push/tick with the header X-Push-Tick.
// All the logic stays in the site (lib/push.js). This Worker shares the site's D1 database (binding DB) only to read
// the tick secret, which whichever side runs first makes once; nobody ever copies a secret by hand.
// SITE_URL: the site's origin, as a plain-text variable on this Worker (or edit the fallback below).
// Setup: references/setup.md, part C.
const SITE = "{{SITE_ORIGIN}}";

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(run(env));
  },
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};

async function run(env) {
  const db = env.DB;
  await db.prepare("CREATE TABLE IF NOT EXISTS push_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)").run();
  const fresh = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await db.prepare("INSERT OR IGNORE INTO push_meta (k, v) VALUES ('tick_secret', ?)").bind(fresh).run();
  const row = await db.prepare("SELECT v FROM push_meta WHERE k = 'tick_secret'").first();
  const r = await fetch(new URL("/api/push/tick", env.SITE_URL || SITE), { method: "POST", headers: { "X-Push-Tick": row.v } });
  const text = await r.text();
  if (!r.ok) console.warn("tick failed", r.status, text.slice(0, 300));
}
