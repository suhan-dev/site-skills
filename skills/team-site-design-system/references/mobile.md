# Phones: every rule, where it lives, and why

The team reads the site on iPhones as often as on laptops, mostly from the Home Screen app. Each rule below came from
something that went wrong on a real phone. Every rule lists **what** it does, **where** it lives (the file in the skill
that ships it) and the **code**, so you can copy the rule and know what it guards against.

What counts as a phone (one set of media queries, used everywhere):

| Query | Means |
|---|---|
| `(max-width:760px)` | phone layout: header in two rows, dialogs become bottom sheets, 44 px taps. In JS: `PHONE_Q` in `sheet.js` |
| `(max-width:760px) and (orientation:portrait)` | a phone held upright: no zoom at all |
| `(pointer:coarse) and (max-height:500px)` | a phone on its side: still a phone (no intro), but zoom is allowed |
| `(hover:none) and (pointer:coarse)` | a touch screen of any size: one docked Comment button, Enter makes a new line |
| `(hover:hover) and (pointer:fine)` | a mouse: inner scroll areas keep their scroll to themselves |

The files: `tokens.css` (`--sab`), `components.css` (sheets, `html.locked`, zoom), `theme.js` (pre-paint script,
`lockPhoneZoom()`), `sheet.js` (`lockPage`, `unlockPage`, `pullToClose`, `sheetDialogs`). The chat's own parts are in
`team-chat` (`chat.js`, `chat.css`).

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

### The page behind an open sheet stays still

`overflow:hidden` on `<html>` is not enough on an iPhone: Safari and the Home Screen app still scroll the page under a
finger. With the chat open, a drag scrolled the page behind the sheet, which felt broken. The rule since then: while
any sheet is open (chat, event, day list, notifications, install), the page behind does not move at all.
`lockPage()` does two things:

1. `html.locked` (`components.css`): `html.locked, html.locked body { overflow: hidden }`, for wheels, keys and
   Android.
2. A `touchmove` listener on the document, **capture phase, not passive**, that cancels every finger move unless it
   scrolls something under the finger that still has room to move that way. An input or textarea always gets the move
   (the caret and text selection need it).

```js
// sheet.js: walk up from the finger; let the move through only if an inner box can take it
const canScroll = (el, dy, dx) => {
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (el.matches("input,textarea,select")) return true;
    const s = getComputedStyle(el);
    if (Math.abs(dx) > Math.abs(dy)) {               // sideways: a wide table or formula strip
      if (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1) return true;
      continue;
    }
    if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      if (dy > 0 && el.scrollTop <= 0) return false;   // at the top, pulled down: would chain to the page
      if (dy < 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) return false; // at the bottom
      return true;
    }
  }
  return false;
};
function touchMove(e) {
  if (e.touches.length !== 1) return;                // two fingers: leave pinch to lockPhoneZoom
  /* dy, dx from the last touch point */
  if (!canScroll(target, dy, dx) && e.cancelable) e.preventDefault();
}
```

- **Counted.** `lockPage()` / `unlockPage()` keep a count, so a dialog opened over the chat sheet and then closed does
  not unlock the page while the chat is still open.
- **Why not `body { position: fixed }`?** That is the usual trick, but it jumps the page to the top (you must save and
  restore the scroll by hand) and the sticky header loses its place for a moment. The touch guard leaves the page
  exactly where it was.
- **Why not `overscroll-behavior` alone?** It stops chaining from a list that is scrolled to its end, but not a drag
  that starts on something that does not scroll at all (a title, the composer, the dim area).

### Where each scroll lives

