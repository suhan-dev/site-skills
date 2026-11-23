# CLAUDE.md — rules for AI assistants

Read this first before working in this repository. The human guide is [README.md](README.md).

## 1. What this repository is

- The **only** repository of the {{SITE_NAME}} team ({{MEMBER_NAMES}}). There is exactly one site.
- Talk with the user in {{TEAM_LANGUAGE}}.
- **Write all documents and records in English**: READMEs, logs, notes, reports, file and folder names, commit messages,
  PR text. Short, plain sentences. Technical terms and proper names stay in English in every language.
- The site UI is English by default with a {{SECOND_LANGUAGE_CODE}} toggle. The intro, header and Calendar stay English.

## 2. Only the site owner's session edits the site

- `site/`, `functions/`, `lib/`, `build.py`, `tools/` and `.github/` are edited **only by the site lead session**.
  Other sessions never touch them. If the site needs a change, ask the site lead.
- Research content (`logs/`, `research/`, `references/`, `code/`, `report/`, `theory/`) may be written by any session,
  following the rules below.

## 3. Never

1. **No passwords, keys or tokens.** Secrets and the sign-in allow-list live only in the host's environment variables.
2. **No paper or notice PDFs.** Copyright. Put DOI links in `references/papers.csv`.
3. **Do not edit a closed week's log.** A week runs {{WEEK_START}} → the day before the next meeting ({{TIMEZONE}}).
   Put corrections in this week's log. (The `record-lock` check catches this.)
4. **Do not edit someone else's log.** `logs/weekNN_MMDD/<id>.md` belongs to that person. `team.md` belongs to the
   week's scribe.
5. **No personal information** (emails, phone numbers, chat screenshots). Anyone with the link can see the site.
6. **Mark guesses as guesses.** End reference descriptions with `(unverified)` or `(verified)`.
7. **Do not compute numbers by hand.** Numbers in the text come from scripts in `code/`. Assumed parameters go into the
   assumptions table of the topic README with a reason.
8. **Do not push to `main` directly.** Branch → PR.

## 4. Folder map

```
logs/        weekly logs. weekNN_MMDD/{team,<member ids>}.md
research/    topics. <topic>/README.md (consensus) · notes/MMDD_name_topic.md
references/  README.md (links) · papers.csv (papers) · notes/year-firstauthor-keyword.md
theory/      background chapters. sections.json · <part>/<label>-slug.md · <part>/figures/
code/        calculations and simulations. common/ · <topic>/ · results/
report/      final manuscript and slides
site/        site frame (HTML · CSS · JS) → build.py → dist/ (not committed)
functions/   Pages Functions (sign-in gate, calendar, notifications)
lib/         code shared by the functions
tools/       local test and check scripts
```

Member ids (file names) come from `site/data/team.json`.

## 5. Commits and PRs

- Commit message: one English line that says what changed and why.
- PR body: what changed and what was checked.
