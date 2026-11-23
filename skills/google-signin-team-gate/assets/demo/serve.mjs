// The gate, running for real in Node, with a mock Google in front of it. No Cloudflare, no Google account, no network.
//   node assets/demo/serve.mjs [port] [--not-set-up]     → http://localhost:8124/
//
// What is real: functions/_middleware.js, lib/auth.js and functions/api/me.js, unchanged. Every ID token is an RS256
// JWT that lib/auth.js checks in full (signature, issuer, audience, expiry, nonce, email_verified, hd, allow-list).
// What is mock, in this process only:
//   - D1 is SQLite in memory (node:sqlite, Node 22.13+).
//   - fetch() of Google's key list answers with this demo's own public key.
//   - the sign-in page's link to accounts.google.com is pointed at /__mock/google, an account chooser that signs a
//     token with this demo's key and posts it back to /__auth/google, as Google does (response_mode=form_post).
// Accounts: alex, blair, casey @example.edu are on the list; dana@example.edu is not (the refusal line).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, "..");
const DS = path.join(HERE, "..", "..", "..", "team-site-design-system", "assets");
const FILL = { "{{SITE_NAME}}": "Example Lab", "{{SITE_SHORT_NAME}}": "Lab" }; // the demo's placeholder values
const GOOGLE = "https://accounts.google.com/o/oauth2/v2/auth";
const CERTS = "https://www.googleapis.com/oauth2/v3/certs";

/* ---------- D1 on SQLite ---------- */
class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...a) { return new Stmt(this.db, this.sql, a.map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : v === undefined ? null : v))); }
  async first() { return this.db.prepare(this.sql).get(...this.args) || null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args).map((r) => ({ ...r })) }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.args); return { meta: { changes: Number(r.changes) } }; }
  _exec() { const st = this.db.prepare(this.sql); return /^\s*select/i.test(this.sql) ? { results: st.all(...this.args) } : { meta: { changes: Number(st.run(...this.args).changes) } }; }
}
class D1 {
  constructor() { this.db = new DatabaseSync(":memory:"); }
  prepare(sql) { return new Stmt(this.db, sql); }
  async batch(list) {
    this.db.exec("BEGIN");
    try { const out = list.map((s) => s._exec()); this.db.exec("COMMIT"); return out; } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
}

/* ---------- the mock Google: a key pair, its key list, signed tokens ---------- */
const enc = new TextEncoder();
const b64u = (u8) => Buffer.from(u8).toString("base64url");
const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url) === CERTS) {
    return new Response(JSON.stringify({ keys: [{ kty: "RSA", alg: "RS256", use: "sig", kid: "demo", n: jwk.n, e: jwk.e }] }),
      { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
  }
  return realFetch(url, init);
};
const ACCOUNTS = [
  { email: "alex@example.edu", name: "Alex", sub: "demo-alex" },
  { email: "blair@example.edu", name: "Blair", sub: "demo-blair" },
  { email: "casey@example.edu", name: "Casey", sub: "demo-casey" },
  { email: "dana@example.edu", name: "Dana (not on the list)", sub: "demo-dana" },
];
async function idToken(clientId, nonce, acct) {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: "https://accounts.google.com", aud: clientId, sub: acct.sub, email: acct.email, email_verified: true,
    hd: acct.email.split("@")[1], nonce, iat: now, exp: now + 3600, name: acct.name };
  const head = b64u(enc.encode(JSON.stringify({ alg: "RS256", kid: "demo", typ: "JWT" })));
  const body = b64u(enc.encode(JSON.stringify(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, enc.encode(head + "." + body)));
  return head + "." + body + "." + b64u(sig);
}

/* ---------- the site behind the gate ---------- */
const args = process.argv.slice(2);
const notSetUp = args.includes("--not-set-up");
const env = {
  GOOGLE_CLIENT_ID: notSetUp ? "" : "demo-client.apps.googleusercontent.com",
  GOOGLE_HD: "example.edu",
  ALLOWED_EMAILS: "alex@example.edu=alex, blair@example.edu=blair, casey@example.edu=casey",
  DB: new D1(),
};

// placeholders filled in a copy of the gate, the way you fill them in your site
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || "/tmp"), "gate-demo-"));
for (const rel of ["functions/_middleware.js", "functions/api/me.js", "lib/auth.js"]) {
  const src = fs.readFileSync(path.join(ASSETS, rel), "utf8");
  fs.mkdirSync(path.dirname(path.join(TMP, rel)), { recursive: true });
  fs.writeFileSync(path.join(TMP, rel), Object.entries(FILL).reduce((s, [k, v]) => s.split(k).join(v), src));
}
const gate = await import(path.join(TMP, "functions/_middleware.js"));
const me = await import(path.join(TMP, "functions/api/me.js"));

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
function staticFile(p) {
  const map = { "/": path.join(HERE, "home.html"), "/assets/poster.svg": path.join(ASSETS, "site/assets/poster.svg"),
    "/assets/poster-tall.svg": path.join(ASSETS, "site/assets/poster-tall.svg"), "/css/tokens.css": path.join(DS, "tokens.css") };
  const f = map[p];
  if (!f || !fs.existsSync(f)) return new Response("not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  return new Response(fs.readFileSync(f), { headers: { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" } });
}
// what Pages would do after the gate: a function for /api/me, a static file for the rest
async function pages(ctx) {
  const p = new URL(ctx.request.url).pathname;
  if (p === "/api/me") return ctx.request.method === "POST" ? me.onRequestPost(ctx) : me.onRequestGet(ctx);
  return staticFile(p);
}

