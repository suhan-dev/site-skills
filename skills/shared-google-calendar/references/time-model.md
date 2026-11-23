# Time model: the 07:00 day

The calendar draws days that run **07:00 → 07:00 the next morning** in the team's time zone. A lab session that goes
from 23:00 to 01:30 stays one block on the day it started, instead of being cut at midnight into two columns. Google
Calendar keeps the real dates and times; only the drawing changes.

Everything below lives in `assets/site/js/cal-layout.js`. The hour comes from `DAY_START_HOUR` in `cal-config.js`
(7 by default; 0 gives an ordinary midnight day).

## The pieces

| Name | What it is | Example (DAY0 = 07:00) |
|---|---|---|
| `DAY0` | the calendar day's start, in minutes after midnight | `420` |
| `off(m)` | minutes after the calendar day's start | `off(420) = 0`, `off(60) = 1080` (01:00 is 18 h in) |
| `calToday()` | the calendar date now: before 07:00 it is still yesterday | 02:10 on the 23rd → `"…-22"` |
| `place(e)` | where an event sits: `{ ds, de, grid, top, end }` | see below |

`place(e)` (cached per event object in a `WeakMap`):

- **All-day** (or no start time): `ds = start`, `de = end`, `grid = false` → a bar in the all-day row.
- **Timed**: `s` = its start in minutes. If `s < DAY0`, the event belongs to the calendar day **before** its date.
  `top = off(s)`; `end = top + length` (length = end − start across dates; no end time = 60 min; zero or negative = 30 min).
  If `end ≤ 1440` the event fits in one calendar day: `grid = true`, a block in the time grid. Otherwise it is a bar
  (it crosses the next 07:00), from `ds` to `de = ds + floor((end − 1) / 1440)` days.

| Event | `ds` | `grid` | Drawn as |
|---|---|---|---|
| Tue 10:00–11:30 | Tue | yes | block, top = 3 h × 46 px = 138 px |
| Tue 23:30 → Wed 01:30 | Tue | yes | one block at the bottom of Tuesday, across the midnight line |
| Wed 02:00–03:00 | **Tue** | yes | block near the bottom of Tuesday |
| Tue 06:00–08:00 | **Mon** | no | bar over Mon and Tue (it crosses 07:00) |
| Fri 18:00 → Sat 10:00 | Fri | no | bar over Fri and Sat, with its start time |
| all day Thu–Sat | Thu | no | bar over three days |

## Everything that follows from it

- **Week columns, month cells, the one-day list, "today" and the now line** all use calendar days.
- **Loading**: the week's request asks for one extra day (`to = last day + 1`), because the last calendar day runs to
  07:00 the next morning.
- **Hour labels** run 08:00 … 06:00 down the gutter (the top edge is 07:00). Midnight gets a stronger label (`.mid`,
  `--ink3`, 600) and a 1 px `--sep2` line across all days (`.wv-mid`). With `DAY_START_HOUR = 0` there is no midnight line.
- **First look at a week**: scrolled to the top (07:00). If now is lower than the visible part minus one hour, the
  view is centred on now. A re-render of the same week keeps its scroll position.
- **Tapping an empty slot**: row `i` (0–23) is hour `(i + 7) % 24`. Rows after midnight are the **next date** (a tap at
  the 01:00 row of Tuesday's column starts Wednesday 01:00). The 23:00 row ends at 00:00 the next date.
- **Saving a new event** moves the view to its calendar day (an event at 02:00 opens the week of the day before when
  that day is a Saturday).
- **A notification for an event before 07:00 on a Sunday** opens the week before (`focus()` checks `place(ev).ds`).
- **The day rolls over at 07:00**: `updateNow()` runs every 30 s and redraws the grid when `calToday()` changes.

## Time zones

- The **page** uses `TIMEZONE` for "today", "now" and the sync time (`Intl.DateTimeFormat` with `timeZone`), so a teammate
  abroad sees the team's day, not their own.
- The **server** uses `TZ` in `lib/gcal.js`: list ranges are sent as RFC 3339 times with the zone's offset on that date
  (`zonedISO()`, DST-aware), Google is asked to answer in `TZ` (`timeZone=` parameter), and Google's times are turned
  back into `YYYY-MM-DD` and `HH:MM` in `TZ` (`Intl`, not a fixed offset). New events are sent as a local time plus the
  zone name, so Google applies the right offset.
- Date arithmetic on `YYYY-MM-DD` strings is done in UTC (`addDays`, `diffDays`), so no zone or DST change can shift a date.
- On the two DST days a year the grid still has 24 rows of 46 px; an event in the skipped or repeated hour is drawn by
  its wall-clock time. `tools/test-calendar.mjs` runs the whole server suite in `America/New_York` to cover this.
