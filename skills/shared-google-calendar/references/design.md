# Design: the shared calendar

Everything needed to rebuild the calendar's look without seeing the original. Values come from
`assets/site/css/calendar.css` and `assets/site/js/calendar.js`. All values are CSS px.

Colours are tokens from the design system: [tokens.css](../../team-site-design-system/assets/tokens.css), described in
[team-site-design-system/references/design.md](../../team-site-design-system/references/design.md). This file names the
token and never repeats its value. The shared pieces (`.btn`, `.dlg`, `.fld`, `.seg`, `.chk`, `.banner`, `.card-h`,
`.icon-btn`) come from [components.css](../../team-site-design-system/assets/components.css). The calendar only adds
its own rules on top.

## 1. Look in one paragraph

The calendar looks like Apple Calendar on a white (or `#1c1c1e`) page. It uses hairlines, not boxes. Week view is the
default. Every event takes its owner's colour: a light tint of that colour as the fill, darker text in the same hue,
and a 3 px solid edge on the left. Today is a filled accent circle around the date. There is no weekend shading. On a
phone the whole calendar is one screen: the header, one head row, and the grid down to the bottom edge.

## 2. Breakpoints

| Width | Layout |
|---|---|
| ≥ 1101 | Two columns: the calendar (`minmax(0,1fr)`) and a 312 px right column, gap 28. The right column is sticky at `top:72px`. |
| 761–1100 | One column. The right column moves under the calendar as a grid of cards (`repeat(auto-fill,minmax(260px,1fr))`). |
| ≤ 760 | Phone. One head row, no sync note and no New event button. Month events become colour bars. The sheet is a bottom sheet. The swipe gesture is on. |
| ≤ 460 | Only the header changes (design system). The calendar is the same as at 760. |
| ≤ 374 | Head gap 6, title 19 px. |
| ≤ 340 | Title 17 px. Prev/next buttons 26 wide. Segment buttons 12 px with 7 px side padding. "Starts" and "Ends" go back above their fields. |
| `pointer:coarse` and ≤ 760 | Chrome's date and time picker icons are hidden (a tap anywhere on the field opens the picker). |
| `hover:hover` and `pointer:fine` | The week body uses `overscroll-behavior:contain`, so the mouse wheel scrolls the hours without scrolling the page. |

JS uses the same 760 px line: `matchMedia("(max-width: 760px)")`. When the width crosses it (rotation, resize), the
grid is drawn again for the other width with the same dates.

## 3. Layout sketches

### 1440 × 900, week view

```
┌ header (sticky glass, 52) ─────────────────────────────────────────────────────────────────────────┐
│ Example Lab    Calendar  Research log  References                              (•) Alex   ☾       │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
  Nov 22 – 28, 2026   (‹ Today ›)  (Week|Month)                        ● Synced 2:20 PM   [+ New event]
  ─────────────────────────────────────────────────────────────────────────── ┬  Upcoming
        Sun 22  Mon 23  Tue 24  Wed (25)  Thu 26  Fri 27  Sat 28               │  ─────────────────
  all-day        ▌Equipment…  ▌Report due      ▌Workshop ───────────────────   │  MON  ● Weekly sync
  ─────┼───────┼───────┼───────┼────────┼───────┼───────┼───────              │   23    09:00–10:00 · Room 101
  08:00│       │▌Weekly│       │▌Stand-up│       │       │                     │  …
  09:00│       │ sync  │       │        │       │       │                      │  Calendars  Click to hide
  10:00│       │▌Des…▌Data     │        │       │       │                      │  ● Team ● Official ● Alex
   …   │       │       │       │ ━━━━━━━━ now line (2 px accent, 10 px dot)    │  ● Blair ● Casey
  00:00│ ───────────── midnight line (1 px --sep2) ───────────────────────     │  Google Calendar
  06:00│       │       │       │        │▌Late  │       │                      │  Connected to Example Lab…
  ─────────────────────────────────────────────────────────────────────────── ┴  (Open in Google Calendar ↗)
```

The grid's height runs from where it starts to 28 px above the window's bottom edge (see §5, `fit()`).

### 1024 (761–1100), month view

