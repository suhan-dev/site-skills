# References tab: detailed design

Every measurement below is in `assets/site/css/refs.css`. Colours, the header, the page frame, `.doc` text, `.eyebrow`
and buttons come from `team-site-design-system` (tokens are linked there, not copied here):

- tokens: [`tokens.css`](../../team-site-design-system/assets/tokens.css) (`--ink` … `--ink4`, `--sep`, `--sep2`,
  `--fill`, `--card`, `--paper`, `--accent`, `--ok`, `--warn`)
- frame and header: [`components.css`](../../team-site-design-system/assets/components.css) (`.bar` 52 px, `.main` max
  1280 px with 36/28/56 px padding; 22/16/36 px on phones)
- Markdown text: [`doc.css`](../../team-site-design-system/assets/doc.css) (`.doc`, used for the overview text and for
  any README section that is not a link list)

The tab is one long page of sections. A contents column on the left lists them and marks the one being read. On phones
the contents column is hidden and a row of four jumps stays under the header instead.

## Contents

1. [Breakpoints](#breakpoints)
2. [Sketches](#sketches)
3. [Layout and contents column](#layout-and-contents-column)
4. [Sections](#sections)
5. [Overview: facts and numbers](#overview-facts-and-numbers)
6. [Tasks](#tasks)
7. [Link lists and marks](#link-lists-and-marks)
8. [Reading list](#reading-list)
9. [Phone jump row](#phone-jump-row)
10. [The tracker (contents follow the reading)](#the-tracker-contents-follow-the-reading)
11. [States](#states)
12. [Motion](#motion)
13. [Dark mode](#dark-mode)

## Breakpoints

| Width | What changes |
|---|---|
| ≥ 1101 | Two columns (contents 208 px, sections). Facts in two columns. Numbers four in a row. |
| 761 – 1100 | Facts in one column, so dates and places stay on one line. Numbers four in a row down to 900. |
| ≤ 899 | Numbers two in a row (the third starts a new row without its left rule). |
| ≥ 761 (desktop polish) | Contents start at the page edge, the marker hangs in the margin; section titles 24 px; prose at 68ch; the topic filters become a strip of tabs on the list's top rule. |
| ≤ 760 (phones) | One column. Contents hidden; the jump row appears. Fact labels 6.5em. Tasks and link rows stack. Search on its own line, 44 px tall, 16 px text. |
| ≤ 460, ≤ 374, ≤ 340 | No rules of its own. Checked at 320, 340, 360, 374, 390, 430 and 460: no sideways scroll; the jump row keeps its four words on one line (at 320: Overview 16–77, Tasks 115–152, Links 189–222, Papers 260–304); the filters wrap. The header's own small-phone rules come from the design system. |

## Sketches

### 1440 (desktop)

```
┌ header 52 ───────────────────────────────────────────────────────────────────────────────┐
│ Example Lab           Calendar  Research log  [References]           bell ● Alex EN ☾ ○ → │
└──────────────────────────────────────────────────────────────────────────────────────────┘
  Project              Example Lab · Winter 2027                      ← .eyebrow
 |Overview             Heat flow in a rod: model it, measure it…      ← h2 clamp(26,2.6vw,34)
  Tasks                ─────────────────────────────────────────────  ← --sep2
                       Period     Jan 5 – Mar 15     Meetings  Every Tuesday…
  Links                ───────────────────────     ───────────────────────  ← --sep
  Project links        Team       3 members          Deliverables  A report…
  Earlier projects
  Notation             Weights
  Tools                ─────────────────────────────────────────────
                       Task 1     │ Task 2     │ Task 3     │ Final talk
  Papers               30 %       │ 30 %       │ 30 %       │ 10 %
  Reading list      8  ─────────────────────────────────────────────
                       A thin aluminium rod is heated…   (.doc, max 68ch)
  ←208→ ←40→
```

### 1024 (761 – 1100)

```
  Project            Heat flow in a rod: model it, measure it, explain the gap
 |Overview           ──────────────────────────────────────────
  Tasks              Period        Jan 5 – Mar 15, 2027 (10 weeks)
                     ──────────────────────────────────────────
  Links              Meetings      Every Tuesday, 10:00, Room 101
  …                  ──────────────────────────────────────────   ← one fact column
```

### 390 (phone)

```
┌ header (two rows, 44 + 38) ───────┐
│ Example Lab        bell ● EN ☾ ○  │
│ Calendar  Research log [References]│
├───────────────────────────────────┤  ← sticky at 82 px, frosted
│ Overview   Tasks   Links  [Papers]│  ← jump row, 44 px links
├───────────────────────────────────┤
│ Reading list, by topic            │  ← h2 24 px, lands at 136 px after a jump
│ Papers we read or plan to read…   │
│ ┌───────────────────────────────┐ │
│ │ Search title, author, journal │ │  ← 44 px, 16 px text
│ └───────────────────────────────┘ │
│ [All] Task 1·3  Task 2·2  Task 3·2│  ← filters wrap, 44 px tap areas
│ Other·1                    8 of 8 │
│───────────────────────────────────│
│ Task 1  3                         │
│───────────────────────────────────│
│ 2023  Contact resistance in…      │
│       D. Okafor, E. Novak         │
│       Example Sensors Letters 8 · │
│       doi:10.0000/esl.2023.0107   │
└───────────────────────────────────┘
```

### 320 (small phone)

The same as 390. The jump row's words have about 38 px between them. The filters wrap to a second row
("Other · 1"). The count sits on its own line at the right.

## Layout and contents column

- `.refs-layout`: grid `208px minmax(0,1fr)`, gap 40 px, `align-items:start`.
- `.refs-toc`: `position:sticky; top:76px` (52 px header + 24 px), grid with 1 px gap, 13.5 px text.
- Group labels (`b`: Project, Links, Papers): 12 px / 600, `--ink4`, margin `14px 0 4px 10px` (the first has no top
  margin). A group appears only when it has entries.
- Entries (`a`): flex, `space-between`, gap 8 px, padding `6px 10px`, `--ink3`, no underline. Hover: `--ink`.
- The entry being read (`a.on`): `--ink`, weight 600, and a 2 px rule on its left (`box-shadow: inset 2px 0 0 var(--ink)`).
  On desktop (≥ 761) the weight stays normal so the words do not shift; only the colour and the rule change.
- The paper count (`small`): `--ink4`, tabular figures, right-aligned in the entry.
- Desktop: `margin-left:-10px`, so the entry text lines up with the page edge and the rule hangs in the margin.
- `.refs-body`: `min-width:0` so long words and wide formulas cannot push the grid wider than the page.

## Sections

- `.refs-sec`: margin-bottom 48 px (64 px on desktop); `scroll-margin-top` 80 px (header 52 + 28) and 136 px on phones.
- Section title `h2`: `clamp(24px,2.4vw,30px)` / 700 / line-height 1.18 / −0.025em. Desktop: 24 px / 1.25 / −0.022em.
  Phones: 24 px.
- The overview title on desktop: `clamp(26px,2.6vw,34px)` / 1.12 / −0.025em, `text-wrap:balance`. It is the page's only
  large title.
- `p.lead` (the sentence before a link list, the grading line, the papers intro): margin `-4px 0 16px`, `--ink3`,
  14 px, max 62em (68ch on desktop, like `.doc`).
- Order: Overview, Tasks (from `problem.json`), then each `## Title` of `references/README.md` in file order, then the
  reading list.

## Overview: facts and numbers

From `site/data/problem.json` (shape in `assets/site/data/problem.example.json`). One block per language; `en` is the
fallback.

- `.eyebrow` (design system): 13 px / 600, `--ink3`, 6 px under it.
- `.facts`: two columns, column gap 44 px, margin-top 22 px, top rule 0.5 px `--sep2`.
- `.fact`: grid `8em minmax(0,1fr)`, gap 16 px, padding 11 px 0, bottom rule 0.5 px `--sep`.
  - `dt` (label): 13 px, `--ink3`, 1 px top padding to sit on the value's baseline.
  - `dd` (value): 14.5 px / 500, `--ink`, −0.01em.
- A fact with `kpi` becomes a row of numbers (`.prize`), not a row: margin `26px 0 24px`.
  - Its label (`.prize-l`): 13 px, `--ink3`, 2 px under it.
  - `.kpis`: four columns, padding 12 px 0 14 px, rules above and below (0.5 px `--sep2`).
  - `.kpi`: padding 0 22 px, left rule 0.5 px `--sep` (none on the first, which also has no left padding).
  - `.kpi-l`: 12.5 px / 500, `--ink3`. `.kpi-v`: baseline flex, gap 5 px, tabular, no wrapping.
  - The figure (`b`): 34 px / 600 / 1.15 / −0.03em, `--ink`. The unit (`small`): 14 px / 500, `--ink3`.
- Background (`.doc p`) and premises (`h3` + `ul`) use the design system's `.doc`.
- 761 – 1100: one fact column. ≤ 899: numbers two in a row, 16 px between rows, the third has no left rule.
  ≤ 760: fact label column 6.5em, gap 12 px; numbers padding 0 16 px, figure 28 px.

## Tasks

- `.steps`: an `ol` without markers, top rule 0.5 px `--sep2`.
- `.step`: grid `190px minmax(0,1fr)`, gap 28 px, padding 15 px 0, bottom rule 0.5 px `--sep`.
  - `.no` ("Task 1"): 12 px / 600, `--accent`, tabular.
  - The name (`b`): 17 px / 600 / 1.3 / −0.018em.
  - The question (`p`): 14.5 px / 1.65, `--ink2`, max 70ch.
- Phones: one column, gap 4 px, padding 13 px 0.
- The grading line (`grading`) is the section's lead.

## Link lists and marks

A README section is a link list when every non-empty line after an optional lead sentence is
`- [Name](url) — description`. Anything else in the section (a plain bullet, a paragraph after the list) makes the whole
section Markdown, so nothing is ever dropped.

- `.links`: top rule 0.5 px `--sep2`.
- `.link-row` (the whole row is the link, opens in a new tab): grid `minmax(0,1fr) auto`, column gap 28 px, row gap 2 px,
  padding 12 px 0, bottom rule 0.5 px `--sep`, `--ink2`, 13.5 px / 1.55, no underline (also on hover).
  - Title (`b`): 15 px / 600 / −0.015em, `--ink`. Hover: `--accent`.
  - Description (`.d`): plain text (no Markdown, no math).
  - Host (`.u`, `www.` removed): right column, first row, 12 px, `--ink4`, 2 px top padding, no wrapping.
- The mark (`.tag`) after the title: 11.5 px / 600, 8 px left margin, raised 1 px.
  - `(unverified)` → **Unverified** in `--warn` (`.tag.guess`). The source's older word `(inferred)` reads the same.
  - `(verified)` → **Verified** in `--ok` (`.tag.ok`).
  - The mark is removed from the description text.
  - No mark → no tag. `build_refs.py --check` fails on such a line, so it does not reach the site.
- Phones: one column; the host moves under the description.
- Text sections: rendered by `md.js` (marked + KaTeX) into `.doc`. Images point at the site's copy (`/repo/references/…`);
  other relative links go to the file on GitHub. A formula wider than the column scrolls sideways inside its own box
  (`doc.css`); the page itself never scrolls sideways (checked at 320 px with the demo's display formula).

## Reading list

From `references/papers.csv` (schema in SKILL.md).

### Tools row

- `.paper-tools`: flex, wrap, centred, gap 8 px, 12 px under it.
- Search (`input#paper-q`, `type=search`): 34 px tall, min 240 px, grows to max 380 px, padding 0 12 px, radius 10 px,
  no border, `--fill`. Focus: `--card` with a 1 px `--accent` ring and a 4 px halo of `--accent` at 22 %.
  It matches every word typed (any order, any case) against title, authors, venue, year and note.
- Topic filters (`#paper-chips`): flex, wrap, gap 0 2 px. Each `button`: 30 px tall, padding 0 8 px, 13 px / 500,
  `--ink3`, no wrapping. Hover: `--ink`. Pressed (`aria-pressed=true`): `--ink`, 600, a 2 px underline in `--ink`.
  Labels: "All", then "Task 1 · 3" (topic · count), in natural order (Task 2 before Task 10), "Other" last, or in the
  order you pass as `groups`.
- The count (`#paper-count`, "8 of 8"): 12.5 px, `--ink3`, tabular, pushed to the right.
- Desktop (≥ 761): gap 10 px 16 px, no margin under the row; search `flex: 0 1 340px`; the filters move to their own
  line under the search and count (`order:3`, full width), 20 px apart with no padding, so their underlines sit on the
  list's top rule like a strip of tabs.
- Phones: search takes its own line, 44 px tall, 16 px text (iOS does not zoom on focus at 16 px); filters wrap with
  6 px between rows; each filter has a 44 × 44 px tap area (`::after`, centred).

### List

- `.papers`: top rule 0.5 px `--sep2`.
- Topic heading (`.grp`): padding 20 px 0 8 px, 13 px / 600, `--ink`, bottom rule 0.5 px `--sep2`, then the count in
  `small` (400, `--ink4`), 10 px apart on the baseline.
- Paper (`.paper`): grid `48px minmax(0,1fr)`, gap 12 px, padding 12 px 0, bottom rule 0.5 px `--sep`. Newest first
  within a topic.
  - Year (`.yr`): 12.5 px, `--ink4`, 2 px top padding, tabular.
  - Title (`a.ti`, new tab): 14.5 px / 500 / 1.45 / −0.01em, `--ink`, no underline. Hover: `--accent`. It links `url`
    when the row has one, else `https://doi.org/<doi>`.
  - Authors (`.au`): 12.5 px, `--ink3`, 3 px above. Names in `highlight.names` are bold (`b`, 600, `--ink2`) with
    `highlight.label` as a tooltip.
  - Venue line (`.ve`): 12 px, `--ink4`, 1 px above: "Venue · doi:10.xxxx/…".
  - Note line (`.note`): 12.5 px, `--ink2`, 4 px above: "Read by alex · one-line memo". Left out when both are blank.
- Nothing matches (`.none`): "No matching papers.", padding 24 px, `--ink3`, centred; the count reads "0 of 8".
- Number pairs ("Task 3", "30 %", "10 W") never break across lines (`keepPairs` in `refs-util.js`).

## Phone jump row

Shown only at ≤ 760 px, where the contents column is hidden.

- `nav.refs-jump`: flex, `space-between`, gap 8 px; `position:sticky; top:var(--refs-bar-h, 82px)`; z-index 20.
- It spans the full width: margin `-10px -16px 20px`, padding 0 16 px (the page's phone gutter is 16 px), so it starts
  12 px under the header and sticks right under it.
- Frosted like the header: `--paper` at 86 % with `saturate(1.8) blur(20px)`; bottom rule 0.5 px `--sep2`.
- Links: 44 px tall, 13.5 px / 500, `--ink3`, no wrapping. Hover: `--ink`. The part being read (`a.on`): `--ink`, 600,
  a 2 px underline in `--ink`.
- Entries: Overview, Tasks (each only when `problem.json` has it), Links (jumps to the first README section; every README
  section counts as Links), Papers.
- `--refs-bar-h`: the phone header's height. The design system's header is two rows (44 + 38). If your header is a
  different height, set `--refs-bar-h` on `:root` and change `scroll-margin-top` to header + 44 + 10.

## The tracker (contents follow the reading)

One function (`spy` in `refs.js`) marks the reading place in both the contents column and the jump row.

- The line: 48 px under the header's bottom edge (desktop) or under the jump row's bottom edge (phones). A jump puts a
  section's top just under that edge, so the section you jumped to is the one marked.
- The current section is the last one whose top has reached the line; the first section before that.
- At the very bottom of the page (within 2 px), the last section, even when it is too short to reach the line.
- Phones: the jump row marks the last of its entries that starts at or before the current section, so all README
  sections mark Links.
- It runs once per animation frame on scroll (passive listener), after the first render, and after a language change.
  It does nothing while the tab's pane is hidden.
- A click on a contents entry or a jump marks it at once, so the mark does not flicker through the sections in between
  during a smooth scroll.

## States

| State | What shows |
|---|---|
| Loading | The body is empty until `refs.json` arrives (one small file; no spinner). |
| `refs.json` missing or broken | No link sections. The reading list shows "0 of 0" and "No matching papers." The contents show only Papers 0. |
| No `problem.json` (or `overviewUrl: null`) | No Overview or Tasks; no Project group in the contents; the jump row starts at Links. |
| `problem.json` without `steps` | No Tasks section, contents entry or jump. |
| README without `##` sections | No Links group in the contents and no Links jump. |
| A README section with text or mixed lines | Rendered as Markdown text, with math. |
| A link without a mark | No tag (the lint fails before it ships). |
| Search or filter without a match | "No matching papers." and "0 of N". Search and filter combine. |
| A paper with only a URL | The title links the URL; no "doi:" on the venue line. |
| A paper with a blank year | The year column is empty; it sorts last in its topic. |
| A paper with a blank group | Under "Other", which is always the last topic. |
| Highlighted names | Bold, with the label as a tooltip; the lead adds "Bold names are {label}." |
| Language change (`site:lang`) | The tab draws again in the new language and keeps the search and filter. |
| Hover | Contents entry `--ink`; link title and paper title `--accent`; filter `--ink`. |
| Focus | Search: the accent ring above (its outline is off). Links, contents entries, jumps and filters: the design system's `:focus-visible` ring (3 px `--accent` at 55 %, in `tokens.css`). |

## Motion

- A jump from the contents or the jump row scrolls smoothly (`scrollIntoView({behavior:"smooth"})`, the browser's
  own timing).
- With `prefers-reduced-motion: reduce`, the jump is instant.
- Nothing else moves: no transitions on rows, filters or marks.

## Dark mode

Every colour is a token, so dark mode comes from the design system with no rules here. Check that `--warn` (Unverified)
and `--ok` (Verified) stay readable on `--paper`, and that the frosted jump row reads well over text (screenshot
`filter-390-dark.png`).
