# Design: the spotlight and the panel

Restrained: the page stays visible, one rounded hole shows the thing being explained, and a small paper panel says
it in one or two sentences. No 8-bit box, no thick border, no blinking, no confetti. Styles: `assets/site/css/guide.css`.
Colours and type are tokens from the design system (`team-site-design-system/assets/tokens.css`), so light and dark
follow `html[data-theme]` or the system like the rest of the site.

## 1. Layers

| Layer | Style |
|---|---|
| Root `.guide` | `position: fixed; inset: 0; z-index: 1000`; fades in and out with `opacity .2s ease` (`.is-off` = 0 and no pointer events) |
| Hole `.guide-hole` | `position: absolute` at the target (set by JS each frame), `border-radius: 12px` (or half the side when smaller), `box-shadow: 0 0 0 1px rgba(255,255,255,.6), 0 0 0 200vmax rgba(0,0,0,.55)`. The dim **is** the hole's shadow, so there is no separate overlay and no gap. |
| No hole (`.none`) | `box-shadow: 0 0 0 200vmax rgba(0,0,0,.55)` only: the whole page dimmed (welcome and last step) |
| Panel `.guide-panel` | paper card (below) |

The same dim, `rgba(0,0,0,.55)`, in light and dark. The 1 px white hairline at 60 % lifts the hole's edge off a light
page and still reads on a dark one.

## 2. The panel

| Property | Value |
|---|---|
| Width | `min(360px, 100vw − 32px)` |
| Max height | `calc(100dvh − 32px)` (`100vh` fallback); scrolls inside (`overscroll-behavior: contain`) if ever taller |
| Padding | 16 20 10 px |
| Fill | `var(--card)`: white in light, the soft grey surface in dark |
| Edge | `box-shadow: 0 0 0 .5px var(--sep2), 0 16px 48px rgba(0,0,0,.2), 0 2px 8px rgba(0,0,0,.08)`; `border-radius: 14px` |
| Font | `var(--sans)` |

Contents, top to bottom:

| Element | Size / line height | Weight | Colour | Spacing |
|---|---|---|---|---|
| Title `.guide-h` | 15 / 1.4, ls −.012em | 600 | `--ink` | in a flex row with Skip, gap 12, `align-items: flex-start` |
| Skip | 13.5 | 500 | `--ink3`, hover `--ink` | 44 × 44 min target, padding 0 12, radius 10; margin −12 −12 −11 0 so the target hangs into the padding and the text lines up with the title |
| Text `.guide-p` | 15 / 1.5, ls −.01em | 400 | `--ink2` | 5 px above |
| Footer | | | | flex, gap 8, 8 px above |
| Back | 14 | 500 | `--ink2`, hover `--ink` | 44 × 44 min, margin-left −12 (text aligns with the text above); `visibility: hidden` on step 1, so the footer does not jump |
| Dots | 6 × 6 circles, gap 6 | | `color-mix(in srgb, var(--ink) 18%, transparent)`; current `--ink` | centred in the remaining space; `background .2s` |
| Next / Done | 14, ls −.01em | 500 | `--on-accent` on `--accent` (hover `--accent2`) | 44 px tall, min-width 76, padding 0 18, pill. The blue is a `::before` inset 4 px top and bottom, so the pill looks 36 px tall while the target is 44 |
| Next focus | | | | `outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent)`, offset 1 px, on the `::before` |
| "Step 2 of 6" | visually hidden (`.guide-sr`) | | | read by screen readers with the dots |

Measured panel heights with the demo's wording: 149 px for a two-line text, 172 px for three lines.

## 3. Where the panel goes (desktop, > 760 px)

The panel is placed next to the hole where it fits **whole** and does not cover the hole (the hole plus 8 px):

1. below the hole (centred on it), then above, then to the right, then to the left;
   when the hole's centre is in the lower half of the window, above is tried first;
2. always 16 px from the window edges (`M`), 14 px from the hole (`G`);
3. if no side fits (a target as tall as the window, like a calendar): the panel goes to the bottom, centred on the
   hole, and the hole is cut off 14 px above it, if at least 40 px of hole stays;
4. otherwise, and when there is no target: the panel is centred and there is no hole.

Measured at 1440 × 900 in the demo:

| Step | Hole (x, y, w × h) | Panel (x, y) |
|---|---|---|
| Welcome | none | 540, 376 (centred) |
| Calendar | 102, 139, 896 × 499 | 370, 652 (below) |
| New event | 867, 86, 131 × 44 | 752, 144 (below, pulled in from the right edge) |
| Tabs (tight) | 626, 9, 201 × 34 | 546, 57 (below) |
| Name · language · theme | 1110, 4, 152 × 44 | 1006, 62 (below, 16 px from the right edge) |
| You're set | none | centred |

