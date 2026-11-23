#!/usr/bin/env python3
"""Build step for the Research log tab: logs/weekNN_MMDD/*.md → dist/data/records.json (+ images → dist/repo/logs/…).

Put this file next to build.py and add it as a step (team-site-setup's skeleton):

    from build_records import records
    STEPS = {"build": build_info, "records": records}
    IMAGE_DIRS = [ROOT / "logs"]          # figures embedded in logs are copied to dist/repo/logs/…

Or run it alone (the demo does this):

    python3 build_records.py --root path/to/repo --out path/to/records.json

Reads site/data/team.json: repo, branch, members (id, name), program (start, weeks or end, timeZone).
Every week of the program gets an entry, with or without a folder, so the site can show "Not started" weeks and offer
"Create from template". Standard library only.
"""
import argparse
import datetime
import json
import pathlib
import re
import unicodedata

HERE = pathlib.Path(__file__).resolve().parent
IMG = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}
WEEK_DIR = re.compile(r"^week(\d{1,2})(?:_(\d{4}))?$", re.I)


def nfc(s):
    return unicodedata.normalize("NFC", s)


def read(p):
    return p.read_text("utf-8-sig") if p.exists() else ""


def h1(md):
    for line in md.splitlines():
        m = re.match(r"^#\s+(.+)$", line.strip())
        if m:
            return m.group(1).strip()
    return ""


def week_title(md):
    """The words after "—" (or " - ") in team.md's first heading: "# Week 3 · 1.19 (Tue) — Midterm check" → "Midterm check"."""
    t = h1(md)
    if "—" in t:
        return t.split("—", 1)[1].strip()
    if " - " in t:
        return t.split(" - ", 1)[1].strip()
    return ""


def records(root=HERE):
    root = pathlib.Path(root)
    rel = lambda p: nfc(p.relative_to(root).as_posix())
    team = json.loads((root / "site" / "data" / "team.json").read_text("utf-8"))
    prog = team["program"]
    start = datetime.date.fromisoformat(prog["start"])
    if prog.get("weeks"):
        n_weeks = int(prog["weeks"])
    else:
        n_weeks = (datetime.date.fromisoformat(prog["end"]) - start).days // 7 + 1

    # a personal log is <id>.md; a member's shown names are accepted too (any case)
    names = {}
    for m in team["members"]:
        names[m["id"].lower()] = m["id"]
        for k in ("name", "en", "full"):
            if m.get(k):
                names[nfc(m[k]).lower()] = m["id"]

    found = {}
    logs = root / "logs"
    if logs.exists():
        for d in sorted(logs.iterdir()):
            m = WEEK_DIR.match(nfc(d.name)) if d.is_dir() else None
            if m:
                found[int(m.group(1))] = d

    weeks = []
    for no in range(1, max([n_weeks] + list(found)) + 1):
        date = start + datetime.timedelta(days=7 * (no - 1))
        d = found.get(no)
        w = {
            "no": no,
            "date": date.isoformat(),
            # the week's last day; from 00:00 the day after it (team time) the week is closed
            "end": (date + datetime.timedelta(days=6)).isoformat(),
            "dir": rel(d) if d else f"logs/week{no:02d}_{date:%m%d}",
            "exists": bool(d),
            "title": "",
            "team": None,
            "people": {},
            "extra": [],
        }
        if d:
            for f in sorted(d.iterdir()):
                name = nfc(f.name)
                if f.is_dir():
                    w["extra"].append({"name": name + "/", "path": rel(f)})
                    continue
                if f.suffix.lower() != ".md":
                    if f.suffix.lower() not in IMG:  # images are shown inside the logs, other files are listed
                        w["extra"].append({"name": name, "path": rel(f)})
                    continue
                stem = nfc(f.stem).lower()
                item = {"path": rel(f), "md": read(f)}
                if stem == "team":
                    w["team"] = item
                    w["title"] = week_title(item["md"])
                elif stem in names:
                    w["people"][names[stem]] = item
                elif stem != "readme":
                    w["extra"].append({"name": name, "path": rel(f)})
        weeks.append(w)
    return {"timeZone": prog.get("timeZone", ""), "weeks": weeks}


def main():
    ap = argparse.ArgumentParser(description="Write records.json from logs/.")
    ap.add_argument("--root", default=str(HERE), help="the repository (holds logs/ and site/data/team.json)")
    ap.add_argument("--out", default=None, help="default: <root>/dist/data/records.json")
    a = ap.parse_args()
    out = pathlib.Path(a.out or pathlib.Path(a.root) / "dist" / "data" / "records.json")
    data = records(a.root)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", "utf-8")
    print(f"records.json: {len(data['weeks'])} weeks, {sum(w['exists'] for w in data['weeks'])} with a folder → {out}")


if __name__ == "__main__":
    main()
