# Architecture: how the pieces fit

```
<head> show-once script ──► html.intro-on | intro-off (+ ix-login, ix-noui)
                                   │
intro-story.js (RUN, BEATS) ──► intro.js  (controller: scroll, headlines, dots, Skip, end, replay)
                                   │ import() only when the intro is on
                                   ▼
                              intro-scene.js  (engine: renderer, passes, camera rig, clock, quality)
                                   │ build(ctx)
                                   ▼
                              scenes/<your-scene>.js  (objects, anchors, camera keys, events, update)
```

The rest of the site never loads three.js: only `intro.js` is a static module, and it imports the engine with
`import("./intro-scene.js")` once it knows the intro is on.

## 1. The head script (decides before the first paint)

In `intro-markup.html`. It runs inline in `<head>`, before any stylesheet, so the right layout is there from the
first frame (no flash of the app under the intro).

- Show the intro when: no `intro_seen` in `sessionStorage`, no `#hash`, no `?date=` / `?event=` deep link, and not a
  phone (`(max-width:760px), (pointer:coarse) and (max-height:500px)`).
- `intro_arrive` in `sessionStorage` (set by the sign-in page) or `?arrive=login` → `html.ix-login`.
- `?ui=0` → `html.ix-noui`.
- `history.scrollRestoration = "manual"`, so a reload does not land in the middle of the run.

## 2. The run (scroll → story progress)

The section is `100svh × (1 + STORY + HOLD + FADE)` tall; the stage inside it is sticky. With the run length
`RUNLEN = STORY + HOLD + FADE` and the scroll position `s` over the whole run (0 → 1):

```
S_HOLD = STORY / RUNLEN               where the story ends and the hold starts
S_FADE = (STORY + HOLD) / RUNLEN      where the end fade starts
p      = clamp(s / S_HOLD)            story progress: 0 → 1, then 1 during the hold and the fade
e      = clamp((s − S_FADE) / (1 − S_FADE))   end fade: 0 → 1
```

`measure()` reads the section's top and the run length on resize only (never inside a frame), and warns in the
console when the CSS height and `intro-story.js` disagree. The run ends where scrolling ends, because a touch screen
with a collapsed toolbar can be taller than `100svh`.

Every camera position is a function of `p`, so scrolling back replays the same picture. Scroll never moves on its own.

## 3. Beats and headlines (`intro-story.js`)

`BEATS[i] = [a, b, c, d]` in story progress: the headline fades in over `a → b` and out over `c → d`. The first beat has
`a, b < 0` (on screen from the start); the last has `c, d > 1` (the end fade takes it away). A headline arrives while
the camera moves, never in a pause; only the last beat holds. The dots are built from `BEATS`; a dot click scrolls to
the middle of that beat's fade-in.

## 4. The engine and the scene module

`intro-scene.js` owns the renderer, the post-processing chain, the studio light, the camera rig, the clock and the
quality control. What the picture shows lives in one scene module, imported at the top:

```js
import STORY_SCENE from './scenes/example-device.js';   // ← your scene module
```

The module's default export is `build(ctx)`. `ctx` gives it:

| Name | What |
|---|---|
| `THREE`, `scene`, `root`, `renderer`, `camera` | Add your objects under `root` (the engine moves `root` for the floating origin). |
| `low` | `true` on the low tier: use fewer instances, smaller textures. |
| `envSoft` | A softer PMREM environment for materials that should not mirror the studio. |
| `font`, `aniso` | The page font (for canvas text) and the anisotropy to set on textures. |
| `rng(seed)`, `R` | A seeded random (mulberry32): the same picture on every load. |
| `cnv(w, h)`, `tex(canvas, srgb)` | A canvas and its 2D context; a `CanvasTexture` with mipmaps and anisotropy. |
| `softRectTexture`, `contactShadow`, `graphiteFloor` | A soft rectangle, a contact shadow under an object, the graphite floor. |
| `clamp, lerp, sstep, ease, easeOut, V` | Small helpers; `V(x,y,z)` is a `Vector3`. |

`build(ctx)` returns:

| Field | Meaning |
|---|---|
| `anchors` | `{ name: () => Vector3 }`: the points the camera looks at, in world space after `update()`. |
| `keys` | `[[p, anchor, d, az, el, pm, paz, pel], …]`: at story progress `p` the camera looks at `anchor` from distance `d`, azimuth `az` and elevation `el` (radians). On portrait screens the distance is multiplied by `pm` and `paz`, `pel` are added. |
| `events` | `[{ k, p, dur }]`: when scroll passes `p`, `ev[k]` runs 0 → 1 on the clock in `dur` seconds (and back if the visitor scrolls back). |
| `update({ p, ev, t, d, low, reduced, portrait })` | Move the objects for this frame: `p` scroll, `ev` event phases, `t` the clock (for drift), `d` the camera distance. |
| `afterCamera?`, `ao?(p)`, `warm?` | Optional: a hook after the camera is placed; the AO radius for this `p`; the list of `p` values to warm up at. |

The camera is interpolated with monotone cubic (Fritsch–Carlson) curves per channel, with the distance in log space,
so a dive from 6 units to 0.9 units feels even. Between two anchors the look-at point blends in step with the zoom.

## 5. The clock

`tNow` runs while the intro is on (it stops with reduced motion or `?t=`). It drives the arrival (first 2.5 s), the
idle drift and the event phases (`stepEvents`). `busy()` is true while the arrival or an event moves; then `intro.js`
draws up to 60 frames a second, otherwise 30.

## 6. The end, Skip and replay

- **End:** when `e` reaches 1 (and the eased scroll has caught up), `finish()` stores `intro_seen`, removes
  `intro-on`, adds `intro-off intro-arrive` (the app fades in at the top over .4 s), scrolls to 0, swallows the rest of
  the wheel or swipe for up to 1.5 s (`calm()`, so the same gesture does not scroll the app) and dispatches
  `intro:done` on `window`.
- **Skip** (`[data-skip]`): plays the same fade on a 0.5 s timer, then `finish(href)`. With reduced motion it finishes
  at once.
- **Replay** (`[data-replay]`, the site name in the header): the app fades out (`ix-leave`, .26 s), the intro comes back
  at the top and the picture fades out of the page colour (.65 s) with the arrival move. On phones it scrolls the app to
  the top instead.

Other code waits for `intro:done` before it opens anything over the page (the "Add to Home Screen" pop-up, the site
guide), or runs at once when `html.intro-off` is set.

## 7. Sign-in hand-off (one scene)

The sign-in page and the intro are one scene, so signing in feels like the page brightening, not a cut:

1. Render a poster of the settled first frame without text: `intro-frames.mjs <url> out --p 0 --ui 0 --dpr 2` and
   convert to WebP (`poster.webp`, 2880 × 1800 from `--w 1440 --h 900`). For the portrait poster render
   `--w 780 --h 1688 --dpr 1.5` (`poster-tall.webp`, 1170 × 2532): a 390 px window has no intro (the phone gate), but
   780 × 1688 has the same shape and gets the portrait framing.
2. The sign-in page uses that poster as its full-screen background, dimmed (the same `.6` dark layer).
3. Before it leaves for the sign-in provider it runs
   `sessionStorage.removeItem("intro_seen"); sessionStorage.setItem("intro_arrive", "1")`.
4. Back on `/`, the head script sets `ix-login`: the stage starts on the poster (set `--ix-poster` and
   `--ix-poster-tall` on `.ix`), dimmed; with the first real frame the dim lifts (.7 s) and the title rises (.8 s).

Swap the poster files whenever the scene's first frame changes, or the hand-off shows a jump.

## 8. Files you copy

| From `assets/` | To the site |
|---|---|
| `intro.js`, `intro-story.js`, `intro-scene.js`, `scenes/<scene>.js` | `/js/` (keep `scenes/` next to the engine) |
| `intro.css` | `/css/` |
| `intro-markup.html` | split into `<head>` and `<body>` of `index.html` |
| `fetch-vendor.sh` | run it; serve `vendor/three/` at `/vendor/three/` (never from a CDN at run time) |
| `tools/intro-frames.mjs` | `tools/` (stills, posters, metrics) |