| Place | What scrolls | What is locked | How | Why |
|---|---|---|---|---|
| Any dialog on a phone (event editor, day list, name menu, app & notifications) | the sheet, up and down only | the page; sideways scroll inside the sheet; chaining | `sheetDialogs()` (`sheet.js`) calls `lockPage()` while a `dialog.dlg` is open at ≤ 760 px; `dialog.dlg{overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;max-height:calc(100dvh - 32px)}` | A long form must scroll inside the sheet; reaching its end must not start scrolling the page. `overflow-x:hidden` stops a wide date field from panning the sheet sideways. `showModal()` already makes the page inert to taps, but not to a finger's scroll. |
| Team chat sheet (phones) | the message list | the page and the dim area | `chat.js` calls `lockPage()` on open at ≤ 760 px and `unlockPage()` on close (and on a resize across 760 px); scrim `touch-action:none`; list `overscroll-behavior:contain` | The chat is not a `<dialog>` (it stays open beside the page on a laptop), so it locks the page itself. A drag on the dim area must not scroll the page. |
| Back from the chat (phones) | — | — | on open `pageY = scrollY`; on close, after `unlockPage()`, `if (Math.abs(scrollY - pageY) > 2) scrollTo(0, pageY)` | The keyboard can still move the page while it is locked (iOS scrolls to bring the field into view). Closing the chat puts the page back where it was. |
| Week calendar (phones) | the hours, up and down | sideways pan, pinch | `.cal-grid{touch-action:pan-y}`, `.wv-body{overflow-x:hidden}`; a quick sideways swipe (> 56 px, mostly horizontal, < 0.7 s) changes the week in JS | The whole week fits the width. Sideways movement means "next week", never a pan. |
| Week calendar (mouse) | the hours | chaining into the page | `@media (hover:hover) and (pointer:fine){.wv-body{overscroll-behavior:contain}}` | With a wheel, the hours are their own scroll box. On touch the end of the hours carries on into the page, which is what a thumb expects. |
| Phone calendar height | — | — | the grid ends at the bottom edge: `height:calc(100dvh - var(--cal-top))`, `--cal-top` measured by `ResizeObserver` | One screen, no page scroll on the calendar tab; `dvh` follows Safari's toolbar. |
| Guide panel (phones) | the panel | chaining | `.guide-panel{overflow-y:auto;overscroll-behavior:contain;max-height:calc(100dvh - 72px)}` | Long steps scroll inside the sheet. The page is **not** locked: the tour scrolls it to bring each spotlight into view. |
| Reader contents sheet (phones) | the sheet | chaining | `.rd-sheet{max-height:min(72vh,620px);overflow-y:auto;overscroll-behavior:contain}` | The contents hang from the sticky section bar over the text; scrolling them must not move the chapter. |
| Wide formulas, tables, week tabs | the strip, sideways | the page, sideways | the strip gets `overflow-x:auto`; the page never scrolls sideways | Only the thing that is too wide scrolls, never the page. A fade at the edge (`mask-image`) shows there is more. The sheet lock lets these through (the sideways branch of `canScroll`). |
| Intro (desktop only) | the page (it drives the scene) | the site under it | `html.intro-on .app{position:fixed;inset:0;visibility:hidden;overflow:hidden}`; `history.scrollRestoration="manual"` | The intro is the scroll; the site must not be scrolled or focused under it, and a reload must start at the top. Phones never get the intro. |

Two rules hold everywhere: **the page itself never scrolls sideways** (check at 320 px), and **an inner scroll box uses
`overscroll-behavior:contain` only where chaining would surprise** (sheets, panels, lists), not on the main column.

## 3. Closing a sheet

Every sheet on a phone closes three ways: its × button, a **tap outside**, and a **pull down**. Esc closes it with a
keyboard.

| Way | How | Rule |
|---|---|---|
| Tap outside | dialogs: `d.addEventListener("click", (e) => { if (e.target === d) d.close(); })` (a click on `::backdrop` reports the dialog itself; `.dlg` has no padding of its own, so a click inside always lands on a child). Chat: a click on `.chat-scrim` | The chat sheet leaves a 44 px strip of the page above it (`--gap: max(safe-area-top, 44px)`), one finger wide, so there is always something to tap. |
| Pull down | `pullToClose(sheet, { scroller, close })` in `sheet.js` | Starts from the sheet's top bar, or from anywhere when what is under the finger is scrolled to the top. Not from inside a text field. |

The pull, step by step:

1. `touchstart`: only on a phone, one finger, not in an input, and only if the scroller under the finger (the chat's
   message list, or the dialog itself) is at `scrollTop` 0. Remember `y0`, `x0` and `e.timeStamp`.
2. The first 8 px decide. Up, or more sideways than down: it is a scroll, not a pull; let it go. Text selected: the
   finger is moving a selection handle; let it go.
