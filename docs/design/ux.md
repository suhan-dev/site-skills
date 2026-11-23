# UX: journeys, states, words, keyboard

How the site behaves for the people who use it. This page covers every skill. It answers four questions: what a
person sees at each step, what the site does in reply, what each screen says when it is empty, loading, broken or
locked, and how it works from a keyboard, a screen reader and a phone.

Everything here comes from the code and the skill docs in this repository, and each claim cites its source. Where the
code does not handle a case, this page says **not handled**. It does not guess. Example data uses the placeholder
team: Alex, Blair and Casey of "Example Lab".

Related pages: [tokens.md](tokens.md) (values), [motion.md](motion.md) (every transition),
[components.md](components.md) (control states), [screens.md](screens.md) (screenshots), and
[team-site-design-system/references/mobile.md](../../skills/team-site-design-system/references/mobile.md) (phones).

## How to read the citations

Paths are shortened. `file:12` means line 12 and `file:12-20` means lines 12 to 20.

| Short | Full path |
|---|---|
| `ds/` | `skills/team-site-design-system/assets/` |
| `gate/` | `skills/google-signin-team-gate/assets/` |
| `cal/` | `skills/shared-google-calendar/assets/site/` |
| `log/` | `skills/weekly-research-log/assets/` |
| `refs/` | `skills/references-library/assets/` |
| `notes/` | `skills/lecture-notes-reader/assets/site/` |
| `chat/` | `skills/team-chat/assets/site/` |
| `push/` | `skills/ios-webapp-push/assets/` |
| `guide/` | `skills/first-visit-spotlight-guide/assets/` |
| `intro/` | `skills/scroll-3d-intro/assets/` |
| `og/` | `skills/kakao-link-preview/assets/` |

A doc is cited by skill name, for example `team-site-design-system/references/decisions.md:9`, meaning
`skills/team-site-design-system/references/decisions.md`, line 9.

## Contents