```
  November 2026  (‹ Today ›) (Week|Month)                     ● Synced 2:20 PM  [+ New event]
  ────────────────────────────────────────────────────────────────────────────────────────────
                Sun      Mon      Tue      Wed      Thu      Fri      Sat     (right-aligned)
  ┌────────┬────────┬────────┬────────┬────────┬────────┬────────┐
  │      1 │      2 │      3 │      4 │      5 │      6 │      7 │  dates at top right, 26 px
  │        │•09:00 W│        │        │        │        │        │  timed: dot · time · title
  │        │        │▌Report…│        │▌Workshop─────────────────│  all-day: tinted bar
  ├────────┼────────┼────────┼────────┼────────┼────────┼────────┤  each week ≥ 118 px, the weeks
  │  …     │        │        │  (25)  │        │        │ +2 more│  share the window's height
  └────────┴────────┴────────┴────────┴────────┴────────┴────────┘
  Upcoming            │ Calendars           │ Google Calendar        ← cards, auto-fill ≥ 260 px
```

### 390 × 844 phone, week view

```
┌──────────────────────────────────────┐
│ Example Lab            (•)  ☾        │  header row 1 (44 px targets)
│ Calendar  Research log  References   │  header row 2 (tabs 38 px)
├──────────────────────────────────────┤
│ November        (‹ [25] ›)(Week|Mon) │  one head row, min 44 px; Today = page glyph with the date
│ ──────────────────────────────────── │
│      S   M   T  (W)  T   F   S       │  weekday letter over the date
│ all  ▌Eq▌Re      ▌Workshop──         │  all-day bars 19 px, one line, ellipsis
│ 08 ─┼───┼───┼───┼───┼───┼───┼──      │  36 px gutter, 9.5 px labels
│ 09  │   │▌We│   │▌St│   │   │        │  blocks keep their height, titles clamp
│ …   │   │   │   ━━━━ now             │
│ 00 ═══════ midnight ═══════════      │
│ …                                    │  the grid ends at the bottom edge (100dvh)
└──────────────────────────────────────┘
```

No New event button and no sync note. A tap on an empty slot adds an event at that hour. A sideways swipe changes the
week.

### 390 phone, month view

```
│ November        (‹ [25] ›)(Week|Mon) │
│   S    M    T    W    T    F    S    │
│   1    2    3    4    5    6    7    │  dates 26 px, cells ≥ 88 px
│  ▬▬▬  ▬▬▬                            │  each event = 5 px colour bar, 3 px gap
│       ▬▬▬                  +2        │  "+n" centred at the bottom
```

A tap anywhere in a day opens that day's week.

### 390 phone, event sheet (bottom sheet)

```
│░░░░░░░░░ dimmed page, 6 px blur ░░░░░│
╭──────────────────────────────────────╮  radius 18 18 0 0
│ New event                        (×) │
│ Title  [ e.g. Design review        ] │  16 px text: iOS does not zoom
│ Calendar (●Team)(●Official)(●Alex)…  │
│ [✓] All day                          │
│ Starts  [ Nov 25, 2026 ] [ 2:00 PM ] │  one row: word · date · time
│ Ends    [ Nov 25, 2026 ] [ 3:00 PM ] │
│ Location [                         ] │
│ Notes    [                         ] │
│ [ Delete ] [ Google Calendar ↗ ] [○ 2]│  only for an existing event (○ 2: Comment, optional)
│ [   Cancel    ]  [     Save       ]  │  Cancel and Save share the last line
╰──────────────────────────────────────╯  + safe-area inset at the bottom
```

## 4. Head row

