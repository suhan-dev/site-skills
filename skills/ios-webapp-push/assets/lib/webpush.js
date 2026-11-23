// Web Push with WebCrypto only (Cloudflare Functions, no packages):
//   - payload encryption: RFC 8291 (Message Encryption for Web Push) with the aes128gcm coding of RFC 8188
//   - sender identity: VAPID, RFC 8292 (an ES256 JWT in the Authorization header)
// Checked against the RFC 8291 Appendix A test vector by tests/test-push.mjs.

const enc = new TextEncoder();

export function b64u(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unb64u(s) {
  const t = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "===".slice((t.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/**
 * Encrypt one push message (RFC 8291 §3.4, one record).
 * p256dh, auth: the subscription's keys (base64url). payload: string or bytes.
 * salt and serverKey (a JWK with d, x, y) are only given by the test vector; normally both are fresh and random.
 */
export async function encryptPayload({ p256dh, auth, payload, salt, serverKey }) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error("bad subscription keys");
  salt = salt ? unb64u(salt) : crypto.getRandomValues(new Uint8Array(16));
  let asPrivate, asPublic;
  if (serverKey) {
    asPrivate = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", ...serverKey }, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    asPublic = concat(new Uint8Array([4]), unb64u(serverKey.x), unb64u(serverKey.y));
  } else {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    asPrivate = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  }
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPrivate, 256));

  // HKDF steps written out with HMAC (each output is one block, so expand is a single HMAC with counter 0x01)
  const prkKey = await hmac(authSecret, ecdh);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const text = typeof payload === "string" ? enc.encode(payload) : payload;
  if (text.length > 3800) throw new Error("payload too long");
  const record = concat(text, new Uint8Array([2])); // 0x02: last record, no padding
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, key, record));

  // header: salt (16) · record size (4, big-endian) · key id length (1) · key id = the server's public key (65)
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, sealed);
}

/** A new VAPID key pair: the public key as base64url (65-byte point) and the private key as a JWK. */
export async function newVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { publicKey: b64u(raw), privateJwk: { kty: "EC", crv: "P-256", d: jwk.d, x: jwk.x, y: jwk.y } };
}

/** The Authorization header for one push service (RFC 8292 §2–3). The JWT lives 12 hours (Apple refuses more than 24). */
export async function vapidAuth({ endpoint, subject, publicKey, privateJwk, now = Date.now() }) {
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", { ...privateJwk, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  // WebCrypto gives the raw r || s form, which is exactly what a JWS ES256 signature is
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + body));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${publicKey}`;
}

/**
 * Send one message. sub: { endpoint, p256dh, auth }. vapid: { subject, publicKey, privateJwk }.
 * Returns the push service's status (201 = accepted; 404 / 410 = the subscription is gone).
 */
export async function sendPush(sub, message, { vapid, ttl = 86400, urgency = "normal", topic = "", timeoutMs = 8000 } = {}) {
  const body = await encryptPayload({ p256dh: sub.p256dh, auth: sub.auth, payload: JSON.stringify(message) });
  const headers = {
    Authorization: await vapidAuth({ endpoint: sub.endpoint, ...vapid }),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(Math.max(0, Math.floor(ttl))),
    Urgency: urgency,
  };
  if (topic) headers.Topic = topic; // replaces an undelivered message with the same topic (≤ 32 base64url characters)
  const r = await fetch(sub.endpoint, { method: "POST", headers, body, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
  try { await r.body?.cancel(); } catch (e) { /* no body */ }
  return r.status;
}
