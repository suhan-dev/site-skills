# Setup: the lock check on GitHub, branch rules, and the build

No secrets and no console besides GitHub. About 10 minutes. You need admin rights on the repository.

## 1. Put the files in the repository

| From `assets/` | To the repository |
|---|---|
| `.github/workflows/record-lock.yml` | `.github/workflows/record-lock.yml` |
| `tools/check_record_lock.py`, `tools/test_records.py` | `tools/` |
| `weeks.py` | `tools/weeks.py` |
| `build_records.py` | next to `build.py` (repository root) |
| `logs/README.md` | `logs/README.md` (fill the placeholders, paste the week table) |
| `site/js/records.js`, `rec-util.js`, `rec-strings.js`, `md.js` | `site/js/` |
| `site/css/records.css` | `site/css/` |

Add to `site/data/team.json` (the shape from team-site-setup):

```json
"program": { "start": "{{START_DATE}}", "end": "{{END_DATE}}", "timeZone": "{{TIMEZONE}}" }
```

- `start`: the first day of week 1 (the meeting day). Its weekday is the start day of every week.
- `end` (or `"weeks": 10` instead): the last program day; the number of weeks is counted from it.
- `timeZone`: the team's IANA zone (`Asia/Seoul`, `Europe/Berlin` …). The lock check, the build and the page all read
  it from here, so there is one place to change.

## 2. Make the week table

```bash
python3 tools/weeks.py --team site/data/team.json
```

Paste the output into `logs/README.md` in place of `{{WEEK_TABLE}}`. Run it again if the dates change; never type the
table by hand.

## 3. Turn on GitHub Actions

1. GitHub → the repository → **Settings** → **Actions** → **General**.
2. **Actions permissions:** "Allow all actions and reusable workflows" (or at least GitHub's own `actions/*`).
3. **Workflow permissions:** "Read repository contents and packages permissions" is enough. Save.
4. Push the workflow file (in a pull request, like any change). It runs only when something under `logs/` changes.

## 4. Protect `main`

So a red X actually stops a merge.

1. **Settings** → **Rules** → **Rulesets** → **New ruleset** → **New branch ruleset**.
2. **Ruleset name:** `main`. **Enforcement status:** Active.
3. **Target branches:** **Add target** → **Include default branch**.
4. Rules to tick:
   - **Restrict deletions** and **Block force pushes**.
   - **Require a pull request before merging** (required approvals: 0 for a small team, or 1).
   - **Require status checks to pass** → **Add checks** → type `check` (the job name in `record-lock.yml`; it appears
     in the list after the workflow has run once) → add it. Leave "Require branches to be up to date" off.
5. **Create**.

Older repositories show **Branches → Add branch protection rule** instead; the same boxes are there.

Because the workflow only runs when `logs/` changes, GitHub would wait forever for the `check` status on a pull request
that touches no log. If that happens, either untick the required check and rely on the red X, or remove the `paths:`
filter from the workflow so it always runs (it takes a few seconds).

## 5. Check that it works

1. On a branch, change a line in a **closed** week's log (any week whose last day has passed). Open a pull request.
2. The `record-lock` check turns red with: "A closed week's log was edited. Do not edit past logs; write corrections
   in this week's log." and the file and the day the week closed.
3. Close the pull request without merging. Delete the branch.
4. Change this week's own log in another pull request: the check is green.

To try it before any week has closed, run it locally with a pretend day:

```bash
echo "logs/week01_0105/alex.md" | python3 tools/check_record_lock.py --today 2099-01-01   # exits 1
python3 tools/test_records.py                                                             # all pass
```

## 6. The build

In `build.py` (team-site-setup's skeleton):

```python
from build_records import records
STEPS = {"build": build_info, "records": records}
IMAGE_DIRS = [ROOT / "logs"]   # figures in logs are copied to dist/repo/logs/… for md.js
MUST += ["data/records.json", "js/records.js", "css/records.css", "vendor/marked/marked.esm.js"]
```

And the libraries for Markdown and math (not committed): `bash fetch-vendor.sh site` writes `site/vendor/marked/` and
`site/vendor/katex/`. Add `site/vendor/` to `.gitignore` and run the same line in the Cloudflare build command
(`bash tools/fetch-vendor.sh site && python3 build.py`), or commit the vendor folder if the team prefers (the source
site did; both are fine, the licence files travel with them).

## Common problems

| What you see | Cause | Fix |
|---|---|---|
| `record-lock: add "timeZone" …` | `program.timeZone` missing in team.json | add it (step 1) |
| The check never runs | Actions off, or the change is outside `logs/` | step 3; it is meant to skip other changes |
| A pull request waits for `check` forever | required check + the `paths:` filter | step 4, last paragraph |
| The check fails on a week that should be open | `program.start` is not week 1's first day, or the zone is wrong | fix team.json; run `weeks.py --team …` and compare |
| The check passes on a closed week | the folder name has no week number (`logs/kickoff/`) | keep `weekNN_MMDD` names; other folders are not locked |
| The site shows "Couldn't load the logs" | `records` step missing in build.py | step 6 |
| Math shows as `$…$` | KaTeX not in `site/vendor/katex/` | step 6, fetch-vendor.sh |
| Images missing in a log | `IMAGE_DIRS` without `logs` | step 6 |
| `zoneinfo` error on Windows | no time-zone database | `pip install tzdata` (GitHub's runner and macOS have it) |
