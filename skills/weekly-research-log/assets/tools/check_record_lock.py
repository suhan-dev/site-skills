#!/usr/bin/env python3
"""Fails when a closed week's log was edited (the GitHub Action "record-lock").

Week N starts on program.start + 7 × (N − 1) days and runs 7 days. From 00:00 on the day after its last day, in the
team's time zone (program.timeZone in site/data/team.json), its folder logs/weekNN_MMDD/ is closed. The same rule is in
weeks.py (the table in logs/README.md) and in the site's Research log tab (records.js).

Reads the changed paths, one per line, and exits 1 if any is inside a closed week's folder.

    git diff --name-only BASE HEAD -- logs | python3 tools/check_record_lock.py
    ... | python3 tools/check_record_lock.py --today 2027-01-21     # tests: pretend it is that day
    ... | python3 tools/check_record_lock.py --team path/to/team.json

Standard library only (Python 3.9+ for zoneinfo).
"""
import argparse
import datetime
import json
import pathlib
import re
import sys
import unicodedata
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parent.parent
# logs/week3/…, logs/week03_0119/…, case-insensitive; only the number counts (a wrong MMDD cannot open a week)
WEEK = re.compile(r"^logs/week(\d{1,2})(?:_\d{4})?/", re.I)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Fail if a closed week's log was edited.")
    ap.add_argument("--team", default=str(ROOT / "site" / "data" / "team.json"))
    ap.add_argument("--today", help="YYYY-MM-DD in the team's zone (tests only)")
    a = ap.parse_args(argv)

    program = json.loads(pathlib.Path(a.team).read_text("utf-8"))["program"]
    start = datetime.date.fromisoformat(program["start"])
    tz = program.get("timeZone")
    if not tz:
        print('record-lock: add "timeZone" (an IANA name such as "Asia/Seoul") to "program" in team.json')
        sys.exit(2)
    today = datetime.date.fromisoformat(a.today) if a.today else datetime.datetime.now(ZoneInfo(tz)).date()

    bad = []
    for raw in sys.stdin.read().splitlines():
        # git may quote paths with non-ASCII names, and macOS writes them decomposed (NFD)
        path = unicodedata.normalize("NFC", raw.strip().strip('"'))
        m = WEEK.match(path)
        if not m:
            continue
        no = int(m.group(1))
        end = start + datetime.timedelta(days=7 * (no - 1) + 6)
        if today > end:
            bad.append(f"{path}  (week {no} closed at the end of {end:%a %Y-%m-%d}, {tz})")
    if bad:
        print("A closed week's log was edited. Do not edit past logs; write corrections in this week's log.")
        print("\n".join("  - " + b for b in bad))
        sys.exit(1)
    print("record-lock: no closed week was edited")


if __name__ == "__main__":
    main()
