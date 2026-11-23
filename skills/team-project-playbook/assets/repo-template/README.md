# {{SITE_NAME}} — team repository

Repository of our team ({{MEMBER_NAMES}}) for **{{PROJECT_TITLE}}**.

- Period: {{START_DATE}} – {{END_DATE}}, weekly meeting every {{WEEK_START}}.
- Team site: {{SITE_ORIGIN}}. Each member signs in with their own Google account; only the team gets in.
- All team work lives in this one repository and on that one site.
- Everything written in this repository (docs, logs, notes, commit messages) is in **English**.
- Using an AI assistant? Its rules are in [CLAUDE.md](CLAUDE.md) ([AGENTS.md](AGENTS.md) points there).

## Folders

```
logs/        weekly logs — weekNN_MMDD/team.md · <member-id>.md        → site "Research log"
research/    topic folders — <topic>/README.md (current consensus) · notes/
references/  paper list (papers.csv) · links · paper notes (no PDFs)   → site "References"
theory/      background chapters, one per file                         → site "Theory"
code/        calculations and simulations, with the figures they make
report/      final report and slides
site/ functions/ lib/ build.py tools/   the website — only the site owner edits these
```

## How to upload (for team members)

1. A **week** runs from {{WEEK_START}} to the day before the next meeting. The table and the lock rule are in
   [logs/README.md](logs/README.md).
2. Your log: site "Research log" → the week → your name → "Edit on GitHub". Edit on the GitHub page and press
   **Commit changes** (GitHub offers a branch and a pull request).
3. Figures, notes, code: **Add file → Upload files** into the right folder. Name notes `MMDD_name_topic.md`.
4. **Edit only your own files.** Never edit a closed week. Never touch the site files.
5. Add and edit events in the site calendar. They go straight into the shared Google Calendar.

## Site

Setup, deployment and local runs: [site/README.md](site/README.md). Keys, secrets and the sign-in allow-list are never
stored in the repository; they live in the host's environment variables.
