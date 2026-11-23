# Design: the reader and the Theory tab

Everything you need to rebuild the look without the source site. Colours are tokens from the design system:
[`team-site-design-system/assets/tokens.css`](../../team-site-design-system/assets/tokens.css). This file names tokens
(`--ink2`, `--sep2` …) and never repeats their values, except where the reader defines its own (scrim, print).
The CSS that implements every line below is in [`assets/site/css/`](../assets/site/css/) (`doc.css`, `reader.css`, `theory.css`).

**The idea.** Lecture notes, not an app. No boxes, no card backgrounds, no shadows. Wide margins, one text column at
72 characters, hairlines (0.5 px `--sep2`) between parts. Numbers (section, equation, figure) are quiet grey
(`--ink4`) beside ink text. Colour is used for links only (`--accent`).

Contents

1. [Type scale](#1-type-scale)
2. [Reader page by width](#2-reader-page-by-width)
3. [Reader parts](#3-reader-parts) (top line, contents, title, text, equations, figures, tables, code, quotes, prev / next)
4. [Phones: the section bar and the contents sheet](#4-phones-the-section-bar-and-the-contents-sheet)
5. [Print](#5-print)
6. [Theory tab](#6-theory-tab)
7. [States](#7-states)
8. [Motion](#8-motion)
9. [Light and dark](#9-light-and-dark)

Font: the design system's `--sans` stack (system UI, then Pretendard for Korean). Screenshots use Inter.
KaTeX keeps its own fonts (KaTeX_Main …). Numbers in lists use `font-variant-numeric: tabular-nums`.

## 1. Type scale

Sizes in px unless marked. "lh" is line height, "ls" letter spacing.

### Reader, wide screens (≥ 761 px)

| Element | Size | Weight | lh | ls | Colour | Margins |
|---|---|---|---|---|---|---|
| Page base (`.rd`) | 16 | 400 | 1.5 | −.006em | `--ink` | |
| Measure base (`.rd-main`) | 17 | | | | | sets `ch` for the 72ch column |
| Top line (crumbs, tools) | 12.5 | 400; first crumb 600 | | | `--ink3`; first crumb `--ink` | |
| Contents heading "Contents" | 12 | 600 | | | `--ink4` | 0 0 6 |
| Part row (I · TITLE · range) | 12 | 600, UPPERCASE | 1.4 | .045em | `--ink3`; open / hover `--ink` | padding 10 0 |
| Part numeral, chapter range | 12 | 600 / 500 | | .02em | `--ink4` | |
| Chapter row | 13 | 400; current 600 | 1.4 | | `--ink3`; current `--ink` | padding 4 0 |
| Section row (h2) | 13 | 400; reading 600 | 1.4 | | `--ink2`; reading `--ink` | padding 4 0 4 10 |
| Subsection row (h3) | 12.5 | 400 | 1.4 | | `--ink3` | padding 4 0 4 22 |
| Part line above title | 12.5 | 600, UPPERCASE | | .05em | `--ink3`; "Part I" `--ink4`; part name `--ink2` | 0 0 14 |
| Chapter title (h1) | clamp(30, 3.2vw, 40) | 700 | 1.12 | −.028em | `--ink`; label "H1" `--ink4` 600 | head block 0 0 36 |
| Body text | 17 | 400 | 1.72 | −.006em | `--ink2` | p 12 0 |
| Section heading (h2) | 26 | 700 | 1.25 | −.022em | `--ink`; number `--ink4` | 64 0 14, padding-top 32, hairline above |
| Subsection (h3) | 18 | 600 | 1.4 | −.012em | `--ink` | 36 0 8 |
| h4 | 17 | 600 | 1.72 | | `--ink` | 24 0 6 |
| `strong` | inherit | 600 | | | `--ink` | |
| List item | 17 | | 1.72 | | | li 4 0; list padding-left 24 (2.1em when it has ≥ 10 items) |
| Inline code | .88em (≈ 15) | 400, `--mono` | | | `--ink`, no background | |
| Code block | 13.5 | `--mono` | 1.55 | | `--ink2` | 20 0; padding 4 0 4 18; left rule 1.5 `--sep2` |
| Blockquote | 17 | | 1.72 | | `--ink3` | 20 0; padding-left 18; left rule 1.5 `--sep2` |
| Table | 15 | 400; th 600 | 1.72 | | td `--ink2`, th `--ink` | 20 0; cells padding 7 12 7 0; hairline under each row |
| Display equation | KaTeX 1.21em of 17 | | | | `--ink` | 24 0; padding 6 0 |
| Equation number | as the equation | | | | `--ink` | right edge of the column |
| Figure caption | 14 | 400; "Figure H1.1." 600 `--ink` | 1.55 | | `--ink3` | 14 auto 0; max 60ch; centred, `text-wrap: balance` |
| Long caption (a sentence) | 14 | | 1.55 | | `--ink3` | flush left, `text-wrap: pretty` |
| Prev / next label | 12 | 600 | | | `--ink4` ("Previous part" `--ink3`) | |
| Prev / next part name | 12 | 600, UPPERCASE | | .05em | `--ink2` | |
| Prev / next chapter | 15 | 400 | 1.4 | | `--accent`; underline on hover (offset 2) | |
| Section numbers everywhere | inherit | 600 in headings | | | `--ink4` | margin-right .45em (h2 .5em, h1 .4em) |

### Reader, phones (≤ 760 px)

| Element | Size | Notes |
|---|---|---|
| Chapter title (h1) | 28 | head block margin-bottom 20 |
| Part line | 11.5 | margin-bottom 10 |
| Body text | 16 / lh 1.7 | |
| h2 | 21.5 | margin-top 52, padding-top 24 |
| h3 | 17 | |
| Display equation | 1.1em of the KaTeX size | margin 20 0 |
| Section bar text | 14 / 600 | number `--ink4` |
| Contents sheet | 14.5 / lh 1.4 | subsections 13.5 |
| Back link | 15 / 500 | `--accent`, chevron 22 px |

### Theory tab (in the app, 15 px base)

| Element | Size | Weight | Colour | Margins |
|---|---|---|---|---|
| Sub-tab | 14 | 500; selected 600 | `--ink3`; selected `--ink` | padding 6 0 11; 1.5 px underline when selected |
| "Chapters" heading | 12 | 600 | `--ink4` | 0 0 6 |
| Chapter row | 13.5 | 400; current 600 | `--ink2`; current `--ink` | padding 5 0; gap 10 |
| Eyebrow "Part · Chapter H1" | 13 | 600 | `--ink3` | design-system `.eyebrow` |
| Title | clamp(26, 2.6vw, 34) | 700, lh 1.12, ls −.025em | `--ink` | design-system `.page-h` |
| "Open in reader ↗" | 13 | 500 | `--accent` | |
| Body text | 15 / lh 1.7 | 400 | `--ink2` | `.doc` |
| h2 | 17 / lh 1.4 (≤ 760 px: 16.5) | 650, ls −.015em | `--ink` | 36 0 8; padding-top 22; hairline above |
| h3 | 15 | 600 | `--ink` | 16 0 4 |
| Display equation | | | | 18 0 |
| Figure / caption | 13 / lh 1.5 | "Figure" 600 `--ink2` | `--ink3` | figure 26 0; caption 10 above |
| Prev / next | 12 label / 13.5 link | | | 44 top, padding-top 18 |

## 2. Reader page by width

The page is a three-column grid: contents | text | air. The text column is `minmax(0, 72ch)` at 17 px, about 770 px with Inter.

```
≥ 1101 px (1440 × 900 shown)                                     max-width 1360, centred, padding 64 48 112
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Example Lab · Theory · Heat and Diffusion                                         ☾   ⎙ Print     │ top line, 14 48
├──────────────────────────────────────────────────────────────────────────────────────────────────┤ 0.5 px --sep2
│                                                                                                  │
│   Contents                  PART I  HEAT AND DIFFUSION                                           │
│   ─────────────────────     H1  Sample chapter: Heat flow in a rod                               │
│   I  HEAT AND DIFF… H1–H2                                                                         │
│   H1 Sample chapter: …      Body text, 17/1.72, --ink2 …………………………………………………… (72ch)               │
│      │ H1.1 Assumptions                                                                           │
│      ┃ H1.2 Fourier's law   ──────────────────────────────────── (h2 hairline)                    │
│      │ H1.3 The heat eq.    H1.2  Fourier's law                                                   │
│      │   H1.3.1 Diffusivity          q = −k ∂T/∂x                                  (H1.1)         │
│   H2 Sample chapter: …                                                                            │
│   ─────────────────────                                                                           │
│   II OSCILLATIONS     O1                                                                          │
│   ─────────────────────                                                                           │
│   1.3fr (min 220)  56 gap   72ch                                       56 gap   .7fr              │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
At 1440: contents box x 88–335 (247 wide, right-aligned in its column, at most 264), text x 391–1163.
```

```
761–1100 px (1024 shown)                  padding 52 32 96, no right column
┌──────────────────────────────────────────────────────────────┐
│ Example Lab · Theory · Heat and Diffusion       ☾  ⎙ Print   │ top line padding 14 32
├──────────────────────────────────────────────────────────────┤
│ Contents (220)    40   text (min(72ch, rest) = 700 at 1024)  │
└──────────────────────────────────────────────────────────────┘
```

```
≤ 760 px (390 shown)                          one column, padding 32 20 72
┌──────────────────────────────┐
│ ‹ Theory              ☾  ⎙   │ 52 high; back link left; tools 44 × 44; crumbs hidden
├──────────────────────────────┤
│ PART I  HEAT AND DIFFUSION   │ 11.5 px
│ H1 Sample chapter: Heat      │ 28 px
│    flow in a rod             │
├──────────────────────────────┤ ← the section bar (sticky, full bleed, 48 min height)
│ H1.2 Fourier's law         ⌄ │
├──────────────────────────────┤
│ Body 16/1.7 …                │
│ wide formula scrolls → ░     │ edge fade
│                      (H1.5)  │ number on its own line
└──────────────────────────────┘
```

The ≤ 460, ≤ 374 and ≤ 340 px steps of the site change nothing in the reader: the column is already fluid and every
row wraps. Check 375 and 340 for overflow anyway (the test checks `scrollWidth ≤ innerWidth`).

## 3. Reader parts

### Top line (`.rd-top`)
- Flex row, gap 8 × 20, max-width 1360, centred, padding 14 48 (761–1100: 14 32), hairline under it.
- Crumbs: site name (600, `--ink`) · Theory · part title, separated by "·" in `--ink4`, gap .55em. Links `--ink3`, hover `--ink`, no underline.
- Tools at the right: theme (moon 15 px filled; sun 16 px stroked; aria-pressed = dark) and Print (16 px printer icon + the word). Each 30 high, padding 0 8, gap 6, 12.5 / 500 `--ink3`, hover `--ink`. Icon strokes 1.6, round caps.
- Phones: min-height 52, padding 0 4 0 20. The crumbs hide; a back link "‹ Theory" (`--accent`, 15 / 500, chevron 22 px stroke 2, 44 high, margin-left −6) takes their place. Tools become 44 × 44 targets.

### Contents (`.rd-toc`, wide screens only)
- Sticky at top 28; max-height `100vh − 56`; scrolls on its own (`overscroll-behavior: contain`, thin scrollbar). It never scrolls the page.
- Width `min(264px, 100%)`, aligned to the right edge of its column so it hugs the text.
- Order: "Contents" heading, then one `<details>` per part.
- **Part row** (`summary`): a 3-column grid `2.1em | 1fr | auto`, gap 0 6, padding 10 0: roman numeral, part title, chapter range ("H1–H2", or "O1" when the part has one chapter). Hairline above each part, and one below the last. Only the part being read is open. No disclosure triangle.
- **Chapter rows**: grid `2.1em | 1fr`, gap 0 6, padding 4 0; label in `--ink4`. The open chapter is 600 `--ink` with its label in `--ink`. Padding 0 0 10 under the list.
- **Section list** (only under the open chapter): indented 2.1em (so it lines up with the chapter titles), margin 4 0 8, padding-left 6, a 0.5 px `--sep2` rule on its left. Each row: flex, gap 7, padding 4 0 4 10, margin-left −6.5 so its own 1.5 px left border sits on the rule. The row being read: `--ink`, left border `--ink` (h2 rows also 600). h2 rows are `--ink2`, h3 rows `--ink3`.
- **Subsections** show only under the h2 being read (`.l2.open`). Indent 22, 12.5 px.
- The list keeps the marked row in view: when it is within 24 px of the list's top or bottom edge, the list scrolls so the row sits a third of the way down.

### Title block (`.rd-head`)
- Part line: "PART I" (`--ink4`) then the part name as a link back to the tab (`--ink2`, hover `--ink`), gap .7em, flex-wrap.
- h1: the label ("H1") in `--ink4` weight 600, margin-right .4em, then the title. `text-wrap: balance`.

### Text (`.rd-text`, built on `.doc`)
- The first child has no top margin. The first section's h2 has no hairline and no top padding.
- Every h2 starts a new part of the page: margin 64 above (52 on phones), padding 32 (24), a 0.5 px `--sep2` hairline at the top of the padding.
- Links inside text: `overflow-wrap: anywhere`, never `word-break: break-all` (chapter links are words).
- References `(H1.3)`, `H1.1`: plain links, `white-space: nowrap`. An unknown one shows `(??)` in `--bad` with a tooltip "Unknown reference: key".
- A link to a chapter that is not published yet is plain `--ink3` text with the tooltip "Not published yet".
- Images inside text: no radius. Inline `<svg>` directly in a section: block, max-width 100 %, margin 28 auto.

### Equations
- Display math: margin 24 0, padding 6 0, scrolls sideways when wider than the column (overflow-x auto, overflow-y hidden), `position: relative` so KaTeX's hidden MathML never widens the page.
- The number is KaTeX's `\tag`, reset to plain text (no badge styling): same size and weight as the formula, at the right edge.
- **Wide formula** (fitWide): when formula width + 2 × number width + 16 > column width, the formula gets `.wide`: it starts at the left, its own number is hidden, and a copy of the number (`.eq-n`) shows on the next line, right-aligned, `1.21em / 1.3 KaTeX_Main`, `--ink`, margin −2 0 18 (24 in the reader, 20 on phones). So the number never covers the formula.
- **Edge fade** on anything that scrolls sideways (formulas, tables, code): `mask-image` fades 22 px at the left while there is more to the left, 28 px at the right while there is more to the right.
- Untagged rows of `align` get no automatic `(1)`, `(2)`: KaTeX's `.eqn-num::before` is emptied.

### Figures
- `figure`: margin 36 0, sans font, `--ink`. Image or SVG: block, max-width 100 %, centred, height auto.
- Caption: 14 / 1.55 `--ink3`, max 60ch, centred, 14 under the picture, `text-wrap: balance`. "Figure H1.1." in front, 600 `--ink`.
- A long caption (the `*Figure H1.1.*` paragraph form) is flush left with `text-wrap: pretty`.
- Figure files are black on transparent. In dark mode, on screen only, `.svg` images get `filter: invert(1) hue-rotate(180deg)`. Inline SVG drawn with `var(--ink)` etc. follows the theme by itself.

### Sections and lazy layout
- chapter.js wraps the text in `<section class="cs">` at every h2 and h3 (`cs3` when it starts at an h3).
- On screen: `content-visibility: auto` with an estimated height `--t × .41 + --e × 85 + --f × 338 + --r × 23` px (phones `.735 / 53 / 48 / 32`), where `--t` is the text length, `--e` display equations, `--f` figures, `--r` table rows. The factors were fitted to real heights.
- A section keeps its children's margins inside: first child margin-top 0, last margin-bottom 0. The gap between sections is the section's own margin: 64 before an h2 section (phones 44), 36 before an h3 section.
- Print uses the plain flow (all of this is `@media screen`).

### Previous / next
- A 2-column grid, gap 24 (phones 16), margin-top 80 (56), padding-top 20, hairline above, 15 px.
- Each link: label (12 / 600 `--ink4`) over "H2 · Title" in `--accent`. Next is in column 2, right-aligned, even when there is no previous.
- Crossing into another part: the label says "Previous part" / "Next part" in `--ink3`, and a third line names the part ("II · OSCILLATIONS", 12 / 600 UPPERCASE .05em `--ink2`) between the label and the chapter.
- Phones: each link at least 44 high.

### Jumps
- Every heading, equation, figure and `.eq-anchor` has `scroll-margin-top: 28` (64 on phones, to clear the section bar).
- The target flashes: background from `--accent` at 16 % to transparent over 2 s, ease-out.

## 4. Phones: the section bar and the contents sheet

```
┌──────────────────────────────┐
│ H1.3 The heat equation     ⌃ │ bar (sticky top 0, z 30)
├──────────────────────────────┤
│ I  HEAT AND DIFFUSION  H1–H2 │ sheet hangs from the bar, max-height min(72vh, 620)
│ H1 Sample chapter: Heat …    │ 14.5 px rows, ≥ 44 high
│    │ H1.1 Assumptions …      │
│    ┃ H1.3 The heat equation  │ ← the section being read
│    │   H1.3.1 Diffusivity …  │
│ H2 Sample chapter: Cooling … │
│ ──────────────────────────── │
│ II OSCILLATIONS          O1  │
├──────────────────────────────┤
│░░░░░░ scrim over the text ░░░│ rgba(0,0,0,.18) light / .45 dark
└──────────────────────────────┘
```

- **Bar** (`.rd-bar`): sits under the title, full bleed (margin 0 −20 28), padding left / right `max(20px, safe-area inset)`. Background `--paper` at 90 % with `blur(18px) saturate(1.8)`; solid `--paper` while open. Hairlines top and bottom.
- **Button**: the whole bar, min-height 48, flex, gap 8, 14 / 600 `--ink`, left-aligned. It shows the section being read: number in `--ink4` (gap 7), title cut with an ellipsis. Before the first heading it shows the chapter label and "Contents". A chevron (18 px, stroke 1.8 `--ink3`) at the right turns 180° in .2 s when open. `aria-expanded`, `aria-controls="rd-sheet"`, `aria-label="Contents"`.
- **Sheet**: absolute, top 100 %, left 0, right 0, padding 4 / safe-area 20 / 16, `--paper`, hairline under it, 14.5 / 1.4, scrolls inside (`overscroll-behavior: contain`). It holds the same contents as the side list. First part: no top hairline. Part rows min-height 44; chapter rows padding 11 0; section rows padding 10 0; subsections 13.5.
- On open, the sheet scrolls so this chapter's row is at the top, or further down if the section being read would fall below 70 % of the sheet (then that row sits a third of the way down).
- **Scrim**: fixed, inset 0, z 25, tap closes. Tapping a link, Esc (focus returns to the bar) and widening the window past 760 px also close it.

## 5. Print

- Forced light: `--paper #fff`, `--ink #000`, `--ink2 #000`, `--ink3 #333`, `--ink4 #666`, `--sep #bbb`, `--sep2 #999`, `--accent #000`, `--fill transparent`, `--bad #000`, `color-scheme: light`, whatever the screen theme.
- `@page { size: A4; margin: 18mm 18mm 20mm }`. White background.
- Hidden: tools, contents, section bar, back link, scrim, previous / next. The crumbs stay as a small running head (8.5 pt `#333`, 400, padding 0 0 8).
- Sizes: base 10.5 pt; text 11 pt / 1.55; title 22 pt (margin-bottom 18 pt); part line 8.5 pt `#333`, margin-bottom 6 pt; h2 15 pt, margin 22 pt 0 6 pt, padding-top 10 pt; h3 12 pt, margin 14 pt 0 4 pt.
- Headings `break-after: avoid`; equations, figures, code, quotes, tables and table rows `break-inside: avoid`; paragraphs `orphans: 3; widows: 3`.
- Equations do not scroll on paper (`overflow: visible`), and the wide-formula layout is screen-only, so the number stays beside the formula.
- Links print as plain text in the text colour, with no URL after them. No highlight animation. SVG figures print black (no invert).

## 6. Theory tab

```
≥ 761 px                                                    (inside the app: header .bar 52 px, .main padding 36 28)
Heat and Diffusion    Oscillations                                       sub-tabs, gap 28, hairline under
────────────────────────────────────────────────────────────
Chapters                  Heat and Diffusion · Chapter H1             Open in reader ↗
H1 Sample chapter: …      Sample chapter: Heat flow in a rod
H2 Sample chapter: …      body 15/1.7 … (max 70ch)
──────────
Open in reader ↗
 208 px    40 gap          70ch
```

- Sub-tabs (`.th-tabs`): plain text, gap 28, margin 0 0 32, hairline under the row; selected tab `--ink` 600 with a 1.5 px `--ink` underline sitting on the hairline (margin-bottom −0.5). The row scrolls sideways with no scrollbar if it ever overflows.
- Layout: grid `208px | minmax(0, 1fr)`, gap 40. Chapter list sticky at top 76 (header 52 + 24), max-height `100vh − 96`, gap 1.
- Chapter list: "Chapters" then one row per chapter (label `--ink4` min-width 1.4em, gap 10). Under it, after a hairline (margin-top 12, padding-top 12), a second "Open in reader ↗" in `--accent`.
- Chapter head (≥ 761): a 2-column grid; row 1 the eyebrow at the left and "Open in reader ↗" at the right (baseline aligned, column-gap 24); row 2 the title across both columns, so a long title keeps the full width. Margin-bottom 22.
- Text: `.doc`, max-width 70ch (about 660 px at 15 px). h2 sections have the hairline rule of the reader at a smaller scale. Same equation and figure rules as the reader, smaller margins (see the table in §1).
- Lazy sections as in the reader, with estimates `.358 / 69 / 285 / 23` (phones `.625 / 45 / 68 / 26`) and gaps 36 (h2) and 16 (h3; 18 after an equation or `hr`, 26 after a figure, so the larger margin wins as plain margins would).
- In-chapter links (`#eq-…`, `#fig-…`, `#heading`) scroll smoothly inside the tab (headings to the top, others to the centre) and flash for 1.8 s. Their `scroll-margin-top` is 76.
- Previous / next: within the part only, grid as in the reader, margin-top 44, padding-top 18.
- **Phones (≤ 760)**: sub-tabs use their short names (`short` in sections.json) and spread edge to edge (`space-between`, gap 12, margin-bottom 18, padding 13 0 12 for 44 px targets). If they still overflow, the right edge fades over 32 px until scrolled to the end. The chapter list folds into a disclosure above the chapter ("Chapters ›", 13 / 600 `--ink3`, the › turns 90° in .15 s, rows min-height 44, hairline under it). "Open in reader" gets a 44 px tap area. Display math at 1.1em.
- **≤ 374**: sub-tab gap 6, 13 px.

## 7. States

| State | Reader | Theory tab |
|---|---|---|
| Loading | `<article aria-busy="true">` empty; top line and grid already drawn | the pane stays as it was until the chapter is ready (no spinner) |
| Not found | contents hidden; one line "Chapter not found. Back to Theory" (`--ink2`, link `--accent`); title "Chapter not found · Site" | an unknown chapter id falls back to the part's first chapter |
| No data / offline / error | "Couldn't load the chapters. Back to Theory" | empty sub-tabs and "Chapters are being written." (`--ink3`) |
| Not configured (no chapters) | as "no data" | "Chapters are being written." |
| Hover | links and rows go to `--ink`; prev / next underline the chapter (offset 2) | same |
| Focus | design-system `:focus-visible` (3 px `--accent` at 55 %, offset 1) | same |
| Selected | current chapter 600 `--ink`; section being read `--ink` with a 1.5 px left bar | selected sub-tab underlined; current chapter 600 |
| Unknown reference | `(??)` in `--bad` | same |
| Unpublished chapter link | `--ink3` text, title "Not published yet" | same |
| Disabled, today, past | none in this feature | none |

## 8. Motion

| What | Duration | Easing | Reduced motion |
|---|---|---|---|
| Jump target flash (reader) | 2 s | ease-out | off (added in this skill) |
| Jump target flash (tab) | 1.8 s | ease-out | off |
| In-tab link scroll | browser smooth scroll | | instant |
| Section bar chevron | .2 s | ease | off |
| Tab chapter-list › | .15 s | ease | off |
| Scroll-spy, contents marking | instant (one update per animation frame) | | |
| Opening at a place | instant jump, repeated after two frames so lazy sections settle | | |

## 9. Light and dark

- Both pages follow the site's saved choice (`localStorage` key `site_theme`, the design system's `THEME_KEY`) or the system. A small inline script sets `<html data-theme>` before the first paint.
- The reader's moon / sun button flips and saves the choice; a change in another tab of the site (the `storage` event) follows here at once.
- Dark uses the design system's soft grey (`--paper` dark), not black. The scrim is darker in dark mode (.45 instead of .18).
- Figures: files are inverted in dark mode (screen only); inline SVG uses tokens.
- `meta theme-color`: `#ffffff` light, `#1c1c1e` dark.