| Part | Desktop | Phone (≤ 760) |
|---|---|---|
| `.cal-head` | flex, wrap, `gap:8px 14px`, margin-bottom 14 | no wrap, gap 8, margin-bottom 8, min-height 44 |
| `.cal-title` | 26 / 700 / line-height 1.2 / letter-spacing −.025em, `min-width:8.4em` (the pill does not jump when the title changes length) | 20 px, `flex:1 1 auto`, one line with ellipsis. 19 at ≤ 374, 17 at ≤ 340 |
| Title text | week "Nov 22 – 28, 2026", across months "Nov 29 – Dec 5, 2026", across years "Dec 27, 2026 – Jan 2, 2027"; month "November 2026" | the month only ("November", "Nov – Dec"), plus the year when it is not this year |
| `.cal-nav` pill | `‹ Today ›` in one track: padding 2, radius 999, `--fill`. Buttons 28 high, 12 px side padding, 13 px text, no fill; hover `--fill`. ‹ › are 30 wide with 16 px icons, stroke 2.3 | buttons 30 high, 11 px padding. Today becomes a 34-wide button holding a calendar-page glyph (`.tdy`): 18 × 18, 1.5 px border, 3.5 px top border, radius 4.5, today's day number in 700 9.5 px |
| `.cal-view` segmented | Week / Month: track like the pill; buttons 28 high, min-width 62, 13 px / 500, `--ink2`. Selected: `--seg-on` knob, `--ink`, 600, shadow `0 1px 3px rgba(0,0,0,.1), 0 0 0 .5px rgba(0,0,0,.04)`. Background and colour change in .15 s | buttons 30 high, min-width 0, 10 px padding |
| `.cal-end` | margin-left auto, gap 12: the sync note and **New event** (`.btn.primary` with a + icon). Wraps to a second line, still on the right, when the column is too narrow | hidden |
| 44 px tap area | – | every pill and segment button gets an invisible `::after` 44 px tall, centred, so the row stays 30 px high to the eye |

The sync note (`.sync`) is a 7 px dot and 12 px `--ink3` text with tabular numbers:

| State | Dot | Text |
|---|---|---|
| first load | `--ink4` | Loading |
| a request is running | dot pulses (opacity 1 → .3 → 1, 1 s, ease-in-out, infinite) | Syncing |
| live | `--ok` | Synced 2:20 PM (tooltip: refreshes every minute and on return) |
| not connected | `--warn` | Not connected |
| error | `--bad` | Calendar error |

## 5. Week view

### The grid

| Part | Value |
|---|---|
| Hour height | `HOUR_PX = 46` (`--wv-h`). 24 rows = 1104 px |
| Gutter | `--wv-gut` 56 (phone 36) |
| Columns | `var(--wv-gut) repeat(7, minmax(0,1fr))`. Every column is the same width; the week always fits the width |
| Body height (desktop) | `max(440px, calc(100vh − var(--cal-top) − 28px))` |
| Body height (phone) | `max(320px, calc(100dvh − var(--cal-top) − 1px))`, with a `100vh` fallback first |
| Scroll | the body scrolls the hours (`overflow:auto`, thin scrollbar). The day header and all-day row stick to its top (`.wv-top`, z 4, `--paper`). The gutter sticks to the left (z 2) |
| Hour lines | the column's background draws a 1 px `--sep` line at the bottom of every hour: `repeating-linear-gradient(to bottom, transparent 0 calc(var(--wv-h) − 1px), var(--sep) … var(--wv-h))` |
| Column divider | `border-left:.5px solid var(--sep)` |
| Grid top and bottom | `.5px solid var(--sep2)` (phones: no bottom line in week view) |
| Midnight line | `.wv-mid`: 1 px `--sep2` across all days at `(1440 − DAY0)/60 × 46 = 782 px`. Only when `DAY_START_HOUR ≠ 0` |
| Hour labels | 10.5 / 500 `--ink4`, right 8, centred on the line (`translateY(−50%)`). From DAY0 + 1 h to DAY0 − 1 h ("08:00" … "06:00"); the top edge is 07:00 and has no label. Midnight label `.mid`: `--ink3`, 600. Phone: 9.5 px, right 4 |
| "all-day" gutter word | 10.5 / 500 `--ink4`, padding `6px 8px 0 0`. Phone 9 px, `7px 3px 0 0` |

`fit()` measures where the grid starts (from the top of `frame`, the scrolling element) and writes it to `--cal-top`.
It runs after every render, on window resize, and when the head, banner or site header changes size
(`ResizeObserver`). So the grid always ends at the bottom of the window, whatever the head wraps to. With no measure
yet, the fallbacks are 170 px (desktop) and 160 px (phone).

### Day header (`.wv-dh`)

- Desktop: weekday (11.5 / 600, letter-spacing .01em, `--ink3`) and date (`.wv-dn`: 28 × 28 circle, radius 14,
  17 / 600, −.02em, `--ink`, tabular) on one baseline, gap 6, padding `9px 4px 8px`.
