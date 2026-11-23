# Phones: every rule, where it lives, and why

The team reads the site on iPhones as often as on laptops, mostly from the Home Screen app. Each rule below came from
something that went wrong on a real phone. Every rule lists **what** it does, **where** it lives (the file in the skill
that ships it) and the **code**, so you can copy the rule and know what it guards against.

What counts as a phone (one set of media queries, used everywhere):

| Query | Means |
|---|---|
| `(max-width:760px)` | phone layout: header in two rows, dialogs become bottom sheets, 44 px taps |
| `(max-width:760px) and (orientation:portrait)` | a phone held upright: no zoom at all |
| `(pointer:coarse) and (max-height:500px)` | a phone on its side: still a phone (no intro), but zoom is allowed |
| `(hover:none) and (pointer:coarse)` | a touch screen of any size: the selection bar docks, Enter makes a new line |
| `(hover:hover) and (pointer:fine)` | a mouse: inner scroll areas keep their scroll to themselves |

## 1. Zoom

| Rule | Where | Why |
|---|---|---|
| A phone held upright never zooms: no pinch, no double tap | `theme.js` `lockPhoneZoom()` + `components.css` | The layout is made for the phone's width. A pinch on iOS left the page zoomed and panned sideways, so the header and calendar were cut off. |
| A phone on its side may zoom | same (the query is portrait only) | On its side the page is wider than the layout was made for; small text can be zoomed if needed. |
| No double-tap zoom anywhere | `tokens.css` (`html{touch-action:manipulation}`) | A quick second tap on a button zoomed the page instead of pressing it. `manipulation` keeps scroll and pinch, drops double-tap zoom, and removes the 300 ms tap delay. |
| Every text field is 16 px on phones | `components.css` (`.fld input`), each skill's own fields | iOS zooms into any focused field under 16 px and does not zoom back. |

How the upright lock works (three layers, because iOS ignores `user-scalable=no` on its own):

```js
// theme.js lockPhoneZoom(): the viewport meta follows the orientation
const m = document.querySelector('meta[name="viewport"]');
const q = matchMedia("(max-width:760px) and (orientation:portrait)");
const base = "width=device-width,initial-scale=1";
const set = () => m.setAttribute("content", q.matches ? base + ",maximum-scale=1,user-scalable=no" : base);
set(); q.addEventListener("change", set);
// iOS Safari ignores user-scalable: stop the pinch itself
document.addEventListener("gesturestart", (e) => { if (q.matches) e.preventDefault(); }, { passive: false });
```

```css
/* components.css: upright phones pan but never pinch-zoom */
@media (max-width:760px) and (orientation:portrait){html{touch-action:pan-x pan-y}}
```

Run it in `<head>` before first paint (the same inline script as the theme), so the first layout is already locked.

## 2. Where scrolling is locked, and how

| Place | What scrolls | What is locked | How | Why |
|---|---|---|---|---|
| Any dialog on a phone (event editor, name menu, app & notifications) | the sheet, up and down only | sideways scroll inside the sheet; scroll chaining into the page | `dialog.dlg{overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;max-height:calc(100dvh - 32px)}` | A long form must scroll inside the sheet. Without `contain`, reaching the end of the sheet started scrolling the page behind it. `overflow-x:hidden` stops a wide date field from panning the sheet sideways. |
| Behind a dialog | nothing | the page | `showModal()` makes the page inert; a tap on the dim area closes: `dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); })` (a click on the backdrop reports the dialog itself as its target) | The page must not react while a sheet is open; tapping outside is how people close sheets on iOS. |
| Team chat sheet (phones) | the message list | the page and the dim area | `html.chat-open, html.chat-open body{overflow:hidden}`; scrim `touch-action:none`; list `overscroll-behavior:contain`; a tap on the scrim closes | The chat is not a `<dialog>` (it stays open beside the page on a laptop), so it locks the page itself. A drag on the dim area must not scroll the page. |
| Week calendar (phones) | the hours, up and down | sideways pan, pinch | `.cal-grid{touch-action:pan-y}`, `.wv-body{overflow-x:hidden}`; a quick sideways swipe (> 56 px, mostly horizontal, < 0.7 s) changes the week in JS | The whole week fits the width. Sideways movement means "next week", never a pan. |
| Week calendar (mouse) | the hours | chaining into the page | `@media (hover:hover) and (pointer:fine){.wv-body{overscroll-behavior:contain}}` | With a wheel, the hours are their own scroll box. On touch the end of the hours carries on into the page, which is what a thumb expects. |
| Phone calendar height | — | — | the grid ends at the bottom edge: `height:calc(100dvh - var(--cal-top))`, `--cal-top` measured by `ResizeObserver` | One screen, no page scroll on the calendar tab; `dvh` follows Safari's toolbar. |
| Guide panel (phones) | the panel | chaining | `.guide-panel{overflow-y:auto;overscroll-behavior:contain;max-height:calc(100dvh - 72px)}` | Long steps scroll inside the sheet; the spotlight above stays put. |
| Reader contents sheet (phones) | the sheet | chaining | `.rd-sheet{max-height:min(72vh,620px);overflow-y:auto;overscroll-behavior:contain}` | The contents hang from the sticky section bar over the text; scrolling them must not move the chapter. |
| Wide formulas, tables, week tabs | the strip, sideways | the page, sideways | the strip gets `overflow-x:auto`; the page never scrolls sideways | Only the thing that is too wide scrolls, never the page. A fade at the edge (`mask-image`) shows there is more. |
| Intro (desktop only) | the page (it drives the scene) | the site under it | `html.intro-on .app{position:fixed;inset:0;visibility:hidden;overflow:hidden}`; `history.scrollRestoration="manual"` | The intro is the scroll; the site must not be scrolled or focused under it, and a reload must start at the top. Phones never get the intro. |