1. [Principles](#1-principles)
2. [Journeys](#2-journeys)
3. [States, per screen](#3-states-per-screen)
4. [Wording rules](#4-wording-rules)
5. [Keyboard and accessibility](#5-keyboard-and-accessibility)
6. [Phones](#6-phones)
7. [Feedback and timing](#7-feedback-and-timing)
8. [Not handled, and where docs and code differ](#8-not-handled-and-where-docs-and-code-differ)

---

## 1. Principles

These rules shape every screen. Each reason is the one the repository gives.

| Rule | What it means on screen | Why (the repo's words) | Source |
|---|---|---|---|
| A calm document, not a dashboard | Hairlines and space instead of boxes. No KPI tiles, no progress bars. | "Boxes made the site look like a template; hairlines read as a calm document." Status dashboards on the home page were rejected. | `team-site-design-system/references/decisions.md:9`, `:26` |
| The schedule comes first | The calendar sits right under the header. Phones skip the 3D intro and open on the calendar. | The home band "pushed the calendar below the fold and repeated what the calendar shows." "On a phone the visitor wants the schedule now." | `team-site-design-system/references/decisions.md:11`; `scroll-3d-intro/references/decisions.md:18` |
| One source of truth | Events live only in Google Calendar. Edits made in Google show on the site within a minute. | "A second store would have to be kept in sync and would drift." | `shared-google-calendar/references/decisions.md:9-11` |
| The server knows who you are | No "Who are you?" picker. "Added by" comes from the sign-in session. | "A page-supplied name can be faked; the session cannot." | `team-site-design-system/references/decisions.md:28`; `shared-google-calendar/references/decisions.md:15-16` |
| Few words | Labels are one to three words. No helper text that repeats the label. Empty states say what to do, once. | Helper text "that only repeats the label" was rejected. | `team-site-design-system/SKILL.md:74`; `references/language.md:34-38`; `references/decisions.md:29` |
| Phones are first-class | 44 px tap areas, bottom sheets, 16 px inputs, room for the home indicator, a page that never slides behind a sheet. | 44 px is "Apple's HIG minimum; teammates use phones." Centred dialogs: "The event editor was unusable on iPhone." The page sliding behind a sheet "felt broken." | `team-site-design-system/references/decisions.md:14`, `:15`, `:19` |
| English first, Korean one tap away | The header, intro, sign-in and Calendar tab stay English. The chat and the bell sheet switch. Terms stay English in both. | The rules "kept the two from drifting apart." | `team-site-design-system/references/language.md:3-15` |
| Motion is short and optional | 150 ms colour, 220 ms dialog, 320 ms sheet. Reduced motion removes them. "Nothing bounces, nothing pulses." | (stated as a rule, no reason given) | `team-site-design-system/SKILL.md:77-78`; `references/design.md:235-240` |
| Records are kept as written | A closed week stays readable. Its edit links go away. | "A lab notebook is trusted because it is not rewritten." Closed weeks "are the record; they stay readable." | `weekly-research-log/references/decisions.md:15`, `:57` |
| Ask once, at the right moment | The install pop-up shows once per member. The guide shows once per member. Notification permission is asked only from a tap. | "Steps inside a sheet are seen only by people who already look for them … a second device does not nag." | `ios-webapp-push/references/decisions.md:18`; `ios-webapp-push/SKILL.md:79-80` |
| Don't flood people | A deploy sends nothing. More than 3 new events become one summary. A series counts once. | "A deploy must never flood the team." "Ten buzzes in a row teach people to turn notifications off." | `ios-webapp-push/references/decisions.md:12-14` |
| A lock screen is public | A notification shows a title, the day, the time and the event title. It never shows a place, a note or a name. | "No location, notes or names: a lock screen is public." | `push/lib/push.js:155`; `ios-webapp-push/SKILL.md:84-85` |
| Nobody's text runs as code | Chat messages are set with `textContent`. Links are built as nodes. | "Nothing typed by a member can run as code in a teammate's browser." | `team-chat/references/decisions.md:27` |

---

## 2. Journeys

Each journey is a table. "Sees" is the screen. "Site does" is the code's reply. "Where" is the file that does it.

### 2.1 First visit on a laptop

Sign-in → intro → calendar → guide.

| # | Sees | Site does | Where |
|---|---|---|---|
| 1 | Opens the link. A dark full-screen poster with one grey pill: **Sign in with Google**. | No session, and this is a page load, so the gate answers with the sign-in page (status 200). It remembers the address asked for as `next`. | `gate/functions/_middleware.js:241-247`, `:147` |
| 2 | Clicks the pill. It fades to half opacity and stops taking clicks. | Clears `intro_seen` and, when `next` is `/`, sets `intro_arrive` so the intro starts from this same picture. | `_middleware.js:171-175`; CSS `.pill.go` at `:123` |
| 3 | Google's account chooser. | Google posts back (form_post). **Cancel** returns to the plain page with no message ("Cancel is not an error"). | `_middleware.js:268`; `google-signin-team-gate/references/decisions.md:42` |
| 4a | Refused: one red line, "This site is for the Example Lab team only." | Not on `ALLOWED_EMAILS`, not verified, or a new Google account reusing a member's address. Status 403. The line never says which. | `_middleware.js:46`, `:273-275`; `google-signin-team-gate/references/design.md:100` |
| 4b | Token problem: "Couldn't sign in. Try again." | Checks 1–7 failed (state, signature, issuer, audience, time, nonce). Status 403. | `_middleware.js:47`, `:275`; `google-signin-team-gate/references/security.md:56` |
| 5 | Signed in. Back at the address they first asked for. | Starts a session for 180 days, counted from sign-in. Redirects (303) to `next`. | `gate/lib/auth.js:18`, `:178-190`; `_middleware.js:277-280` |
| 6 | The intro: the dim lifts over 0.7 s and the site name rises. Scrolling drives a 3D story. **Skip** is at top right, with small scene dots. | A script in `<head>` decides before the first paint. The intro shows only at `/`, with no `#hash`, no `?date=` or `?event=`, not on a phone, and once per browser tab. | `intro/intro-markup.html:11-18`; `google-signin-team-gate/references/design.md:131` |
| 7 | At the end (or on Skip) the picture fades into the site, on the Calendar tab. | Sets `intro_seen`, fires `intro:done`, and swallows wheel and touch moves until they stop (at most 1.5 s), so the momentum does not scroll the page. | `intro/intro.js:168-188` |
| 8 | 0.4 s later, the first-visit guide. The page dims and a spotlight moves from one part to the next (in the demo: the calendar, "New event", the tabs, the header buttons). A panel shows "Welcome, Alex", text, **Skip**, **Back** and **Next**. | `firstVisit()`: no install offer on a laptop, so it calls `guide.picked(member)`. That starts after 400 ms, unless this browser or the server (`seen.guide`) says it was shown. It never starts by itself for the site owner. | `guide/site/js/first-visit.js:17-23`; `guide/site/js/guide.js:291-295`; `first-visit-spotlight-guide/references/decisions.md:44` |
| 9 | Clicks **Done**, **Skip** or Esc. The guide fades out and focus lands on the name button. | Every way out counts as seen. Saved in `localStorage` (`site_guide_v1_<id>`) and sent as `POST /api/me {seen:"guide"}`. The tab and scroll position are restored. | `guide.js:263-288`; `first-visit-spotlight-guide/references/decisions.md:43` |
| 10 | Later: name menu → **Site guide** shows the guide again. | Starts 120 ms after the menu closes. | `guide.js:297-305` |

The intro can be replayed: the site name in the header carries `data-replay` (`intro/intro.js:190-224`;
`scroll-3d-intro/SKILL.md:55`).

### 2.2 First visit on an iPhone

Sign-in → calendar → install offer → Home Screen app → notifications.

| # | Sees | Site does | Where |
|---|---|---|---|
| 1 | The link is tapped inside KakaoTalk. The sign-in page shows **Open in Safari** instead of the Google pill, with "Google sign-in works in Safari, not inside this app." | Detects the in-app browser. The button opens `kakaotalk://web/openExternal?url=…`. On Android it reads "Open in browser" and "…works in your browser, not inside this app." | `gate/functions/_middleware.js:155-169` |
| 2 | In Safari: **Sign in with Google** → Google → back. | As in 2.1, steps 2–5. | — |
| 3 | The calendar, at once. No intro. | Phones (≤ 760 px wide, or a phone on its side) never get the intro. | `intro/intro-markup.html:16`; `scroll-3d-intro/references/decisions.md:18` |
| 4 | About 0.6 s later, a sheet from the bottom: "Add Lab to your Home Screen" / "Add it as an app to get notifications.", four steps with the Share glyph, then **Not now** and **Got it**. (`Lab` is the short name, `{{SITE_SHORT_NAME}}`.) | `firstVisit()` waits 600 ms, then `offerInstall()`. The sheet shows only in an iPhone or iPad browser and only once per member: this browser (`install_seen_<member>`) and the server (`seen.install`) must both say "not yet". It never opens over another dialog. Both records are written at once. | `first-visit.js:23`; `push/site/js/push.js:242-249`; `push/site/js/push-strings.js:29-37` |
| 5 | Closes it. 0.3 s later the site guide starts. | The `close` event runs the next step after 300 ms; the guide adds its own 400 ms. | `push.js:233-237`; `guide.js:291-295` |
| 6 | Share → Add to Home Screen → Add. The app icon appears with the short name under it. | iOS does this. The manifest gives the name, icons and standalone mode. | `ios-webapp-push/SKILL.md:29-30` |
| 7 | Opens the app from the Home Screen and signs in again. | On iPhone the installed app has its own storage, so it has no session yet. | `ios-webapp-push/references/setup.md:97`; `first-visit.js:6` |
| 8 | 0.4 s after the first start, the **App & notifications** sheet opens by itself, once. No site tour here. | `welcome()`: only in standalone mode, once per device (`push_welcomed`). | `push.js:252-257`; `ios-webapp-push/references/decisions.md:19` |
| 9 | Status: "Notifications are off on this device." Two switches, both on: **New events** and **30 minutes before**. A **Turn on notifications** button. | The switches are only remembered on this device until it subscribes. | `push.js:40-47`, `:100-119` |
| 10 | Taps **Turn on notifications** → iOS asks → **Allow**. "Saving…" → "Notifications are on for this device." | Asks for permission straight from the tap (iOS allows it only from a tap), subscribes, and saves the device with its switches on the server. | `push.js:158-176` |
| 10b | Taps **Don't Allow**: "Notifications are off for this app. Turn them on in Settings → Notifications → Lab." | The browser's permission is now `denied`. The switches are disabled. | `push.js:86-94`, `:105-108`; `push-strings.js:24` |

### 2.3 Adding and editing an event

| # | Sees | Site does | Where |
|---|---|---|---|
| 1 | Calendar tab, week view. Clicks **New event**, or clicks an empty hour slot or the all-day row. In month view a click on a day starts an event on that day; on a phone it opens that day's week instead. A click on a day's header opens that day's list. | A slot opens the editor at that hour; the all-day row opens an all-day event. | `cal/js/calendar.js:630-669`, `:695` |
| 2 | A dialog (a bottom sheet on phones) titled **New event**. Title has focus. Start 14:00, end 15:00, unless a slot gave the hour. The **Calendar** row is preset to their own calendar. | `openEditor()` resets the form and focuses Title after 30 ms. | `calendar.js:450-499` |
| 3 | Fields: Title ("e.g. Design review", 300 characters), Calendar, All day, Starts, Ends, Location ("e.g. Room 101 · Zoom"), Notes ("Links, things to bring…"). | Time inputs step by 5 minutes. | `cal/calendar.html:55-66` |
| 4 | Clicks **Save** (or presses Enter in a one-line field). If something is wrong, one red line under the form: "Add a title." / "Pick a date." / "The end date is before the start." / "The end time is before the start." | Checks in that order. A missing title also puts focus back on Title. | `calendar.js:524-527`; `cal/js/cal-strings.js:20` |
| 5 | **Save** greys out and reads "Saving…". The sheet closes and the calendar jumps to the new event's week. | POST to `/api/events`, then a quiet reload. The server, not the page, records "Added by". | `calendar.js:528-543`; `shared-google-calendar/references/decisions.md:15` |
| 5b | Save failed: "Couldn't save: {reason}". The reason is in plain words, for example "The service account has no access to this calendar. Share the calendar with the service account email ("Make changes to events")." | The server's error code is mapped to a sentence. Save comes back. | `calendar.js:538-542`; `cal-strings.js:21`, `:24-33` |
| 6 | Teammates see the event within a minute, or as soon as they come back to the tab after 15 s away. Their phones get "New event". The author's own devices get nothing. | Polling (§7). The calendar's POST calls `notifyCreated()` right away. | `calendar.js:705-706`; `ios-webapp-push/references/server.md:74`; `ios-webapp-push/SKILL.md:81` |
| 7 | Editing: clicks an event. The title reads **Edit event**. A grey note under the form: "Added by Alex · Edited by Blair", plus "Recurring event: changes apply to this one only." when it is part of a series. | Buttons: **Delete**, **Google Calendar ↗**, **Comment**, **Cancel**, **Save**. | `calendar.js:476-497`; `cal/calendar.html:69-76` |
| 8 | **Delete** turns red and reads "Click again to delete". A second click deletes. | It stays armed until the dialog is opened again. On failure: "Couldn't delete: {reason}". Deleting an event that is already gone counts as success. | `calendar.js:545-564`; `shared-google-calendar/references/decisions.md:76-77` |
| 9 | Closes with ×, **Cancel**, Esc, a click on the dim area, or (phone) a pull down. | Unsaved edits are dropped without asking (**not handled**: there is no "discard changes?" check). | `calendar.js:578-579`; `ds/sheet.js:118-131` |
| 10 | Before Google Calendar is connected, **New event** shakes the banner that says why. A click on an empty slot or day opens that day's list instead. Preview events open as **Event**, read only: "Read only until Google Calendar is connected." | `flashBanner()` nudges the banner for 300 ms. Fields are disabled and Save is hidden. | `calendar.js:451`, `:493-496`, `:623-627`, `:648-668` |

### 2.4 Writing this week's log

Logs are Markdown files in the repository. The site shows them and links to GitHub to edit; it does not edit them itself
(`weekly-research-log/references/decisions.md:53-54`).

| # | Sees | Site does | Where |
|---|---|---|---|
| 1 | Opens **Research log**. The week tabs show "Week 3" over "Jan 5 – Jan 11", with "This week" on the current one. The member's own tab is selected. | The default week is the one that holds today, in the team's time zone. The signed-in member's tab is chosen first. | `log/site/js/records.js:89-98`, `:139`; `log/site/js/rec-util.js:8-11` |
| 2 | A state line: "**This week** · open until the end of Mon, Jan 11." | — | `records.js:162-167`; `log/site/js/rec-strings.js:15` |
| 3 | No file yet: "Alex hasn't started a log for week 3." and **Create from template ↗**. | The link opens GitHub's "new file" page with the file name (`alex.md`) and the template filled in. | `records.js:67`, `:146-148`; `rec-strings.js:13` |
| 4 | A file with only the template: "Template only. Nothing written yet." and **Start writing ↗**. | Links to GitHub's editor for that file. | `records.js:150-152`; `rec-strings.js:12` |
| 5 | Writes and commits on GitHub, on a branch, then opens a pull request. | The `record-lock` Action runs on pushes and pull requests that touch `logs/**`. If a closed week's file changed, it fails with "A closed week's log was edited. Do not edit past logs; write corrections in this week's log." | `log/.github/workflows/record-lock.yml:4-8`; `log/tools/check_record_lock.py:56` |
| 6 | After the merge and the next deploy, the log shows on the site as formatted text. **Edit on GitHub ↗** sits beside the member tabs. | The site reads `records.json` once per page load (no polling). A page that was already open needs a reload. | `records.js:77-87`, `:161` |
| 7 | A past week: a lock glyph on its tab and "**Closed** · closed at the end of Mon, Jan 11. Past logs stay as they are; put corrections in this week's log." The links read **View on GitHub ↗**. There is no create link. | `isLocked(w)` is `today > w.end`, the same rule as the Action. | `records.js:75`, `:117-119`, `:164`, `:161`; `rec-strings.js:14` |

### 2.5 Adding a reference

The site only reads `references/`. There is no "add" form on the site
(`references-library/SKILL.md:144`).

| # | Sees | Site does | Where |
|---|---|---|---|
| 1 | Opens **References**. Link sections, then "Reading list, by topic" with "Edit the list in references/papers.csv (read_by, note)." | The file name is a link to the file on GitHub. | `refs/site/js/refs.js:154-157`; `refs/site/js/refs-strings.js:9-10` |
| 2 | Adds a row to `references/papers.csv` (columns `group, title, authors, year, venue, doi, url, read_by, note`), or a link line to `references/README.md` ending with `(verified)` or `(unverified)`. | — | `refs/build_refs.py:27-28` |
| 3 | The build check prints exactly what is wrong, for example "papers.csv line 7: doi should look like 10.xxxx/… (no https://doi.org/): https://doi.org/10.1000/x", or "README.md line 12: end the description with (verified) or (unverified): …". When all is well: "references: ok". | `build_refs.py --check` fails the build on a PDF file, a link to a `.pdf`, a DOI written as a URL, a row with no DOI and no URL, a bad year, a missing column, or an unmarked link. | `build_refs.py:55-88`, `:100` |
| 4 | After deploy: the paper sits under its topic. The tag reads **Unverified** or **Verified**. "(inferred)" also reads as Unverified. | `tagOf()` reads the mark at the end of the description. | `refs.js:48-49` |
| 5 | Finds it again: types in the search box ("Search title, author, journal"), or picks a topic chip. The count reads "3 of 41". | Matches every typed word, in any order, against title, authors, venue, year and note. It runs on every keystroke with no delay. | `refs.js:94-98`, `:188-190` |

### 2.6 Reading a chapter and coming back to where you left off

| # | Sees | Site does | Where |
|---|---|---|---|
| 1 | Opens **Theory**, picks a sub-tab and a chapter. A new chapter starts at the top. | The Theory tab does not jump to a saved place when it opens a chapter. | `notes/js/theory-tab.js:99-106` |
| 2 | Reads. | 700 ms after scrolling stops, the tab saves the section under the reading line (a quarter of the way down the window). | `theory-tab.js:141-151` |
| 3 | Clicks **Open in reader ↗**. | Just before the link is followed, it is pointed at the section being read. On a desktop it opens a new tab; on a phone or in the installed app it opens in the same window. | `theory-tab.js:124-138` |
| 4 | The reader opens at that section. Opened from a bookmark or by its address, it opens where this chapter was last read. | A `#section` in the address wins; otherwise the saved place. | `notes/js/reader.js:213-222` |
| 5 | Reads on. The contents column marks the current section. | Saves the place 400 ms after scrolling stops, and when the page is hidden or left. Not in the first 600 ms (the jump at load is not reading). Back near the top (< 80 px), the saved place is removed. | `reader.js:224-234`; `lecture-notes-reader/references/decisions.md:68-70` |
| 6 | Clicks **‹ Theory**. | If the reader was opened from the main page in this same window, it goes back in history, to the very spot. Otherwise it opens `/#theory/<part>/<chapter>`. | `reader.js:181-188` |
| 7 | Comes back days later. | Places are kept in `localStorage` (`rd_at`) for the 60 most recent chapters, per browser. They are not shared between devices. | `notes/js/chapter.js:362-378` |

### 2.7 Commenting on a passage, and someone else finding it

Anything inside an element with `data-chat-page` can be commented on (`team-chat/SKILL.md:55`).

| # | Sees | Site does | Where |
|---|---|---|---|
| 1 | Alex selects a sentence with the mouse. A small dark bar appears above it: **Copy · Comment**. | Shows 10 ms after the mouse is released. If there is no room under the header, the bar goes below the selection. | `chat/js/chat.js:608-635`, `:637-638` |
| 1b | On a phone: Alex selects text. After the selection settles, one **Comment** bar docks at the bottom of the screen, or at the top when the selection ends near the bottom. | Shows 400 ms after the selection stops changing. No Copy here: the phone's own menu already has it. | `chat.js:616-623`, `:637`, `:641`; `team-chat/references/decisions.md:13` |
| 2 | **Copy**: the bar reads "Copied" and closes 0.9 s later. | Clipboard API, with the old `execCommand` as the fallback. | `chat.js:650-656` |
| 3 | **Comment**: the chat opens with "Commenting on" and the quoted words above the box. The cursor is in the box. | Stores the passage with 40 characters of context on each side and the heading it sits under. | `chat.js:659-668`; `team-chat/references/decisions.md:11` |
| 4 | Types and presses Enter (Shift+Enter for a new line; on a phone Enter is a new line and the arrow sends). | Sends to `/api/messages`. The message appears, the list scrolls down, and the passage gets a highlight mark. On failure: "Couldn't send. Try again." | `chat.js:513-545` |
| 5 | Blair's page: a dot appears on the chat button. A screen reader hears "Team chat, 1 new". | Blair's browser polls every 45 s while the chat is closed (4 s when open). On a first visit everything already there counts as read. | `chat.js:29`, `:216`, `:227-239` |
| 6 | Blair sees the marked passage in the text and clicks it. | The chat opens on **This page**, scrolls to the comment, and flashes it for 1.6 s. | `chat.js:491-499`; `chat/css/chat.css:53` |
| 7 | Or Blair clicks the quote inside the chat (**Go to text**). | On the same page: opens the right tab, chapter or week, scrolls to the mark, and flashes it (1.8 s). On a phone the sheet closes first. From another page it follows a link such as `/theory/<part>/<chapter>?c=42`. | `chat.js:363-392`; `chat.css:129` |
| 8 | Arriving through such a link, the page scrolls to the mark once it is drawn. | `?c=` is removed from the address. The jump waits up to 10 s for the content. | `chat.js:394-404`, `:339-349` |
| 9 | The passage was later rewritten. | The comment stays in the chat without a mark. | `team-chat/references/decisions.md:11` |
| 10 | Alex deletes a message: **Delete** → "Delete?" for 3 s → tap again. | On failure: "Couldn't delete." | `chat.js:546-561` |

Comments on an event: the event sheet's **Comment** button closes the sheet and opens the chat with the selected words
(or the title), headed "Event · Tue, Dec 22" (`cal/js/calendar.js:566-576`; `chat.js:673-683`).

### 2.8 Getting a notification and tapping it

| # | Sees | Site does | Where |
|---|---|---|---|
| 1 | Blair adds an event on the site. | `notifyCreated()` runs at once for that event. An event added in Google Calendar is found at the next minute tick. | `ios-webapp-push/references/server.md:74`; `push/lib/push.js:3-7` |
| 2 | Alex's lock screen: **New event**, "Tue 12/22 · 10:50 · Weekly sync". More than 3 at once: **New events**, "5 events added · from Tue 12/22". | Day and time in the team's time zone. Titles are cut at 70 characters; an empty title reads "(no title)". Blair, the author, gets nothing. | `push/lib/push.js:156-168`, `:180-186` |
| 3 | 24 to 30.5 minutes before a timed event: **In 30 minutes**, "Tue 12/22 · 10:50 · Weekly sync". | Once per event, start time and device. Checked again just before sending; a moved event gets a new reminder, a deleted one gets none. | `push/lib/push.js:29`, `:280-286`; `ios-webapp-push/SKILL.md:82-83` |
| 4 | Taps it, and the app is already open. | The service worker focuses the window and sends it `app:open`; the page jumps to that day and opens the event. No reload. | `push/site/sw.js:27-42`; `push/site/js/push.js:78-83` |
| 5 | Taps it, and the app is closed. | Opens `/?event=<id>&date=<day>#calendar`. The hash and the deep link keep the intro off. | `push/lib/push.js:163`; `intro/intro-markup.html:16` |
| 6 | The calendar shows that week with the event's sheet open. If the event was deleted, the day's list opens instead. | `focus(date, id)` waits for loads to finish. A recurring series is matched by `<id>_<date>`. | `cal/js/calendar.js:600-620` |
| 7 | A second notification for the same event replaces the first. | Same notification `tag`. | `push/site/sw.js:19` |

### 2.9 Sharing the site link in KakaoTalk

| # | Sees | Site does | Where |
|---|---|---|---|
| 1 | Pastes the site link into a chat. A card appears: the picture, the site name, one plain sentence. | KakaoTalk's crawler fetches `/` without cookies. The gate answers with the sign-in page itself (200, not a redirect), which carries the link-preview tags. `og:url` is always the site root. | `og/og-tags.js:9-18`; `kakao-link-preview/SKILL.md:43-46`; `kakao-link-preview/references/kakao.md:10-11` |
| 2 | The picture is sharp on a phone and its words are not cut. | 2400 × 1260 JPEG. Everything readable sits in the centre square. | `kakao-link-preview/SKILL.md:32-34`; `references/kakao.md:6-9` |
| 3 | After the picture changes, the old card still shows. | KakaoTalk caches a card per URL for days. The fix: a new `?v=` hash on the picture (`og_version.py`), then Kakao's sharing debugger → Clear cache. | `references/kakao.md:3-5`, `:32`; `kakao-link-preview/SKILL.md:47`, `:54` |
| 4 | A teammate taps the card. | KakaoTalk's in-app browser opens the sign-in page with **Open in Safari** (journey 2.2, step 1). | `references/kakao.md:12-13` |
| 5 | A notice post with a picture. | Attach from the photo album for an inline picture. "File" gives a download box. | `references/kakao.md:15-21` |

### 2.10 Signing out, and an expired session

| # | Sees | Site does | Where |
|---|---|---|---|
| 1 | Clicks the sign-out icon (header, wider than 960 px) or **Sign out** in the name menu. | `/__logout` deletes the session row and the cookie, then redirects to `/`, which shows the sign-in page. | `gate/functions/_middleware.js:228-233`; `ds/components.css:154` |
| 2 | — | Things kept in this browser stay: theme and language (`site_theme`, `site_lang`), calendar view and hidden calendars (`cal_view`, `cal_hidden`), reading places (`rd_at`), chat read mark (`site_chat_seen`), notification switches (`push_prefs`), "seen" flags for the guide and the install pop-up. Clearing them on sign-out is **not handled**. | `ds/theme.js:10-11`; `cal/js/calendar.js:335`, `:675`; `notes/js/chapter.js:365`; `chat/js/chat.js:23`; `push/site/js/push.js:18-20`; `guide/site/js/guide.js:66` |
| 3 | Notifications still arrive on this device. | Sign-out does not unsubscribe the device (**not handled**). A device is dropped only when its member leaves `ALLOWED_EMAILS`. | `push/lib/push.js:245-247`; `ios-webapp-push/references/server.md:53` |
| 4 | The session ends: 180 days after sign-in, or on the next request after the member is removed from the list. Loading any page then shows the sign-in page, with no message. After signing in, the person is back at that page. | Sessions are fixed at sign-in and never extended. The allow-list is read on every request. | `gate/lib/auth.js:186-187`, `:196-215`; `_middleware.js:241-247`; `google-signin-team-gate/references/setup.md:150` |
| 5 | A tab left open: the calendar or the chat reloads itself into the sign-in page. | Their API calls get `401 {error:"auth"}` and call `location.reload()`. The chat polls every 45 s while closed and the calendar every 60 s while visible, so this happens within about a minute. | `_middleware.js:220-222`, `:241`; `cal/js/cal-util.js:33`; `chat/js/chat-util.js:15` |
| 6 | Other parts of an open tab do not reload. | Data files get `401 "Sign in first."` as plain text. A tab opened for the first time after expiry then shows: Research log "Couldn't load the logs (HTTP 401)."; References "0 of 0" and "No matching papers."; Theory "Chapters are being written."; the bell sheet "Notifications aren't set up on the server yet." (see §8). | `_middleware.js:246`; `records.js:77-87`; `refs.js:69-77`; `theory-tab.js:49-53`; `push.js:129-142` |
| 7 | A removed member signs in again: "This site is for the Example Lab team only." | — | `_middleware.js:46`, `:273-275` |

---

## 3. States, per screen

Exact words from the code, in English and in Korean where the code has a Korean table. The design-system rule for each
state is in `team-site-design-system/references/design.md:222-233`: Empty is one grey line with the action beside it;
Loading is a grey dot and "Loading", "never a spinner over content"; Error is a red line or a red banner "with what to
do"; Not configured is a warning banner "that names the missing setting".

### 3.1 Sign-in page

Always dark, always English. Source: `gate/functions/_middleware.js`.

| State | Words | Where |
|---|---|---|
| Default | **Sign in with Google** | `:147` |
| Clicked | (no words; the pill fades to half opacity and ignores clicks; coming back with the Back button undoes it) | `:123`, `:173`, `:177` |
| Cancel at Google | (no message) | `:268` |
| Refused | "This site is for the Example Lab team only." (403) | `:46`, `:275` |
| Failed check | "Couldn't sign in. Try again." (403; a Google-side error other than Cancel shows the same line with status 200) | `:47`, `:268`, `:275` |
| Not configured | "Sign-in isn't set up yet: GOOGLE_CLIENT_ID and the D1 binding DB." (503, message only, no pill) | `:48`, `:132`, `:201` |
| In-app browser (KakaoTalk) | **Open in Safari** / **Open in browser**; hint "Google sign-in works in Safari, not inside this app." / "Google sign-in works in your browser, not inside this app." | `:148`, `:155-169` |
| Request from another site | `403 {error:"origin"}` (API writes only; no screen) | `:209-212` |

### 3.2 Calendar

English only, in both languages (`team-site-design-system/references/language.md:12`). Strings:
`cal/js/cal-strings.js`.

**Sync note** (top right, a 7 px dot and one word):

| State | Words | Where |
|---|---|---|
| Before the script runs | "Loading" | `cal/calendar.html:27` |
| A full load is running | "Syncing" (the dot pulses) | `cal-strings.js:6`; `calendar.js:112-115` |
| Live | "Synced 2:20 PM", tooltip "Refreshes every minute and when you return to this tab" | `cal-strings.js:6`; `calendar.js:117-120` |
| Not connected | "Not connected" | `cal-strings.js:7`; `calendar.js:121-124` |
| Error | "Calendar error" | `cal-strings.js:7`; `calendar.js:125-128` |

A quiet reload (polling, Today, after a save) does not show "Syncing": `load({quiet:true})` passes no busy state
(`calendar.js:77`).

**Banner** (under the toolbar):

| Mode | Words | Where |
|---|---|---|
| Not configured | "Google Calendar isn't connected yet. Striped events are a preview of the official schedule." | `cal-strings.js:9`; `calendar.js:143-146` |
| Events API unreachable (offline, 404) | "Couldn't reach the events API." | `cal-strings.js:8`; `calendar.js:63-65`, `:145` |
| Error | "**Couldn't connect to Google Calendar.**" then the reason, for example "Calendar not found. Check GOOGLE_CALENDAR_ID and the sharing." | `cal-strings.js:10`, `:24-33`; `calendar.js:147-150` |
| Live | (hidden) | `calendar.js:151` |

The reasons, by server code (`cal-strings.js:24-33`):

| Code | Words |
|---|---|
| `not-configured` | "Google Calendar is not connected yet." |
| `sa-json` | "GOOGLE_SA_JSON is not valid. Paste the whole key file again." |
| `sa-key` | "Couldn't read the service account key. Paste the key JSON again." |
| `google-auth` | "Google sign-in failed. Check the service account key." |
| `google-401` | "Google refused the credentials. Check the service account key." |
| `google-403` | "The service account has no access to this calendar. Share the calendar with the service account email ("Make changes to events")." |
| `google-404` | "Calendar not found. Check GOOGLE_CALENDAR_ID and the sharing." |

**Google Calendar card** (side column): live "Connected to **{name}**. Changes here go straight to Google Calendar, and
edits there show up here within a minute." with **Open in Google Calendar** and, once, **Add official schedule**
(pressed: "Adding…", failed: "Failed: {m}"); not connected "Not connected yet."; error: the reason, or "Checking the
connection…", with **Try again** (`cal-strings.js:13-15`; `calendar.js:420-432`, `:680-689`).

**Other calendar states:**

| State | Words or look | Where |
|---|---|---|
| Upcoming list empty | "Nothing scheduled." | `cal-strings.js:12`; `calendar.js:412` |
| Week with no events | grid lines only | `shared-google-calendar/references/design.md:404` |
| Too many events in a day | "+2 more" (desktop), "+2" on phones with the full words as `aria-label` | `calendar.js:168-176` |
| Day list with no events | an empty list and **New event on this day** (no empty-state line: **not handled**) | `calendar.js:584-593` |
| Read only (not connected) | sheet title **Event**, fields disabled, Save hidden, note "Read only until Google Calendar is connected."; **New event on this day** hidden | `calendar.js:464`, `:493-496`, `:591` |
| Validation | "Add a title." · "Pick a date." · "The end date is before the start." · "The end time is before the start." | `cal-strings.js:20` |
| Saving | Save disabled, "Saving…" | `calendar.js:528-530` |
| Save / delete failed | "Couldn't save: {m}" / "Couldn't delete: {m}" | `cal-strings.js:21` |
| Delete armed | "Click again to delete" (red) | `calendar.js:549-552` |
| Success | the sheet closes and the event shows in the grid; there is no toast | `calendar.js:534-537`, `:557-558` |
| Signed out | the page reloads into the sign-in page | `cal/js/cal-util.js:33` |

A network failure during a quiet reload while live switches the calendar to error mode. Later quiet reloads do not ask
`/api/status` again, so it stays in error mode, showing the preview schedule, until **Try again** or a page reload
(`calendar.js:73-105`, `:705-706`). See §8.

### 3.3 Research log

English only; the strings file has a hook for a second table but ships none (`log/site/js/rec-strings.js:1-3`,
`:21-25`).

| State | Words | Where |
|---|---|---|
| Loading | the pane stays empty until `records.json` arrives (no spinner) | `weekly-research-log/references/design.md:169` |
| Load failed | "Couldn't load the logs (HTTP 404)." | `rec-strings.js:18`; `records.js:133` |
| No weeks | "No logs." | `rec-strings.js:17`; `records.js:133` |
| Week not started | "**Not started** · runs Tue, Jan 12 – Mon, Jan 18." | `rec-strings.js:16`; `records.js:167` |
| Open week | "**This week** · open until the end of Mon, Jan 11." | `rec-strings.js:15` |
| Closed week | lock glyph; "**Closed** · closed at the end of Mon, Jan 4. Past logs stay as they are; put corrections in this week's log." | `rec-strings.js:14` |
| Team notes missing | open: "No file yet." + **Create from template ↗**; closed: "No meeting notes this week." | `rec-strings.js:11`; `records.js:120-121` |
| Personal log missing | open: "Alex hasn't started a log for week 3." + **Create from template ↗**; closed: "Alex has no log for week 3." | `rec-strings.js:13`; `records.js:146-148` |
| Template only | open: "Template only. Nothing written yet." + **Start writing ↗**; closed: "Nothing was written this week." | `rec-strings.js:12`; `records.js:150-152` |
| Has entries | a dot on the week tab, tooltip "Has entries" | `rec-strings.js:6`; `records.js:107` |
| Week rule | under "Week dates and closing rule": "A week runs **Tuesday to the following Monday** (Asia/Seoul). After Monday 24:00 it closes and is not edited. Add anything missed to this week's log." (days and zone come from the data) | `rec-strings.js:8`; `records.js:111-113` |

### 3.4 References

English only, with a hook for a second table (`refs/site/js/refs-strings.js:1-3`).

| State | Words | Where |
|---|---|---|
| Loading | the body is empty until `refs.json` arrives (no spinner) | `references-library/references/design.md:258` |
| Load failed | (no message: the list is treated as empty, so "0 of 0" and "No matching papers.") | `refs.js:69-77` |
| No match | "No matching papers." | `refs-strings.js:13`; `refs.js:98` |
| Count | "12 of 41" | `refs-strings.js:12`; `refs.js:97` |
| Marks | **Unverified** / **Verified** | `refs-strings.js:14`; `refs.js:48-49` |
| Reader line | "Read by Alex · note" | `refs-strings.js:13`; `refs.js:107` |

### 3.5 Theory tab and reader

The Theory tab's words are English, passed in as `t` (`notes/js/theory-tab.js:15-18`). The reader's words are
written in English in the code.

| Screen | State | Words | Where |
|---|---|---|---|
| Theory tab | No chapters, or load failed | "Chapters are being written." | `theory-tab.js:17`, `:49-53`, `:71` |
| Reader | Loading | `<article aria-busy="true">`, empty; no spinner | `notes/reader.html:42`; `lecture-notes-reader/references/design.md:275` |
| Reader | Load failed | "Couldn't load the chapters. Back to Theory"; tab title "Chapter not found · Example Lab" | `reader.js:49-54`, `:166` |
| Reader | Unknown address | "Chapter not found. Back to Theory" | `reader.js:168` |
| Both | Link to a chapter not published yet | plain text, tooltip "Not published yet" | `notes/js/chapter.js:298-304` |
| Both | Cross-reference that does not exist | "(??)", tooltip "Unknown reference: {key}" | `chapter.js:233-238` |
| Both | Jump to an equation, figure or section | a soft accent flash: 2 s in the reader, 1.8 s in the tab | `notes/css/reader.css:133`; `notes/css/theory.css:67` |

### 3.6 Team chat

English and Korean (`chat/js/chat-strings.js:5-29`).

| State | EN | KO | Where |
|---|---|---|---|
| Empty, All, mouse | "No messages yet. Write below, or drag over any text in the notes, logs or papers to comment on it." | "아직 메시지가 없습니다. 아래에 쓰거나, 노트 · 기록 · 논문의 글을 드래그해 코멘트를 남깁니다." | `:9`, `:22` |
| Empty, All, touch | "…or select any text in the notes, logs or papers to comment on it." | "…글을 선택해 코멘트를 남깁니다." | `:10`, `:23` |
| Empty, This page, mouse | "No comments on this page yet. Drag over a passage and choose Comment." | "이 페이지에 단 코멘트가 아직 없습니다. 구절을 드래그하고 "코멘트" 를 누릅니다." | `:11`, `:24` |
| Empty, This page, touch | "No comments on this page yet. Select a passage and tap Comment." | "…구절을 선택하고 "코멘트" 를 누릅니다." | `:12`, `:25` |
| Not set up, offline, or 404/503 | "Chat isn't connected yet. Copy still works." | "채팅이 아직 연결되지 않았습니다. 복사는 됩니다." | `:13`, `:26`; `chat.js:219` |
| Send failed | "Couldn't send. Try again." | "보내지 못했습니다. 다시 시도하세요." | `:13`, `:26`; `chat.js:541` |
| Delete failed | "Couldn't delete." | "지우지 못했습니다." | `:13`, `:26`; `chat.js:560` |
| Delete armed | "Delete?" | "삭제할까요?" | `:8`, `:21`; `chat.js:549` |
| Quoting | "Commenting on" | "코멘트할 구절" | `:7`, `:20` |
| Copied | "Copied" | "복사됨" | `:14`, `:27` |
| Unread | button label "Team chat, 2 new" (English only, set in code) and a dot | — | `chat.js:233-239` |
| Day separators | "Today", "Yesterday", "Mon, Dec 22" | "오늘", "어제", "12월 22일 (월)" | `:14`, `:27`; `chat/js/chat-util.js:28-35` |
| Loading | (nothing shows until the first answer) | — | `chat.js:206-225` |

### 3.7 Bell sheet and install pop-up

English and Korean (`push/site/js/push-strings.js`). One status line for every device state (`push.js:86-98`).

| State | EN | KO | Line |
|---|---|---|---|
| iPhone browser, not installed | "Add the app to your Home Screen to get notifications." | "홈 화면에 앱을 추가하면 알림을 받을 수 있습니다." | `:19`, `:51` |
| Inside KakaoTalk on iPhone | "Open this page in Safari to install the app." | "앱을 설치하려면 이 페이지를 Safari로 여세요." | `:20`, `:52` |
| iOS before 16.4 | "Notifications need iOS 16.4 or later." | "알림은 iOS 16.4 이상에서 받을 수 있습니다." | `:21`, `:53` |
| Browser without push | "This browser can't show notifications." | "이 브라우저는 알림을 보여 주지 못합니다." | `:22`, `:54` |
| Checking | "Checking…" | "확인하는 중…" | `:28`, `:60` |
| Not configured (or the API failed) | "Notifications aren't set up on the server yet." | "서버에 알림이 아직 설정되지 않았습니다." | `:23`, `:55` |
| Blocked, iPhone app | "Notifications are off for this app. Turn them on in Settings → Notifications → Lab." | "이 앱의 알림이 꺼져 있습니다. 설정 → 알림 → Lab에서 켜세요." | `:24`, `:56` |
| Blocked, other browsers | "Notifications are blocked for this site in your browser settings." | "브라우저 설정에서 이 사이트의 알림이 막혀 있습니다." | `:25`, `:57` |
| Off | "Notifications are off on this device." | "이 기기에서는 알림이 꺼져 있습니다." | `:26`, `:58` |
| On | "Notifications are on for this device." | "이 기기에서 알림을 받습니다." | `:27`, `:59` |
| Saving | "Saving…" | "저장하는 중…" | `:28`, `:60` |
| Save failed | "Couldn't save. Try again." (the switch moves back) | "저장하지 못했습니다. 다시 시도하세요." | `:28`, `:60`; `push.js:186-192` |

The switches are disabled unless the state is On or Off. **Turn on notifications** shows only when Off, and is
disabled when both switches are off (`push.js:105-111`). In an iPhone browser the bell opens the install pop-up
instead of the switches (`push.js:146-147`).

### 3.8 Guide and intro

| Screen | State | Words | Where |
|---|---|---|---|
| Guide | Buttons | **Skip**, **Back**, **Next**, **Done** on the last step; "Step 2 of 6" for screen readers | `guide/site/js/guide.js:68` |
| Guide | Example steps | "Welcome, Alex" / "This is the team site of Example Lab. Here's a 30-second tour." … "You're set" / "You can reopen this guide from your name menu." | `guide/demo/index.html:182-192` |
| Guide | Blocked | does not start during the intro or while any dialog is open | `guide.js:65` |
| Intro | Text | the site name, then one headline per scene (the demo: "Open It Up", "Every Layer", "One Chip"); **Skip** | `intro/intro-markup.html:27-34` |
| Intro | Slow 3D | the dimmed arrival is lifted after 4 s even if the scene has not drawn | `intro/intro.js:234` |

---

## 4. Wording rules

### 4.1 Tone and length

From `team-site-design-system/references/language.md:32-39` and `SKILL.md:74`:

- Labels and buttons: one to three words ("New event", "Open in reader", "Not now").
- Sentence case. No full stop on a label; a full stop on a sentence.
- Say what happens, not how it works ("Changes go straight to Google Calendar").
- No helper text that repeats the label. An empty state says what to do, once.
- Errors say what to do next ("Add a title.", "The end time is before the start.").

What the code adds:

- Errors that need a setting name it, in words "a teammate can act on": "GOOGLE_SA_JSON is not valid. Paste the whole
  key file again." (`cal/js/cal-strings.js:24-33`). The sign-in page names its missing settings too
  (`gate/functions/_middleware.js:48`).
- A refusal never says why. "Not on the list", "wrong domain" and "not verified" all read as the one team-only line
  (`google-signin-team-gate/references/design.md:100`).
- Failures that the person can retry end with "Try again." ("Couldn't sign in. Try again.", "Couldn't send. Try
  again.", "Couldn't save. Try again.").
- "Couldn't …" is the standard opening for a failure. Calendar failures add the reason after a colon: "Couldn't save:
  {m}".
- Destructive actions confirm in place, not in a dialog: "Click again to delete" (calendar), "Delete?" for 3 s (chat)
  (`team-chat/references/decisions.md:18`).
- Status lines are full sentences that say the state of this device ("Notifications are on for this device.").
- Buttons that leave the site end with ↗ ("Edit on GitHub ↗", "Open in reader ↗", "Google Calendar ↗").

### 4.2 What is English by default

| Area | EN mode | KO mode | How |
|---|---|---|---|
| Sign-in page, intro | English | English | `data-lang-fixed`; the sign-in page has no Korean |
| Header (tabs, buttons, tooltips) | English | English | `data-lang-fixed` on `.bar` (`ds/demo/index.html:33`) |
| Calendar tab, its dialogs, the sync note | English | English | `cal-strings.js` has one table |
| Guide | English | English | `data-lang-fixed` on its root (`guide.js:101`) |
| Research log, References, Theory UI | English | English as shipped (see §8) | hooks only: `useStrings()` / `t` |
| Team chat panel | English | Korean | `chat-strings.js:18-29`; the header's chat button stays English |
| Bell sheet, install pop-up | English | Korean (the sheet's `title` stays "App & notifications") | `push-strings.js:39-70` |
| Content (logs, notes, chapters) | as written | as written | repo rule: English |
| Terms and proper names | English | English | `language.md:15`, `:39` |

The language button reads **EN** or **KO**. Its tooltip says what a tap does: "Switch to Korean" / "Switch to
English". Its label says both: "Language: English. Switch to Korean" (`ds/i18n.js:51-60`). The choice is saved as
`site_lang` and applied before the first paint (`ds/theme.js:11`, `:15`). Changing it fires `site:lang`, and each tab
draws again (`ds/i18n.js:39-45`).

Korean strings keep iOS's own Korean labels for iOS steps (공유, 홈 화면에 추가, 웹 앱으로 열기, 추가)
(`push-strings.js:3-4`).

### 4.3 Dates, times and the time zone

Everything is shown in the **team's time zone**, wherever the viewer is. Dates are built by small helpers, not by
`toLocaleString` (`team-site-design-system/references/language.md:27-28`).

| Where | Format | Example | Source |
|---|---|---|---|
| Calendar week title | `Mon D – D, YYYY` (months or years added when they differ) | "Dec 22 – 28, 2026" | `cal/js/calendar.js:212-217` |
| Calendar title on phones | month only; the year only when it is not this year | "December", "Nov – Dec" | `calendar.js:218-223` |
| Calendar month title | full month and year | "December 2026" | `cal-strings.js:51-52` |
| Hour labels, event times | 24 h, `HH:MM` | "08:00", "10:50" | `calendar.js:274-277`, `:163` |
| Now line label | 24 h | "14:05" | `calendar.js:318` |
| Upcoming list | day stamp + time range or "All day" | "22 / Dec Tue", "10:50–11:30 · Room 101" | `cal-strings.js:53-54`; `calendar.js:391-397` |
| Sync note | 12 h (the only 12 h time on screen) | "Synced 2:20 PM" | `cal/js/cal-util.js:15` |
| Research log tabs | `Week n` over `Mon D – Mon D` | "Week 3", "Jan 5 – Jan 11" | `records.js:107`; `log/site/js/rec-util.js:22` |
| Research log state lines | `Ddd, Mon D` | "Tue, Jan 5" | `rec-util.js:23` |
| Week closes | `{day}, 00:00` | "Tue, Jan 12, 00:00" | `rec-strings.js:9` |
| Chat times | 24 h | "14:05" | `chat/js/chat.js:44`, `:269` |
| Chat days | Today / Yesterday / date | "Mon, Dec 22" / "12월 22일 (월)" | `chat.js:256-259`; `chat-util.js:28-35` |
| Notifications | `Ddd M/D · HH:MM` | "Tue 12/22 · 10:50" | `push/lib/push.js:155-160` |
| Calendar "day" | runs 07:00 to 07:00, so a 02:00 event belongs to the day before | — | `cal/js/cal-config.js:10`; `calendar.js:535` |

Where the zone comes from: `TIMEZONE` in `cal/js/cal-config.js:6` (calendar), `timeZone` in `records.json`
(Research log, `rec-util.js:6-11`), `TIMEZONE` in `chat/js/chat-util.js:4` (chat; see §8), and the server's zone in
`push/lib/push.js` (notifications).

### 4.4 Numbers

- A number never breaks from its label or unit: "Week 3", "12/22 – 12/28", "10:50 AM". Pairs are wrapped in
  `white-space: nowrap`, and Korean uses `word-break: keep-all` (`team-site-design-system/SKILL.md:62-64`;
  `ds/tokens.css:60`). Logs and references run `keepPairs()`, which turns the space into a no-break space
  ("Step 3", "260 °C", "40 nm") (`log/site/js/rec-util.js:28-34`).
- Counts sit inside the sentence: "{n} of {t}", "+{n} more", "Comment (3)", "Team chat, 2 new", "5 events added".
- The sync note uses tabular numbers (`shared-google-calendar/references/design.md:139`).
- Numbers in the research text come from scripts, never by hand (the team rule in `team-project-playbook`).

### 4.5 Notification text

Title, day, time, event title. Never a place, a note, a guest, an email or a name
(`ios-webapp-push/SKILL.md:84-85`). Titles: "New event", "New events", "In 30 minutes" (`push/lib/push.js:168`,
`:185`, `:286`). The notification title falls back to the site name (`push/site/sw.js:7`, `:17`).

---

## 5. Keyboard and accessibility

### 5.1 Keyboard shortcuts

| Key | Where | Does | Source |
|---|---|---|---|
| ← / → | Calendar tab, focus not in a field or dialog | Previous / next week (or month) | `cal/js/calendar.js:697-701` |
| Enter | Event form, in a one-line field | Submits (the browser's default for a form with a submit button) | `cal/calendar.html:50`, `:75` |
| Esc | Any open `<dialog>`: event, day list, bell sheet, install pop-up, name menu | Closes it (the browser's default) | `shared-google-calendar/references/design.md:365` |
| Esc | Team chat open, no dialog open | Closes the chat | `chat/js/chat.js:474` |
| Enter | Chat box, keyboard device | Sends. Shift+Enter is a new line. Never while a Korean syllable is being composed. On touch screens Enter is a new line. | `chat.js:513-520` |
| Shift + arrows | Selecting text with the keyboard | Shows the Copy · Comment bar when Shift is released | `chat.js:639` |
| Esc | Guide | Ends it (counts as seen) | `guide/site/js/guide.js:225` |
| → / ← | Guide | Next / previous step | `guide.js:226-227` |
| Enter | Guide, focus not on a guide button | Next (Done on the last step) | `guide.js:228` |
| Space | Guide, focus not on a button | Swallowed | `guide.js:229` |
| Tab / Shift+Tab | Guide | Cycles Skip → Back → Next only | `guide.js:230-236` |
| ↑ ↓ PgUp PgDn Home End | Guide | Swallowed, so the page does not scroll under it | `guide.js:237` |
| Any other key | Guide | Stopped from reaching the page's own shortcuts | `guide.js:238` |
| Esc | Reader, phone contents sheet open | Closes it and puts focus back on the bar button | `notes/js/reader.js:159` |
| Space, PgDn, arrows | Intro | The browser's own scrolling drives the story (no key handling of its own) | `intro/intro.js` (no `keydown` handler) |

Tab lists (header tabs, week tabs, member tabs, Theory sub-tabs, chat tabs) use `role="tab"` but have no arrow-key
movement. Each tab is a normal Tab stop. Arrow keys on tab lists: **not handled**.

### 5.2 Focus

| Surface | On open | While open | On close |
|---|---|---|---|
| Event sheet | Title, after 30 ms, when it can be edited (`calendar.js:498`) | Native modal dialog | Browser default (returns to the opener) |
| Bell sheet, install pop-up | The sheet itself, so no ring shows on the close button after a tap; Tab still reaches every control (`push.js:150-153`, `:227-230`) | `.dlg:focus-visible` shows no ring on the sheet itself (`ds/components.css:84`) | Browser default |
| Guide | **Next**, on every step (`guide.js:147`) | The app behind is `inert`. Tab cycles inside the panel. Focus that escapes is pulled back to Next (`guide.js:241-243`, `:252-254`). | The name button `#me-btn` (`guide.js:286-287`) |
| Team chat | The text box, on non-touch devices (`chat.js:470`). Comment also focuses it (`chat.js:667`). | Not modal; the page stays usable on wide screens | The text box is blurred. Focus does not return to the chat button (**not handled**) (`chat.js:444-460`). |
| Reader contents (phone) | — | — | Esc returns focus to the bar button (`reader.js:159`) |
| Theory "Open in reader" | Re-aimed on `focusin` too, so keyboard users get the right section (`theory-tab.js:138`) | — | — |
| Sign-in page | The pill is a real link and the first Tab stop (`google-signin-team-gate/references/design.md:138`) | — | — |

Focus ring: 3 px accent at 55 %, offset 1 px, on `:focus-visible` only (`ds/tokens.css:65`). Switch rows show the ring
on the switch itself (`ds/components.css:126-127`). Segmented choices ring the visible pill (`components.css:109`). The
sign-in pill uses a white ring on its dark page (`gate/functions/_middleware.js:122`).

### 5.3 Roles and attributes

| Element | Markup | Source |
|---|---|---|
| Header tabs | `nav role="tablist" aria-label="Sections"`, `a role="tab" aria-selected` | `ds/demo/index.html:36-40` |
| Calendar view | `role="group" aria-label="Calendar view"`, buttons `aria-pressed` | `cal/calendar.html:23-24`; `calendar.js:178` |
| Calendar grid | `aria-live="polite"` | `cal/calendar.html:32` |
| Calendar legend | buttons `aria-pressed` (true = shown) | `calendar.js:414` |
| Event sheet | `<dialog aria-labelledby>`; error line `role="alert"` | `cal/calendar.html:49`, `:68` |
| Week tabs | `nav role="tablist" aria-label="Weeks"`; `role="tab" aria-selected`; lock glyph `aria-hidden` | `log/site/records.html:11`; `records.js:106` |
| Member tabs | `role="tablist" aria-label="Personal logs"` | `records.js:180` |
| References | search `aria-label` = its placeholder; topic chips `aria-pressed`; phone jump row `nav aria-label="Contents"` | `refs.js:159-165` |
| Theory sub-tabs | `nav role="tablist"`, `a role="tab" aria-selected`; chapter list `aria-current="page"` | `theory-tab.js:56`, `:68-69` |
| Reader | crumbs `aria-label="Breadcrumb"`; contents `aria-label="Contents"`; current section `aria-current="location"`; article `aria-busy` until ready; phone bar `aria-expanded`, `aria-controls` | `notes/reader.html:27`, `:41-42`; `reader.js:107`, `:199-207` |
| Chat panel | `aside role="dialog"` with `aria-label`; tabs `role="tablist"`; status `role="status"`; list `aria-live="polite"`; error `role="alert"`; selection bar `role="toolbar"` | `chat.js:128-153`, `:174` |
| Chat button | `aria-expanded`; `aria-label` with the unread count | `chat.js:233-239`, `:436`, `:457` |
| Bell sheet | `<dialog tabindex="-1" aria-labelledby>`; status `role="status" aria-live="polite"`; switches `button role="switch" aria-checked` | `push/site/push-dialogs.html:14-23` |
| Install pop-up | `<dialog aria-labelledby aria-describedby tabindex="-1">` | `push-dialogs.html:46` |
| Guide | `role="dialog" aria-modal="true"`, `aria-labelledby` the title, `aria-describedby` the text; text `aria-live="polite"`; dots `aria-hidden`; a hidden "Step n of N" | `guide.js:96-108` |
| Intro | `section aria-label="Intro"`; dots `nav aria-label="Scenes"`; each dot labelled with its headline, `aria-current="step"` | `intro/intro-markup.html:22`, `:28`; `intro/intro.js:69`, `:93` |
| Sign-in | poster and mark `aria-hidden`; message `role="alert"` | `google-signin-team-gate/references/design.md:140-141` |
| Theme button | `aria-pressed="true"` means dark | `ds/theme.js:26-28` |

### 5.4 Labels for icon buttons

| Button | Label | Source |
|---|---|---|
| Bell | "App & notifications" | `push-dialogs.html:9` |
| Language | "Language: English. Switch to Korean" (and the reverse) | `ds/i18n.js:56` |
| Theme | tooltip "Light or dark", `aria-pressed`; no `aria-label` in the header (the reader's has both) | `ds/demo/index.html:48`; `notes/reader.html:29` |
| Chat | "Team chat" / "Team chat, n new" | `chat.js:238` |
| Sign out | "Sign out" | `ds/demo/index.html:56` |
| Calendar arrows and Today | "Previous", "Next", "Today" | `cal/calendar.html:19-21` |
| Time fields | "Start time", "End time" | `cal/calendar.html:60`, `:63` |
| Dialog close | "Close" (KO "닫기" in the bell sheet and chat) | `cal/calendar.html:53`; `push-dialogs.html:16`; `chat.js:178` |
| Chat quote remove, send | "Remove the passage" / "구절 빼기", "Send" / "보내기" | `chat.js:181-184` |
| Event Comment | "Comment" or "Comment (3)" | `calendar.js:487` |
| "+n" on phones | "+2 more" | `calendar.js:172-173` |

Decorative SVGs carry `aria-hidden="true"` throughout (for example `cal/calendar.html:19-28`, `chat.js:40-41`).

### 5.5 Tap sizes

Every tappable thing on a phone is at least 44 × 44 px (`team-site-design-system/SKILL.md:66-67`). Header buttons,
`.btn`, `.icon-btn`, fields and checkboxes get the real height. Small controls keep their look and get an invisible
44 px `::after` (`ds/components.css:175-192`). Skill-specific: calendar pills and segments (`cal/css/calendar.css:207`),
guide buttons (`guide/site/css/guide.css:18`, `:27`, `:43`), chat close and the docked Comment bar
(`chat/css/chat.css:89`, `:116`), reader chat button (`chat.css:136`), the sign-in pill 232 × 44
(`google-signin-team-gate/references/design.md:33`).

### 5.6 Reduced motion

`prefers-reduced-motion: reduce` turns off:

| What | Source |
|---|---|
| Dialog rise and switch slide | `ds/components.css:214` |
| Calendar week/month slide and the sync dot pulse (it stops at opacity .6) | `calendar.js:373`; `calendar.css:275-276` |
| Chat panel slide and the page making room | `chat/css/chat.css:16` |
| Chat scroll to a mark (instant instead of smooth) | `chat.js:345` |
| Guide fades and spotlight movement | `guide.css:46-47`; `guide.js:160`, `:198`, `:278` |
| Reader and Theory jump flash and the turning chevron | `reader.css:211-214`; `theory.css:123-126` |
| Theory in-chapter links, references jumps (instant) | `theory-tab.js:117-118`; `refs.js:176-177` |
| Bell sheet chevron | `push/site/css/push.css:77-78` |
| Intro: headline drift, scene jumps, Skip and replay fades | `intro/intro.js:63`, `:87`, `:209`, `:217-220`; `intro/intro.css:74`, `:87` |
| Sign-in pill transition | `_middleware.js:124` |

Still moving with reduced motion: the chat message flash (1.6 s), the passage mark flash (1.8 s) and the selection
bar's 0.14 s pop-in (`chat.css:53`, `:106`, `:129`). See §8.

### 5.7 Contrast

The only measured contrast in the repo is the sign-in page: pill text 11.6 : 1, the red message 6.7 : 1, the grey hint
7.3 : 1 on the dimmed picture. "Check again with your own poster: a bright picture behind the centre lowers it."
(`google-signin-team-gate/references/design.md:142-143`). Other screens rely on Apple's system colours
(see [tokens.md](tokens.md)).

### 5.8 Korean input (IME)

- Enter in the chat never sends while a syllable is being composed: it checks `isComposing` and `keyCode 229`
  (`chat.js:516`). Reason: "Korean input commits a syllable on Enter; sending then cuts the last letter or sends
  twice." (`team-chat/references/decisions.md:21`).
- Korean text breaks only between words (`ds/tokens.css:60`).
- Other text fields (event form, references search) have no Enter handling of their own; the event form submits on
  Enter through the browser. IME handling there: **not handled** in code.

### 5.9 Zoom

An upright phone cannot zoom: the viewport gets `maximum-scale=1,user-scalable=no`, pinches are stopped at
`gesturestart`, and `touch-action: pan-x pan-y` stops double-tap zoom. Landscape and wider screens keep zoom "for
accessibility" (`ds/theme.js:55-68`; `ds/components.css:213`; `team-site-design-system/references/design.md:248-249`).

---

## 6. Phones

Every phone rule, with its code and its reason, is in
[team-site-design-system/references/mobile.md](../../skills/team-site-design-system/references/mobile.md). In short:

- **Width.** At ≤ 760 px the header becomes two rows, dialogs become bottom sheets, taps are 44 px, inputs are 16 px,
  and there is no intro (mobile.md §4, §8).
- **Zoom.** Upright phones never zoom; landscape does (mobile.md §1).
- **The page stays still.** While a sheet is open the page behind cannot scroll; only what can still scroll moves
  (mobile.md §2).
- **Closing.** Every sheet closes with a tap outside or a pull down; there is no half-height state (mobile.md §3).
- **Keyboard.** The chat sheet fits above the keyboard and re-measures a few times while it settles (mobile.md §5).
- **Safe areas.** Sheets keep room for the home indicator, also in the Home Screen app (mobile.md §6).
- **Selection.** On touch screens one Comment bar docks at the bottom (mobile.md §7).
- **A real phone.** The checklist in mobile.md §10.

---

## 7. Feedback and timing

### 7.1 At once

| What | Feedback | Source |
|---|---|---|
| Notification switch | The switch moves at once; it moves back with "Couldn't save. Try again." if saving fails | `push/site/js/push.js:178-196` |
| Calendar legend | Hides or shows that calendar's events at once; saved in this browser | `calendar.js:671-679` |
| References search and chips | The list filters on every keystroke (no debounce) | `refs.js:180-190` |
| Theme and language | Switch at once and are saved | `ds/theme.js:27-37`; `ds/i18n.js:39-45` |
| Delete (calendar, chat) | The button arms at once ("Click again to delete", "Delete?") | `calendar.js:546-552`; `chat.js:546-551` |
| Save, Send, seed | The button disables while the request runs ("Saving…", "Adding…") | `calendar.js:528-530`, `:682-683`; `chat.js:530` |
| Chat text box | Grows with the text up to 132 px | `chat.js:508-512` |

### 7.2 Short delays and timers

| What | Delay | Source |
|---|---|---|
| Title focus in the event sheet | 30 ms | `calendar.js:498` |
| Copy · Comment bar after a mouse selection | 10 ms | `chat.js:637` |
| Comment bar after a touch selection | 400 ms | `chat.js:637` |
| Bar hides after the selection collapses | 150 ms | `chat.js:642` |
| "Copied" then the bar hides | 0.9 s | `chat.js:653` |
| Chat delete stays armed | 3 s | `chat.js:550` |
| Chat marks redraw | 60 ms debounce | `chat.js:321-324` |
| Chat panel hidden after closing | 260 ms | `chat.js:458` |
| Chat sheet re-measures for the keyboard | 0, 120, 400, 800 ms | `chat.js:426` |
| Jump to a comment's mark | waits up to 6 s (same page) or 10 s (from a link) | `chat.js:384`, `:398` |
| Calendar banner shake (read only) | 300 ms | `calendar.js:623-627` |
| Calendar week slide | 240 ms | `calendar.js:374` |
| Calendar swipe (phones) | under 700 ms, over 56 px, mostly sideways | `calendar.js:376-389` |
| Now line | moves every 30 s | `calendar.js:322` |
| Sheet pull down | decides after 8 px; closes past 110 px or a flick (> 36 px at > 0.55 px/ms); closes after 240 ms, springs back in 280 ms | `ds/sheet.js:62-108` |
| First-visit order | 600 ms after load (no intro) or 400 ms after the intro ends | `guide/site/js/first-visit.js:21-23` |
| Install pop-up closed → next step | 300 ms | `push.js:236` |
| Installed app's first-start sheet | 400 ms | `push.js:255` |
| Guide start | 400 ms after the member is known; 120 ms after the name menu closes | `guide.js:67`, `:303` |
| Guide step movement / fade out | 280 ms / 240 ms | `guide.js:22`, `:279` |
| Theory place saved | 700 ms after scrolling stops | `theory-tab.js:143-150` |
| Reader place saved | 400 ms after scrolling stops; not in the first 600 ms | `reader.js:231-232` |
| Intro: Skip fade, replay fade, leave | 0.5 s, 0.65 s, 260 ms | `intro/intro.js:43` |
| Intro: wheel and touch swallowed after the end | until 180 ms pass with no input (400 ms if none comes), at most 1.5 s | `intro.js:180-188` |
| Intro: dimmed arrival lifted anyway | 4 s | `intro.js:234` |

### 7.3 Flashes (where something you jumped to lights up)

| What | Length | Source |
|---|---|---|
| Reader: equation, figure or heading you jumped to | 2 s | `notes/css/reader.css:133` |
| Theory tab: target of an in-chapter link | 1.8 s | `notes/css/theory.css:67` |
| Chat: a comment opened from its mark | 1.6 s | `chat/css/chat.css:53` |
| Text: a mark opened from its comment | 1.8 s | `chat.css:129` |

There are no toasts. Success shows as the result itself: the sheet closes and the event appears, the message appears in
the list, the status line changes.

### 7.4 Polling and refresh

| What | Interval | Conditions | Source |
|---|---|---|---|
| Calendar | 60 s | Tab visible, the calendar is the active tab, the event sheet is closed | `calendar.js:20`, `:705` |
| Calendar on return | when the window gets focus after more than 15 s | same, sheet closed | `calendar.js:706` |
| Chat, open | 4 s | page visible | `chat.js:29`, `:229` |
| Chat, closed | 45 s | page visible | `chat.js:29`, `:229` |
| Chat, not connected | 5 min | page visible | `chat.js:29`, `:229` |
| Chat on return | at once when the page becomes visible | — | `chat.js:231` |
| Notification tick | every minute | the cron Worker calls `/api/push/tick` | `ios-webapp-push/SKILL.md:68` |
| Retries of a failed push | after 1, 2, 4, 8 minutes, at most 4 tries | — | `ios-webapp-push/references/server.md:70` |
| Research log, References, Theory | never | read once per page load | `records.js:77-87`; `refs.js:69-77`; `theory-tab.js:49-53` |
| Sign-in check on the server | cached 60 s per session; the allow-list is read on every request | — | `gate/lib/auth.js:193-215` |

---

## 8. Not handled, and where docs and code differ

### 8.1 Not handled

Each line is something the code does not do. They are listed so nobody assumes it does.

- Arrow keys inside tab lists (`role="tab"` without roving focus).
- Focus back to the chat button after the chat closes (`chat/js/chat.js:444-460`).
- A "discard changes?" check when the event sheet closes with edits (`cal/js/calendar.js:578-579`).
- An empty-state line in the calendar's day list (`calendar.js:584-593`).
- Clearing this browser's saved state on sign-out (§2.10).
- Unsubscribing the device on sign-out (§2.10).
- Working offline: the service worker caches nothing on purpose (`push/site/sw.js:1-2`; `ios-webapp-push/SKILL.md:21-22`).
- Debounce on the references search (`refs/site/js/refs.js:188-190`).
- Notifications for chat messages: the push skill sends only calendar alerts (`ios-webapp-push/SKILL.md:3`).
- Korean words for the Calendar, Research log, References and Theory UI (§4.2).
- A reload into the sign-in page from the static tabs and the bell sheet when a session ends (§2.10, step 6).
- Live updates of the Research log, References and Theory: they need a page reload after a deploy.

### 8.2 Where docs and code differ

Found while writing this page. These were fixed in the docs alongside it: the Korean content-tab strings
(`language.md` now says the skills ship English tables), the dark `theme-color` (only the browser bar is `#000000`),
"nothing pulses" (the sync dot does), the quiet reload (no pulse), reduced motion (what stops and what stays, in
`design.md` §10), `toLocaleTimeString` for the sync note, and the push switch subtitles in the design-system demo. The
rows below are still open.

| Topic | Doc says | Code does | Files |
|---|---|---|---|
| Chat time zone | Set `{{TIMEZONE}}` | `chat-util.js` hard-codes `"Asia/Seoul"` with the placeholder only in a comment | `chat/js/chat-util.js:4` |
| Session end in the bell sheet | Calendar and chat reload into the sign-in page on a 401 | `push.js` has its own `api()` without that reload; the sheet then says "Notifications aren't set up on the server yet." | `push/site/js/push.js:26-31`, `:129-142` |
| Session end in static tabs | — | `/data/*.json` gets 401 text; the tabs show their load-failed or empty text instead of sending the person to sign in | `gate/functions/_middleware.js:246`; §2.10 step 6 |
| Chat offline | "Chat isn't connected yet." is the not-set-up line | Any network failure shows the same line and switches to 5-minute polling | `chat/js/chat.js:219`, `:229` |
| Calendar after a network blip | — | One failed quiet reload leaves the calendar in error mode with the preview schedule until **Try again** or a reload, because quiet loads skip `/api/status` | `cal/js/calendar.js:73-105` |
| Papers list link | "Edit the list in references/papers.csv" | The link opens the file's view page (`/blob/`), not the editor | `refs/site/js/refs-strings.js:10`; `refs.js:154` |
| Intro Skip target | Point Skip at `#calendar` | The markup ships `href="#home"` (a step for the builder to change) | `scroll-3d-intro/SKILL.md:55`; `intro/intro-markup.html:27` |
| Theme button label | — | Header theme buttons have a `title` but no `aria-label`; the reader's has both | `ds/demo/index.html:48`; `notes/reader.html:29` |
| Sign-in failures | Failures 1–7 answer 403 | True. A Google-side error other than Cancel shows "Couldn't sign in. Try again." with status 200; security.md does not cover it | `google-signin-team-gate/references/security.md:56-57`; `_middleware.js:268` |
| Install pop-up in KakaoTalk | The pop-up has a KakaoTalk variant | Behind the sign-in gate, KakaoTalk's browser sees the sign-in page ("Open in Safari") first, so the variant may only show without the gate (unverified) | `push/site/js/push.js:86-96`; `gate/functions/_middleware.js:155-169` |