- Phone: the weekday's first letter (11 px, line-height 14) over the date (15 px, 26 × 26), gap 1, padding `6px 0`.
- Today: the weekday turns `--accent`; the date sits in a filled `--accent` circle with `--on-accent` text.
- Hover: the date gets a `--fill` circle (today keeps its accent).
- A click opens the one-day list.

### Today's column

- `.wv-col.today` and `.wv-allcell.today` get `color-mix(in srgb, var(--accent) var(--today), transparent)` (5 % light,
  3 % dark).
- The now line: 2 px `--accent` from 1 px left of the column to its right edge, z 3, with a 10 px accent dot at its left
  end (left −5, top −6).
- The now label in the gutter: accent pill (radius 5, padding `1px 4px`, 600, `--on-accent`) with "14:20". The hour
  label within 14 minutes of it fades out (`opacity 0`, .2 s) so the two never overlap.
- `updateNow()` runs every 30 s. When the calendar day changes at 07:00, it redraws the whole grid.

### Timed blocks (`.wv-ev`)

- Position: `top = minutes from DAY0 / 60 × 46`; height `--hh = max(length × 46 / 60 − 2, 20)`.
- Fill `color-mix(--c var(--ev-bg), --paper)`. Text `color-mix(--c var(--ev-ink), var(--ev-mix))`. A 3 px `--c` edge on
  the left (`inset 3px 0 0`). A 1 px `--paper` ring, so neighbours stay apart.
- Radius 6. Padding `3px 6px 3px 9px`. 12 px, line-height 1.25, −.01em. Title 600 (breaks between words only); the time
  "10:30–12:00" 11 / 500 at opacity .8, tabular.
- **Grows to show its words.** `--hmax` is the room up to the next event in the same day (or the day's end). The block
  is at least its own height and at most `--hmax`, so a short block with a long title still shows the whole title when
  there is free space below it.
- Hover and keyboard focus: fill + 8 %, z 5, no max height, shadow `0 8px 22px rgba(0,0,0,.14)`.
- Overlaps: `packDay()` gives each block a column `k` of `n`. Width `100/n %`, 2 px gap on each side (phone 1 px).
- Phone: the block keeps exactly its own height (no growing; there is no room). Padding `2px 1px 2px 5px`, radius 4,
  10.5 px / line-height 13, −.015em. The title is clamped to `--cl` lines with an ellipsis, never split inside a word.
  `--cl = max(1, floor((h − 4 − time) / 13))`. The start time (10 px, line-height 12) is shown only in a full-width block
  tall enough for two title lines and the time (`h − 4 ≥ 39`).

### All-day row (`.wv-all`)

- Holds all-day events and anything that does not fit one calendar day (for example 06:00–08:00, which crosses 07:00,
  or 18:00 → 10:00 the next day).
- Lanes: rows `minmax(21px, auto)` (phone 19), gap 3, padding `4px 0 5px`. Empty row: 30 px high.
- At most `MAX_LANES = 3` lanes. The rest is counted per day and shown as "+2 more" (11.5 / 600 `--ink3`, radius 5;
  phone "+2" centred, 11 px, with the full words in `aria-label`). When any day has more, the lanes get 22 px of bottom
  padding (phone) so "+n" has its own line.
- Bars: see §6 (the same `.ev.allday` and `.ev.timed` pieces as the month).
- A click on an empty all-day cell starts a new all-day event on that date.

### Scroll position

- First look at a week: scrolled to the top (07:00).
- When the week holds today and now is below the visible part (minus one hour), the body is scrolled so that now is in
  the middle.
- When the same week is drawn again (polling, an edit), the scroll position is kept.

### Tap on an empty slot

Row `i` (0–23) from the pointer's y. Its hour is `(i + DAY0/60) % 24`. Rows after midnight belong to the next date. The
editor opens with that hour to the hour after (the 23:00 row ends at 00:00 the next date). Before Google is connected,
the tap opens the one-day list instead.

## 6. Month view

| Part | Value |
|---|---|
| Weekday row (`.dow`) | 11.5 / 600 `--ink3`, right-aligned, padding `9px 10px 7px`, `.5px --sep2` under it |
| Week row (`.week`) | min-height 118 (phone 88), `.5px --sep` between weeks. The weeks share the window's height: the grid is `min-height: max(520px, calc(100vh − var(--cal-top) − 28px))` and each week is `flex: 1 0 auto` |
| Day cell (`.day`) | `.5px --sep` on the right, padding `5px 6px` (phone 3), right-aligned. Hover: `--fill` at 60 % (.12 s) |
| Date (`.dn`) | 26 × 26 pill, radius 13, 13 / 500, tabular. The 1st shows "Dec 1". Days from other months: `--ink4` at opacity .7 |
| Today | the date in a filled `--accent` circle, `--on-accent`, 600 |
| Selected day (`.day.sel`) | `inset 0 0 0 2px var(--accent)` |
| Lanes | over the cells, `margin-top:34px` (phone 32), rows `minmax(21px, auto)`, gap 3, bottom padding 24 for "+n more". The lanes let clicks through to the day; bars take their own clicks |
| "+n more" | bottom 4, left and right 6, 11.5 / 600 `--ink3`, hover `--fill` |

Event pieces (`.ev`), shared with the week's all-day row:

- Base: min-height 21, radius 5, padding `2px 7px`, 12 / 500, line-height 17, −.01em, margin `0 4px`. In the month,
  one line with an ellipsis; the full title is in the tooltip and the day list.
- **All-day bar** (`.ev.allday`): owner-tint fill, owner-ink text, a 3 px `--c` edge on the left, padding-left 9. Hover
  fill + 8 %.
- **Continues past the week's edge:** `.cont-l` loses its left radius, its left margin and its edge stripe (it started
  in the week before); `.cont-r` loses its right radius and right margin.
