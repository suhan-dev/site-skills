# logs — weekly logs

A chronological notebook. One meeting = one folder. The site's Research log tab shows each folder as a week tab.

```
logs/
  week01_MMDD/
    team.md        meeting notes: decisions, progress, to-dos — only that week's scribe edits it
    <member-id>.md personal log: what I did, what I learned, where I got stuck, next steps, links to results
    figure.png     figures for the logs of that week (embed with ![caption](figure.png))
  week02_MMDD/
  …
```

File names are the member ids in `site/data/team.json` ({{MEMBER_IDS}}).

## Rules

1. **Edit only your own file.** Everyone can upload on the same day without conflicts. `team.md` is written by that
   week's scribe.
2. **A log records what you did and where the result is.** Derivations, figures and code go in `research/` or `code/`;
   link to them.
3. **Never edit a closed week.** Put corrections in this week's log as "Correction to week N: …".
4. Figures go in the same folder: `![caption](figure.png)`. Math as `$x$` or `$$…$$`.
5. Write in English.

## Weeks and closing times

A week runs **{{WEEK_START}} → the day before the next {{WEEK_START}}** ({{TIMEZONE}}). After that last day's 24:00 the
folder is **closed**: the site hides its edit links, and the `record-lock` check on GitHub marks any commit or pull
request that edits it with a red X.

<!-- Paste the output of: python3 tools/weeks.py --team site/data/team.json -->
{{WEEK_TABLE}}

## Starting a new week

On the site's Research log tab, pick the week and press **Create from template**. GitHub's new-file page opens with the
folder name and the template filled in. Folder names are `weekNN_MMDD`: the two-digit week number and the month and day
of the week's first day (the table above).
