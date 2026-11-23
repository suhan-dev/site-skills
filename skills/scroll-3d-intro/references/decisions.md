# Decisions: what was tried, what replaced it, and why

From the source site's history. Read this before you "improve" something back into a state that already failed.

| Before | After | Why |
|---|---|---|
| Line-drawn and flat-shaded concept scenes (SVG diagrams, isometric blocks, a "history objects" scene) | Physically based product render: PBR materials with procedural roughness maps, studio environment, AO, depth of field | The owner rejected "looks hand-drawn" and "flat CG blocks" outright. Only the photographic prototype survived. |
| Five full candidates rendered side by side, each with stills, a poster and metrics | One chosen (a dive from an SSD down to a single memory cell) | Comparing finished candidates was faster than arguing about sketches. Each candidate had to look finished. |
| A different picture per beat | One continuous camera that dives into the object | A cut reads as a slideshow; a dive reads as a product film. |
| Long stretches where scrolling changed nothing, then the good part flew by | Camera keys spread so motion is even; the stills-and-metrics check (no 4 near-zero steps in a row, subject ≥ 35 % of the frame) | The owner complained about dead scroll. The metrics make it measurable. |
| A static scene that only moved with scroll | A clock: arrival move, idle drift and light sweep, ~1 s beat events | A still render moved by scroll looked lifeless; time-driven life (modelled on a physics-lab site's intro) made it feel shot. |
| A plain circle for the final cell | Real pits in the surface and a section through one channel | The plain circle looked unreal at the moment the camera stopped on it. Close-ups need real geometry. |
| The sign-in page and the intro as two pictures | One scene: the sign-in background is the intro's settled first frame (a poster), dimmed; after sign-in it brightens and the title rises | Two pictures made a visible cut at the most important moment. |
| Stutters mid-scroll the first time a part came into view | All shaders compiled before the first frame; the quality drops within three late frames; lighter passes (half-size AO, MSAA only on the scene pass, Bokeh skipping in-focus pixels) | Shader compiles and fill rate were the stutters. |
| The intro ended at the last beat, and the app slid up from below | A hold on the last beat, then the picture brightens into the page colour, the intro folds away and the app fades in at the top | The slide-up looked like a page loading late. The fade makes the intro and the site one surface. |
| A long hold and fade at the end | Hold 0.45 screen, fade 0.28 screen | The owner asked for less room at the end. |
| `overflow-x: hidden` on `html` and `body` | `overflow-x: clip` on `body` only | `hidden` makes a scroll container, and the sticky stage stopped sticking. |
| The intro on phones too (portrait framing, low tier) | No intro on phones (≤ 760 px wide, or a phone on its side); they open on the calendar | On a phone the visitor wants the schedule now; a 4-screen scroll and a 3D download were in the way. Portrait tablets keep the intro with their own framing. |
| three.js from a CDN through an import map (prototypes) | three.js r170 served from the site (`/vendor/three/`), pinned by version and hash | One origin, no outage risk, cached with the site; the hash makes the download verifiable. |
| Bloom for "glow" | Never | Glow made it look like a game, not a product. |
| `window.__snap` and per-candidate globals | `window.introDebug` (`snap`, `go`, `run`, `fadeAt`, `quality`, `frames`) | One documented hook for stills, posters and metrics. |