- **Timed event in a cell** (`.ev.timed`): no fill, `--ink` text, a 7 px `--c` dot, then the start time (11 px
  `--ink3`, tabular), then the title. Hover `--fill`.
- **Preview** (Google not connected): 135° stripes, `transparent 0 5px, color-mix(--paper 55%, transparent) 5px 10px`,
  over the event. The same stripes on week blocks.

Phone month: every event is a thin colour bar with no words, so nothing breaks or overflows. Bars are 5 px high, radius
3, margin `0 3px`, gap 3. Timed events are solid `--c`; all-day bars are `--c` at 70 % over `--paper`. Bars ignore taps;
a tap anywhere in the day opens that day's week. "+n" is 11 px, centred at the bottom.

## 7. Right column

Three cards, each `padding:14px 0 0` with a `.5px --sep2` line on top (no boxes), gap 26.

**Upcoming.** The next 7 visible events from today, sorted by date, then all-day first, then time.

- Row button: grid `42px minmax(0,1fr)`, gap 10, padding `7px 8px`, radius 10, hover `--fill`. The list has `margin 0 −8px`
  so the text lines up with the card title.
- Date stamp: the weekday 10.5 / 600 uppercase `--ink3` (.02em) under a 20 / 600 day number (`--ink`, −.02em, tabular).
- Title: 13.5 / 500, line-height 1.4, after a 7 px owner dot.
- Meta: 12 px `--ink3`, line-height 1.45, indented 14 to line up with the title: "09:00–10:00 · Room 101", or
  "Nov 27 → Nov 28", or "All day".
- Empty: "Nothing scheduled." 13 px `--ink3`.

**Calendars** (legend, title with "Click to hide" in 12 px `--ink4`). Each owner is a 28 px row (phone 44): a 9 px dot
and 13 / 500 text, gap 7, rows `gap:2px 14px`. Hidden: `--ink4` text and a hollow dot (`inset 0 0 0 1.5px --c`),
`aria-pressed=false`. The choice is kept per browser (`PREF_PREFIX + "hidden"`).

**Google Calendar.** Title with a 16 px calendar-page glyph drawn in CSS (1.5 px `--ink3` outline, 5 px solid top).

| State | Body |
|---|---|
| live | "Connected to **Example Lab**. Changes here go straight to Google Calendar…", then **Open in Google Calendar ↗** (`.btn.ghost.small`) and, while `seeded` is false, **Add official schedule** (`.btn.primary.small`; "Adding…" while it runs, "Failed: …" on error) |
| preview | "Not connected yet." in `.muted` |
| error | the mapped error sentence and **Try again** (`.btn.ghost.small`) |

Text 13 px `--ink2`, line-height 1.5; ids in `--mono` 11.5 px `--ink3`.

## 8. Banner

`.banner` from the design system: a 2 px left rule, 13.5 px `--ink2`, no box.

