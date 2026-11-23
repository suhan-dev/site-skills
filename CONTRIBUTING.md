# How a skill in this repository is built

Every skill is a folder under `skills/<name>/`. Keep this layout exactly; `tools/check-skills.mjs` and the README index depend on it.

```
skills/<name>/
├── SKILL.md            the entry point: frontmatter + steps + rules + self-check (aim for 150–300 lines)
├── references/         long detail, one topic per file (design.md, setup.md, api.md, decisions.md …)
├── assets/             generalised working code, copied from production and stripped of project data
│   └── demo/           a page that runs with placeholder data (used for the screenshots)
└── screenshots/        PNGs of the demo, made with tools/shoot.mjs
```

## SKILL.md

```markdown
---
name: <folder name>
description: <one sentence: what it builds, and when to use it. Starts with a verb. Under 300 characters.>
---

# <Readable title>

<two or three sentences: what you get, with one screenshot>

## When to use / when not to
## What you get (files in assets/, what each does)
## Steps (numbered, imperative, each one checkable)
## Rules (the non-negotiable design and behaviour rules, as short bullets)
## Configuration (every placeholder, its meaning, an example value)
## Self-check before shipping (widths, light and dark, reduced motion, tests to run, privacy scan)
## References (links to references/*.md)
```

Write for another Claude that has never seen the source site. Say *why* a rule exists when it is not obvious ("a day runs 07:00 → 07:00 so a late-night session stays on the day it started").

## Placeholders

Code in `assets/` must run once placeholders are filled. Use these names everywhere so the skills agree:

| Placeholder | Meaning | Demo value |
|---|---|---|
| `{{SITE_NAME}}` | full site name | `Example Lab` |
| `{{SITE_SHORT_NAME}}` | Home Screen label (≤ 12 characters) | `Lab` |
| `{{SITE_ORIGIN}}` | production origin | `https://example-lab.pages.dev` |
| `{{TIMEZONE}}` | IANA zone of the team | `Asia/Seoul` |
| `{{GOOGLE_HD}}` | Google Workspace domain allowed to sign in | `example.edu` |
| `{{PAGES_PROJECT}}` | Cloudflare Pages project (the `*.pages.dev` name) | `example-lab` |
| `{{D1_NAME}}` | D1 database name | `example-lab-db` |
| `{{REPO}}` | GitHub `owner/name` | `example-org/example-lab` |
| member ids | lowercase ids from `team.json` | `alex`, `blair`, `casey` |
| member names | shown names | `Alex`, `Blair`, `Casey` |

Secrets are never placeholders in code. They are environment variables read at run time (`env.GOOGLE_SA_JSON`, `env.ALLOWED_EMAILS` …) and documented in the skill's `references/setup.md` and in `.env.example` files with empty values.

## Demo data

Screenshots use **placeholder data only**: the three demo members above, made-up events ("Weekly sync", "Design review", "Lab session", "Reading group"), made-up chapters ("Sample chapter: Heat flow in a rod") written fresh for the demo. Never real names, emails, calendar ids, event titles or chapter text from the source site.

## Screenshots

```bash
python3 -m http.server 8123 -d skills/<name>/assets/demo &   # or any static server
node tools/shoot.mjs http://localhost:8123/ skills/<name>/screenshots/desktop-light.png --w 1440 --h 900 --theme light
node tools/shoot.mjs http://localhost:8123/ skills/<name>/screenshots/phone-dark.png   --w 390  --h 844 --theme dark
```

Device scale 2 (the default). Name files `<what>-<width>-<theme>.png`. Keep each skill to about 4–8 screenshots and each PNG under 1 MB (use `--h` to crop, not full-page shots of long pages).

## Third-party code

Do not commit vendored libraries. Name the exact version and where to get it (`assets/vendor.txt` or a `fetch-vendor.sh` that downloads pinned versions from npm). three.js r170 (MIT), marked (MIT) and KaTeX (MIT) are the ones used.

## Before every push

```bash
bash tools/privacy-scan.sh      # must print only ✓
node tools/check-skills.mjs     # frontmatter, required sections, links, image sizes
node tools/make-index.mjs       # regenerates docs/gallery.md and llms.txt
```

The scan's list of real names lives in `tools/private-patterns.txt`, which git ignores, so the names themselves are never
published. Copy `tools/private-patterns.example.txt` and fill it in once per clone.
