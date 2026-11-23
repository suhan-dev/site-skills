# Protocol: Web Push with WebCrypto only

`assets/lib/webpush.js` sends a push without any package: it runs on Cloudflare Pages Functions (and Node 22 for the
tests) with `crypto.subtle` alone. Three standards are involved.

## 1. The subscription (browser side)

`pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` with the server's VAPID public key (65 bytes,
an uncompressed P-256 point, base64url) gives:

```json
{ "endpoint": "https://web.push.apple.com/…", "keys": { "p256dh": "<65-byte point, 87 chars>", "auth": "<16 bytes, 22 chars>" } }
```

The server accepts only endpoints of known push services (`*.push.apple.com`, `fcm.googleapis.com`,
`android.googleapis.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`), https, no port, no user info,
at most 1400 characters, and keys of exactly those lengths (`subFrom()` in `lib/push.js`). Anything else would let a
page make the server POST to an address of its choice.

## 2. Payload encryption: RFC 8291 with aes128gcm (RFC 8188)

For each message (`encryptPayload()`):

1. A fresh ECDH P-256 key pair on the server (`as_private`, `as_public`) and a fresh 16-byte salt.
2. `ecdh_secret = ECDH(as_private, ua_public)`, where `ua_public` is the subscription's `p256dh`.
3. HKDF in four HMAC-SHA-256 steps (each output fits in one block, so "expand" is one HMAC with the counter `0x01`):
   ```
   PRK_key = HMAC(auth_secret, ecdh_secret)
   IKM     = HMAC(PRK_key, "WebPush: info\0" ‖ ua_public ‖ as_public ‖ 0x01)
   PRK     = HMAC(salt, IKM)
   CEK     = HMAC(PRK, "Content-Encoding: aes128gcm\0" ‖ 0x01)[0..16]
   NONCE   = HMAC(PRK, "Content-Encoding: nonce\0"     ‖ 0x01)[0..12]
   ```
4. One record: `plaintext ‖ 0x02` (the last-record delimiter, no padding), sealed with AES-128-GCM (`CEK`, `NONCE`,
   128-bit tag). The plaintext is the JSON `{ title, body, url, tag }`, at most 3800 bytes.
5. The body sent is the aes128gcm header followed by the record:
   ```
   salt (16) ‖ record size (4, big-endian, 4096) ‖ key id length (1, = 65) ‖ key id = as_public (65) ‖ ciphertext
   ```

The test (`tests/test-push.mjs`) encrypts RFC 8291 Appendix A's message with its fixed salt and server key and checks
that the output equals the RFC's bytes exactly. Then every push in the test is decrypted with the fake device's own
private key, so what the tests assert is what a phone would show.

## 3. Sender identity: VAPID, RFC 8292

`vapidAuth()` signs a JWT with the server's VAPID private key (ES256, P-256):

```
header  { "typ": "JWT", "alg": "ES256" }
claims  { "aud": <the endpoint's origin>, "exp": now + 12 h, "sub": "{{SITE_ORIGIN}}" }
Authorization: vapid t=<header>.<claims>.<signature>, k=<VAPID public key>
```

- WebCrypto's ECDSA signature is the raw `r ‖ s` form, which is exactly a JWS ES256 signature (no DER conversion).
- `exp` is 12 hours: Apple refuses tokens that live longer than 24 hours.
- `sub` is the site's https origin. RFC 8292 allows a URL or a `mailto:`; the URL keeps every email address out of
  the code and out of the push services' logs.

## 4. The request

```
POST <endpoint>
Authorization: vapid t=…, k=…
Content-Encoding: aes128gcm
Content-Type: application/octet-stream
TTL: <seconds>            reminders: until the event starts (at least 60); new events: 86400
Urgency: high | normal    reminders are high (they must arrive on time), new events normal
```

Answers: `201` accepted; `404` / `410` the subscription is gone (the device is forgotten); `400` / `403` / `413` will
never work (the job is closed); anything else or a timeout (8 s) is retried (see `server.md`). Redirects are not
followed.

## 5. The keys

`newVapidKeys()` makes the VAPID pair with `crypto.subtle.generateKey` once, the first time anything needs it, and
`lib/push.js` stores it in D1 (`push_meta`, key `vapid`, as `{ publicKey, privateJwk }`). It is never in the repository,
a variable, a log or an API answer; `GET /api/push` returns only the public key.