| Mode | Rule | Text |
|---|---|---|
| preview | `--warn` | "Google Calendar isn't connected yet. Striped events are a preview of the official schedule." |
| API unreachable | `--warn` | "Couldn't reach the events API." |
| error | `--bad` | **Couldn't connect to Google Calendar.** + the mapped sentence |
| live | hidden | – |

A tap that would add an event while not connected shakes the banner instead: `translateX(0 → −6 → 6 → 0)`, 300 ms.

## 9. Event sheet

Desktop: a centred dialog (`.dlg`), 620 px wide (`min(620px, 100vw − 32px)`; other dialogs are 560), radius 20,
`--card`, `--shadow`, padding `20px 22px`, rows gap 14. The backdrop is `rgba(0,0,0,.28)` with a 6 px blur. It opens
with `dlg-in` (.22 s `cubic-bezier(.2,.8,.2,1)`, from opacity 0, 8 px lower, scale .98).

Phone: a bottom sheet. Full width, radius `18px 18px 0 0`, max-height `calc(100dvh − 32px)`, scrolls inside
(`overscroll-behavior:contain`), padding `18px 16px calc(20px + safe-area-inset-bottom)`. It slides up with `dlg-sheet`
(.32 s, same easing, from `translateY(100%)`). Inputs are 16 px so iOS does not zoom in on focus.

Fields, top to bottom:

1. **Title** (`.fld`, 38 px high, phone 44; radius 10; `--fill`; focus `--card` with a 1 px accent ring and a 4 px
   accent glow at 22 %). Required, max 300. Focused when the sheet opens.
2. **Calendar** owner pills (`.seg`): 30 px high, radius 999, `--fill`, a 9 px `--c` dot, 13 / 500 `--ink2`. Chosen:
   owner tint over `--card`, `--ink`, 600, `inset 0 0 0 1.5px --c`. Focus: 3 px accent outline at 55 %. Phone gap
   `10px 8px` and 44 px tap areas. The new event's owner is the signed-in member.
3. **All day** (`.chk`, 16 px box; phone 18 px, 15 px text, 44 px row).
4. **Starts → Ends** (`.dt-row`).
   - Desktop: one row, `date | time | → | date | time` (`1fr 1fr auto 1fr 1fr`, gap 8). A time gets as much room as a
     date, so "02:00 PM" keeps its AM/PM next to Chrome's clock icon. The arrow is `--ink4`, padding-bottom 9.
   - Phone: two rows, "Starts" then "Ends". Each row is the word (15 px `--ink`, 3.4 em wide), the date, and the time
     (`1.75fr 1fr`). Inputs have 10 px vertical padding.
   - ≤ 340: the words go back above the fields (12 / 500 `--ink3`), columns `1.25fr 1fr`.
   - All day: the times are hidden (desktop keeps their space with `visibility:hidden`; phone gives the date the whole
     row).
   - Inputs have no built-in minimum width (`min-width:0`, `appearance:none`), because iOS Safari keeps one and spills
     into the next column. The value is left-aligned.
   - Changing the start date to after the end date moves the end date with it.
   - Defaults for a new event: today, 14:00–15:00. From a slot: that hour to the next. From a day: that date.
5. **Location** (max 500) and **Notes** (textarea, 4 rows, max 8000, `resize:vertical`, line-height 1.55).
6. **Note line** (12.5 px `--ink3`): "Added by Blair · Edited by Alex · Recurring event: changes apply to this one only."
   Hidden when empty.
