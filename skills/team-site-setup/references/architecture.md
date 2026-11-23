# Architecture

## Request flow

```
browser ──▶ Cloudflare edge
              │
              ▼
        functions/_middleware.js
          ├─ public path? (link-preview image, sign-in posters, manifest, sw.js, icons) ──▶ static file
          ├─ /api/push/tick with the right secret header ──────────────────────────────▶ tick function
          ├─ /__auth/google (Google posts the ID token here) ─▶ verify ─▶ session cookie ─▶ redirect
          ├─ no valid session ──▶ the sign-in page (200, carries the link-preview tags)
          └─ signed in ──▶ context.data.user = { member } ──▶ next()
                                                      ├─ /api/* functions (calendar, push, chat, me)
                                                      ├─ /theory/<part>/<chapter> ─▶ reader.html
                                                      └─ static files from dist/
```

Every response gets `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: same-origin`, `X-Content-Type-Options:
nosniff`, `X-Frame-Options: SAMEORIGIN`.

## Where state lives

| State | Where | Why there |
|---|---|---|
| Events | the shared Google Calendar | the source of truth; teammates also use Google Calendar directly |
| Logs, references, theory, code | the repo | reviewed, versioned, built into `dist/data/*.json` |
| Sessions (hashed tokens) | D1 | must survive deploys; never in the repo |
| Push devices, seen events, sync token, queue, VAPID keys, tick secret | D1 | generated and kept server-side |
| Chat messages | D1 | team-only, small |
| "Seen once" (install pop-up, guide) | D1 **and** localStorage | survives a cleared browser or a new phone |
| Theme, language, last reading position | localStorage | per browser, harmless to lose |

## Build

`python3 build.py` copies `site/` to `dist/` and writes JSON for the tabs:

| Output | From | Skill |
|---|---|---|
| `data/records.json` | `logs/weekNN_MMDD/*.md` | `weekly-research-log` |
| `data/refs.json` | `references/papers.csv`, `references/README.md` | `references-library` |
| `data/theory.json` | `theory/sections.json`, `theory/<part>/*.md` | `lecture-notes-reader` |
| `data/build.json` | git commit, time | this skill |
| `repo/<path>` images | images next to the Markdown | all three |

The page fetches these JSON files once; there is no client-side Markdown fetching from GitHub.

## Costs and limits (free plans, late 2026)

| Piece | Free allowance | A three-person team uses |
|---|---|---|
| Pages builds | 500 per month | one per merge |
| Pages Functions | 100,000 requests per day | a few thousand |
| D1 | 5 GB, 5 M reads per day | kilobytes |
| Worker cron | 100,000 requests per day | 1,440 (one per minute) |
| Google Calendar API | 1,000,000 queries per day | a few thousand |

Check the current numbers in each provider's pricing page before relying on them.

## Local development

```bash
python3 build.py --check
npx wrangler pages dev dist --binding DEV_MEMBER=alex            # signed in as alex, no Google
npx wrangler pages dev dist --d1 DB={{D1_NAME}}                   # with a local D1 (sessions, push, chat)
node tools/mock-google.mjs 8790 .dev.vars                         # fake Google Calendar (shared-google-calendar)
```

`.dev.vars` (git-ignored) holds local values; copy `.dev.vars.example`.
