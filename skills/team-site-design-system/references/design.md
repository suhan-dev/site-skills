# Design reference

Everything needed to rebuild the look without seeing the original. Values are from production CSS. "px" is CSS px.

## 1. Colour tokens

Three blocks in `tokens.css` carry the same names: `:root` (light), `:root[data-theme=dark]` (chosen dark), and
`@media (prefers-color-scheme:dark){:root:not([data-theme=light])}` (system dark when nothing is chosen).

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--paper` | `#ffffff` | `#1c1c1e` | page background, header glass base |
| `--card` | `#ffffff` | `#2c2c2e` | dialogs, sheets, focused inputs |
| `--card2` | `#f5f5f7` | `#3a3a3c` | spare second surface; defined but not used by any skill's CSS today |
| `--ink` | `#1d1d1f` | `#f5f5f7` | primary text, selected tab underline |
| `--ink2` | `#424245` | `#d1d1d6` | body text in documents, secondary controls |
| `--ink3` | `#6e6e73` | `#98989d` | labels, meta, unselected tabs |
| `--ink4` | `#86868b` | `#6e6e73` | placeholders, faint marks, disabled |
| `--fill` | `rgba(118,118,128,.12)` | `rgba(118,118,128,.24)` | ghost buttons, inputs, pill nav and segmented track |
| `--fill2` | `rgba(118,118,128,.2)` | `rgba(118,118,128,.34)` | hover on fills |
| `--seg-on` | `#ffffff` | `#636366` | the selected segment's knob |
| `--sep` | `rgba(60,60,67,.14)` | `rgba(255,255,255,.07)` | hairlines inside a section |
| `--sep2` | `rgba(60,60,67,.26)` | `rgba(255,255,255,.11)` | hairlines between sections, header bottom |
| `--today` | `5%` | `3%` | accent mixed into today's column |
| `--accent` | `#0071e3` | `#0a84ff` | primary buttons, links, focus ring, today |
| `--accent2` | `#0077ed` | `#409cff` | hover on primary |
| `--on-accent` | `#ffffff` | `#ffffff` | text on accent |
| `--ok` | `#28a745` | `#30d158` | "open" week dot, success |
| `--warn` | `#c25e00` | `#ff9f0a` | warning banner rule, setup states |
| `--bad` | `#d70015` | `#ff453a` | errors, delete |
| `--lift` | `0 1px 2px rgba(0,0,0,.04), 0 0 0 .5px rgba(0,0,0,.05)` | `0 0 0 .5px rgba(255,255,255,.06)` | spare shadow for small raised things; defined but not used by any skill's CSS today |
| `--shadow` | `0 24px 64px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08), 0 0 0 .5px rgba(0,0,0,.06)` | `0 24px 64px rgba(0,0,0,.6), 0 0 0 .5px rgba(255,255,255,.1)` | dialogs and popovers only |
| `--ev-bg` | `15%` | `26%` | how much of a member colour tints an event background |
| `--ev-ink` | `58%` | `52%` | how much of the member colour goes into event text |
| `--ev-mix` | `var(--ink)` | `#ffffff` | what the member colour is mixed with for text |

Member / calendar colours, keyed by Google Calendar colorId (1–11):

| colorId | Light | Dark | Apple name |
|---|---|---|---|
| 1 | `#af52de` | `#bf5af2` | purple |
| 2 | `#00c7be` | `#63e6e2` | mint |
| 3 | `#a2845e` | `#ac8e68` | brown |
| 4 | `#ff2d55` | `#ff375f` | pink |
| 5 | `#ffcc00` | `#ffd60a` | yellow |
| 6 | `#ff9500` | `#ff9f0a` | orange |
| 7 | `#007aff` | `#0a84ff` | blue |
| 8 | `#8e8e93` | `#98989d` | grey (Graphite: reserved for Claude-added events) |
| 9 | `#5856d6` | `#5e5ce6` | indigo |
| 10 | `#34c759` | `#30d158` | green |
| 11 | `#ff3b30` | `#ff453a` | red (official events) |

Switch: `--sw-on #34c759` / `#30d158`, `--sw-off rgba(120,120,128,.16)` / `.32`, knob `#ffffff`.

