# Worked example: the source site's scene ("from a drive to one memory cell")

The scene that shipped in the source site is not in `assets/` (it is long and specific to its subject). This is its
plan, so you can see what a full-length dive looks like and copy its structure for your own subject. The example
scene in `assets/scenes/example-device.js` follows the same pattern at a smaller scale.

## The subject

One continuous camera from an M.2 SSD on a graphite surface down to a single 3D NAND memory cell, about five orders of
magnitude of zoom (camera distance 6.0 → 0.000042 units). A floating origin keeps the precision.

## Beats (story progress p; headline in a → b, out c → d)

| Headline | In | Out | Camera |
|---|---|---|---|
| `{{SITE_NAME}}` | on at load | 0.07 → 0.11 | the drive, a hero three-quarter view, gliding onto one package |
| Inside the Package | 0.130 → 0.168 | 0.262 → 0.294 | the package lid lifts; orbit over the gold wire bonds |
| Stacked Dies | 0.300 → 0.338 | 0.442 → 0.474 | along the edge of eight stacked dies, into the top die |
| 300 Layers | 0.525 → 0.563 | 0.664 → 0.696 | the word-line staircase and its contacts, then over the top |
| One Channel | 0.732 → 0.770 | 0.866 → 0.898 | down onto the field of channel holes (real pits in the surface) |
| One Cell | 0.912 → 0.950 | holds to the end | a section through one channel: the films around it, the cell; the only hold |

Run: STORY 2, HOLD 0.45, FADE 0.28 screens → 373svh.

## Camera keys

`[p, anchor, distance, azimuth, elevation | portrait: distance ×, azimuth +, elevation +]`

```
[0.000, 'ssd',  6.0,       0.58, 0.60,  0.85, 0.80,  0.06]
[0.080, 'ssd',  3.85,      0.34, 0.68,  0.90, 0.72,  0.04]
[0.160, 'pkg',  2.75,      0.18, 0.72,  1.15, 0.55,  0.00]
[0.245, 'pkg2', 2.05,     -0.42, 0.56,  1.20, 0.30,  0.00]
[0.330, 'stk',  1.55,     -0.98, 0.38,  1.25, 0.05,  0.04]
[0.415, 'stk2', 0.62,     -0.62, 0.30,  1.20, 0.00,  0.00]
[0.485, 'edge', 0.040,    -0.40, 0.34,  0.95, 0.00,  0.12]
[0.560, 'blk',  0.0046,   -0.58, 0.42,  1.25, 0.12,  0.04]
[0.660, 'fld1', 0.00125,  -0.44, 0.62,  1.10, 0.00,  0.00]
[0.765, 'fld',  0.00036,  -0.36, 0.50,  1.10, 0.00,  0.04]   skim the polished top
[0.855, 'pit',  0.000165, -0.30, 1.10,  1.15, 0.00,  0.00]   tilt down into the holes
[0.950, 'cell', 0.0000880,-0.58, 0.60,  1.25, 0.06, -0.06]   over the brink: the section through one cell
```

Note how the distance falls by a roughly constant factor per key in the second half: in log space the dive feels even.
The portrait channels mostly push the camera back (× 1.10–1.25) and swing it a little; the first keys pull in
(× 0.85) because the drive is wide.

## Events (on the clock once scroll passes p)

| Event | p | Duration | What moves |
|---|---|---|---|
| lid | 0.150 | 1.1 s | the package lid lifts and fades ("decap") |
| settle | 0.322 | 1.2 s | the eight dies settle onto each other |
| wl | 0.548 | 1.2 s | a faint warm band climbs the word-line stack; one word line stays lit |
| e | 0.930 | 1.2 s | 16 electrons (12 on the low tier) drift from the channel through the tunnel oxide into the charge-trap layer |

Accent colours only by meaning: electrons a calm blue (about `#6aa8ff`), holes amber (`#f0a24b`), damage a dull red.

## Schematic shortcuts (written in the scene's header)

- 128 word-line pairs are drawn; only the headline says 300.
- The films in the channel hole are drawn about 1.3 × thicker than real, relative to the hole.
- The fill oxide is removed so the staircase and its contacts stand free.
- The lid lift is a metaphor for decapsulation.

## What to copy for your own subject

1. Pick one object people recognise, and one thing inside it that is the point of your site. The story is the dive
   from one to the other.
2. Write the beats first: 4–6 headlines of 1–3 words. The first is the site name.
3. Set camera keys so every beat has motion; let the distance fall by a steady factor in log space.
4. Give each beat one small event on the clock (a lid, a settle, a light, a flow).
5. Render stills and metrics (`quality.md`) after every change.
