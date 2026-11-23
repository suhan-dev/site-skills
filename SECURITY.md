# Security

This repository is public. It holds code, docs and placeholder screenshots only.

## What is never in this repository

- Passwords, API keys, tokens, private keys, client secrets, service-account JSON files.
- Email addresses, phone numbers, real names of the source team, chat captures.
- Google Calendar ids, service-account addresses, OAuth client ids, Cloudflare account or D1 database ids.
- Lecture-note or paper text from the source site (the reader skill ships its own sample chapters).

`bash tools/privacy-scan.sh` checks for all of these and must print only ✓ before every push.

## How the skills keep secrets out of *your* site's repo

| Secret | Where it lives | Never |
|---|---|---|
| Google service-account key (`GOOGLE_SA_JSON`) | Cloudflare Pages → Variables and Secrets, type **Secret** | in the repo, in chat, in `.dev.vars` committed |
| Sign-in allow-list (`ALLOWED_EMAILS`) | Cloudflare, type **Secret** | on any page, in logs, in notifications |
| VAPID key pair, push tick secret | generated inside D1 on first use | copied anywhere by hand |
| Session tokens | cookie (HttpOnly, Secure, SameSite=Lax); D1 keeps only the SHA-256 | readable by scripts |
| Google OAuth client secret | nowhere: the sign-in flow does not use it | saved at all |

Every skill's `.gitignore` excludes `.dev.vars*`, `.env*`, `*.key.json`, `service-account*.json` and `*.pdf`, and every
`.dev.vars.example` has empty values.

## Design choices that matter for security

- Sign-in checks Google's RS256 signature with WebCrypto against Google's published keys, plus issuer, audience,
  expiry, a one-time nonce, `email_verified` and the Workspace domain, then the allow-list.
- The page never receives an email address; `/api/me` returns a member id.
- `DEV_MEMBER` (sign in without Google) works only on `localhost`.
- The push tick endpoint is public only with its secret header, compared in constant time.
- Every response carries `X-Robots-Tag: noindex`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  `Referrer-Policy: same-origin`.

## Reporting

Found something sensitive here, or a weakness in a skill's code? Open a GitHub issue **without** the sensitive value, or
contact the repository owner through GitHub. Rotate any exposed credential first; deleting a commit does not un-publish it.
