#!/usr/bin/env python3
"""Site build: copies site/ to dist/ and turns repo folders into dist/data/*.json.

Cloudflare Pages: build command `python3 build.py`, output directory `dist`.
Standard library only, so nothing has to be installed in the Pages build image.

    python3 build.py          # build dist/
    python3 build.py --check  # build, then fail if anything the pages need is missing

Add a step by writing a function that returns a JSON-able object and listing it in STEPS. The other skills in this
repository provide steps: records (weekly-research-log), refs (references-library), theory (lecture-notes-reader).
"""
import datetime
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SITE = ROOT / "site"
DIST = ROOT / "dist"
TZ = datetime.timezone(datetime.timedelta(hours=9))  # {{TIMEZONE}} offset; used only for the build stamp
IMG = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}

# folders whose images are copied to dist/repo/<path> so Markdown can embed them
IMAGE_DIRS = []  # e.g. [ROOT / "logs", ROOT / "references", ROOT / "theory"]

# files the pages need; --check fails if one is missing from dist/
MUST = ["index.html", "css/tokens.css", "css/components.css", "js/app.js", "data/team.json", "data/build.json", "robots.txt"]


def build_info():
    commit = os.environ.get("CF_PAGES_COMMIT_SHA", "")
    if not commit:
        try:
            commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, timeout=5).stdout.strip()
        except Exception:
            commit = ""
    return {"time": datetime.datetime.now(TZ).strftime("%Y-%m-%d %H:%M"), "commit": commit, "branch": os.environ.get("CF_PAGES_BRANCH", "")}


# name in dist/data → function. Example: STEPS = {"records": records, "refs": refs, "theory": theory}
STEPS = {"build": build_info}


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), "utf-8")


def copy_images(src):
    n = 0
    for f in src.rglob("*") if src.exists() else []:
        if f.is_file() and f.suffix.lower() in IMG:
            out = DIST / "repo" / f.relative_to(ROOT).as_posix()
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, out)
            n += 1
    return n


def check():
    missing = [m for m in MUST if not (DIST / m).exists()]
    # every absolute src/href in the HTML pages exists
    for page in DIST.glob("*.html"):
        for ref in re.findall(r'(?:src|href)="(/[^"#?]+)"', page.read_text("utf-8")):
            if not ref.startswith("/__") and not (DIST / ref.lstrip("/")).exists():
                missing.append(f"{ref} (in {page.name})")
    # every relative module a script imports exists
    for js in (DIST / "js").glob("*.js") if (DIST / "js").exists() else []:
        for ref in re.findall(r"""^\s*import\s[^"']*["']([./][^"']+)["']""", js.read_text("utf-8"), re.M):
            target = DIST / ref.lstrip("/") if ref.startswith("/") else js.parent / ref
            if not target.resolve().exists():
                missing.append(f"{ref} (imported by js/{js.name})")
    if missing:
        print("missing:", ", ".join(sorted(set(missing))))
        sys.exit(1)
    print("check: nothing missing")


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(SITE, DIST, ignore=shutil.ignore_patterns("README.md", ".DS_Store"))
    for name, fn in STEPS.items():
        write_json(DIST / "data" / f"{name}.json", fn())
    imgs = sum(copy_images(d) for d in IMAGE_DIRS)
    print(f"dist/ done: {len(STEPS)} data files, {imgs} images")
    if "--check" in sys.argv:
        check()


if __name__ == "__main__":
    main()
