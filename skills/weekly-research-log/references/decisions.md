# Decisions: what was chosen, and what was tried and dropped

Pairs are **before → after**, with the source site's commit (short hash) where the change landed.

## The record

- **Logs live in the repository as Markdown, one file per person per week.** Not a database, not a shared document.
  Git keeps the history, GitHub's editor works on a phone, and the logs can be read without the site.
- **One file per person.** Three people can upload on the same evening without a merge conflict. The meeting notes
  (`team.md`) belong to that week's scribe for the same reason. This is a team rule, not a CI check: a per-person
  CODEOWNERS rule would need required reviews on every log, which is too heavy for three people. (The source site uses
  CODEOWNERS only for the site's own code.)
- **A log says what was done and where the result is.** Derivations, figures and code go in `research/` or `code/`, and
  the log links to them. Logs stay short and readable as a timeline.
- **Past weeks are not edited.** A lab notebook is trusted because it is not rewritten. A correction goes into this
  week's log ("Correction to week 2: …"), and the settled result goes into `research/`.

## The lock

| Before | After | Why | Where |
|---|---|---|---|
| (none) | A GitHub Action, `record-lock`, fails any push or pull request that touches a closed week's folder | A rule nobody checks is broken by accident; a red X is noticed before merging | 0fd3253 |
| (none) | The site hides "Edit on GitHub" and "Create from template" for closed weeks and shows "View on GitHub" and a lock | Don't offer a button that leads to a failing check | 0fd3253 |
| Fixed `+09:00` offset (`KST`) in the check | (this skill) the team's IANA zone from `team.json`, with `zoneinfo` | Any team, any zone, DST included | this skill |
| The week table in logs/README.md typed by hand | (this skill) `weeks.py` prints it with the same rule as the check | A hand-typed date that disagrees with the check is worse than no table | this skill |

The lock counts only the week number in the folder name (`week03_…`), so a wrong `MMDD` cannot reopen a closed week. A
week stays open through its whole last day, until 24:00 team time: the meeting is on the next day, and the scribe needs
the evening before it.

## Names

| Before | After | Why | Where |
|---|---|---|---|
| File and folder names in the team's own language (a Korean word for "week" plus the number, a Korean word for "team", members' names) | English: `weekNN_MMDD/`, `team.md`, and member ids from `team.json` (`alex.md`); the build still accepts a member's shown name as a file name | Ids never change and survive any keyboard, URL and shell; names can | 0fd3253 → 70c24b2 |
| – | `weekNN_MMDD`: two-digit number, then the first day's month and day | Sorts in order, and the date shows in GitHub's file list; the build and the check also accept `weekN` | 0fd3253 |

## Look

| Before | After | Why | Where |
|---|---|---|---|
| Week tabs with rounded tops and a filled background on the chosen tab, dates in a monospace font | Apple-style segmented track (a `--fill` track, a white knob) | The new site style | f8aa765 |
| The segmented track | Plain tabs on a hairline with a 2 px `--ink` underline under the chosen week | Ten weeks in a segmented control looked like buttons; an underline reads as navigation, like the header tabs | 23b4244 |
| Team notes and personal logs in rounded white cards with shadows (`radius 18`, `--lift`) | No boxes: a hairline on top of each column and under each head, gap 44 between the columns | Less chrome around long text; the same rule as the rest of the site | 23b4244 |
| A serif week title | The site's sans title (24 / 700) with the meeting title in `--ink3` | One type family | f8aa765 |
| Small tap targets on phones; the week strip cut off without a hint | 44 px tabs and links; the strip fades at the right edge while more weeks are hidden; the week head stacks | Phone use, and showing that the strip scrolls | 9c73ae8 |
| Phone page head: the eyebrow, the title, then a full-size GitHub button on its own row | The GitHub link small on the eyebrow's line, the title a size down (23 px) | The head took a third of the screen | 853406c |
| Desktop: the two column heads had different heights, the "has entries" dot floated in the tab's corner, the table summary had the browser's ▸ | Both heads 48 px so their rules line up; the dot right after the week's name; a `›` that turns when open; a log's `h1` 19 px inside its card | Alignment polish; phones unchanged | f4f56e2 |
| "This week" added by CSS (`::after` text) | A real `<em>` in the tab | Translatable, and screen readers read it | f8aa765 |

## Rejected

- **Editing logs inside the site.** It would need write access to GitHub from the server, a merge story, and a second
  editor. GitHub's own editor (one link away) already does this, with history.
- **One shared weekly document.** Conflicts, and nobody knows who wrote what.
- **Locking by branch protection on folders.** GitHub has no per-folder write lock; the Action is the simplest check.
- **Hiding closed weeks.** They are the record; they stay readable, only their edit links go.
