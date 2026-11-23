# Checklists

## Day one

- [ ] Project name, short name (≤ 12 characters), member ids, time zone, week start day decided and written in `team.json`.
- [ ] Repo created from `assets/repo-template/`, placeholders filled, pushed.
- [ ] `main` protected (ruleset: require PR, block force pushes; code-owner review for the site paths).
- [ ] `CODEOWNERS` names the site owner.
- [ ] Teammates invited with Write access (they must accept the invitation).
- [ ] Host project (Cloudflare Pages) connected to the repo, production branch `main`, preview builds off.
- [ ] Shared Google Calendar created and shared with every member and the service account.
- [ ] Sign-in allow-list set in the host's secret variables.
- [ ] `logs/README.md` week table written for the whole project period.
- [ ] Claude project memory: people, rules, site facts, routing rule.

## Every week (the meeting day)

- [ ] Last week is closed: nobody edits it any more (the CI check enforces it).
- [ ] This week's folder exists with one file per member and `team.md` for the scribe.
- [ ] Decisions made at the meeting written into `team.md` and, if they are rules, into `CLAUDE.md`.
- [ ] Calendar has the next meeting and any deadlines.

## Before every merge to `main`

- [ ] Build check passes.
- [ ] Offline tests pass.
- [ ] Screenshots at 1440 and 390 px, light and dark, look right.
- [ ] No secret, address or PDF in the diff.
