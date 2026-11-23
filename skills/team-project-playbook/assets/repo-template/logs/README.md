# logs — weekly logs

A chronological notebook. One meeting = one folder. The site's Research log tab shows each folder as a week tab.

```
logs/
  week01_MMDD/
    team.md        meeting notes: decisions, progress, to-dos — only that week's scribe edits it
    <member-id>.md personal log: what I did, what I learned, where I got stuck, next steps, links to results
```

## Rules

1. **Edit only your own file.** `team.md` is written by that week's scribe.
2. **A log records what you did and where the result is.** Derivations, figures and code go in `research/` or `code/`;
   link to them.
3. **Never edit a closed week.** Corrections go into this week's log as "Correction to week N: …".
4. Figures go in the same folder: `![caption](figure.png)`. Math as `$x$` or `$$…$$`.
5. Write in English.

## Weeks and closing times

A week runs **from {{WEEK_START}} to the day before the next meeting** ({{TIMEZONE}}). After that day's 24:00 the
folder is **closed**.

| Week | Folder | Dates | Closed from |
|---|---|---|---|
| Week 1 | `week01_MMDD` | {{WEEK1_DATES}} | {{WEEK1_CLOSE}} |
| … | | | |

Generate the full table with `weekly-research-log/assets/weeks.py` so it matches the lock check exactly.

## Template for a personal log

```markdown
# Week N — <your name>

## Done
- 

## Learned
- 

## Stuck on
- 

## Next
- 

## Links
- 
```