```
1440 × 900, step "Shared calendar"
┌─────────────────────────────────────────────────────────────────┐
│ Example Lab      Calendar  Research log  References     ● Alex …│  header (dimmed)
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░ Nov 22 – 28 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░[New event]░░ Upcoming ░│
│░╭──────────────────────────────────────────────────╮░░░░░░░░░░░░░│
│░│  Sun   Mon   Tue   Wed   Thu   Fri   Sat         │░░░░░░░░░░░░░│  hole: the grid + 6 px,
│░│        ▇▇    ▇▇                ▇▇                │░░░░░░░░░░░░░│  12 px radius, white hairline
│░│              ▇▇          ▇▇                      │░░░░░░░░░░░░░│
│░╰──────────────────────────────────────────────────╯░░░░░░░░░░░░░│
│░░░░░░░░░░░░╭───────────────────────────────╮░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░│ Shared calendar          Skip │░░░░░░░░░░░░░░░░░░░░│  panel 360 px, 14 px below
│░░░░░░░░░░░░│ This is the team's Google …   │░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░│ Back      ● ● ○ ○ ○ ○   (Next)│░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░╰───────────────────────────────╯░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────────────────────────────────────────────┘
```

## 4. Phones (≤ 760 px): a bottom sheet

| Property | Value |
|---|---|
| Position | `top: auto; right: 0; bottom: 0; width: auto` (full width), `transform: none` |
| Max height | `calc(100dvh − 72px)` |
| Radius | 14 14 0 0 |
| Padding | 16 px top; sides `max(20px, (100vw − 440px) / 2)` (wider screens keep lines short); bottom `max(14px, --sab + 6px)` (`--sab` from the design system: the safe area, or the home indicator in the Home Screen app) |
| Edge | `box-shadow: 0 −.5px 0 var(--sep2), 0 −10px 36px rgba(0,0,0,.16)` |

The hole always ends 10 px above the sheet. Before each step the page scrolls (smoothly, or at once with reduced motion)
so the target sits between the header + 12 px and the sheet − 12 px, with up to 16 px of air; a target taller than that
room shows its top part.

```
390 × 844, step "Log and papers"
┌──────────────────────────────┐
│ Example Lab      🔔 ● EN ☾ 💬 │
│ Calendar ╭────────────────╮  │  tight hole around the two words
│          │Research log Ref…│  │
│░░░░░░░░░░╰────────────────╯░░│
│░░ Nov 22 – 28, 2026 ░░░░░░░░░│
│░░ (calendar, dimmed) ░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
├──────────────────────────────┤  sheet: full width, 14 px top corners
│ Log and papers          Skip │
│ One page per week for each   │
│ member, and the papers …     │
│ Back     ○ ○ ○ ● ○ ○   (Next)│
└──────────────────────────────┘  + safe-area inset
```

Measured (demo): the sheet is 149–172 px tall at 390 × 844, 375 × 600 and 320 × 568; nothing scrolls inside it, and
every step fits at 375 × 600 (the spec's smallest screen).

## 5. Motion

| What | How | Reduced motion |
|---|---|---|
| Open | the root fades in (`.2s`); the hole grows out of its target's centre | appears at once |
| Between steps | hole and panel ease from where they were to the new place over 280 ms, cubic ease-out (`1 − (1 − x)³`), every animation frame | jump |
| No target | the hole closes into a point where it was | at once |
| Target moves (smooth scroll, resize, layout) | the hole follows it every frame | same |
| Close | fade out `.2s`, removed after 240 ms; the page scrolls back to where it was | removed at once |
| Dots | `background .2s` | none |

## 6. States

| State | What shows |
|---|---|
| Step 1 | title "Welcome, {name}", no hole, panel centred (desktop) or the sheet; Back hidden |
| Middle steps | hole on the target; Back, dots, Next |
| Last step | no hole; Next reads "Done" |
| Target hidden at this width | the step's `alt` container is spotlit instead (demo: "New event" is hidden on phones → the calendar) |
| Nothing to spotlight | the panel is centred and the page is only dimmed |
| Keyboard focus | Next has focus on every step; ring on Next's pill only when focus came from the keyboard (`:focus-visible`) |
| Hover (pointer) | Skip and Back turn `--ink`; Next turns `--accent2` |

## 7. The menu item

"Site guide" sits in the member's name menu (the dialog the name button opens): `.guide-link`, 13.5 px, weight 500,
`--accent`, 44 px tall, underline on hover. Choosing it closes the menu and starts the tour 120 ms later.

## 8. Words

Sentence case, one idea per step, at most two short sentences. The step's wording may differ on phones
(`text: ({ phone }) => …`), e.g. "Tap an empty slot" without "or New event" where that button is not shown. The guide is
always English (`data-lang-fixed`), like the header. Never show an address or anything private in a step.