`color-scheme` is set to `light` / `dark` in each block so form controls and scrollbars follow.

Tints are always made with `color-mix()`, never with new literals:
- event background: `color-mix(in srgb, var(--c) var(--ev-bg), var(--paper))`
- event text: `color-mix(in srgb, var(--c) var(--ev-ink), var(--ev-mix))`
- selected choice pill: `color-mix(in srgb, var(--c) var(--ev-bg), var(--card))` + `inset 0 0 0 1.5px var(--c)`
- focus ring: `3px solid color-mix(in srgb, var(--accent) 55%, transparent)`, offset 1 px
- danger button: `color-mix(in srgb, var(--bad) 10%, transparent)`, hover 16 %

## 2. Type

Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Pretendard Variable", Pretendard, "Segoe UI",
system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`. Pretendard (variable, dynamic subset) is loaded from
jsDelivr for Korean and non-Apple systems. Mono: `"SF Mono", ui-monospace, Menlo, Consolas, monospace`.

Body: 15 px / 1.5, letter-spacing −.006em, antialiased, `font-feature-settings: "kern"`, `word-break: keep-all`,
`overflow-wrap: break-word`, `-webkit-text-size-adjust: 100%`.

| Role | Size | Weight | Tracking | Line height |
|---|---|---|---|---|
| Page title `.page-h` | `clamp(26px, 2.6vw, 34px)` (23 px on phones) | 700 | −.025em | 1.12, `text-wrap: balance` |
| Calendar title | 26 px (20 → 19 → 17 px on phones) | 700 | −.025em | 1.2 |
| Section title (`h2` in a tab) | 24 px (the References sections stay 24 px on phones too) | 700 | −.022em | 1.25 |
| Dialog title | 19 px | 700 | −.02em | — |
| Doc h1 | 22 px (19 in a log column) | 700 | −.022em | 1.3 |
| Doc h2 | 17 px | 650 | −.015em | 1.4 |
| Card head / doc h3 | 15 px | 600 | −.015em | — |
| Brand | 15 px (14 at ≤ 340) | 600 | −.015em | — |
| Body / doc text | 15 px, doc 1.7 line height, `--ink2` | 400 | −.006em | 1.5 / 1.7 |
| Tabs | 13.5 px (12.5 at ≤ 374, 11.5 at ≤ 340) | 500, selected 600 | −.006em | — |
| Buttons | 13.5 px (small 12.5) | 500 | −.01em | — |
| Eyebrow `.eyebrow` | 13 px, `--ink3` | 600 | −.005em | — |
| Field label `.fld>span` | 12 px, `--ink3`, 2 px left pad | 500 | — | — |
| Notes, meta | 12.5 px, `--ink3`, `tabular-nums` for numbers | 400 | — | — |
| Language button | 12 px, `--ink2` | 600 | +.03em | — |
| Footer | 12 px, `--ink4` | 400 | — | — |

Numbers in tables, dates and times use `font-variant-numeric: tabular-nums`.

## 3. Space, size, radius

- Page: `max-width 1280px`, side padding 28 px (≥ 1024), 20 px (761–1023), 16 px (≤ 760).
  `main` padding `36px 28px 56px`; phones `22px 16px 36px`.
- Header height 52 px (one row). Phones: 44 px top row + 38 px tab row = 82 px; sticky things below the header use
  `top: 82px` on phones.
- Footer: 12 px text, hairline on top, padding `18px 28px 32px` (phones `16px 16px 28px`), same edges as the content.
- Gaps: 6–8 px between related controls, 12–14 px between a head and its content, 24–28 px between columns,
  44 px between page sections, 64 px between reference sections.
- Radii: pills `999px`; dialogs 20 px (sheets `18px 18px 0 0`); inputs 10 px; code blocks and images 10 px; inline
  code 5 px; small links 7 px; the switch track 16 px.
- Hairlines are `.5px` (they render as one device pixel on Retina).
- Icon buttons 32 px round (44 on phones), icons 18 px, stroke 1.7, round caps and joins, `fill: none`.

## 4. Breakpoints

| Width | What changes |
|---|---|
| ≥ 1101 | Calendar has its right sidebar (312 px). Two-column layouts. |
| ≤ 1100 | Sidebar moves under the calendar (`calendar.css`, `max-width:1100px`). |
| 961– | Sign-out icon shows in the header. ≤ 960: it moves into the name menu. |
| 761–1023 | Header one row, tighter: padding 20 px, gap 12 px, tab padding 10 px. ≤ 900: the name pill shows only its dot. |
| ≤ 760 | Phone layout: header two rows, dialogs → bottom sheets, 44 px tap areas, inputs 16 px, no zoom upright, no intro. |
| ≤ 460 | Name text hidden (dot only), tighter gaps. (The 30 px widths this block sets for the language and icon buttons are overridden by the 44 px phone block after it, so they stay 44 px.) |
| ≤ 374 | Small phones (360 Android, 375 mini): header and tabs close up (tabs 12.5 px). |
| ≤ 340 | 320 px iPhone SE: tabs 11.5 px with no gap, brand 14 px, field labels back above fields. |

Also `(pointer:coarse) and (max-height:500px)` = a phone on its side: treated as a phone (no intro).

## 5. Header

```
≥ 1024 px  (52 px, sticky, glass)
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Example Lab          Calendar  Research log  References  Theory       🔔 ● Alex  EN  ☾  💬• ⇥ │
│                      ════════                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
  grid: minmax(max-content,1fr) | auto | minmax(max-content,1fr), gap 20 px, padding 0 28 px

