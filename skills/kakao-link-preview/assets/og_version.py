#!/usr/bin/env python3
"""Link-preview picture: check its size and write its version into lib/og.js.

Messengers cache a preview image by URL. The page links the picture as /assets/og.jpg?v=<first 8 hex of its SHA-1>, so
a new picture is a new URL and is fetched again. Run after replacing site/assets/og.jpg, and commit both files:

    python3 og_version.py            # writes lib/og.js
    python3 og_version.py --check    # exits 1 if lib/og.js is stale or the picture has the wrong size (use in CI)

Standard library only.
"""
import hashlib
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent  # put this file at the repo root, or change ROOT
IMG = ROOT / "site" / "assets" / "og.jpg"
OUT = ROOT / "lib" / "og.js"
SIZE = (2400, 1260)  # 1.91 : 1, twice the usual 1200 × 630 so it stays sharp on high-density phones
ALT = "{{OG_ALT}}"   # one plain sentence describing the picture

OG_JS = """// The link-preview picture and its version (?v=, so messengers fetch it again after a change).
// Written by og_version.py from site/assets/og.jpg. Do not edit by hand.
export const OG = {{ path: "/assets/og.jpg", v: "{v}", w: {w}, h: {h}, alt: "{alt}" }};
"""


def jpeg_size(b):
    """(width, height) from a JPEG's first SOF marker, or None."""
    if b[:2] != b"\xff\xd8":
        return None
    i = 2
    while i + 9 < len(b):
        if b[i] != 0xFF:
            return None
        m = b[i + 1]
        if m in (0xD8, 0x01) or 0xD0 <= m <= 0xD7:
            i += 2
            continue
        n = int.from_bytes(b[i + 2:i + 4], "big")
        if 0xC0 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC):
            return int.from_bytes(b[i + 7:i + 9], "big"), int.from_bytes(b[i + 5:i + 7], "big")
        i += 2 + n
    return None


def version():
    b = IMG.read_bytes() if IMG.exists() else b""
    if jpeg_size(b) != SIZE:
        return None, f"{IMG.relative_to(ROOT)} must be a {SIZE[0]} × {SIZE[1]} JPEG"
    return hashlib.sha1(b).hexdigest()[:8], None


def main():
    v, err = version()
    if err:
        print(err)
        sys.exit(1)
    want = OG_JS.format(v=v, w=SIZE[0], h=SIZE[1], alt=ALT)
    if "--check" in sys.argv:
        have = OUT.read_text("utf-8") if OUT.exists() else ""
        if f'v: "{v}", w: {SIZE[0]}, h: {SIZE[1]}' not in have:
            print(f"{OUT.relative_to(ROOT)} has an old og.jpg version (want {v}; run python3 og_version.py)")
            sys.exit(1)
        print("og: up to date", v)
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(want, "utf-8")
    print(f"{OUT.relative_to(ROOT)}: og.jpg v={v}")


if __name__ == "__main__":
    main()