3. Down: cancel the move (`preventDefault`) and follow the finger with `transform: translateY(dy)`, no transition.
4. `touchend`: close if `dy > 110 px`, or on a flick (`dy > 36 px` and faster than `0.55 px/ms`, timed with
   `event.timeStamp`, which is the touch's own clock). Closing slides the rest of the way (`translateY(100%)`, 260 ms
   `cubic-bezier(.2,.8,.2,1)`), then calls `close()` and clears the inline style. Anything less springs back.

Why: this is how sheets close in iOS, and the team asked for "tap outside to leave" after using the chat in the
iPhone app. **No half-height state**: a sheet is open or closed. A middle detent would need its own layout for the list
and the composer, and nobody asked for one.

```js
// once, after the dialogs are in the page (sheet.js): lock + tap outside + pull down for every dialog.dlg
sheetDialogs();
// a page that already closes its dialogs on a backdrop click (calendar.js):
sheetDialogs("dialog.dlg", { tapOutside: false });
// the chat (chat.js): the list is the scroller, so a pull inside a scrolled list scrolls it instead
pullToClose(box, { scroller: () => list, close });
```

## 4. Sheets instead of centred dialogs

- Every `dialog.dlg` becomes a bottom sheet at ≤ 760 px: full width, `border-radius:18px 18px 0 0`, `margin:auto 0 0`,
  slides up (`translateY(100%)` → 0, 320 ms `cubic-bezier(.2,.8,.2,1)`).
- Wider than a phone (a tablet held upright), the fields stay 560 px wide in the middle:
  `padding: 18px max(16px, calc((100% - 560px) / 2)) max(20px, calc(var(--sab) + 10px))`.
- The chat and the guide follow the same shape (top corners 14 px, grab handle on the chat).
- Why: centred dialogs on iPhone overlapped the keyboard, panned sideways and zoomed on focus. The event editor was
  unusable before this.

## 5. The keyboard (chat sheet)

- **Full height until the keyboard is up.** The sheet runs from 44 px below the top to the bottom edge. Only while the
  keyboard is up (`visualViewport.height < innerHeight - 120`) does it fit the part of the screen the keyboard leaves:
  `.chat.kb`, top `visualViewport.offsetTop + gap`, height `visualViewport.height - gap`, and the gap shrinks from
  44 px to `max(safe-area-top, 10px)` so the list keeps room.
- **Why only then:** without the keyboard the sheet must reach the bottom edge and keep the home indicator's room
  (`--sab`, §6). With the keyboard up, the indicator is covered, so that room goes (the composer's bottom padding drops
  to 8 px) and the composer sits right on the keys.
- **Look again later.** iPhone settles the keyboard over several frames and does not always fire a last `resize`.
  On focus and blur of the composer the chat measures at 0, 120, 400 and 800 ms (`settle()`), and on every
  `visualViewport` `resize` and `scroll`.
- **Closing blurs the composer first**, so the keyboard goes down with the sheet instead of staying over the page.
- Fields in dialogs are 16 px (no zoom), so focusing them does not move the layout.
- Enter: on a touch screen it is a new line and the arrow button sends; with a keyboard Enter sends. Enter never sends
  while a Korean syllable is being composed (`e.isComposing || e.keyCode === 229`).

## 6. Safe areas (notch, home indicator)

- **`--sab`** (`tokens.css`) is the room a sheet's last row keeps at the bottom:
  `:root { --sab: max(env(safe-area-inset-bottom, 0px), var(--home, 0px)) }`. Dialogs pad
  `max(20px, calc(var(--sab) + 10px))`, the guide panel `max(14px, calc(var(--sab) + 6px))`, the chat's composer
  `max(12px, var(--sab))` (8 px while the keyboard is up, since the keyboard covers the indicator), the docked Comment
  button sits `calc(16px + var(--sab))` from the bottom.
- **Why `--home`:** the site keeps the default viewport (no `viewport-fit=cover`). In Safari, iOS then keeps the page
  out of the unsafe area itself. But the Home Screen app still runs the page to the bottom edge, under the home
  indicator, while `env(safe-area-inset-bottom)` stays 0. The chat's composer touched the indicator. So the pre-paint
  script sets `--home: 34px` in the installed app on an iPhone with a home indicator (tall screen):

  ```js
  // theme.js PREPAINT (second line), or sheet.js HOME_PREPAINT, inline in <head>
  try{if((matchMedia("(display-mode: standalone)").matches||navigator.standalone===true)
    &&/iPhone|iPod/.test(navigator.userAgent)&&Math.max(screen.width,screen.height)>=812)
    document.documentElement.style.setProperty("--home","34px")}catch(e){}
  ```

  Safari, iPads and iPhones with a home button get 0. Put the same line in every page that shows sheets (the reader
  too).