≤ 760 px  (44 + 38 px)
┌───────────────────────────────────────┐
│ Example Lab           🔔  ●  EN  ☾  💬 │  44 px: brand left, buttons right (44 px each)
│ Calendar  Research log  References Theory│  38 px: tabs spread edge to edge (space-between)
│ ════════                               │
└───────────────────────────────────────┘
```

- Glass: `background: color-mix(in srgb, var(--paper) 78%, transparent)`, `backdrop-filter: saturate(1.8) blur(20px)`,
  bottom hairline `--sep2`, `z-index 30`.
- Tab: full header height (52 px; 38 px on phones), padding `0 14px`, `--ink3`; hover `--ink`; selected `--ink`, 600,
  and a 2 px underline drawn with `box-shadow: inset 0 -2px 0 var(--ink)` (no layout shift). 150 ms transition.
- Brand: a button (replays the intro on desktop, goes to the calendar on phones); hover opacity .72.
- Name pill `.me`: 30 px tall, 10 px dot in the member colour (`--c`), name 13 px 500. Hover `--fill`. Not signed in:
  an empty ring (`inset 0 0 0 1.5px var(--ink4)`). Opens the name menu (a dialog: the name, then "Site guide · App &
  notifications · Sign out" as a row of links).
- Language `.lang-btn`: one pill button that reads the language in use, "EN" or "KO"; a tap switches to the other.
  32 px tall, min-width 34 px, padding 0 6 px, 12 px 600, +.03em, `--ink2`; hover `--fill` and `--ink`. Its title and
  label say what a tap does ("Switch to Korean"). Phones: a 44 px circle; ≤ 374 min 38; ≤ 340 min 36.
  Wired by `wireLangButton()` in `i18n.js`.
- Theme button: a moon when light, a sun when dark (`aria-pressed=true` = dark).
- Bell: same icon button; opens "App & notifications" (`ios-webapp-push`).
- Chat `.chat-btn` (`team-chat`): an icon button with a 19 px speech bubble, between the theme button and sign-out.
  Open: `aria-expanded=true`, `--ink` on `--fill`. Unread messages: `.chat-dot`, an 8 px `--accent` dot with a 2 px
  `--paper` ring, at `top: calc(50% - 11px); left: calc(50% + 5px)` (the bubble's top-right shoulder).
- Order, left to right: bell · name · language · theme · chat · sign-out.

## 6. Buttons and controls

| Class | Size | Look | Hover |
|---|---|---|---|
| `.btn` | 32 px tall, padding 0 15 px, 13.5 px 500 | pill, `--ink` text | — |
| `.btn.primary` | | `--accent` fill, white text | `--accent2`; disabled opacity .4 |
| `.btn.ghost` | | `--fill` | `--fill2` |
| `.btn.danger` | | 10 % red fill, red text | 16 %; `.armed` = solid red, white text ("Click again to delete") |
| `.btn.small` | 28 px, padding 0 12 px, 12.5 px | | |
| `.btn.sq` | 32 × 32 (44 × 44 on phones) | square pill for an icon | |
| `.icon-btn` | 32 px circle (44 on phones) | no fill, `--ink2` | `--fill`, `--ink` |
| `.pill-nav` | no track of its own in `components.css` (the calendar draws one: `.cal-nav`, 2 px padding, `--fill`) | buttons inside are 28 px, transparent | `--fill` |
| `.segmented` | same track; buttons 28 px, min 62 px, 13 px 500 | selected: `--seg-on` knob, 600, `0 1px 3px rgba(0,0,0,.1), 0 0 0 .5px rgba(0,0,0,.04)` | `--ink` |
| `.seg` choice pills | 30 px, padding `0 12px 0 10px`, 13 px 500, 9 px colour dot | `--fill` | checked: tinted + 1.5 px ring in `--c`, 600 |
| `.sw` switch | 51 × 31 px track, 27 px knob, 2 px inset | `--sw-off` / `--sw-on` | knob slides 20 px in 220 ms `cubic-bezier(.3,.7,.4,1)` |
| `.chk` checkbox | 16 px box (18 on phones), 13.5 px label (15 on phones) | `accent-color: var(--accent)` | |

Focus: `:focus-visible` gets the 3 px 55 % accent ring everywhere; inputs get `0 0 0 1px var(--accent), 0 0 0 4px
color-mix(in srgb, var(--accent) 22%, transparent)` and turn `--card`.

## 7. Dialogs and sheets

```
desktop (≥ 761 px)                         phone (≤ 760 px)
     ┌──────────────────────────┐          ┌───────────────────────┐
     │ New event            (×) │          │  page, blurred        │
     │ Title                    │          ├───────────────────────┤ ← radius 18 18 0 0
     │ [____________________]   │          │ New event         (×) │
     │ …                        │          │ Title                 │
     │           Cancel  Save   │          │ [___________________] │
     └──────────────────────────┘          │ Cancel    │   Save    │
  560 px (620 wide), radius 20,            │ + safe-area bottom    │
  backdrop rgba(0,0,0,.28) + blur 6 px     └───────────────────────┘
