---
name: team-project-playbook
description: Set up the working rules for a small team project (student team, lab, capstone) that shares one repo and one site and works with several Claude sessions. Use at the start of a team project, or when a team's repo, records or sessions start to drift.
---

# Team project playbook

The rules a three-person capstone team settled on over many rounds of "this is annoying, fix it". Each rule removed a real
source of friction: lost context between chat threads, two sessions editing the same file, a past week's log quietly
rewritten, a secret pasted into a repo, a phone layout nobody checked. Use this skill to start a new team project with
all of them in place on day one, and to explain *why* each one exists when someone asks.

The other skills in this repository build the site itself. This one sets up the people, sessions, repo and records
around it.

## When to use / when not to

- Use when a small team (2–8 people) starts a project that will have a shared repo, a shared calendar, weekly records,
  and Claude sessions doing much of the work.
- Use when an existing team project has the symptoms above.
- Not for a solo project (most rules are about who may edit what), and not for a large organisation with its own
  process (keep only the language, secrets and records rules).

## What you get

| Path | What it is |
|---|---|
| `assets/repo-template/` | A starting repo: `README.md`, `CLAUDE.md`, `AGENTS.md`, `CODEOWNERS`, `.gitignore`, `logs/README.md` with the week table and a log template, `research/README.md`, `references/README.md` + `papers.csv` header, the `record-lock` workflow stub |
| `assets/session-roles.md` | Ready-to-paste instructions for the four Claude session roles |
| `references/decisions.md` | Every decision, when it was made, why, and how it is enforced |
| `references/claude-sessions.md` | How the team ran several Claude threads without stepping on each other |
| `references/checklist.md` | The day-one checklist and the weekly checklist |

## Steps

1. **Pick the names once.** Project name, short name (≤ 12 characters, for the Home Screen), member ids (lowercase,
   never change them: file names depend on them), the team time zone, and the weekday the week starts on (the day of the
   regular meeting). Write them into `team.json` (see `shared-google-calendar`) and the repo README.
2. **Create one repo and one site.** Copy `assets/repo-template/`, fill the `{{…}}` placeholders, push to `main`, then
   protect `main` (see `references/decisions.md` → D7). Every piece of team work lives in this repo; the site is built
   from it. No second repo "for the site" and no shared drive "for the real files".
3. **Set the language rule** in `CLAUDE.md`: chat in the team's language; everything written into the repo in English,
   short plain sentences; technical terms and proper names stay in English even inside the team's language.
4. **Name the site owner.** One person and one Claude thread ("site lead") edit `site/`, `functions/`, `lib/`,
   `build.py`, `tools/`, `.github/`. Everyone else sends site changes to the site lead. Enforce with `CODEOWNERS` +
   a branch ruleset (needs GitHub Pro or a public repo).
5. **Set up the records.** Weekly logs, one file per person per week, the week table in `logs/README.md`, and the lock:
   a closed week is never edited (corrections go in this week's log). Use `weekly-research-log` for the CI check and the
   site tab.
6. **Set up the sessions** (if the team works through Claude): one coordinator that only forwards, one main session that
   holds the whole context and delegates, one site lead, one research session, feature threads only with a declared
   file list. Paste the role texts from `assets/session-roles.md`. Details: `references/claude-sessions.md`.
7. **Keep secrets out from the first commit.** The `.gitignore` in the template already excludes `.dev.vars*`, `.env*`,
   key JSON files and PDFs. Secrets live only in the host's environment variables (Cloudflare). The allow-list of who
   may sign in is a secret too.
8. **Build the site from the other skills**, in this order: `team-site-setup` → `team-site-design-system` →
   `google-signin-team-gate` → `shared-google-calendar` → `weekly-research-log` → `references-library` →
   `lecture-notes-reader` → `ios-webapp-push` → `first-visit-spotlight-guide` → `kakao-link-preview` →
   `scroll-3d-intro` (last; it is the most work and the least needed).
9. **Write decisions down the day they are made**, with the date and the reason, in the repo (`CLAUDE.md` for rules,
   `site/README.md` for site behaviour) and in the Claude project memory. A rule nobody can find gets broken.

## Rules

- One repo, one site, one owner of the site code. Others never edit site files directly.
- Never push to `main`. Branch → pull request → merge after the checks pass. The checks are the gate; the project owner
  does not have to review every PR.
- Everything in the repo is English. Chat is in the team's language. Terms stay English everywhere.
- A week runs from the meeting day to the day before the next meeting. A closed week is read-only, forever.
- Each person edits only their own log file. The week's scribe owns `team.md`.
- No passwords, keys, tokens, email addresses, phone numbers or chat screenshots in the repo or on the site. Anyone with
  the link may see the site.
- No paper or notice PDFs (copyright). Link DOIs instead.
- Mark guesses as guesses: reference notes end with `(verified)` or `(unverified)`.
- Numbers in the text come from scripts in `code/`, never from hand calculation. Assumed parameters go into an
  assumptions table with a reason.
- The shared calendar is the source of truth for dates. The site stores no events of its own.
- Anything Claude adds to the shared calendar is visibly Claude's (one grey colour, first line "Added by Claude",
  no invitations).

## Configuration

| Placeholder | Meaning | Example |
|---|---|---|
| `{{SITE_NAME}}` | project / site name | `Example Lab` |
| `{{REPO}}` | `owner/name` of the one repo | `example-org/example-lab` |
| `{{OWNER_LOGIN}}` | GitHub login of the site owner (CODEOWNERS) | `example-owner` |
| `{{TIMEZONE}}` | team time zone | `Asia/Seoul` |
| `{{WEEK_START}}` | weekday the week starts (the meeting day) | `Tuesday` |
| `{{FIRST_WEEK}}` | date of week 1's first day | `2026-12-22` |
| member ids | lowercase, permanent | `alex`, `blair`, `casey` |

## Self-check before you call the setup done

- [ ] `README.md` says what the project is, where the site is, and links `CLAUDE.md` for AI assistants.
- [ ] `CLAUDE.md` has the language rule, the site-owner rule, the never-list and the folder map.
- [ ] `main` is protected: a direct push is refused (try it).
- [ ] `git ls-files | grep -iE '\.pdf$|\.dev\.vars|service-account|\.env'` prints nothing.
- [ ] `logs/README.md` has the full week table for the whole project period.
- [ ] The record-lock check fails on a test commit that edits a closed week (see `weekly-research-log`).
- [ ] Every member can open the site on a phone at 375 px wide with nothing cut off.

## References

- [references/decisions.md](references/decisions.md): each decision with its reason and enforcement.
- [references/claude-sessions.md](references/claude-sessions.md): running several Claude threads on one project.
- [references/checklist.md](references/checklist.md): day-one and weekly checklists.

Origin: the NAND Capstone 2026 Winter team site.
