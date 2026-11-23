# How it works, and what it checks

The flow from a signed-out visit to a signed-in page, every check on the way, and what each one stops.
Code: [`assets/lib/auth.js`](../assets/lib/auth.js), [`assets/functions/_middleware.js`](../assets/functions/_middleware.js).

## 1. The flow

```
browser                         site (Pages middleware)                       Google
───────                         ───────────────────────                       ──────
GET /records?week=3  ───────▶  no session → sign-in page (200)
                     ◀───────  Set-Cookie site_nonce=<n>|/records?week=3
                               (HttpOnly, Path=/__auth/google, 10 min)
click the pill  ─────────────────────────────────────────────────────────▶  /o/oauth2/v2/auth?client_id&redirect_uri
                                                                             &response_type=id_token
                                                                             &response_mode=form_post
                                                                             &scope=openid email&nonce=<n>&state=<n>
                                                                             &prompt=select_account[&hd=example.edu]
                     ◀────────────────────────────────────────────────────  account chooser, then an auto-posting form
POST /__auth/google  ───────▶  id_token, state  (+ cookie site_nonce)
                               state == nonce? token checks (§2)? on the list? sub pinned?
                     ◀───────  303 → /records?week=3
                               Set-Cookie site_sid=<64 hex> (HttpOnly, SameSite=Lax, Secure, 180 days)
                               Set-Cookie site_nonce=; Max-Age=0
GET /records?week=3  ───────▶  sha256(site_sid) in D1, not expired, address still on the list
                               → context.data.user = { email, member } → the page, file or API
```

Why this flow (OpenID Connect implicit, `id_token` posted back):

- **No client secret.** The token comes straight from Google's sign-in page; there is no authorisation code to
  exchange, so the site keeps nothing secret for Google. The ID token is signed by Google and bound to this sign-in by
  the nonce.
- **No JavaScript needed.** The pill is a link and Google answers with a form post, so it works in the browser and in the
  installed Home Screen app alike (where pop-ups are a problem).
- **`form_post`, not a fragment.** The token reaches the server in a POST body, never in an address, a history entry
  or a `Referer`.

## 2. The checks, in order