```

- `<dialog class="dlg">`, width `min(560px, 100vw − 32px)`, `max-height: 100vh − 48px`, `overflow-x: hidden` (a dialog
  scrolls up and down, never sideways), `--card` background, `--shadow`, radius 20 px.
- Inner `.dlg-in`: padding `20px 22px`, one grid column `minmax(0,1fr)`, gap 14 px.
- Top `.dlg-top`: title 19 px 700 and a 28 px round close button on `--fill` (14 px icon, stroke 2.2).
- Open: `dlg-in` 220 ms `cubic-bezier(.2,.8,.2,1)` from `translateY(8px) scale(.98)` and opacity 0.
- Phones: full width, `margin: auto 0 0`, `max-height: 100dvh − 32px`, radius `18px 18px 0 0`, own vertical scroll with
  `overscroll-behavior: contain`, slides up from `translateY(100%)` in 320 ms. Content stays 560 px wide in the middle on
  wider phones and small tablets: `padding: 18px max(16px, (100% − 560px)/2) max(20px, var(--sab) + 10px)`.
  Cancel and Save share the last row (`flex: 1 1 0`). While a sheet is open the page behind is locked (`html.locked` +
  `sheet.js` `lockPage`); a tap on the dim area or a pull down closes it (`sheetDialogs()`, see mobile.md §2–3).
- Fields `.fld`: 38 px tall (44 on phones), padding `0 12px`, radius 10, `--fill`, no border; textarea padding
  `9px 12px`, line height 1.55, vertical resize.
- Notes `.dlg-note` 12.5 px `--ink3`; errors `.dlg-err` 13 px `--bad`; both hidden when empty.

## 8. Sections, documents, banners

- `.card` is not a box: `padding-top 14px`, a `--sep2` hairline on top. `.card-h` 15 px 600 with an optional
  `small` hint (12 px `--ink4`).
- `.banner`: `padding: 1px 0 1px 12px`, a 2 px left rule in `--warn` (or `--bad`), 13.5 px `--ink2`.
- `.doc` (Markdown): 15 px / 1.7 `--ink2`; h1 22 px, h2 17 px 650, h3 15 px 600 (all `--ink`); paragraphs 8 px apart;
  lists 22 px indent, 2 px between items; task lists hang their checkboxes in the indent; inline code `--fill` 5 px
  radius at .86em; code blocks `--fill` 10 px radius, 12.5 px / 1.55, scroll sideways; blockquote 3 px `--sep2` rule,
  `--ink3`; tables full width, hairline rows, `tabular-nums`, scroll sideways inside themselves; images radius 10.
- Reading measure for prose: `max-width: 68ch` (references) and 72ch (the reader).

## 9. States

| State | Look |
|---|---|
| Hover (pointer) | fills step up one level (`--fill` → `--fill2`), text `--ink3` → `--ink`; links underline 2 px offset |
| Focus | accent ring (above) |
| Selected tab / segment | `--ink`, 600, underline or knob |
| Disabled | opacity .4 (buttons), .42 (switch rows), .5 (the chat's send button while sending) |
| Empty | one line in `--ink3`, 13.5 px, with the action as a button or link beside it |
| Loading | a grey dot + "Loading"; never a spinner over content |
| Error | red text line or a `.banner.bad`, with what to do |
| Not configured | `.banner` (warn) that names the missing setting, e.g. "Google Calendar isn't connected yet" |
| Today | accent text and `--today` % accent mixed into the column |
| Past / closed | `--ink3` / `--ink4`, a small lock glyph (12 px, stroke 1.6) |

## 10. Motion

- Colour and background transitions 150 ms with the default `ease`; the switch track `.2s ease`; dialog 220 ms and
  sheet 320 ms with `cubic-bezier(.2,.8,.2,1)`. Every value with its file and line: [docs/design/motion.md](../../../docs/design/motion.md).
- `prefers-reduced-motion: reduce` removes the dialog and sheet animations and the switch transitions
  (`components.css`), and each skill removes its own larger motion (the chat panel slide, smooth scrolling to a passage, the intro's
  arrival; see each skill's design.md). Still running
  with reduced motion: colour fades (hover colours, the chat's flash on a message or a passage, the selection bar's
  fade-in), the intro's progress dots growing, the calendar banner's short shake on a read-only event, and the
  pull-to-close spring of a phone sheet (it follows the finger).
- Nothing bounces. One thing pulses: the calendar's small sync dot while a load is in progress (`calendar.css`).

## 11. Phones in detail

- 44 px rule: header buttons, `.btn`, `.icon-btn`, fields and checkboxes get the real height. Small text controls
  (`.btn.small`, the dialog close button, choice pills, pill-nav and segmented buttons) keep their look and get an
  invisible 44 px hit area with `::after { inset: centred; width: max(100%,44px); height: max(100%,44px) }`.
- Inputs at 16 px so iOS Safari does not zoom on focus.
- Upright phones: viewport gets `maximum-scale=1,user-scalable=no`, `gesturestart` is prevented (iOS ignores
  user-scalable), and `html { touch-action: pan-x pan-y }` stops double-tap zoom. Landscape keeps zoom.
- Strips that scroll sideways fade their right edge with a 32 px mask and lose the fade at the end (`.at-end`): the
  Research log's week tabs (from 761 px; `records.css`) and the Theory sub-tabs (`theory.css`).
- Sticky rows under the header sit at `top: 82px`; anchors they cover use `scroll-margin-top`.
- Safe areas: sheets pad `--sab` (`max(env(safe-area-inset-bottom), var(--home))`; `--home` is 34 px in the iPhone Home
  Screen app, where `env()` stays 0); the installed app's status bar colour follows the page (`paintStatusBar`).

## 12. Icons

Inline SVG, 24 × 24 viewBox, `stroke: currentColor`, width 1.7 (2–2.3 inside small pills), round caps and joins, no
fill, drawn at 16–18 px. No icon fonts, no emoji in the UI.
