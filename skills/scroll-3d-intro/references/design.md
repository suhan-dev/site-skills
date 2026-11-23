# Design: what the intro looks like at every width and in every state

All sizes are CSS px. Colours not listed here come from the design system (`team-site-design-system`, `tokens.css`):
the intro uses `--paper` (the page colour it fades into) and `--sans` (the font).

## The stage

| Thing | Value | Why |
|---|---|---|
| Stage colour `--ix-bg` | `#111216` in both themes | A product render reads best on a dark studio floor; the light theme gets its light page at the end fade. |
| Text colour `--ix-ink` | `#f3f0ea` (warm white), secondary `rgba(243,240,234,.62)` | Pure white looks blue next to warm metal. |
| Section height | `373svh` (`373vh` fallback) = 100 × (1 + STORY 2 + HOLD 0.45 + FADE 0.28) | Two screens of story, a short hold on the last beat, a short fade. Keep it in step with `intro-story.js`. |
| Stage | `position: sticky; top: 0; height: 100svh` | `svh` so the iOS toolbar does not make it jump. |
| Page | `body { overflow-x: clip }` while the intro is on | `overflow-x: hidden` on `html` or `body` makes a scroll container and the sticky stage stops sticking. |
| The app | `position: fixed; inset: 0; visibility: hidden` while the intro is on | The document ends with the intro, so nothing slides up from below the stage at the end. |

## Text on the picture (no boxes)

| Element | Desktop and landscape | Portrait (aspect ≤ 4/5) or ≤ 700 px wide |
|---|---|---|
| Gutter `--ix-gut` | `clamp(24px, 5.4vw, 88px)` | `20px` + safe-area insets |
| Brand (top left) | 14 px / 600 / −.005em | 13 px |
| Skip (top right) | 14 px / 500, plain text, no border, 44 × 44 target, `--ix-ink2` → `--ix-ink` on hover | same; top padding `4px + safe-area-inset-top` |
| Top fade behind brand and Skip | `linear-gradient(to bottom, rgba(10,11,14,.5), transparent)` | same |
| Headline | `clamp(44px, 6.9vw, 106px)`, 700, −.035em, line-height .95, one line, lower left, bottom `clamp(56px, 12vh, 128px)` | `clamp(34px, 10.2vw, 44px)`, may wrap, line-height 1, bottom `max(13svh, 84px)` + safe area, right edge 48 px clear of the dots |
| Headline shadow | `0 2px 36px rgba(10,11,14,.5)` | same |
| Shade behind the headline | radial, `85% 70% at 0% 100%`, `.74 → .40 (40%) → 0 (74%)` of `rgba(10,11,14)` | linear from the bottom, `.78 → .42 (26%) → 0 (52%)` |
| Beat dots (right, centred) | 26 × 26 buttons, 5 px dot at `rgba(243,240,234,.32)`, the current one ink and `scale(1.45)` | 44 × 44 on touch |

One headline per beat, one to three words, nothing else on screen: no paragraphs, captions or labels. All English.
The first headline is the site name (an `h1`), on screen from the first painted frame (no fade-in), except after
sign-in (below).

## Motion

| What | Duration and curve |
|---|---|
| Scroll follow | exponential ease, time constant 1/7 s (`1 − e^(−7·dt)`), never ahead of the finger |
| Headline in / out | by scroll: fade over its beat's `a → b` and `c → d` (smoothstep); arriving from 24 px below, leaving 14 px up |
| Arrival (first frame) | 2.5 s dolly-in (distance × 1.38 → 1) with a small swing, and a focus pull from soft to sharp; the canvas fades in over .9 s |
| Idle | azimuth drift `0.11·sin(0.09 t)` and a turntable sweep of the object `0.24·sin(0.045 t + 0.4)` (about 0.01 rad/s) under fixed soft boxes, so highlights slowly cross the metal |
| Beat events | 0.8–1.2 s on the clock, started when scroll passes the event's `p`, always finished |
| End fade | text out over the first 40 % (`--ix-ui`), then the page colour comes over the picture (dark: `sstep(.12,.92)`, light: `sstep(.22,.96)` after the picture has washed out) |
| Skip | the same end fade on a 0.5 s timer |
| App arrival | `opacity 0 → 1`, .4 s ease, at the top of the page; never a slide |
| Replay (site name) | the app fades to the page colour in .26 s, then the picture comes out of it in .65 s, with the arrival move again |
| Sign-in arrival | the poster dimmed `.6` → `0` over .7 s `cubic-bezier(.3,0,.2,1)`; the title rises 30 px and fades in over .8 s `cubic-bezier(.2,.7,.2,1)`, .3 s delay |

Reduced motion (`prefers-reduced-motion: reduce`): the clock stops, events are shown in their final state, no arrival,
no text movement, every switch is instant, the dots jump instead of scrolling smoothly.

## States

| State | What shows |
|---|---|
| Loading (scene module not ready) | The stage colour with the title; the canvas is hidden until its first real frame. After 4 s the dim lifts anyway. |
| No WebGL (`html.ix-nogl`) | The poster (`--ix-poster`, `--ix-poster-tall` for portrait) as the stage background; headlines and dots still follow the scroll. |
| Just signed in (`html.ix-login`) | Starts on the sign-in background (the poster) dimmed, then brightens and the title rises. |
| Signed-in visitor | Title on screen from the first paint; the scene fades in out of the dark while the camera arrives. |
| Seen in this tab | No intro (`sessionStorage intro_seen`); the site name in the header can replay it. |
| Deep link (`#hash`, `?date=`, `?event=`) | No intro: the link opens what it points to. |
| Phone (≤ 760 px wide, or coarse pointer and ≤ 500 px tall) | No intro at all: the app opens on its first tab. The site name scrolls to the top instead of replaying. |
| Portrait tablet or window (aspect < 0.8) | The intro with a wider lens (30° → 46°), its own framing per camera key, the subject above the text, and the low render tier. |
| `?ui=0` | All text hidden (posters, metrics). |
| Print | Hidden. |

## Layout sketches

Desktop 1440 × 900:
```
┌──────────────────────────────────────────────────────────────┐
│ Example Lab                                            Skip  │  ← 14 px, gutter 78 px
│                                                              │
│                  ┌───────────────────────┐                   │
│                 /   the subject, ≥ 35 %  /                 • │
│                /    of the frame        /                  ● │  ← dots, right, centred
│               └───────────────────────┘                    • │
│                                                            • │
│ Every Layer                                                  │  ← 99 px headline, lower left
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Portrait tablet 820 × 1180 (and narrow windows):
```
┌────────────────────────────┐
│ Example Lab          Skip  │
│                            │
│     ┌────────────────┐     │
│     │  subject, up   │    •│
│     │  and centred   │    ●│
│     └────────────────┘    •│
│                            │
│ Every                      │  ← 44 px, may wrap, 20 px gutter
│ Layer                      │
└────────────────────────────┘
```

Phone 390 × 844: no intro. The app opens on its first tab.