- Side paddings of full-width bars use `max(20px, env(safe-area-inset-left/right))`.
- If you ever add `viewport-fit=cover`, `env()` starts to work in the app and `--home` becomes a harmless fallback (the
  `max()` takes the larger). Add it to `base` in `lockPhoneZoom()` too, because that function rewrites the whole
  viewport meta.
- The Home Screen app uses `apple-mobile-web-app-status-bar-style: default` (content starts under the status bar, not
  behind it) and `theme-color` for light and dark.

## 7. Selecting text on a touch screen

- iOS and Android already show their own menu (Copy, Look Up, Share) by a selection. The site's own Copy · Comment bar
  next to it looked like a second, overlapping menu. So on a touch screen the site shows **only Comment**, as one pill
  with a speech-bubble icon, never a second Copy.
- It docks at the **bottom** of the screen, clear of the phone's menu: `position:fixed; bottom: calc(16px + var(--sab))`,
  44 px tall. When the selection ends in the bottom 120 px of the screen it moves to the **top** instead
  (`.selpop.dock.up`, `top: calc(safe-area-top + 12px)`), so it never covers the words being selected.
- It appears 400 ms after the selection settles (`selectionchange`), not on every handle drag.
- The passage is captured **when the bar appears** (`lastQ`). A tap on the bar can clear the selection on iOS before the
  click arrives; Comment then uses the saved passage.
- The bar is `user-select:none`, and a press on it calls `preventDefault()` on `mousedown`, so tapping it keeps the
  selection where the browser allows.
- With a mouse nothing changed: Copy · Comment floats above the selection.
- Details: `team-chat/references/design.md` §6.

## 8. Taps

- Every control is at least 44 × 44 px on phones (Apple's minimum). Controls that sit in the page's rhythm get the real
  size. Small text controls keep their look and get an invisible 44 px hit area:
  `.btn.small{position:relative}` + `.btn.small::after{content:"";position:absolute;left:50%;top:50%;width:max(100%,44px);height:max(100%,44px);transform:translate(-50%,-50%)}`.
- On touch screens a tap anywhere on a date or time field opens the picker, so Chrome's small picker icons are hidden
  (`::-webkit-calendar-picker-indicator{display:none}` under `(pointer:coarse)`).
- iOS date and time inputs keep a built-in minimum width; `min-width:0; -webkit-appearance:none` stops them spilling
  into the next column.

## 9. Viewport units

- Use `dvh` for things that must end at the visible bottom edge (sheets, the phone calendar), with a `vh` line before
  it as the fallback: `max-height:calc(100vh - 32px); max-height:calc(100dvh - 32px)`.
- Use `svh` for a full-screen stage that must not jump when Safari's toolbar collapses (the intro).
- Never `100vh` alone on a phone: on iOS it is the height with the toolbar hidden, so the bottom is cut off.

## 10. Check on a real phone

Headless browsers do not show most of these problems. On an iPhone, in Safari **and** from the Home Screen:

- [ ] Pinch on the calendar upright: nothing happens. On its side: it zooms.
- [ ] Double-tap a button quickly: it presses twice, the page does not zoom.
- [ ] Open the event editor, focus Title: no zoom. Drag on its title bar or on the dim area: the page behind does not
  move. Scroll the sheet to its end and keep dragging: the page does not move.
- [ ] Pull the event sheet down a little: it springs back. Pull past about a third of a finger's length, or flick: it
  closes. Tap the dim area: it closes.
- [ ] Open the chat, drag on the dim area or the composer: the page does not move. Type: the composer stays just above
  the keyboard. Close it: the page is where you left it.
- [ ] From the Home Screen app: the last row of every sheet (Save, the composer, the guide's buttons) sits clear of
  the home indicator.
- [ ] Select words in a chapter: the phone's own menu shows by the words and one Comment button at the bottom. Select
  words near the bottom edge: the button moves to the top.
- [ ] Swipe the week sideways: the next week comes in; the page never pans sideways at 320 px.
