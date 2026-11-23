# Behaviour: when it shows, how it moves, what it blocks

Code: [`assets/site/js/guide.js`](../assets/site/js/guide.js) and [`first-visit.js`](../assets/site/js/first-visit.js).

## 1. API

```js
import { createGuide } from "./guide.js";
import { firstVisit } from "./first-visit.js";

const account = await fetch("/api/me").then((r) => r.json()); // { auth, member, seen: { install, guide } }
const guide = createGuide({
  steps: STEPS,                                   // see §2
  me: () => ({ id: account.member, name: "Alex" }),
  serverSeen: () => (account.seen ? account.seen.guide : null),
  markSeen: () => fetch("/api/me", { method: "POST", body: JSON.stringify({ seen: "guide" }) }),
  noAuto: ["alex"],                               // the site's owner: no tour by itself
  home: { pane: "#pane-calendar", hash: "#calendar" },
  menuItem: "#menu-guide",                        // "Site guide" in the name menu
});
firstVisit({ member: account.member, guide, offerInstall: push.offerInstall, appWelcome: push.welcome });
```

| Option | Default | Meaning |
|---|---|---|
| `steps` | (required) | the tour |
| `me` | `() => null` | the member `{ id, name }` |
| `serverSeen` | `() => null` | `true` / `false` from the server, `null` when it can't say |
| `markSeen` | no-op | records "seen" on the server; errors are ignored (the browser remembers anyway) |
| `noAuto` | `[]` | member ids that never get it by themselves |
| `app` | `"#app"` | the wrapper made `inert` while the guide is open (header and main, not dialogs) |
| `bar` | `".bar"` | the sticky header; holes never go under it, and targets inside it are not scrolled to |
| `home` | `null` | `{ pane, hash }`: when that pane is hidden, switch to it for the tour and back afterwards |
| `returnFocus` | `"#me-btn"` | focus goes here when the guide ends |
| `menuItem` | `null` | the button that reopens it |
| `blocked` | intro playing or a `<dialog open>` | the guide never starts over these |
| `key` | `id => "site_guide_v1_" + id` | the browser's record |
| `delay` | 400 ms | from `picked()` to the start |
| `words` | English | Skip, Back, Next, Done, "Step n of N" |

Returns `{ start, stop, picked, isOpen }`. `start()` opens it now (the menu item uses it); `picked(id)` opens it once,
after `delay`, unless one of the checks in §4 says no.

## 2. Steps

```js
{ at: ["#me-btn", "#lang-btn", "#theme-btn"], alt: ".bar-right", tight: false,
  title: "Make it yours", text: ({ name, phone }) => "…" }
```

- `at`: CSS selectors. Every visible one is measured and the hole covers all of them together.
- Visible means: connected, not `visibility: hidden`, at least 2 × 2 px, and at least partly inside the window
  horizontally. `display: none` gives a 0 × 0 box, so it counts as hidden.
- `alt`: used when none of `at` is visible (a button that phones do not show; a header item folded into a menu).
- `tight`: the hole follows the text (a DOM `Range` around the element's contents, 2 px wider and 3 px taller), not the
  element box. For header tabs, whose link is the full 52 px bar height.
- No `at`, or nothing visible and no `alt`: no hole, panel centred (desktop) or the sheet (phone).
- `title` and `text` can be functions of `{ name, phone }`, so a step can greet by name or word itself for phones.

## 3. Every frame

While open, one `requestAnimationFrame` loop:

1. measures the target again (it may move: smooth scrolling, a resize, fonts, a lazy image);
2. pads it by 6 px, keeps it 4 px inside the window, below the sticky header (+4 px) unless the target is in the header,
   and above the sheet (−10 px) on phones; a hole thinner than 16 px is dropped;
3. on desktop, places the panel (design.md §3), which may shorten the hole above a bottom panel;
4. eases hole and panel from their last place to the new one over 280 ms (cubic ease-out); with reduced motion the
   ease is skipped;
5. writes `transform`, `width`, `height` and `border-radius` (≤ 12 px, ≤ half of either side) to the hole, and the
   panel's `transform` (desktop only; on phones the sheet is CSS).

The first hole of a tour opens from its target's centre. A step without a target closes the hole into a point where it
was.

## 4. Once per member

`picked(id)` starts the tour only if all of these hold:

- `id` is set and not in `noAuto`;
- this browser has no `key(id)` record (`localStorage`, every access in `try/catch`, so private windows work);
- the server does not say it was seen (`serverSeen() !== true`; `null` means "can't say", and the tour may show).

Done, Skip and Esc all end it the same way: the browser record gets the date (ISO), and `markSeen(id)` tells the server
(`POST /api/me { "seen": "guide" }`, which the google-signin-team-gate skill stores in D1 `member_seen` by member id).
So a second device, a cleared browser or the installed app (separate storage on iPhone) does not show it again.

The guide never starts while the intro plays (`html.intro-on`) or a `<dialog>` is open. It does not queue: whatever
opened over it decides what comes next (see §6).

## 5. Keys, focus and the page underneath

| Input | Does |
|---|---|
| → | next step (nothing on the last) |
| ← | previous step |
| Enter | Next / Done, unless focus is on Skip or Back (then that button acts) |
| Space | the focused button; otherwise nothing |
| Esc | ends the tour (counts as seen) |
| Tab / Shift+Tab | cycle Skip → Back (when shown) → Next, never out of the panel |
| ↑ ↓ PageUp PageDown Home End | swallowed: the page does not scroll |
| any other key | stopped from reaching the page's own shortcuts |
| wheel, touchmove | swallowed, unless the panel itself can scroll |
| pointer down outside a button | `preventDefault`: no text selection, no focus change |

- Keys are caught on `window` in the capture phase, so they win over the page's own handlers.
- Focus moves to Next on every step (`preventScroll`). If focus ever lands outside the guide (`focusin`), it goes back
  to Next.
- The app wrapper (`app`) is `inert` while the guide is open: nothing under it can be clicked, focused or read out. Its
  earlier `inert` value is restored afterwards.
- So nothing is written by accident during the tour (no event added to the shared calendar, no log edited).

## 6. What comes first (first-visit.js)

On the first visit of a member, one thing at a time:

1. an iPhone or iPad **browser**: "Add to Home Screen" (ios-webapp-push `offerInstall(after)`), once per member;
   the tour comes after it closes;
2. the **installed app**: the notifications sheet once on that device (`appWelcome()`), instead of the tour;
3. anywhere else: the tour (`guide.picked(member)`).

It runs 600 ms after load when there is no intro, or 400 ms after `intro:done` (scroll-3d-intro).

## 7. Start and end

- **Start**: remember the hash, `scrollY` and the app's `inert`; if `home.pane` is hidden, `location.replace(home.hash)`;
  build the dialog (`role="dialog"`, `aria-modal`, labelled by the title, described by the text); make the app inert;
  listen to keys and focus; show step 1; fade in on the next frame.
- **End**: record seen; stop listening; restore `inert`; fade out and remove (at once with reduced motion); go back to
  the remembered tab (`location.replace`) and, after its `hashchange`, to the remembered scroll position; focus
  `returnFocus` (the name button, where the guide can be found again).

## 8. Accessibility

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the title, `aria-describedby` the text; the text is
  `aria-live="polite"`, so each step is read out.
- "Step n of N" is visually hidden next to the dots; the dots are `aria-hidden`.
- Every button is at least 44 × 44 px.
- The hole and the dim are `aria-hidden` and never take focus.
