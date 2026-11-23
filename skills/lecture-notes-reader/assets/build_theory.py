#!/usr/bin/env python3
"""Chapters → theory.json for the Theory tab and the lecture-notes reader. Standard library only.

    python3 build_theory.py --src theory --out dist                 # dist/data/theory.json + figures in dist/repo/theory/…
    python3 build_theory.py --src theory --out dist --check         # and fail on a broken chapter folder
    python3 build_theory.py --src assets/demo/theory --out assets/demo --base / --no-images   # the demo

Folder shape (see references/authoring.md):
    theory/sections.json                 [{"id": "heat", "title": "Heat and Diffusion", "short": "Heat"}, …]  (parts, in order)
    theory/<id>/<label>-slug.md          one chapter per file: h1-heat-flow-in-a-rod.md → label "H1"
    theory/<id>/figures/*.svg            figures (copied to <out>/<base>/<root>/<id>/figures/ unless --no-images)

theory.json:
    {"root": "theory", "base": "/repo/", "repo": "owner/name", "branch": "main",
     "sections": [{"id", "title", "short", "chapters": [{"id", "label", "no", "title", "md"}]}]}
"""
import argparse
import json
import pathlib
import re
import shutil
import sys
import unicodedata

IMG = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}
# Chapter file names: <letter><number>-slug.md (h1-heat-flow.md → label "H1") or NN-slug.md (01-intro.md → "1").
CHAPTER = re.compile(r"^([A-Za-z]?)(\d+)(?:[-_ ]|$)")


def nfc(s):
    return unicodedata.normalize("NFC", s)


def read(p):
    return p.read_text("utf-8-sig") if p.exists() else ""


def split_h1(md):
    """(title, md without that line): the first '# H1' line of a chapter is its title."""
    lines = md.splitlines(keepends=True)
    for i, line in enumerate(lines):
        m = re.match(r"^#\s+(.+)$", line.strip())
        if m:
            return m.group(1).strip(), "".join(lines[:i] + lines[i + 1:])
    return "", md


def natural(name):
    """Sort key that reads numbers as numbers: h2 before h10, h0 first."""
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", nfc(name).lower())]


def chapter_files(d):
    return sorted((f for f in d.iterdir() if f.is_file() and f.suffix.lower() == ".md" and f.stem.lower() != "readme"),
                  key=lambda f: natural(f.name)) if d.is_dir() else []


def chapter_label(stem, i):
    """("H1", 1) from h1-heat-flow, ("1", 1) from 01-intro; a name without a number gets its place in the list."""
    m = CHAPTER.match(stem)
    return (m.group(1).upper() + str(int(m.group(2))), int(m.group(2))) if m else (str(i), i)


def chapter_title(title, label):
    """'# H1. Heat flow' → 'Heat flow': the label in front of the H1 is dropped (the site shows it on its own)."""
    sep = r"\s*[.:·—–-]\s*" + (r"|\s+" if label[0].isalpha() else "")
    return re.sub(rf"^{re.escape(label)}(?:{sep})", "", title, count=1, flags=re.I).strip() or title


def spec(src):
    """sections.json: the parts in order, [{"id": folder name, "title": tab name, "short": name on phones (optional)}]."""
    return json.loads(read(src / "sections.json") or "[]")


def theory(src):
    """Each part folder <src>/<id>/ holds one chapter per file, in natural file-name order.
    A chapter: id (file name without .md, also its address), label ("H1"), no (1), title (H1 without the label), md."""
    sections = []
    for s in spec(src):
        chapters = []
        for i, f in enumerate(chapter_files(src / s["id"]), 1):
            stem = nfc(f.stem)
            label, no = chapter_label(stem, i)
            title, md = split_h1(read(f))
            chapters.append({
                "id": stem,
                "label": label,
                "no": no,
                "title": chapter_title(title, label) if title else
                         (re.sub(r"^[A-Za-z]?\d+[-_ ]*", "", stem).replace("-", " ").strip().capitalize() or stem),
                "md": md,
            })
        sections.append({"id": s["id"], "title": s.get("title") or s["id"], "short": s.get("short") or "", "chapters": chapters})
    return sections


def check(src):
    """Every folder is listed in sections.json, and every listed folder exists.
    A letter label (H1) is used once in the whole folder and a number label (1) once per part: equation numbers and
    references like \\eqref{H2.3} rely on that. A chapter file name has no dot before .md: the reader address
    /theory/<part>/<chapter> must not look like a file."""
    ids = [s["id"] for s in spec(src)]
    dirs = {nfc(d.name) for d in src.iterdir() if d.is_dir()} if src.is_dir() else set()
    out = [f"{src.name}/{d}/ (not in sections.json)" for d in sorted(dirs - set(ids))]
    out += [f"{src.name}/{i}/ (listed in sections.json, no folder)" for i in ids if i not in dirs]
    seen = {}
    for sid in ids:
        for i, f in enumerate(chapter_files(src / sid), 1):
            label = chapter_label(nfc(f.stem), i)[0]
            key = label if label[0].isalpha() else (sid, label)
            name = f"{src.name}/{sid}/{f.name}"
            if "." in f.stem:
                out.append(f"{name} (no dots in chapter file names)")
            if not split_h1(read(f))[0]:
                out.append(f"{name} (no '# Title' line)")
            if key in seen:
                out.append(f"{name} (chapter label {label} is also used by {seen[key]})")
            seen.setdefault(key, name)
    return out


def copy_images(src, dest):
    n = 0
    for f in src.rglob("*"):
        if f.is_file() and f.suffix.lower() in IMG:
            out = dest / nfc(f.relative_to(src).as_posix())
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, out)
            n += 1
    return n


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--src", default="theory", help="the chapters folder (holds sections.json)")
    ap.add_argument("--out", default="dist", help="the built site; theory.json goes to <out>/data/")
    ap.add_argument("--root", default=None, help="the chapters folder's path in the repository (default: the --src folder name)")
    ap.add_argument("--base", default="/repo/", help="site path the figures are served under (default /repo/)")
    ap.add_argument("--repo", default="", help="GitHub owner/name, for links to files that are not chapters (optional)")
    ap.add_argument("--branch", default="main")
    ap.add_argument("--no-images", action="store_true", help="do not copy figures (they are served from --src already)")
    ap.add_argument("--check", action="store_true", help="fail if the folder breaks the naming rules")
    a = ap.parse_args()
    src, out = pathlib.Path(a.src), pathlib.Path(a.out)
    root = (a.root or src.name).strip("/")
    base = "/" + a.base.strip("/") + "/" if a.base.strip("/") else "/"
    data = {"root": root, "base": base, "repo": a.repo, "branch": a.branch, "sections": theory(src)}
    (out / "data").mkdir(parents=True, exist_ok=True)
    (out / "data" / "theory.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), "utf-8")
    imgs = 0 if a.no_images else copy_images(src, out / base.strip("/") / root)
    n = sum(len(s["chapters"]) for s in data["sections"])
    print(f"theory.json: {len(data['sections'])} parts, {n} chapters, {imgs} figures copied")
    if a.check:
        bad = check(src)
        if bad:
            print("problems:", ", ".join(bad))
            sys.exit(1)
        print("check: chapters folder is fine")


if __name__ == "__main__":
    main()
