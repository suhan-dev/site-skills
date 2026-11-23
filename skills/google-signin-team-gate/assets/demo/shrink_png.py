"""Shrink screenshots over 900 KB to a 256-colour PNG (needs Pillow). The sign-in page is a smooth dark gradient,
which the browser dithers; at 2x that is a 2+ MB PNG. The palette is built from the picture plus its bright pixels
weighted up, so the pill's white text keeps its white.
    python3 shrink_png.py a.png b.png ...
"""
import os
import sys

from PIL import Image

LIMIT = 900_000

for path in sys.argv[1:]:
    if os.path.getsize(path) <= LIMIT:
        continue
    im = Image.open(path).convert("RGB")
    small = im.resize((im.width // 4, im.height // 4))
    bright = [p for p in im.get_flattened_data() if sum(p) > 300] if hasattr(im, "get_flattened_data") else [p for p in im.getdata() if sum(p) > 300]
    src = Image.new("RGB", (small.width, small.height + 40))
    src.paste(small, (0, 0))
    if bright:
        strip = Image.new("RGB", (len(bright), 1))
        strip.putdata(bright)
        src.paste(strip.resize((small.width, 40)), (0, small.height))
    palette = src.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    im.quantize(palette=palette, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)
    print(f"shrunk {os.path.basename(path)} to {os.path.getsize(path) // 1000} KB")
