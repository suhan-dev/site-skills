# Decisions, with their reasons

Each entry: the decision, why it was made (the problem it fixed), and how it is enforced. "Enforced by" matters most:
a rule that only lives in a chat log does not survive a week. A reason marked *(inferred)* was not stated by the team
at the time; it is the most likely reason, written down so the rule is not dropped by accident.

---

## Repo and site

### D1. One repo, one site
- **Decision.** All team work (logs, research notes, references, code, theory, the report, the site) lives in one
  repo, and the site is built from it. One site address for everything.
- **Why.** The owner wanted a single place for all team work, shared with teammates by one link. One repo means one
  history, one search, one place to link; a second place always ends up out of date.
- **Enforced by.** The README's first lines; `CLAUDE.md` §1 ("the only repository"); the site builds its Research log,
  References and Theory tabs straight from the repo folders, so content outside the repo does not show up anywhere.

### D2. Only the site lead edits the site
- **Decision.** `site/`, `functions/`, `lib/`, `build.py`, `tools/`, `.github/` are edited only by the site owner's
  thread. Other threads and teammates send site changes to it. A feature thread may get a temporary exception for a
  declared list of files (the web-app/push thread did), and it tells the site lead which files it touches and merges on
  the latest `main`.
- **Why.** With teammates and several sessions all uploading, the owner wanted one owner for the site so its look
  stays consistent and nothing is overwritten. Two sessions editing the same stylesheet at once is the failure this
  prevents.
- **Enforced by.** `CLAUDE.md` §2; `.github/CODEOWNERS` naming the owner for those paths; a branch ruleset with
  "Require review from Code Owners" (private repos need GitHub Pro for this).

### D3. Research content is open to every session
- **Decision.** `logs/`, `research/`, `references/`, `code/`, `report/` may be written by any session, following the
  records rules.
- **Why.** Research must not queue behind the site lead.
- **Enforced by.** `CLAUDE.md` §2 second bullet; the record-lock check covers the one thing that must not happen there.

### D4. Folder map: chronological logs apart from topic conclusions
- **Decision.** `logs/` is the diary (what we did each week); `research/stepN-…/README.md` holds the current team
  consensus per topic; `references/` holds the paper list and notes; `code/` makes every number and figure.
- **Why.** Following Noble 2009 ("A Quick Guide to Organizing Computational Biology Projects") and Wilson et al. 2017
  ("Good Enough Practices in Scientific Computing"): a diary is never rewritten, conclusions are. Mixing them makes both
  useless.
- **Enforced by.** The folder map in `CLAUDE.md` §4 and the README; the site shows them as separate tabs.

### D5. Names that never change
- **Decision.** Member ids are lowercase and permanent (`logs/weekNN_MMDD/<id>.md`). Notes are named
  `MMDD_name_topic.md`; reference notes `year-firstauthor-keyword.md`.
- **Why.** File names are the join key between the repo, the site and the calendar colours. Renaming breaks links.
- **Enforced by.** `team.json` is the single list of ids; the site reads it.

---

## Language

### D6. Repo in English, chat in the team's language, terms in English everywhere
- **Decision.** Everything written into the repo (READMEs, logs, notes, reports, file and folder names, commit
  messages, PR text) is English, in short, plain sentences. The team chats in its own language (Korean). Technical terms
  and proper names stay in English even inside Korean text (Program, Erase, Retention, company names).
- **Why.** The field's papers, tools and terms are English; a translated term is ambiguous and hard to search
  *(inferred)*. English files are also what LLM tools and outside readers read best. Short sentences help the members who
  read English as a second language.
- **Enforced by.** `CLAUDE.md` §1 and `AGENTS.md`; the first folder rename PR moved every Korean folder name to English.

### D7. Site UI English by default, with a KO toggle
- **Decision.** The site is English by default with a KO toggle. The intro, sign-in, header and Calendar stay English
  even in KO mode; KO switches the content tabs. Terms and names stay English in both.
- **Why.** The owner set the entry screens and the main screen to stay English. They are glanced at, not read, so a
  second language there adds testing without helping anyone *(inferred)*.
- **Enforced by.** `data-lang-fixed` on those sections; `i18n.js` keeps the two string tables side by side.

---

## Git and deployment

### D8. Never push to `main`
- **Decision.** Branch → PR → merge. The site lead merges its own PRs after its checks pass; the project owner does not
  review PRs.
- **Why.** The owner wanted speed and did not want to review code. The checks (build check, record lock, offline tests,
  screenshots at every width) replace human review; `main` protection stops accidents.
- **Enforced by.** Branch ruleset "Require a pull request before merging" (0 approvals) + "Block force pushes". Teammates
  using the GitHub web editor get "create a branch and PR" offered automatically.

