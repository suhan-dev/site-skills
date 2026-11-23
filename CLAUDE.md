# CLAUDE.md

You are working with **site-skills**: a library of Claude skills that rebuild a private team site (calendar, research
log, references, lecture-notes reader, Google sign-in, iOS app with notifications, team chat, onboarding tour, link
previews, 3D intro) and the team working rules around it.

There are two kinds of jobs here. Find out which one the user wants.

## Job A: build a site (or a feature) for the user

1. **Read [docs/START-HERE.md](docs/START-HERE.md).** It has the questions to ask first, the order of skills, what you
   do yourself and what only the user can do (console clicks, secrets), and the checks after each step.
2. Ask the intake questions in one message (name, members, time zone, week start, features, accounts). Do not guess
   member names, addresses or ids.
3. Work skill by skill, in the order START-HERE gives. For each one: read its `SKILL.md`, copy its `assets/`, fill the
   placeholders, run its tests, take its screenshots, then run its self-check. Show the user the screenshots.
4. When a step needs a console (Google Cloud, Cloudflare), give the user the exact clicks from that skill's
   `references/setup.md` and wait. **Never ask the user to paste a secret into chat.** Secrets go straight into
   Cloudflare's Variables and Secrets (type Secret) by the user's own hand.
5. Keep the user's repo following `team-project-playbook` (English docs, never push to `main`, records lock).

## Job B: change this library

1. Follow [CONTRIBUTING.md](CONTRIBUTING.md): folder layout, `SKILL.md` sections, placeholders, demo data, screenshots.
2. Placeholder data only: members Alex, Blair, Casey; site "Example Lab"; made-up events and chapters.
3. Before every commit:
   ```bash
   bash tools/privacy-scan.sh     # must print only ✓
   node tools/check-skills.mjs    # frontmatter, sections, links, sizes, marketplace
   node tools/make-index.mjs      # regenerates docs/gallery.md and llms.txt
   ```
4. A new skill must also be added to `.claude-plugin/marketplace.json`, `README.md` (the table) and the build order in
   `tools/make-index.mjs` and `docs/START-HERE.md`.
5. Branch → pull request → merge. Never push to `main`.

## Never

- Commit a password, key, token, client secret, service-account JSON, email address, phone number, calendar id,
  account id or database id. This repository is public.
- Copy the source site's real content (names, events, lecture-note text) into a demo or screenshot.
- Commit third-party libraries; each skill pins versions in `fetch-vendor.sh` or `vendor.txt`.
- Weaken a security check in a skill's code to make a demo work. Use the documented local switches (`DEV_MEMBER` on
  localhost, the mock Google server) instead.

## Map

```
README.md               what this is, the skill list with screenshots, install
CLAUDE.md               this file (AGENTS.md points here)
llms.txt                index for LLM tools (generated)
SECURITY.md             what is never committed, how secrets are handled
CONTRIBUTING.md         how a skill folder is built
docs/START-HERE.md      build playbook: intake → order → checks
docs/gallery.md         every screenshot in one page (generated)
skills/<name>/          SKILL.md · references/ · assets/ · screenshots/
tools/                  shoot.mjs (screenshots) · privacy-scan.sh · check-skills.mjs · make-index.mjs
.claude-plugin/         marketplace.json (install as a Claude Code plugin)
```

Talk to the user in their language; write files in English.