Two rules hold everywhere: **the page itself never scrolls sideways** (check at 320 px), and **an inner scroll box uses
`overscroll-behavior:contain` only where chaining would surprise** (sheets, panels, lists), not on the main column.

## 3. Sheets instead of centred dialogs

- Every `dialog.dlg` becomes a bottom sheet at ≤ 760 px: full width, `border-radius:18px 18px 0 0`, `margin:auto 0 0`,
  slides up (`translateY(100%)` → 0, 320 ms `cubic-bezier(.2,.8,.2,1)`).
- Wider than a phone (a tablet held upright), the fields stay 560 px wide in the middle:
  `padding: 18px max(16px, calc((100% - 560px) / 2)) …`.
- The chat and the guide follow the same shape (top corners 14 px, grab handle on the chat).
- Why: centred dialogs on iPhone overlapped the keyboard, panned sideways and zoomed on focus. The event editor was
  unusable before this.

## 4. The keyboard

- The chat sheet follows `window.visualViewport`: its top is `visualViewport.offsetTop` and its height
  `visualViewport.height`, updated on the viewport's `resize` and `scroll`. The composer stays just above the keyboard.
- Fields in dialogs are 16 px (no zoom), so focusing them does not move the layout.
- Enter: on a touch screen it is a new line and the arrow button sends; with a keyboard Enter sends. Enter never sends
  while a Korean syllable is being composed (`e.isComposing || e.keyCode === 229`).

## 5. Safe areas (notch, home bar)

- Bottom paddings of sheets and docked bars add `env(safe-area-inset-bottom,0px)`:
  `padding-bottom: calc(20px + env(safe-area-inset-bottom,0px))`. Side paddings of full-width bars use
  `max(20px, env(safe-area-inset-left/right))`.
- The site keeps the default viewport (no `viewport-fit=cover`). Then iOS keeps the page inside the safe area itself and
  these insets are 0 in Safari; they still matter in landscape and the moment a page opts into `cover`. Always write
  them, so switching later breaks nothing. If you do add `viewport-fit=cover`, add it to `base` in `lockPhoneZoom()`
  too, because that function rewrites the whole viewport meta.
- The Home Screen app uses `apple-mobile-web-app-status-bar-style: default` (content starts under the status bar, not
  behind it) and `theme-color` for light and dark.

## 6. Selecting text on a touch screen

- iOS and Android show their own Copy / Look Up menu above a selection. The site's Copy · Comment bar therefore docks at
  the **bottom** of the screen on touch screens (`position:fixed; bottom: calc(18px + env(safe-area-inset-bottom))`,
  44 px tall), and appears 400 ms after the selection settles, not on every handle drag.
- The bar itself is `user-select:none`, and a press on it calls `preventDefault()` on `mousedown`, so tapping it keeps
  the selection.
- Details: `team-chat/references/design.md` §6.

## 7. Taps

- Every control is at least 44 × 44 px on phones (Apple's minimum). Controls that sit in the page's rhythm get the real
  size. Small text controls keep their look and get an invisible 44 px hit area:
  `.btn.small{position:relative}` + `.btn.small::after{content:"";position:absolute;left:50%;top:50%;width:max(100%,44px);height:max(100%,44px);transform:translate(-50%,-50%)}`.
- On touch screens a tap anywhere on a date or time field opens the picker, so Chrome's small picker icons are hidden
  (`::-webkit-calendar-picker-indicator{display:none}` under `(pointer:coarse)`).
- iOS date and time inputs keep a built-in minimum width; `min-width:0; -webkit-appearance:none` stops them spilling
  into the next column.

## 8. Viewport units

- Use `dvh` for things that must end at the visible bottom edge (sheets, the phone calendar), with a `vh` line before
  it as the fallback: `max-height:calc(100vh - 32px); max-height:calc(100dvh - 32px)`.
- Use `svh` for a full-screen stage that must not jump when Safari's toolbar collapses (the intro).
- Never `100vh` alone on a phone: on iOS it is the height with the toolbar hidden, so the bottom is cut off.

## 9. Check on a real phone

Headless browsers do not show most of these problems. On an iPhone, in Safari **and** from the Home Screen:

- [ ] Pinch on the calendar upright: nothing happens. On its side: it zooms.
- [ ] Double-tap a button quickly: it presses twice, the page does not zoom.
- [ ] Open the event editor, focus Title: no zoom; scroll the sheet to the end and keep dragging: the page behind
  does not move; tap the dim area: it closes.
- [ ] Open the chat, drag on the dim area: the page does not move; type: the composer stays above the keyboard.
- [ ] Select words in a chapter: the phone's own menu and the Copy · Comment bar are both usable.
- [ ] Swipe the week sideways: the next week comes in; the page never pans sideways at 320 px.