| # | Check | Where | Stops |
|---|---|---|---|
| 1 | `state` equals the nonce in this browser's cookie | middleware | a token posted from somewhere else (login CSRF), a replay of an old post |
| 2 | Token ≤ 8 KB, three parts, header `alg: RS256` and a `kid` | `verifyIdToken` | `alg: none`, HS256 with the public key, junk |
| 3 | RS256 signature (RSASSA-PKCS1-v1_5, SHA-256) with Google's key for that `kid`, via WebCrypto | `verifyIdToken` | forged or edited tokens |
| 4 | `iss` is `https://accounts.google.com` or `accounts.google.com` | `verifyIdToken` | tokens from other issuers |
| 5 | `aud` contains `GOOGLE_CLIENT_ID` | `verifyIdToken` | a Google token made for another app |
| 6 | `exp` in the future, `iat` not in the future (60 s leeway) | `verifyIdToken` | old or pre-dated tokens |
| 7 | `nonce` claim equals the cookie's nonce | `verifyIdToken` | a stolen token used in another browser |
| 8 | `email_verified === true` (a real boolean) | `verifyIdToken` | unverified addresses |
| 9 | With `GOOGLE_HD`: `hd` claim equals it **and** the address ends with `@` + it | `verifyIdToken` | accounts outside the Workspace (the `hd` URL parameter alone only filters Google's chooser) |
| 10 | The address is on `ALLOWED_EMAILS` (case ignored) and `sub` is present | `verifyIdToken` | everyone else |
| 11 | The address's first `sub` is pinned in D1; a different `sub` later is refused | `startSession` | a new Google account that reuses a member's address |
| 12 | On every later request: the session hash exists, is not expired, and its address is **still** on the list | `currentUser` | removed members (signed out on their next request) |

Failures 8–11 show "This site is for the {{SITE_NAME}} team only."; failures 1–7 show "Couldn't sign in. Try again.";
Cancel at Google (`error=access_denied`) shows nothing. All three answer with the sign-in page (403 for the first two).

## 3. Google's keys

- Fetched from `https://www.googleapis.com/oauth2/v3/certs`, imported once as WebCrypto keys, kept for the
  response's `max-age` (clamped to 1 minute … 1 day).
- An unknown `kid` refetches at most once a minute, so a flood of junk tokens cannot make the site hammer Google, and a
  key rotation is picked up within a minute.
- Only `kty: RSA`, `alg: RS256` (or none) keys with `n`, `e` and a `kid` are used.

## 4. Cookies

| Cookie | Value | Attributes | Why |
|---|---|---|---|
| `site_nonce` | 32 hex + `\|` + the return path | `HttpOnly; Path=/__auth/google; Max-Age=600; SameSite=None; Secure` (on https and on localhost), else `SameSite=Lax` | Google's post back is cross-site: a Lax cookie would stay behind. The path keeps it out of every other request. A nonce still in its 10 minutes is reused, so two open sign-in tabs both work. |
| `site_sid` | 64 hex (32 random bytes) | `HttpOnly; Path=/; Max-Age=15552000 (180 days); SameSite=Lax`; `Secure` on https | Scripts cannot read it; other sites cannot send it with a POST. D1 keeps only `sha256(token)`, so a database leak gives no working session. |

The return path is cleaned (`safeNext`): it must start with one `/`, not `//` or `/\` (which browsers read as another
host), and not `/__` (the gate's own addresses). Anything else returns to `/`.

## 5. The gate, request by request

Order in `onRequest`:

1. **Public paths** pass untouched (but get the security headers): `/robots.txt`, `/favicon.svg`, `/assets/og.jpg`,
   the two poster files, `/manifest.webmanifest`, `/sw.js`, `/icons/<name>.png`. Each is needed before sign-in (link
   preview crawlers, the sign-in page itself, browsers fetching the manifest without cookies) and none is private.
2. **Machine paths** (`MACHINE`): a path a server calls without a session passes only with its secret header, checked
   by its owner in constant time (e.g. ios-webapp-push's `/api/push/tick`). A wrong header is 403; no header falls
   through to the normal gate.
3. **`DEV_MEMBER`** on `localhost` / `127.0.0.1` / `[::1]` only: signs in as that member, no Google.
4. **Not set up** (no `GOOGLE_CLIENT_ID` or no `DB`): a 503 page with one line. Nobody gets in. There is no fallback
   password.
5. `/__auth/google`: the sign-in return (POST only; a GET goes to `/`).
6. `/__logout`: deletes the session row and the cookie, 303 to `/`.
7. **Signed in**: `context.data.user = { email, member }`, then:
   - a write to `/api/*` (not GET, HEAD, OPTIONS) with an `Origin` header from another origin → 403 `{"error":"origin"}`;
   - the `REWRITES` (e.g. the lecture reader's `/theory/<part>/<chapter>`);
   - otherwise the page, file or function.
8. **Signed out**: `/api/*` → 401 `{"error":"auth"}`; a page load (`Sec-Fetch-Dest: document`, or a path without a file
   extension) → the sign-in page; anything else (a favicon, a script) → 401 text, without touching the nonce.

Every answer carries `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: same-origin`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`. The sign-in page is also `Cache-Control: no-store`.

## 6. What the rest of the site gets

- Functions read `context.data.user.member` (e.g. `alex`). The team chat takes the author from it, the calendar takes
  "added by" from it, and a page's own claim of who it is is ignored.
- Pages call `GET /api/me` → `{ "auth": "google", "member": "alex", "seen": { "install": false, "guide": true } }`.
  The address is never sent to a page.
- `POST /api/me { "seen": "guide" }` records that this member has seen a once-only thing (names listed in `ONCE` in
  `auth.js`), on any device. first-visit-spotlight-guide uses `guide`, ios-webapp-push uses `install`.
- `allowedMembers(env)` gives the members on the list (or `null` while sign-in is not set up), so other features can
  forget what belongs to someone removed (ios-webapp-push prunes their devices).

## 7. D1 tables

```sql
auth_accounts (email TEXT PRIMARY KEY, sub TEXT NOT NULL, first_at INTEGER NOT NULL, last_at INTEGER NOT NULL)
auth_sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)
member_seen   (member TEXT NOT NULL, what TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (member, what))
```

Times are milliseconds. Expired sessions are deleted whenever someone signs in. `member_seen` holds member ids, never
addresses. A per-isolate cache remembers a token's address for at most 60 s (500 entries), so a page and its files do
not each ask D1; the allow-list is still read on every request, and Sign out clears the entry.

## 8. What it does not do

- No roles. Everyone on the list sees and does the same. Add a check on `data.user.member` in a function if one page
  needs an owner only.
- No rate limit of its own. Google rate-limits its sign-in; Cloudflare's WAF rules can limit `/__auth/google` if needed.
- No refresh against Google after sign-in: a member whose Google account is suspended stays signed in until removed from
  the list or 180 days pass. Removing them from `ALLOWED_EMAILS` is the off switch.
