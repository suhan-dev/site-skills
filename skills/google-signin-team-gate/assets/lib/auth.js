// Google sign-in for a small team (functions/_middleware.js uses this). No password anywhere.
//
// The sign-in page's button opens Google's own sign-in (OpenID Connect). Google posts an ID token back to
// /__auth/google (response_mode=form_post), and it is checked here: Google's RS256 signature (keys from CERTS), the
// issuer, the audience (our client id), the expiry, the nonce from our own cookie, email_verified, the Workspace domain
// (GOOGLE_HD, when set), and the address on the allow-list.
//
// The allow-list is the Cloudflare secret ALLOWED_EMAILS, one "address=member" per entry (comma or new line),
// member = an id such as "alex". Addresses live only there and in D1, never in the repository or on a page.
// Taking an address off the list (and redeploying) stops it on its next request.
//
// A session is a random token in an HttpOnly cookie that lasts SESSION_DAYS; D1 keeps only its SHA-256.
// Sign out deletes it. The Google account's `sub` is pinned to the address on its first sign-in.
//
// It needs GOOGLE_CLIENT_ID and the D1 binding DB both; without them nobody gets in (functions/_middleware.js).
// No client secret: the ID token comes straight back from Google's sign-in, there is no code to exchange.

export const SESSION_DAYS = 180;
export const SID = "site_sid";
export const NONCE = "site_nonce";
export const AUTH_PATH = "/__auth/google";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const SKEW = 60_000; // clock leeway for exp / iat
const MEMBER = /^[a-z0-9_-]{1,32}$/;
const DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}$/;
const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);
const enc = new TextEncoder();

export const googleOn = (env) => !!(env && env.GOOGLE_CLIENT_ID && env.DB);

/** The Workspace domain everyone must belong to (GOOGLE_HD, e.g. "example.edu"), or "" for any Google account. */
export function hostedDomain(env) {
  const d = String((env && env.GOOGLE_HD) || "").trim().toLowerCase();
  return DOMAIN.test(d) ? d : "";
}

/** ALLOWED_EMAILS → Map(address → member). Entries are "address=member" (":" works too), separated by commas or lines. */
export function allowList(env) {
  const map = new Map();
  for (const raw of String((env && env.ALLOWED_EMAILS) || "").split(/[,;\n]/)) {
    const s = raw.trim();
    const i = Math.max(s.lastIndexOf("="), s.lastIndexOf(":"));
    if (i < 1) continue;
    const email = s.slice(0, i).trim().toLowerCase(), member = s.slice(i + 1).trim().toLowerCase();
    if (email.includes("@") && MEMBER.test(member)) map.set(email, member);
  }
  return map;
}

/** The members on the list, or null while Google sign-in isn't set up (local preview: nobody is left out).
 *  Other features use it to forget what belongs to someone taken off the list (e.g. notification devices). */
export function allowedMembers(env) {
  return googleOn(env) ? new Set(allowList(env).values()) : null;
}

/** Google's sign-in address for one sign-in page. The nonce comes back inside the ID token and, as `state`, beside it. */
export function googleAuthUrl(env, origin, nonce) {
  const q = new URLSearchParams({
    client_id: String(env.GOOGLE_CLIENT_ID), redirect_uri: origin + AUTH_PATH, response_type: "id_token", response_mode: "form_post",
    scope: "openid email", nonce, state: nonce, prompt: "select_account",
  });
  // hd only narrows Google's account chooser; the token's own hd claim is what is checked
  const hd = hostedDomain(env);
  if (hd) q.set("hd", hd);
  return AUTHORIZE + "?" + q;
}

/* ---------- small helpers ---------- */
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
export const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
function unb64u(s) {
  const t = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const json64 = (s) => JSON.parse(new TextDecoder().decode(unb64u(s)));
export function randomToken(bytes = 32) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}
export function readCookie(request, name) {
  for (const part of (request.headers.get("Cookie") || "").split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) {
      try { return decodeURIComponent(part.slice(i + 1)); } catch (e) { return ""; }
    }
  }
  return "";
}
const isHttps = (url) => new URL(url).protocol === "https:";

