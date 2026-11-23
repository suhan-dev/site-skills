# Quality: the bar, what failed, what passed, and how to check every frame

## The bar

A high-end **product render**: the kind of continuous camera move a hardware maker opens a product page with. One
object stays on screen; the camera keeps moving into it; the visitor feels they are holding the thing.

Two words ended earlier attempts, and they will end yours:

- **"Looks hand-drawn."** Line-drawn SVG scenes, outlines, flat fills, isometric diagrams. However neat, they read as
  an illustration of a thing, not the thing.
- **"Flat CG blocks."** Boxes with one flat colour each, perfect edges, no wear, uniform lighting. They read as a
  3D editor's default scene.

Also rejected: neon, glow, bloom (`UnrealBloomPass` is never used), purple or pink accents, a different picture per
beat (a cut is not a dive), text other than the headlines, and stretches of scroll where nothing changes.

## What passed, and why

| Ingredient | Why it works |
|---|---|
| `MeshPhysicalMaterial` everywhere, metalness 1 for metals | Metal looks like metal only when it reflects its surroundings. |
| Procedural `CanvasTexture` maps for colour **and** roughness (brushed streaks, bead-blast speckle, milled rings, solder-mask mottling, silkscreen, laser marks, data-matrix codes) | Real surfaces are never uniform. Roughness variation is what the eye reads as "material". Small honest markings (a part number, a revision, a date code) say "manufactured". |
| `RoomEnvironment` PMREM as a dark studio, one soft key light with `PCFSoftShadowMap`, contact shadows | Soft boxes give long, soft highlights on metal; contact shadows put the object on the floor. |
| Bevels and rounded edges on every part (`ExtrudeGeometry` with bevel, `RoundedBoxGeometry`) | A perfectly sharp edge catches no light: it is the strongest "CG" tell. |
| GTAO (ambient occlusion) | Dark creases where parts meet: weight and contact. |
| Bokeh depth of field that follows the subject | A real lens: the eye goes where the focus is, and scale reads right. |
| Fog relative to the camera distance | Depth on a dark stage without a visible horizon. |
| ACES tone mapping, sRGB output, a light vignette, a little grain, a lift of the blacks | The finish of a photograph instead of a framebuffer. |
| Iridescence only where it is physical (thin films on silicon), kept low (≤ 0.15 in the example) | A hint of colour shift reads as silicon; more reads as a soap bubble. |
| Time-driven life (below) | A still render with a scrolling camera feels dead; slow drift and light make it feel shot. |

The model for the time-driven parts was the black-hole intro of a physics-lab site (`bh-intro.js`): a `tNow` clock
that keeps running, a camera azimuth that drifts slowly with it (`0.35 + tNow·0.012`), and small things (leader lines
there) that draw over about one second when a beat is reached. This skill's engine generalises that:

- **Arrival:** on load the camera settles in over about 2.5 s, a dolly-in plus a focus pull from soft to sharp, with
  no input.
- **Idle:** there is always a very slow orbit drift and a turntable sweep of the object (about 0.01 rad/s); because
  the object turns under fixed soft boxes, a soft highlight slowly sweeps across the glossy surfaces.
- **Beat events:** on reaching a beat its event plays on the clock over 0.8–1.2 s and always finishes, even if
  scrolling stops.
- **Scroll moves only between beats;** nothing ever auto-advances.
- `prefers-reduced-motion` freezes the clock and shows the final states.

## The rules of the story

- One continuous camera; the subject stays on screen; never cut to a different image.
- The subject covers at least about 35 % of the frame at every scroll position.
- No dead scroll: spread the motion evenly. Every headline arrives during motion, not in a pause. Only the very end
  may hold.
- One 1–3 word headline per beat, the site name small at the top left, "Skip" as plain text at the top right, small
  beat dots. All English.
- Physical shortcuts are fine, but say so in the scene's header comment (the worked example draws 128 word-line pairs
  where the headline says 300).

## The workflow: stills and metrics, every change

Render, look at every frame, fix what looks fake, empty, badly cropped or drawn, and render again. Expect two or three
passes per change. `assets/tools/intro-frames.mjs` renders with the same shaders as a real GPU (WebGL on SwiftShader
in headless Chromium) and uses the frozen clock (`?t=`) and `window.introDebug.snap()`, so frames are repeatable:

```bash
# serve the repository root, then:
node assets/tools/intro-frames.mjs http://127.0.0.1:8461/skills/scroll-3d-intro/assets/demo/ out \
  --w 1440 --h 900 --p 0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1 --end 0.5 --theme light
node assets/tools/intro-frames.mjs http://127.0.0.1:8461/skills/scroll-3d-intro/assets/demo/ out \
  --w 960 --h 600 --metrics 51
node assets/tools/intro-frames.mjs …/demo/ out --w 820 --h 1180 --tier low --p 0,0.25,0.5,0.75,1 --prefix t   # portrait tablet
```

`metrics.txt` lists, for 51 frames from p 0 to 1 with the text hidden:

- **diff**: the mean absolute pixel difference to the next frame (RGB levels, at 480 px wide). Near zero means
  nothing moved: dead scroll.
- **lum**: the share of pixels that differ from the stage colour `#111216` by more than 10 levels. Below 0.35 means the
  subject is too small or out of frame.

**Pass rule:** no run of 4 or more near-zero steps (near zero = below 15 % of the median step, at least 0.5 levels),
and no frame with lum below 0.35. A deliberate final hold may be flagged; say so.

The example scene in this skill passes at 960 × 600: median diff 14.2, min 3.4 (p 0.54, the layers settling), longest
near-zero run 0, lowest lum 0.625. The source site's scene passed with median diff 27.3, min 4.6, longest run 0,
lowest coverage 0.48 on desktop and 0.72 on portrait.

## Be honest about the weakest frames

Write them down in the scene's header comment and keep them in mind for the next pass. In the example scene:

- **p 0.00–0.12** (the closed device): the dark hero moves slowly by design (diff 4–6), never near zero.
- **p 0.52–0.56** (between "Every Layer" and the board): the slowest stretch outside the end (diff 3.4).
- **p 0.97–1.00** (the die): the die is dark at the default exposure; its blocks read, its wiring is faint.
- The bead-blasted lid reads dark grey rather than silver at p 0 because it mirrors a dark studio; brighter soft
  boxes would lift it but wash the board out later.

In the source site's scene the weakest stretch was the approach to the edge of the top die (a large polished slab with
a narrow notch that still read as clean CG), and the far hole field showed faint moiré at a pixel ratio of 1.
