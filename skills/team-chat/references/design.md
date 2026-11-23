# Team chat: design

Document style, like the rest of the site: no bubbles and no boxes. Name and time on one line, the message under it, a
quote as a hairline on the left. Colours come only from `team-site-design-system` tokens.

## 1. Where it opens

| Width | Shape | Page |
|---|---|---|
| ≥ 1100 px | Panel on the right, 380 px, full height from the top | The page makes room: `html.chat-open body { padding-right: 380px }`, animated with the panel. No shadow. |
| 761–1099 px | Panel on the right, 380 px, under the header (`--chat-top` = the header's bottom, kept in place on scroll) | The panel covers the page's right edge. Shadow `-18px 0 40px -32px rgba(0,0,0,.35)`. |
| ≤ 760 px | Sheet from the bottom, full width, from the safe-area top (at least 10 px) to the top of the keyboard | Dimmed with a scrim `rgba(0,0,0,.28)`; the page doesn't scroll behind it. A tap on the scrim closes. |

```
≥ 1100 px                                                ≤ 760 px
┌────────────────────────────────┬─────────────────┐    ┌───────────────────────┐
│ header                         │ Team chat All│2 ×│    │       ▔▔▔▔ grab       │
├────────────────────────────────┤─────────────────┤    │ Team chat   All│2   × │
│ page (moves left by 380 px)    │ Yesterday       │    │ Today                 │
│                                │ ● Blair 21:40   │    │ ● Alex 09:12   Delete │
│ …a passage that two people     │   message       │    │   ┃ A1 › 2. Two ideas │
│   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾  │ ● Alex 09:12    │    │   ┃ a passage that…   │
│   read differently…            │   ┃ quote       │    │   ┃ Go to text →      │
│   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾             │   ┃ Go to text →│    │   message             │
│                                │   message       │    │                       │
│                                ├─────────────────┤    ├───────────────────────┤
│                                │ (Message…)    ⬆ │    │ (Message the team)  ⬆ │
└────────────────────────────────┴─────────────────┘    └───────────────────────┘
```

Motion: the panel slides in from the right (`translateX(100%)` → 0), the sheet from below (`translateY(100%)` → 0),
both 280 ms `cubic-bezier(.2,.8,.2,1)`; with reduced motion, no transition. Closing hides it after 260 ms.

## 2. Header button

- `.chat-btn`: the standard 32 px icon button (44 px on phones) with a 19 px speech bubble (stroke 1.7).
- Open: `aria-expanded=true`, `--ink` on `--fill`.
- Unread: `.chat-dot`, 8 px, `--accent`, with a 2 px `--paper` ring, at `top: calc(50% - 11px); left: calc(50% + 5px)`.
  Unread = messages from others with an id above the one saved in `site_chat_seen`. A first visit starts with nothing
  unread. The label becomes "Team chat, 3 new".
- Order on the right of the header: bell · name · language · theme · **chat** · sign-out.

## 3. Panel head

| Part | Desktop | Phone |
|---|---|---|
| Grab handle | none | 36 × 5 px, radius 3, `--fill2`, 6 px from the top |
| Head padding | 12 10 10 20 px, hairline `--sep` under it | 4 6 8 16 px |
| Title "Team chat" | 15 px, 650, −.01em | 17 px |
| Tabs (All · This page n) | Segmented: track `--fill`, radius 8, 2 px inset; buttons 26 px, 0 10 px, 12.5 px 500 `--ink2`; selected `--seg-on`, `--ink`, `0 1px 2px rgba(0,0,0,.08)` | 30 px, 0 12 px, 13 px |
| Count after "This page" | 600, `--accent`; hidden at 0 | same |
| Close × | 30 px circle, 15 px icon, stroke 2 | 44 px |
| Status line (chat not connected) | 12.5 px `--ink3`, 10 20 px, hairline under | 10 16 px |

**This page** lists only comments whose `page` is on screen now (every visible `[data-chat-page]`, plus the event the
chat was opened from). It follows tab, chapter and week changes.

## 4. Messages

| Part | Value |
|---|---|
| List padding | 6 20 14 px (phones 4 16 12 px), scrolls on its own, `overscroll-behavior: contain` |
| Day label | Sticky, 11.5 px 600 +.02em `--ink4`, 12 20 6 px, a `--paper` → transparent gradient behind it (phones `--card`). "Today", "Yesterday", else "Mon, Dec 22" / "12월 22일 (월)" |
| Item | 9 px above, 10 px below; a `.5px --sep` hairline between items |
| Name line | 12.5 px: 7 px dot in the member colour (`--gc-N`), name 600 `--ink` (your own: `--accent`), time `--ink4` tabular |
| Delete (own only) | Right end, 12 px `--ink4`, visible on hover or focus (always on phones, 32 px tall). First tap: "Delete?" in `--bad` 600 for 3 s; second tap deletes |
| Text | 14 px / 1.5 (phones 15 px), 14 px left indent (under the name, past the dot), `pre-wrap`, `keep-all` for Korean, `overflow-wrap: anywhere`. `https://` links in `--accent` |
| Quote | 14 px indent, 2 px `--sep2` left rule (hover: `--accent`), 10 px inside. Where: 11.5 px 600 `--ink4`, one line with an ellipsis ("A1 Sample chapter › 2. Two ideas"). The words: 13 px / 1.45 `--ink3`, at most 3 lines. "Go to text →" 12 px 500 `--accent` |
| Flash | A message opened from a mark: `--accent` at 12 % fading out over 1.6 s |
| Empty | 13.5 px / 1.55 `--ink3`, 28 px padding: how to write or comment (touch wording on touch screens) |

## 5. Composer

| Part | Desktop | Phone |
|---|---|---|
| Area | 10 14 12 20 px + safe area, hairline above | 8 10 8 16 px + safe area, `--card` |
| Quoted passage | 2 px `--accent` rule; "Commenting on" 11.5 px 600 `--accent`; the words 13 px / 1.4 `--ink3`, 2 lines; × 28 px circle `--ink4` | × 36 px |
| Field | Pill, radius 18, `.5px --sep2`, 8 12 px, 14 px / 1.4, 36 px min, grows to 132 px. Focus: border `--accent` 60 %, ring 3 px `--accent` 16 % | 16 px text (no zoom on focus), 38 px min, 8 14 px |
| Send | 32 px `--accent` circle, white up arrow 16 px stroke 2.4; disabled while sending (opacity .5) | 34 px |
| Error | 12 px `--bad` under the field, hidden when empty | |

Keys: Enter sends and Shift+Enter is a new line with a keyboard; on touch screens Enter is a new line and the arrow
sends. Enter never sends while a Korean syllable is being composed.

## 6. Copy · Comment bar

| | Mouse | Touch |
|---|---|---|
| Where | Centred 8 px above the selection's first line; under its last line when that would hide under the header; kept 8 px inside the window (and clear of an open panel) | Docked: fixed, centred, 18 px above the bottom + safe area, so the phone's own Copy/Look Up menu stays usable |
| Size | 34 px tall, radius 9, 0 4 px; buttons 0 11 px, 13 px 500 | 44 px tall, radius 22, 0 6 px; buttons 0 16 px, 15 px |
| Look | `#1d1d1f` (dark mode `#3a3a3c`), white text, shadow `0 8px 24px rgba(0,0,0,.22)` + `.5px` white 8 % ring, a `.5px` white 28 % divider 16 px tall (20 px docked). Fades in over 140 ms | same |
| Shows | 10 ms after mouse-up or Shift-select | 400 ms after the selection settles |

Copy writes to the clipboard, shows "Copied" alone for 0.9 s, then hides. Comment captures the passage, clears the
selection, opens the chat with the quote in the composer and focuses the field. The bar never appears for a selection
outside a `[data-chat-page]` root.

## 7. Marks in the text

- `mark.cm-mark`: no background, the text's own colour, an underline 1.5 px in `--accent` at 55 %, offset 3 px,
  `skip-ink: none`. Hover: `--accent` at 9 % behind it. Title "Show the comment".
- One mark per text node, so a passage across bold, links or several paragraphs still underlines. Math (KaTeX) is never
  split.
- A tap on a mark (without a selection) opens the chat on **This page** and flashes the comment.
- **Go to text** opens the tab, chapter or week first if needed, scrolls the mark to the centre and flashes it
  (`--accent` 22 % fading over 1.8 s). On a phone the sheet closes first.
- Printing hides the chat and the bar, and drops the underline.

## 8. Words

All strings are in `chat-strings.js` (EN and KO). The header button's label stays English. Dates and times use the
team's time zone (`TIMEZONE`), not the browser's.