/* ---------- the mock Google's pages ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function chooser(q) {
  const rows = ACCOUNTS.map((a, i) => `<button name="a" value="${i}"><b>${esc(a.name)}</b><span>${esc(a.email)}</span></button>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mock Google (demo)</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f2f4;color:#1d1d1f;font:15px/1.4 system-ui,sans-serif}
form{width:min(380px,calc(100vw - 32px));background:#fff;border-radius:12px;padding:24px;box-shadow:0 0 0 .5px #d2d2d7}
h1{font-size:18px;margin:0 0 4px}p{margin:0 0 16px;color:#6e6e73;font-size:13px}
button{display:grid;width:100%;text-align:left;gap:2px;padding:12px;margin:0;border:0;border-top:.5px solid #d2d2d7;background:none;font:inherit;cursor:pointer}
button:hover{background:#f5f5f7}button span{color:#6e6e73;font-size:13px}.cancel{color:#0071e3;text-align:center}
</style></head><body><form method="post" action="/__mock/google">
<h1>Mock Google (demo only)</h1><p>Choose an account. The demo signs a real RS256 token with its own key.</p>
${rows}<button class="cancel" name="a" value="cancel">Cancel</button>
${["client_id", "redirect_uri", "nonce", "state"].map((k) => `<input type="hidden" name="${k}" value="${esc(q.get(k) || "")}">`).join("")}
</form></body></html>`;
}
async function chosen(form) {
  const f = (k) => String(form.get(k) || "");
  const redirect = new URL(f("redirect_uri"));
  if (redirect.pathname !== "/__auth/google" || !["localhost", "127.0.0.1"].includes(redirect.hostname)) return new Response("bad redirect_uri", { status: 400 });
  const a = f("a");
  const fields = a === "cancel" ? { error: "access_denied", state: f("state") }
    : { id_token: await idToken(f("client_id"), f("nonce"), ACCOUNTS[+a] || ACCOUNTS[0]), state: f("state") };
  // the page Google answers with: a form that posts itself to the site
  const inputs = Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join("");
  return new Response(`<!doctype html><html><body><form method="post" action="${esc(redirect.href)}">${inputs}</form>
<script>document.forms[0].submit()</script></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/* ---------- Node ⇄ fetch ---------- */
async function handle(req, res) {
  const port = server.address().port;
  const url = new URL(req.url, `http://${req.headers.host || "localhost:" + port}`);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const request = new Request(url, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });

  let out;
  if (url.pathname === "/__mock/google") out = req.method === "POST" ? await chosen(await request.formData()) : new Response(chooser(url.searchParams), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  else {
    const ctx = { request, env, data: {}, next: () => pages(ctx) };
    out = await gate.onRequest(ctx);
    // point the sign-in button at the mock instead of accounts.google.com (the demo's only change, made on the way out)
    if ((out.headers.get("Content-Type") || "").includes("text/html") && out.status !== 303) {
      const text = (await out.text()).split(GOOGLE).join("/__mock/google");
      out = new Response(text, out);
    }
  }
  const h = {};
  out.headers.forEach((v, k) => { if (k !== "set-cookie") h[k] = v; });
  const cookies = out.headers.getSetCookie();
  if (cookies.length) h["set-cookie"] = cookies;
  res.writeHead(out.status, h);
  res.end(req.method === "HEAD" ? undefined : Buffer.from(await out.arrayBuffer()));
}

const server = http.createServer((req, res) => handle(req, res).catch((e) => { console.error(e); res.writeHead(500); res.end("demo error"); }));
const port = +(args.find((a) => /^\d+$/.test(a)) || 8124);
server.listen(port, () => console.log(`gate demo on http://localhost:${port}/${notSetUp ? " (not set up)" : ""}`));
process.on("exit", () => fs.rmSync(TMP, { recursive: true, force: true }));
export default server;
