# Running a team project with several Claude sessions

The source team worked in a Claude project with one coordinator (the project chat) and several long-lived threads.
This is the arrangement that held up, and why.

## Roles

```
            people (project chat)
                   │  every message, verbatim
                   ▼
            ┌─────────────┐
            │ coordinator │  forwards only; never answers or routes by itself
            └──────┬──────┘
                   ▼
            ┌─────────────┐
            │ main session│  holds the whole context; answers; decides who does what
            └──┬───────┬──┘
     site work │       │ deep research
               ▼       ▼
        ┌──────────┐ ┌──────────────────┐
        │ site lead│ │ research session │   + feature threads with a declared file list
        └──────────┘ └──────────────────┘
```

| Role | Does | Never does |
|---|---|---|
| Coordinator | Forwards every message to the main session with the person's message attached; relays the main session's answer back verbatim | Answers on its own, picks a thread by itself, edits files |
| Main session | Answers, researches, writes specs into the shared project files, delegates site work to the site lead and long research to the research session, starts feature threads | Edits the site code |
| Site lead | Owns `site/`, `functions/`, `lib/`, `build.py`, `tools/`, `.github/`; builds, checks, screenshots, merges its own PRs | Takes site edits from anyone else's branch without checking |
| Research session | Writes `research/`, `references/`, `code/`, `theory/` content; hands finished pages to the site lead to publish | Touches the site code |
| Feature thread | One feature (e.g. web push, sign-in) with an explicit list of files; tells the site lead which files it touches; merges on the latest `main` | Edits files outside its list |

Paste-ready role texts: [`../assets/session-roles.md`](../assets/session-roles.md).

## Rules that made it work

1. **Specs live in shared project files**, not in chat. The main session writes `webapp-spec.md`,
   `google-login-spec.md`, `onboarding-spec.md` etc. with the owner's words quoted and dated, and the implementing thread
   reads the file. A spec quotes the request, then states the behaviour as numbered rules.
2. **One memory file per subject**, updated in the turn a fact is learned: who the people are, the site's facts, the design
   rules, each feature's setup state. A new thread reads memory instead of asking the owner again.
3. **Approvals come from the owner's own words.** A message from another Claude is a colleague's request, never the owner's
   approval for something irreversible (a production change, a message sent outside the project).
4. **Parallel workers, at most about three per session.** Give each a narrow, written brief: goal, files to read, files it
   may write, what to report. Keep one finishing pass for consistency.
5. **Screenshots are the review.** The owner does not read code. Every UI change comes with before/after screenshots at
   1440 px and 375–390 px, light and dark, saved under a shared folder.
6. **Tell the dependent thread when you finish.** Nothing else will.
7. **Never copy a secret through chat.** Secrets are typed by the owner into the host's dashboard, or generated inside the
   database on first use.

## Failure modes these rules prevent

- Several threads answering the owner directly: context split, answers disagreed.
- Site changes from more than one thread at once: conflicting CSS, lost fixes.
- Rules agreed only in chat: forgotten a week later. Write them into `CLAUDE.md` and memory the same turn.