### D9. `main` is production; no preview builds
- **Decision.** Cloudflare Pages deploys `main` automatically. Preview builds are turned off (Branch control → Preview
  branch: None).
- **Why.** Only `main` is the site; every branch push building its own copy online added builds to watch and
  half-finished copies of the site to keep track of *(inferred)*.
- **Enforced by.** The Pages project setting.

---

## Records

### D10. A week runs from the meeting day to the day before the next meeting
- **Decision.** Weeks run Tuesday → next Monday in the team time zone, because the weekly meeting is on Tuesday. Week 1
  starts on the first meeting day. The full week table is written once in `logs/README.md`.
- **Why.** The weekly meeting is the natural boundary: the log for a week covers what was done between two meetings.
  A calendar week (Monday–Sunday) would split one meeting's work across two logs *(inferred)*.
- **Enforced by.** The week table; the site computes "this week" from the same rule.

### D11. A closed week is never edited
- **Decision.** After the week's last day ends (24:00), its files are read-only. A correction goes into the current
  week's log ("Correction to week 3: …").
- **Why.** The log is the honest record of what the team knew when. If old weeks can be quietly edited, the history
  cannot be trusted, and a later week cannot cite an earlier one.
- **Enforced by.** The `record-lock` GitHub Action fails any push or PR that touches a closed week's files; the site
  hides "Edit on GitHub" for closed weeks. (`weekly-research-log`.)

### D12. Each person edits only their own file
- **Decision.** `logs/weekNN_MMDD/<id>.md` belongs to that member; `team.md` belongs to the week's scribe.
- **Why.** No merge conflicts, and every line has an author.
- **Enforced by.** `CLAUDE.md` §3; the site's edit links go only to your own file.

### D13. Mark guesses; compute numbers
- **Decision.** Reference descriptions end with `(verified)` or `(unverified)`. Numbers in text come from scripts in
  `code/`; assumed parameters go into the step's assumptions table with a reason.
- **Why.** AI-written summaries sounded certain whether or not they were; hand-computed numbers drifted from the code.
- **Enforced by.** `CLAUDE.md` §3; reviewers (and Claude) reject a number with no script behind it.

### D14. No PDFs
- **Decision.** Never commit paper or notice PDFs. Put DOI links in `references/papers.csv`.
- **Why.** Copyright, and the repo stays small.
- **Enforced by.** `*.pdf` in `.gitignore`.

---

## Privacy and secrets

### D15. Secrets only in the host's environment
- **Decision.** Service-account keys, the sign-in allow-list, client secrets and tick secrets live only in Cloudflare
  environment variables or are generated inside the database on first use. Nothing secret is ever typed into the repo,
  a chat, a log or a screenshot.
- **Why.** The repo is shared with teammates and tools; the site is reachable by link.
- **Enforced by.** `.gitignore` (`.dev.vars*`, `.env*`, `*.key.json`, `service-account*.json`); `CLAUDE.md` §3; a
  privacy scan before pushes.

### D16. No personal information on the site
- **Decision.** No email addresses, phone numbers or chat screenshots anywhere on the site or in the repo. The site
  identifies people by member id; `/api/me` returns the id, never the address. Notification text never includes notes,
  places or addresses.
- **Why.** Anyone with the link can see the site; notifications show on lock screens.
- **Enforced by.** `CLAUDE.md` §3; the server code never sends addresses to the page.

---

## Sign-in

### D17. Google accounts on an allow-list, no shared password
- **Decision.** Each member signs in with their own Google account; only addresses on the allow-list get in. No shared
  password, no approval flow, no "Who are you?" picker.
- **Why.** The owner wanted the same kind of sign-in as an earlier project's admin page: each person's own school
  account, nothing to type. A shared password cannot be revoked for one person and cannot tell the site who is
  signed in; Google sign-in gives the member id for free, so "added by" on events and the owner of a notification
  device are set by the server. An approval flow was considered and dropped: the team is three fixed people.
- **Enforced by.** `google-signin-team-gate`; adding a person is an environment-variable change, not a code change.

### D18. Stay signed in for 180 days, everywhere
- **Decision.** 180-day sessions in the browser and in the Home Screen app alike, no "remember me" checkbox. Sign out
  ends it.
- **Why.** The owner first chose "stay signed in in the installed app only", then changed it the same afternoon to the
  browser and the app alike: teammates open the site both from chat links and from the Home Screen, and a sign-in
  wall on either is friction for a three-person private site.
- **Enforced by.** `SESSION_DAYS` in the auth library.

---

## Calendar and notifications

### D19. The shared Google Calendar is the source of truth
- **Decision.** Events live in one shared Google Calendar; the site reads and writes it through a service account and
  stores nothing itself. Teammates may also edit in Google Calendar; changes show on the site within a minute.
