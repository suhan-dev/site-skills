# Decisions: what was chosen, and what was tried and dropped

The calendar was built in about ten rounds. Each pair below is **before → after**, with the commit (short hash) and
pull request (#n) where the change landed in the source site, and the reason. Read this before you "improve" a rule:
most of the obvious alternatives were tried.

## Where the data lives

- **Google Calendar is the only store.** The site keeps nothing of its own: no database rows, no cache file. Members
  can still add and edit events in the Google Calendar app on their phones, and the site shows those edits within a
  minute. A second store would have to be kept in sync and would drift.
- **A service account, not each member's Google login.** The site writes to one shared calendar with one robot account.
  Members never grant the site access to their own calendars, and "who added it" is still recorded, from the site's
  sign-in session, in `extendedProperties.shared`.
- **"Added by" comes from the server.** Before: the page sent `who` (a member id picked on the page). After: the server
  takes it from the signed-in session and ignores `who`. A page-supplied name can be faked; the session cannot.
- **Colour follows the owner.** Every event belongs to one calendar ("Team", "Official", or a member). The page sends
  that owner's Google `colorId`, so the same colour shows in Google Calendar too.

## Look

| Before | After | Why | Where |
|---|---|---|---|
| A month grid only, serif title, cards with borders | Apple-style week view as the default, month as the second view | A team plans by the week; the month hid times | 0fd3253 → f8aa765 (#1) |
| Boxed cards and tinted banners | Hairlines (`.5px --sep2`) between sections; banners are a 2 px left rule and text | Less chrome; the events carry the colour | 23b4244 |
| Legend as filled pills | Legend as dots with text; a hidden owner gets a hollow dot | Pills competed with the events | 23b4244 |
| Week blocks clamped to their height, short ones marked "short" with the title cut | A block grows down to the next event in its day to show its whole title; it lifts on hover | Titles were unreadable in 30-minute blocks | 15a38cc (#4) |
| Dark mode on pure black `#000` | Apple's dark grey `#1c1c1e`, fainter lines, today's tint 3 % instead of 5 % | Pure black made the hairlines and tints harsh | 642bb89 (#5) |
| A "home band" above the calendar (program line, four KPIs, a ten-week bar) | Removed; the calendar starts right under the header | The band pushed the calendar below the fold and repeated what the tabs show | f83fdf2 (#6) |
| Weekend columns shaded grey | No weekend shading | A research team works weekends; grey read as "off" | 2e33eba (#35) |

## Time

| Before | After | Why | Where |
|---|---|---|---|
| A day ran 00:00 → 24:00; a 23:00–01:30 session was cut into two blocks on two columns | A calendar day runs 07:00 → 07:00. The late session is one block at the bottom of the day it started. A midnight line marks 00:00 | Late lab nights are normal; cutting them in two hid them | 2e33eba (#35) |
| The week opened scrolled to 08:00 | It opens at the top (07:00), or centred on now when now is lower down | 07:00 is now the top of the day | 2e33eba (#35) |
| Fixed `+09:00` offsets in the server | (in this skill) any IANA zone via `Intl`, DST-aware, tested in `America/New_York` | Make the skill usable by any team | this skill |

See [time-model.md](time-model.md) for the rule and its consequences.

## Size and head row

| Before | After | Why | Where |
|---|---|---|---|
| Week body `max-height: min(720px, 100vh − 150px)`: on a tall screen it stopped short, on a short one the page scrolled too | The grid fills the window from where it starts (`fit()` measures `--cal-top`); the hours scroll inside it | One screen, nothing to scroll twice | 454feb4 (#35) |
| Separate ‹, Today, › buttons and a text "Week \| Month" switch with a divider | `‹ Today ›` in one pill and Week \| Month as a segmented control, on the title's row | One row, the same controls as Apple Calendar | 454feb4 (#35) |
| The head ran off the right edge at some widths; New event stuck out | `.cal-end` wraps to a second line, still on the right | Every width from 320 to 1440 must fit | 73ebbe6 (#30) |

## Phones

| Before | After | Why | Where |
|---|---|---|---|
| The phone week scrolled sideways (`min-width: 640px` columns) | The whole week fits the width: weekday letters over the dates, small titles cut with an ellipsis | Sideways scrolling inside a page that also scrolls was confusing | 9308aba (#14) |
| Phone month showed event words, broken mid-word in 50 px cells | Each event is a thin colour bar; a tap on the day opens its week | Words cannot fit; colour still shows "busy" | 15a38cc (#4), 9308aba |
| Small tap targets | Every control at least 44 px to tap; small pills keep their look with an invisible 44 px `::after` | Apple's guideline; misses were common | 9c73ae8 (#14) |
| A two-row phone head (title, then buttons) with New event and the sync note | One row: month name, `‹ [25] ›` with a calendar-page Today glyph, Week \| Month. No New event, no sync note: a tap on the calendar adds | Height for the calendar; tapping a slot is faster than a button | 454feb4 (#35) |
| Only the arrows changed the week | A quick sideways swipe (> 56 px, < 700 ms, clearly sideways) changes it, with a 240 ms slide | The phone gesture people expect | 454feb4 (#35) |
| Pinch and double-tap zoomed the page, and the grid panned | No zoom on an upright phone (viewport script + `gesturestart`), `touch-action: pan-y` on the grid | Zooming broke the one-screen layout | 454feb4 (#35) |
| The event editor was a centred dialog on phones; Starts/Ends sat in one cramped row (`1.25fr .9fr`), the time lost its AM/PM, the sheet overlapped and panned sideways, iOS zoomed into fields | A bottom sheet; Starts and Ends one row each (word, date, time); 16 px fields; on desktop the dialog is 620 px so a time keeps its AM/PM | The iPhone editor was unusable | 623cf11 (#35) |
| On phones, overlapping events split one ~40 px day column side by side; at 320 px each showed one letter ("D…", "r…") | One block per overlap group from its first start to its last end, the first title and "+n"; a tap opens the day's list. Wider screens keep side-by-side columns | Unreadable blocks; the day list already shows each event in full | 29f8f93 (#40) |

## Against the owner's design brief

The brief (written before the build) asked for a few things the result does differently, on purpose:

| Brief | Built | Why |
|---|---|---|
| Today marked by a thin ring | A filled accent circle around the date | A thin ring was hard to see in dark mode and on phones; this is also Apple Calendar's mark |
| Three meaning colours for event kinds | One colour per owner (team, official, each member) | The team wanted to see whose event it is at a glance; "official" keeps red for deadlines |
| A "today's status" band with KPIs above the calendar | Removed (f83fdf2) | See "Look" above |

## Small rules that came from bugs

- **The seed is idempotent.** Pressing "Add official schedule" twice must not double the schedule. Fixed ids, plus
  "restore if deleted" and "skip if a hand-made twin exists", make any number of presses safe.
- **Deleting twice is a success.** Google answers 410 for an event that is already gone; the server treats it as done,
  so two teammates deleting at once both see success.
- **A PATCH between all-day and timed sends `null` for the other kind of date.** Google merges PATCH bodies; without the
  nulls, an event keeps both a `date` and a `dateTime` and Google refuses it.
- **Polling never runs while the sheet is open**, and one request runs at a time (`busy` / `again`). Before, a reload
  during an edit could overlap with the save.
- **Google's 401 and 403 become 502.** The visitor is signed in; it is the server's robot that is refused. A 401 would
  read as "your sign-in expired" to the page.
- **iOS date inputs keep a built-in minimum width** and spill into the next column. `min-width: 0` and
  `appearance: none` on `.dt-row input` fix it.
