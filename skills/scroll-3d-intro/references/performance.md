# Performance: smooth on a normal laptop, never a stall mid-scroll

The intro has one job before it can impress anyone: it must not stutter. These are the rules the engine follows, in
the order they matter.

## 1. Load nothing until it is needed

- The head script decides `intro-on` / `intro-off` before the first paint. With `intro-off` nothing of the intro loads
  beyond `intro.js` (a few KB) and `intro.css`.
- `intro.js` imports `intro-scene.js` (and with it three.js and the scene) only when the intro is on.
- Phones never get the intro: `(max-width: 760px), (pointer: coarse) and (max-height: 500px)`. A phone on its side has
  a short screen and a coarse pointer, so it is caught by the second half. Phones open straight on the app.
- three.js r170 comes from the site itself (`/vendor/three/`, pinned by `fetch-vendor.sh`), never from a CDN at run
  time: one origin, cached with the site, no third-party outage.

## 2. Pick a starting tier and resolution

| Decision | Rule |
|---|---|
| Low tier | `pointer: coarse` (tablets) or the short side < 600 px. No GTAO, no Bokeh (a cheap edge blur in the final pass instead), 512 px canvas textures, one small shadow map, fewer instances. Pixel ratio cap 1.5 (2 on the high tier). |
| GPU class | The unmasked renderer string. `SwiftShader\|llvmpipe\|softpipe\|Software\|Microsoft Basic` → SOFT: start with no AO and no depth of field, pixel ratio ≤ 1. `NVIDIA\|GeForce\|Quadro\|Radeon (RX\|Pro)\|Arc(TM)\|Apple M… Pro/Max/Ultra` → FAST: start with everything. Anything else (integrated or unknown): half-size AO and depth of field. The low tier starts with neither. |
| Pixel budget | Low tier 1.0 M pixels, FAST 4.2 M, others 2.1 M. The starting pixel ratio is `sqrt(budget / (innerWidth × innerHeight))`, clamped between 1 and the cap (the adaptive step lowers it further when needed, down to 0.6). |
| Effect level `fx` | 3 = full GTAO and Bokeh; 2 = both at half size; 1 = no AO; 0 = neither. Stills (`?t=`) and a forced `?tier=` start at 3. |

`?tier=low|high`, `?fx=0..3` and `?dpr=` override all of this (for stills and measurements); with `?fx` or `?dpr` the
quality stays fixed.

## 3. Compile every shader before the first frame

A program compiled mid-scroll is a hitch of 0.1 s to several seconds. `warm()` runs once, before the first real
frame, while the stage still shows the dark stage colour (or the poster):

1. `renderer.compileAsync(scene, camera)` with the scene pass's render target bound, so the variants match (linear
   output, no tone mapping). Uses `KHR_parallel_shader_compile` where the browser has it, capped at 8 s.
2. One tiny frame (32 px wide) at every camera key and halfway between keys, with AO and depth of field on and each
   event at 0, 0.5 or 1 as it would be there. This compiles the shadow, AO and depth variants, objects that appear
   only after an event, and uploads every texture.

The example scene ends with about 33 programs. Check `window.introDebug.quality().programs` after a full scroll: if the
number grew, something compiled late; add that `p` to the scene's `warm` list.

## 4. Lower the quality fast, raise it slowly

`adapt(dt)` runs every frame after a 45-frame grace period:

- A frame is **late** when it takes more than 23.5 ms (1.4 frames at 60 Hz). Three late frames in a row, or an average
  above 19.5 ms over the last 20 frames, lower the quality **one step at once**:
  1. half-size AO and depth of field (`fx 3 → 2`);
  2. then the resolution (pixel ratio × 0.82, not below 1; the old value becomes the ceiling);
  3. then AO off (`fx 2 → 1`);
  4. then depth of field off (`fx 1 → 0`);
  5. only when frames are very slow (> 45 ms): pixel ratio below 1, down to 0.6.
- 90 quick frames in a row (average under 12.5 ms) raise the pixel ratio by 8 %, never above the last level that was
  too slow.
- After any change, 10 frames of grace, so one change is measured before the next.

## 5. Draw only what is needed

- At most 60 frames a second while anything moves (scroll catching up, an event, the arrival, the fades), also on
  120 Hz screens; 30 a second while only the slow drift runs (`busy()` false).
- The loop stops when the tab is hidden and when the intro ends.
- Only the scene pass uses MSAA (a custom pass with a multisampled target); GTAO runs at half size from `fx 2`; the
  Bokeh pass is patched to skip pixels that are in focus.
- Instanced meshes for repeated parts (passives, pads, bonds); canvas textures with mipmaps and anisotropy ≤ 8.
- A floating origin at the camera target: deep zooms (the worked example goes from 6 units to 0.00004 units) keep
  their precision.
- Layout is read on resize only (`measure()` and a `ResizeObserver`), never inside a frame.

## 6. How to check it

- On a real laptop (not headless), open the browser's performance panel, scroll the whole intro with a wheel or
  trackpad and look for long frames. A long frame right after a new part of the scene comes into view is a late
  shader compile (see section 3); a steady stream of long frames is fill rate (section 4 should catch it within
  three frames: check `window.introDebug.quality()` before and after).
- `window.introDebug.quality()` returns `{ gpu, fx, pr, programs }`: the renderer string, the effect level, the pixel
  ratio and the number of compiled programs.
- In headless SwiftShader (the screenshot tool) a frame takes 1–3 s. That is expected; `dt` is capped at 0.1 s, so
  events look slow there. Judge smoothness on a real GPU, judge the picture with the stills.
