#!/usr/bin/env python3
"""Prints the week table for logs/README.md: Week · Folder · Dates · Closed from.

Uses the same rule as tools/check_record_lock.py and the site's Research log tab:
  - week 1 starts on the first day; every week is 7 days, so the weekday of the first day is the week's start day;
  - week N's folder is logs/weekNN_MMDD/ (two-digit number, month and day of the week's first day);
  - week N is closed from 00:00 on the day after its last day, in the team's time zone.

Standard library only (Python 3.9+ for zoneinfo).

    python3 weeks.py 2027-01-05 10 Asia/Seoul        # first day, number of weeks, IANA time zone
    python3 weeks.py --team site/data/team.json      # the same three values from team.json's "program"
    python3 weeks.py 2027-01-05 10 Asia/Seoul --today 2027-01-21   # also mark closed / this week
"""
import argparse
import datetime
import json
import pathlib
import sys
from zoneinfo import ZoneInfo

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def week_dates(start, no):
    """First and last day of week `no` (1-based)."""
    first = start + datetime.timedelta(days=7 * (no - 1))
    return first, first + datetime.timedelta(days=6)


def folder(start, no):
    first, _ = week_dates(start, no)
    return f"week{no:02d}_{first:%m%d}"


def closed(start, no, today):
    """True once the week's last day has passed (today is a date in the team's zone)."""
    return today > week_dates(start, no)[1]


def today_in(tz):
    return datetime.datetime.now(ZoneInfo(tz)).date()


def program(team_path):
    """(first day, number of weeks, zone) from team.json: program.start, program.weeks or program.end, program.timeZone."""
    p = json.loads(pathlib.Path(team_path).read_text("utf-8"))["program"]
    start = datetime.date.fromisoformat(p["start"])
    if p.get("weeks"):
        n = int(p["weeks"])
    else:
        n = (datetime.date.fromisoformat(p["end"]) - start).days // 7 + 1
    tz = p.get("timeZone")
    if not tz:
        sys.exit('team.json: add "timeZone" (an IANA name such as "Asia/Seoul") to "program"')
    return start, n, tz


def table(start, n, tz, today=None):
    d = lambda x: f"{DAYS[x.weekday()]} {x:%m-%d}"
    rows = ["| Week | Folder | Dates | Closed from (no edits) |", "|---|---|---|---|"]
    for no in range(1, n + 1):
        a, b = week_dates(start, no)
        mark = ""
        if today is not None:
            mark = " · closed" if closed(start, no, today) else " · this week" if a <= today <= b else ""
        rows.append(f"| Week {no} | `{folder(start, no)}` | {d(a)} – {d(b)}{mark} | {d(b + datetime.timedelta(days=1))} 00:00 |")
    return "\n".join(rows) + f"\n\nTimes are {tz}. A week runs {DAYS[start.weekday()]} → {DAYS[(start.weekday() + 6) % 7]}."


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("start", nargs="?", help="first day of week 1, YYYY-MM-DD")
    ap.add_argument("weeks", nargs="?", type=int, help="number of weeks")
    ap.add_argument("tz", nargs="?", help="IANA time zone, e.g. Asia/Seoul")
    ap.add_argument("--team", help="read the three values from team.json instead")
    ap.add_argument("--today", help="YYYY-MM-DD: mark closed weeks and this week (default: no marks)")
    a = ap.parse_args(argv)
    if a.team:
        start, n, tz = program(a.team)
    elif a.start and a.weeks and a.tz:
        start, n, tz = datetime.date.fromisoformat(a.start), a.weeks, a.tz
    else:
        ap.error("give START WEEKS TZ, or --team site/data/team.json")
    ZoneInfo(tz)  # fails early on a wrong zone name
    today = datetime.date.fromisoformat(a.today) if a.today else None
    print(table(start, n, tz, today))


if __name__ == "__main__":
    main()