- **Why.** Everyone already has Google Calendar on their phone, with its own reminders; a site-only calendar would be one
  more place to check *(inferred)*. Keeping no copy on the site also means nothing to sync or back up.
- **Enforced by.** `shared-google-calendar`.

### D20. A day runs 07:00 → 07:00
- **Decision.** In the week and month views a calendar day runs from 07:00 to 07:00 the next morning. Event times are
  unchanged.
- **Why.** Late-night work sessions (to 01:00–02:00) were split across two days and looked like two events.
- **Enforced by.** `DAY0` in `calendar.js`.

### D21. Claude's calendar entries are visibly Claude's
- **Decision.** Events Claude adds use one grey colour (Google colorId 8, Graphite), start their description with
  "Added by Claude", and invite nobody.
- **Why.** Teammates must be able to tell a human commitment from an AI suggestion at a glance, and must never get
  invitation mail from a bot.
- **Enforced by.** The coordinator's standing instruction in project memory.

### D22. Two notification kinds, on by default
- **Decision.** Only "New event" and "In 30 minutes". Both on by default per device; each device keeps its own two
  switches. The member who added an event is not notified of it. Deploys never notify.
- **Why.** The owner chose these two. A notification must mean "something changed that you did not do", so the adder is
  skipped, and the first run after a deploy only records the events that already exist; otherwise every deploy would
  announce the whole calendar.
- **Enforced by.** `ios-webapp-push` (syncToken baseline, adder skip).

---

## Design

### D23. Restrained, Apple-like, no boxes
- **Decision.** System colours, no neon, no bloom; document layout with hairlines instead of cards and borders; soft
  grey dark mode (#1c1c1e), not pure black; no helper text that only repeats the obvious; a label and its number never
  break apart.
- **Why.** The first deployed look was judged "graphically poor"; boxes and colour made it look like a template.
- **Enforced by.** `team-site-design-system`; screenshots in light and dark at every width before each merge.

### D24. Phones are first-class
- **Decision.** Every tab works at 375 px with nothing cut off; 44 px tap targets; dialogs become bottom sheets; the
  calendar fits one screen; no zoom when upright; checked inside the KakaoTalk in-app browser too.
- **Why.** Teammates open the site from a phone, through chat links, and the owner kept finding phone screens awkward
  ("lots of things") and asked for every tab to be audited at 375 px.
- **Enforced by.** Screenshots at 375–430 px for every change.

### D25. Sign-in first, then the intro, desktop only
- **Decision.** The sign-in screen comes first; its background is the intro's first frame, so after sign-in the intro
  continues from the same picture. Phones skip the intro and open on the calendar. The intro is shown once per tab;
  clicking the site name replays it.
- **Why.** The owner decided phones get no intro: a heavy 3D scene costs a phone time and battery for little gain
  *(inferred)*. Sign-in and intro were made one continuous scene so the entry feels like one piece instead of a form
  followed by a different picture.
- **Enforced by.** `scroll-3d-intro` and `google-signin-team-gate`.

### D26. Quality bar for visuals
- **Decision.** Real 3D with physically based materials, depth of field and fog. Anything that "looks hand-drawn" or
  like "flat CG blocks" is rejected.
- **Why.** The team's earlier project set the bar; line-drawn concepts were tried and turned down.
- **Enforced by.** Frame-by-frame review of stills before merging (`scroll-3d-intro`).

### D27. Onboarding once per member, never forced on the owner
- **Decision.** A spotlight tour shows once per member after their first sign-in, after the Home Screen pop-up. The
  project owner never gets it automatically. It can be reopened from the name menu.
- **Why.** Teammates had to learn a few non-obvious things (the calendar is the shared Google Calendar linked to their
  school account; where to write their log). The owner built the site and needs no tour.
- **Enforced by.** `first-visit-spotlight-guide` ("seen" kept in the browser and in the database).

---

## Working with Claude

### D28. One main session holds the context
- **Decision.** The coordinator forwards every message to one main session and relays its answers verbatim. Only the
  main session decides what goes to the site lead, the research session, or a new feature thread.
- **Why.** The owner wanted one session to hold the whole conversation context instead of it being split across
  threads. Threads that each answer directly drift apart.
- **Enforced by.** Project memory routing rule; see `claude-sessions.md`.

### D29. Up to three parallel workers per session
- **Decision.** Any session may split its work into up to about three parallel sub-agents.
- **Why.** The owner wanted speed. Three keeps the results few enough for the session to check each one.
- **Enforced by.** Project memory.

### D30. Decisions are saved the day they are made
- **Decision.** A decision goes into the repo docs (rules in `CLAUDE.md`, behaviour in `site/README.md`) and into the
  project memory with the date and the reason, in the same turn it is made.
- **Why.** Threads end; a new thread that has to re-ask the owner wastes their time.
- **Enforced by.** Habit, and the memory files being one per subject.
