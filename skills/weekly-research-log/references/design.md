# Design: the Research log tab

Everything needed to rebuild the tab's look without seeing the original. Values come from
`assets/site/css/records.css` and `assets/site/js/records.js`. All values are CSS px.

Colours are tokens from [tokens.css](../../team-site-design-system/assets/tokens.css) (see
[the design system's design.md](../../team-site-design-system/references/design.md)); this file names the token and
never repeats its value. Shared pieces come from [components.css](../../team-site-design-system/assets/components.css)
(`.eyebrow`, `.page-h`, `.btn`, `.card`, `.card-h`, the header) and the Markdown inside a log from
[doc.css](../../team-site-design-system/assets/doc.css) (`.doc`).

## 1. Look in one paragraph

A document page, not an app: a small grey eyebrow, a large title, then a strip of week tabs with an underline under the
chosen week. Under it, the week's dates, its folder, its title from the meeting notes, and one line that says whether
the week is open, closed or not started. Then two columns separated by space, not boxes: the team's meeting notes on the
left, the personal logs on the right with one tab per member. Every divider is a hairline. Closed weeks carry a small
lock and show "View on GitHub" instead of "Edit on GitHub".

## 2. Breakpoints

| Width | Layout |
|---|---|
| ≥ 1101 | Two columns: team notes `minmax(0,1.15fr)`, personal logs `minmax(0,1fr)`, gap `24px 44px`. |
| 761–1100 | One column: team notes, then personal logs (gap 24). Desktop polish still applies. |
| ≤ 760 | Phone: lighter page head, the week head stacks, 44 px targets, the week strip fades at its right edge. Column gap 28. |
| ≤ 460, ≤ 374, ≤ 340 | Only the header changes (design system). The tab is the same as at 760. |

"Desktop polish" (≥ 761) is a set of small alignments: the two folder links share one size, the "has entries" dot sits
right after the week's name, the closing-table summary gets a `›` that turns 90° when open, and both column heads are
48 px tall so their rules line up.

## 3. Layout sketches

### 1440 × 900

```
  Research log                                                                      (GitHub folder ↗)
  What we did each week, and what's next                     ← .page-h, clamp(26px, 2.6vw, 34px)
  ───────────────────────────────────────────────────────────────────────────────────────────────────
   ^Week 1•   ^Week 2•    Week 3•          Week 4    Week 5 … Week 10        ← ^ lock, • has entries
   Jan 5–11   Jan 12–18  Jan 19–25 · This week  Jan 26–Feb 1 …
                         ━━━━━━━━━━━━━━━━━  (2 px --ink underline)
  ───────────────────────────────────────────────────────────────────────────────────────────────────
  Week dates and closing rule ›
  Tue, Jan 19 – Mon, Jan 25 · logs/week03_0119/
  Week 3 — Model vs data                                                             (Week folder ↗)
  ● This week · open until the end of Mon, Jan 25.
  ───────────────────────────────────────────────    ────────────────────────────────────────────
  Team notes                        Edit on GitHub ↗   ● Alex  ● Blair  ● Casey     Edit on GitHub ↗
  ───────────────────────────────────────────────    ────────────────────────────────────────────
  Week 3 · 1.19 (Tue) — Model vs data                Alex · Week 3 (1.19)
  • Scribe: Alex                                     Done
  …  (doc.css)                                       …
```

### 390 × 844

```
│ Research log            (GitHub folder ↗) │  eyebrow and the small link on one line
│ What we did each                          │  title 23 px
│ week, and what's next                     │
│ •3   Week 3 •      Week 4      Week 5 ░░  │  strip scrolls sideways, fades 32 px at the right
│      Jan 19–25 · This week                │
│ ▸ Week dates and closing rule             │
│ Tue, Jan 19 – Mon, Jan 25 · logs/week03…  │
│ Week 3 — Model vs data                    │  22 px
│ (Week folder ↗)                           │  under the title
│ ● This week · open until the end of …     │
│ ───────────────────────────────────────── │
│ Team notes                Edit on GitHub ↗│
│ ───────────────────────────────────────── │
│ (team.md)                                 │
│ ───────────────────────────────────────── │
│ ● Alex  ● Blair  ● Casey  Edit on GitHub ↗│  44 px rows
│ (alex.md)                                 │
```

## 4. Page head

| Part | Desktop | Phone (≤ 760) |
|---|---|---|
| `.page-head` | flex, `align-items:flex-end`, space-between, gap 16, margin-bottom 24 | grid `minmax(0,1fr) auto`, gap `0 12px`, margin-bottom 18; the inner `div` uses `display:contents` so the eyebrow, the link and the title share one grid |
| `.eyebrow` | 13 / 600, −.005em, `--ink3`, margin-bottom 6 | same, row 1 left |
| `.page-h` | `clamp(26px, 2.6vw, 34px)` / 700, line-height 1.12, −.025em, `text-wrap:balance` | 23 px, the whole second row |
| `#rec-repo` (GitHub folder ↗) | `.btn.ghost`, 28 high, 12 px padding, 12.5 px | row 1 right, 30 high, 12.5 px, `margin-top:-6px`, invisible 44 px tap area |

## 5. Week strip (`.week-tabs`)

- A flex row that scrolls sideways (`overflow-x:auto`, scrollbar hidden), `.5px --sep2` line under it, margin-bottom 14.
- Each tab `flex:1 0 auto`, so few weeks share the width and many weeks scroll. Padding `6px 12px 9px`, centred.
  - Name (`b`): 13 / 600, −.01em, `--ink2`. Hover `--ink`.
  - Dates (`small`): "Jan 19 – Jan 25", 11 px, tabular, no wrap, `--ink3`.
  - This week: " · **This week**" after the dates in `--accent`, 600.
  - Chosen: `inset 0 -2px 0 var(--ink)` underline (.15 s), name `--ink`, dates `--ink2`.
  - No folder yet (`.empty`): name `--ink3`, 500.
  - Closed (`.locked`): a 12 px lock icon (stroke 1.6, `currentColor`) before the name, name `--ink3`. Tooltip
    "Week 2 · Tue, Jan 12 – Mon, Jan 18 · Closed".
  - Has entries (anything written in team.md or a personal log): a 6 px `--accent` dot. Desktop: 5 px after the name,
    vertically centred. Phone: top 7, right 7 of the tab.
- On open, the chosen tab is scrolled into view (16 px from the left edge, `sideStrip()`).
- Phones and desktop both fade the strip's last 32 px (`mask-image` to transparent) while more weeks are hidden on the
  right; the fade goes when the strip reaches its end (`.at-end`). Phone tabs are at least 44 px tall.

## 6. Closing table (`details.wk-table`)

- Summary: "Week dates and closing rule", 12.5 px `--ink3`, hover `--ink`. Desktop: no marker, a `›` after it (15 px)
  that rotates 90° when open (.15 s). Phone: the browser's own ▸ marker.
- The rule in one sentence: "A week runs **Tuesday to the following Monday** (Asia/Seoul). After Monday 24:00 it closes
  and is not edited. Add anything missed to this week's log." The days and the zone come from the data.
- Table: min-width `min(620px, 100%)`, tabular numbers, cells 12.5 px with `6px 14px 6px 0` padding and a `.5px --sep`
  line under each. Head `--ink3`, 600. Closed rows `--ink4` with a lock and "Closed"; this week's row `--ink`, 600, with
  "This week".

## 7. The week's head

- `.wk-top`: flex, `align-items:flex-end`, space-between, gap 16, margin `26px 0 12px`. Phone: a column, gap 10.
- Meta line: "Tue, Jan 19 – Mon, Jan 25 · logs/week03_0119/", 12.5 px `--ink3`, tabular, margin-bottom 2.
- Title: "Week 3" 24 / 700, line-height 1.25, −.022em (phone 22) and the meeting's title after " — " in `--ink3`, 600.
  The title is the text after "—" (or " - ") in team.md's first heading.
- **Week folder ↗** (`.btn.ghost.small`, 28 high) only when the folder exists.
- State line (`.wk-state`, 13 px `--ink2`, gap 9, margin-bottom 18):

| State | Mark | Text |
|---|---|---|
| open (this week) | 8 px `--ok` dot | "**This week** · open until the end of Mon, Jan 25." |
| closed | the 12 px lock, line in `--ink3` | "**Closed** · closed at the end of Mon, Jan 18. Past logs stay as they are; put corrections in this week's log." |
| not started | 8 px hollow circle (`inset 0 0 0 1.5px --ink4`) | "**Not started** · runs Tue, Jan 26 – Mon, Feb 1." |

## 8. Columns

Both columns are `.doc-card`: a `.5px --sep2` line on top, no box, `min-width:0`.

- **Head** (`header` or `.person-tabs`): flex, gap 10, padding `12px 0`, `.5px --sep` under it. Desktop: 48 px tall,
  no vertical padding, so the left and right heads line up.
  - "Team notes": 15 / 600, −.015em.
  - Links (right): "Edit on GitHub ↗" (open week) or "View on GitHub ↗" (closed week), 12.5 / 500 `--accent`, padding
    `4px 8px`, radius 7, hover `--fill`. Phone: invisible 44 px tap area.
- **Member tabs** (`.person-tabs`): gap `2px 14px`, wraps. Each: 30 high (phone 44), an 8 px dot in the member's colour
  (`--gc-N` from `colorId`), 13.5 / 500 `--ink3`. Hover `--ink`. Chosen `--ink`, 600. A member with nothing written
  `--ink4`. The signed-in member's tab is chosen first.
- **Body**: the log rendered by `md.js` inside `.doc` (doc.css: 15 px, line-height 1.7, `--ink2`; headings `--ink`;
  task lists with hanging boxes; tables that scroll sideways; KaTeX math; images radius 10). Desktop shrinks a log's
  `h1` to 19 px (line-height 1.35, −.018em) because the card already has a head. Bottom padding 12.
- Numbers keep their units on one line ("28 cm", "0.5 °C"): `keepPairs()` puts no-break spaces in the text.

Empty states (`.empty-box`: padding `22px 0`, 13.5 px `--ink3`, text then a `.btn.ghost.small`):

| Case | Open week | Closed week |
|---|---|---|
| no team.md | "No file yet." + **Create from template ↗** | "No meeting notes this week." |
| team.md is only the template | "Template only. Nothing written yet." + **Start writing ↗** | "Nothing was written this week." |
| no personal file | "Alex hasn't started a log for week 4." + **Create from template ↗** | "Alex has no log for week 2." |
| personal file is only the template | "Template only. Nothing written yet." + **Start writing ↗** | "Nothing was written this week." |

"Only the template" (`isBlank()`): nothing but headings, empty bullets and boxes, "Label:" bullets, empty table rows,
comments and "> hint" quotes.

**Create from template** opens GitHub's new-file page with the folder, the file name and the template filled in
(`/new/<branch>/<dir>?filename=…&value=…`).

**Other files in this folder** (`.card.wk-extra`, margin-top 28): a list of files that are not logs and not images
(data files, sub-folders), 13.5 px, each linking to GitHub.

## 9. States checklist

| State | Where |
|---|---|
| loading | the pane is empty until records.json arrives (one small file; no spinner) |
| load failed | "Couldn't load the logs (HTTP 404)." in the body |
| no weeks | "No logs." |
| before week 1 | the first week with a folder is chosen, all weeks "Not started" |
| open week | green dot line, Edit links, Create from template |
| closed week | locks on the tab and the line, View links, no create or write buttons |
| not started | hollow dot line, Create from template (writing ahead is allowed) |
| after the last week | the last week is chosen |
| hover | tab names and member names to `--ink`; links get a `--fill` background |
| focus | the design system's ring (3 px accent at 55 %) |
| selected | 2 px `--ink` underline (week), `--ink` 600 (member) |
| disabled | none; closed weeks hide actions instead of disabling them |
| today | " · This week" in the strip, bold row in the closing table |
| past | closed: `--ink3` names with a lock, `--ink4` rows in the table |

## 10. Motion

Only colour and underline changes, .15 s (`transition:box-shadow .15s` on tabs, the summary arrow's rotation). No page
animation. Reduced motion removes both transitions.

## 11. Address and focus

- The week's number goes into the address (`#records/3`) so a link opens that week. `show(3)` opens it from code.
- `site:lang` (the design system's language button) draws the tab again, so a second language can swap the words.