/** The session cookie: 180 days, HttpOnly, SameSite=Lax (Secure on https). Empty value + 0 deletes it. */
export function sessionCookie(request, token, maxAge = SESSION_DAYS * 86400) {
  return `${SID}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${isHttps(request.url) ? "; Secure" : ""}`;
}
/** The nonce cookie for one sign-in, 10 minutes, sent only to /__auth/google. SameSite=None: Google posts the token
 *  back to us from its own page, a cross-site POST, and a Lax cookie would stay behind. None needs Secure; browsers
 *  built on Chromium accept Secure cookies on http://localhost too, so a local sign-in with the real Google works there. */
export function nonceCookie(request, value, maxAge = 600) {
  const u = new URL(request.url);
  const site = isHttps(request.url) || LOCAL.has(u.hostname) ? "; SameSite=None; Secure" : "; SameSite=Lax";
  return `${NONCE}=${encodeURIComponent(value)}; Path=${AUTH_PATH}; Max-Age=${maxAge}; HttpOnly${site}`;
}

/* ---------- Google's keys ---------- */
const KEYS = { map: new Map(), until: 0, fetchedAt: 0 };
async function googleKey(kid, now) {
  if (KEYS.map.has(kid) && now < KEYS.until) return KEYS.map.get(kid);
  // an unknown kid refetches at most once a minute (Google rotates keys every few days)
  if (now - KEYS.fetchedAt < 60_000 && KEYS.map.size && !KEYS.map.has(kid)) return null;
  const r = await fetch(CERTS);
  if (!r.ok) throw new Error("certs " + r.status);
  const d = await r.json();
  const age = Number(((r.headers.get("Cache-Control") || "").match(/max-age=(\d+)/) || [])[1] || 3600);
  const map = new Map();
  for (const k of (d && d.keys) || []) {
    if (k.kty !== "RSA" || (k.alg && k.alg !== "RS256") || !k.kid || !k.n || !k.e) continue;
    map.set(k.kid, await crypto.subtle.importKey("jwk", { kty: "RSA", n: k.n, e: k.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
  }
  KEYS.map = map; KEYS.fetchedAt = now; KEYS.until = now + Math.min(Math.max(age, 60), 86400) * 1000;
  return map.get(kid) || null;
}
export function forgetGoogleKeys() { KEYS.map = new Map(); KEYS.until = 0; KEYS.fetchedAt = 0; } // tests

/**
 * Check a Google ID token. → { ok: true, email, member, sub } or { ok: false, why }
 * why: "token" (malformed, signature, issuer, audience, time, nonce), "verified", "team" (wrong domain or not on the list).
 */
export async function verifyIdToken(env, token, nonce, now = Date.now()) {
  const no = (why) => ({ ok: false, why });
  if (typeof token !== "string" || token.length > 8192 || !nonce) return no("token");
  const parts = token.split(".");
  if (parts.length !== 3) return no("token");
  let head, claims;
  try { head = json64(parts[0]); claims = json64(parts[1]); } catch (e) { return no("token"); }
  if (!head || head.alg !== "RS256" || typeof head.kid !== "string" || !claims || typeof claims !== "object") return no("token");
  const key = await googleKey(head.kid, now);
  if (!key) return no("token");
  let good = false;
  try { good = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, unb64u(parts[2]), enc.encode(parts[0] + "." + parts[1])); } catch (e) { good = false; }
  if (!good) return no("token");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!ISSUERS.includes(claims.iss) || !aud.includes(String(env.GOOGLE_CLIENT_ID))) return no("token");
  if (!(Number(claims.exp) * 1000 + SKEW > now) || (claims.iat && Number(claims.iat) * 1000 - SKEW > now)) return no("token");
  if (typeof claims.nonce !== "string" || claims.nonce !== nonce) return no("token");
  if (claims.email_verified !== true) return no("verified");
  const email = String(claims.email || "").toLowerCase();
  const hd = hostedDomain(env);
  if (hd && (claims.hd !== hd || !email.endsWith("@" + hd))) return no("team");
  const member = allowList(env).get(email);
  if (!member || typeof claims.sub !== "string" || !claims.sub) return no("team");
  return { ok: true, email, member, sub: claims.sub };
}

/* ---------- sessions in D1 ---------- */
const TABLES = [
  `CREATE TABLE IF NOT EXISTS auth_accounts (email TEXT PRIMARY KEY, sub TEXT NOT NULL,
    first_at INTEGER NOT NULL, last_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL,
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS member_seen (member TEXT NOT NULL, what TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (member, what))`,
];
let made = null;
async function db(env) {
  if (!made || made.env !== env.DB) {
    const d = env.DB;
    made = { env: d, p: d.batch(TABLES.map((s) => d.prepare(s))) };
    made.p.catch(() => { made = null; });
  }
  await made.p;
  return env.DB;
}

/** A checked token → a new session. The first sign-in pins the Google account; a different one later is refused. */
export async function startSession(env, idt, now = Date.now()) {
  const d = await db(env);
  const row = await d.prepare("SELECT sub FROM auth_accounts WHERE email = ?").bind(idt.email).first();
  if (row && row.sub !== idt.sub) return null;
  const token = randomToken();
  await d.batch([
    d.prepare(`INSERT INTO auth_accounts (email, sub, first_at, last_at) VALUES (?1, ?2, ?3, ?3)
      ON CONFLICT (email) DO UPDATE SET last_at = ?3`).bind(idt.email, idt.sub, now),
    d.prepare("INSERT INTO auth_sessions (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(await sha256(token), idt.email, now, now + SESSION_DAYS * 86400e3),
    d.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").bind(now),
  ]);
  return token;
}

// recent answers per token, so pages and their files don't each ask D1 (a minute at most; sign out clears it here)
const CACHE = new Map();
const CACHE_MS = 60_000;

/** The signed-in member for this request → { email, member } or null. The allow-list is read on every request. */
export async function currentUser(env, request, now = Date.now()) {
  const token = readCookie(request, SID);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const h = await sha256(token);
  let email = null;
  const c = CACHE.get(h);
  if (c && c.until > now) email = c.email;
  else {
    const d = await db(env);
    const row = await d.prepare("SELECT email FROM auth_sessions WHERE token_hash = ? AND expires_at > ?").bind(h, now).first();
    if (!row) { CACHE.delete(h); return null; }
    email = row.email;
    if (CACHE.size > 500) CACHE.clear();
    CACHE.set(h, { email, until: now + CACHE_MS });
  }
  const member = allowList(env).get(email);
  return member ? { email, member } : null;
}

export async function endSession(env, request) {
  const token = readCookie(request, SID);
  if (!/^[a-f0-9]{64}$/.test(token)) return;
  const h = await sha256(token);
  CACHE.delete(h);
  const d = await db(env);
  await d.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(h).run();
}

/* ---------- shown once per member ---------- */
// Things the page shows a member only one time, on any device: "install" is the "Add to Home Screen" sheet
// (ios-webapp-push), "guide" the first-visit tour (first-visit-spotlight-guide). Kept by member id, so a browser that
// cleared its storage, or a second device, doesn't show it again. Add a name here before a page may record it.
export const ONCE = ["install", "guide"];

/** { install: true | false, guide: true | false } for this member. */
export async function seenFor(env, member) {
  const d = await db(env);
  const { results } = await d.prepare("SELECT what FROM member_seen WHERE member = ?").bind(member).all();
  const got = new Set(results.map((r) => r.what));
  return Object.fromEntries(ONCE.map((k) => [k, got.has(k)]));
}

/** Record that the member has seen it. False for anything not in ONCE. */
export async function markSeen(env, member, what, now = Date.now()) {
  if (!ONCE.includes(what)) return false;
  const d = await db(env);
  await d.prepare("INSERT OR IGNORE INTO member_seen (member, what, at) VALUES (?, ?, ?)").bind(member, what, now).run();
  return true;
}