7. **Error line** (13 px `--bad`, `role=alert`). Hidden when empty.
8. **Actions** (`.dlg-act`, gap 8, margin-top 4; phone 8):
   - **Delete** (`.btn.danger`: `--bad` text on a 10 % `--bad` fill, hover 16 %). The first click arms it: solid
     `--bad`, white text, "Click again to delete". The second click deletes. Opening the sheet again disarms it.
   - **Google Calendar ↗** (`.btn.ghost`, the event's `htmlLink`, new tab).
   - **Comment** (optional, only when the page passes a `chat` from the team-chat skill, and only for an existing
     event): `.btn.ghost` with a 16 px speech-bubble icon, the word, and the number of comments in `--ink3` when there
     are some. The words selected in the title or notes (or else the whole title) become the quote; the sheet closes,
     then the chat opens. Phone: the bubble and number only, padding `0 14px`, so it shares the first line.
   - spacer, **Cancel** (`.btn.ghost`), **Save** (`.btn.primary`; disabled and "Saving…" while saving).
   - Phone: Delete, Google Calendar and Comment share the first line; Cancel and Save share the last line, each half
     wide. A new event has only Cancel and Save.

Validation, in the page before sending (the server checks again):

| Case | Message |
|---|---|
| empty title | "Add a title." (and the title gets focus) |
| no start date | "Pick a date." |
| end date before start | "The end date is before the start." |
| same day, end time ≤ start time | "The end time is before the start." |
| the server refused | "Couldn't save: <mapped sentence>" |

Read only (Google not connected): the title says "Event", every field is disabled, Save and Delete are hidden, and the
note says "Read only until Google Calendar is connected."

A click on the backdrop closes the sheet. So do the × button and Cancel. Escape closes it (native `<dialog>`).

## 10. One-day list

`.dlg.day-dlg`: the long date as its title ("Wednesday, November 25, 2026"), the day's events as Upcoming rows (sorted
by time; all-day first), and **New event on this day** (hidden when read only). It lists the calendar day, 07:00 to
07:00. It opens from "+n more", a day header, and from a tap anywhere before Google is connected.

## 11. Motion

| What | Duration | Easing | Reduced motion |
|---|---|---|---|
| Next / previous week or month: the grid slides in from that side (`translateX(±22px)`, opacity .25 → 1) | 240 ms | `cubic-bezier(.2,.8,.2,1)` | skipped |
| Dialog opens (desktop) | 220 ms | same | none (design system) |
| Bottom sheet slides up (phone) | 320 ms | same | none |
| Sync dot pulse | 1 s loop | ease-in-out | stops at opacity .6 |
| Banner shake | 300 ms | linear | – |
| Segment and button colours | 150 ms | ease | – |
| Day cell hover | 120 ms | ease | – |
| Hour label fade near the now label | 200 ms | ease | – |

## 12. Phones: input rules

- **No zoom.** On a phone held upright, a small script in `<head>` adds `maximum-scale=1,user-scalable=no` to the
  viewport and cancels `gesturestart` (iOS ignores `user-scalable` otherwise). A phone on its side and tablets keep
  pinch zoom. The grid has `touch-action:pan-y`, so a sideways drag never pans or zooms it.
- **Swipe.** One finger, quicker than 700 ms, more than 56 px sideways, and `|dx| > 1.8 × |dy|`. Left = next, right =
  previous. A vertical scroll of the hours never changes the week.
- **Keyboard (desktop).** ← and → go to the previous and next week or month, unless focus is in a field or a dialog.
- **44 px.** Every control is at least 44 px to tap. The small pill buttons keep their look and get an invisible 44 px
  `::after`.
- **No sideways scroll.** The week always fits the width (`overflow-x:hidden` on phones).

## 13. States checklist

| State | Where it shows |
|---|---|
| loading (first) | sync "Loading", empty grid lines, Upcoming empty |
| syncing (quiet reload) | the sync dot pulses; nothing else moves |
| live | green dot "Synced 2:20 PM", events in owner colours |
| empty week | grid lines only; "Nothing scheduled." in Upcoming |
| not configured | orange dot, warn banner, striped official schedule, read only, a tap shakes the banner |
| API unreachable (offline, 404) | same as not configured, banner "Couldn't reach the events API." |
| error (403/404/key) | red dot, bad banner with the hint, Google Calendar card with Try again |
| hover | blocks +8 % and lifted; cells `--fill` 60 %; rows `--fill` |
| focus | design-system ring (3 px accent at 55 %, offset 1); a focused block also lifts like hover |
| selected | segmented knob; owner pill ring; `.day.sel` 2 px accent inset |
| disabled | Save while saving (opacity .4); fields when read only |
| today | accent date circle, accent weekday, 5 % / 3 % column tint, now line and label |
| past | no special look (Google keeps them; they stay readable) |
| hidden owner | legend row `--ink4` with a hollow dot; its events are left out everywhere |
| armed delete | solid `--bad` "Click again to delete" |
| more than 3 lanes | "+n more" (desktop), "+n" (phone) |

## 14. Print

The right column and the sync note / New event are hidden; the grid prints as drawn.
