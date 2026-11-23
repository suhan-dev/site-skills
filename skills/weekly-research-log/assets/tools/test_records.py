#!/usr/bin/env python3
"""Offline tests for the weekly research log: the week rule (weeks.py), the lock check, and the build step.

    python3 tools/test_records.py        (Python 3.9+, standard library only)

Run it from the skill's assets/ folder or from a project that copied the files: it looks for weeks.py next to this
file or one folder up, and for build_records.py one folder up.
"""
import contextlib
import datetime
import importlib.util
import io
import json
import pathlib
import subprocess
import sys
import tempfile
import unicodedata

HERE = pathlib.Path(__file__).resolve().parent
UP = HERE.parent
passed = failed = 0


def ok(cond, name, extra=""):
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
        print("✗", name, extra)


def load(name, *places):
    for p in places:
        f = p / f"{name}.py"
        if f.exists():
            spec = importlib.util.spec_from_file_location(name, f)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            return mod
    sys.exit(f"{name}.py not found in {', '.join(map(str, places))}")


weeks = load("weeks", HERE, UP)
lock = load("check_record_lock", HERE, UP / "tools")
build = load("build_records", UP, HERE)
D = datetime.date.fromisoformat

# ---------- weeks.py ----------
start = D("2027-01-05")  # a Tuesday
ok(weeks.week_dates(start, 1) == (D("2027-01-05"), D("2027-01-11")), "week 1 runs Tue → Mon")
ok(weeks.week_dates(start, 8) == (D("2027-02-23"), D("2027-03-01")), "week 8 crosses the month")
ok(weeks.folder(start, 3) == "week03_0119", "folder name weekNN_MMDD", weeks.folder(start, 3))
ok(weeks.folder(D("2026-12-29"), 1) == "week01_1229" and weeks.folder(D("2026-12-29"), 2) == "week02_0105", "folders across the new year")
ok(not weeks.closed(start, 1, D("2027-01-11")), "open on its last day")
ok(weeks.closed(start, 1, D("2027-01-12")), "closed the day after")
t = weeks.table(start, 10, "Asia/Seoul", today=D("2027-01-21"))
rows = [r for r in t.splitlines() if r.startswith("| Week ") and r[7].isdigit()]
ok(len(rows) == 10, "table has 10 rows", len(rows))
ok("· closed" in rows[1] and "· this week" in rows[2] and "·" not in rows[3].split("|")[3], "marks: closed, this week, nothing", rows[:4])
ok(rows[0] == "| Week 1 | `week01_0105` | Tue 01-05 – Mon 01-11 · closed | Tue 01-12 00:00 |", "row format", rows[0])
ok("A week runs Tue → Mon." in t and "Asia/Seoul" in t, "table note names the zone and the days")
# another start day and zone: weeks run Thursday → Wednesday
t2 = weeks.table(D("2027-09-02"), 2, "America/New_York")
ok("| Week 1 | `week01_0902` | Thu 09-02 – Wed 09-08 | Thu 09-09 00:00 |" in t2, "Thursday weeks", t2)

# the CLI, both ways
with tempfile.TemporaryDirectory() as tmp:
    team = pathlib.Path(tmp) / "team.json"
    team.write_text(json.dumps({"program": {"start": "2027-01-05", "end": "2027-03-08", "timeZone": "Asia/Seoul"}}))
    a = subprocess.run([sys.executable, str(pathlib.Path(weeks.__file__)), "2027-01-05", "9", "Asia/Seoul"], capture_output=True, text=True)
    b = subprocess.run([sys.executable, str(pathlib.Path(weeks.__file__)), "--team", str(team)], capture_output=True, text=True)
    ok(a.returncode == 0 and a.stdout == b.stdout, "CLI: three values == --team (end → 9 weeks)", a.stderr + b.stderr)
    bad = subprocess.run([sys.executable, str(pathlib.Path(weeks.__file__)), "2027-01-05", "9", "Mars/Olympus"], capture_output=True, text=True)
    ok(bad.returncode != 0, "CLI: a wrong zone fails")


# ---------- check_record_lock.py ----------
def run_lock(paths, today, program=None):
    program = program or {"start": "2027-01-05", "weeks": 10, "timeZone": "Asia/Seoul"}
    with tempfile.TemporaryDirectory() as tmp:
        team = pathlib.Path(tmp) / "team.json"
        team.write_text(json.dumps({"program": program}))
        out, code = io.StringIO(), 0
        old = sys.stdin
        sys.stdin = io.StringIO("\n".join(paths) + "\n")
        try:
            with contextlib.redirect_stdout(out):
                lock.main(["--team", str(team), "--today", today])
        except SystemExit as e:
            code = e.code or 0
        finally:
            sys.stdin = old
        return code, out.getvalue()


ok(run_lock(["logs/week01_0105/alex.md"], "2027-01-11")[0] == 0, "lock: week 1 open on Mon 01-11")
code, out = run_lock(["logs/week01_0105/alex.md"], "2027-01-12")
ok(code == 1 and "week 1 closed" in out, "lock: week 1 closed on Tue 01-12", out)
ok(run_lock(["logs/week03_0119/team.md", "README.md", "research/x.md"], "2027-01-21")[0] == 0, "lock: this week and other folders pass")
ok(run_lock(["logs/week2/blair.md"], "2027-01-21")[0] == 1, "lock: a folder without _MMDD still counts")
ok(run_lock(["logs/Week02_0112/blair.md"], "2027-01-21")[0] == 1, "lock: any case")
ok(run_lock(['"logs/week02_0112/blair.md"'], "2027-01-21")[0] == 1, "lock: a quoted path from git")
nfd = unicodedata.normalize("NFD", "logs/week02_0112/é.md")
ok(run_lock([nfd], "2027-01-21")[0] == 1, "lock: a decomposed (macOS) name")
ok(run_lock(["logs/week02_9999/blair.md"], "2027-01-21")[0] == 1, "lock: a wrong MMDD cannot reopen a week")
ok(run_lock(["logs/README.md", "logs/week04_0126/alex.md"], "2027-01-21")[0] == 0, "lock: logs/README.md and a future week pass")
ok(run_lock(["logs/week01_0105/a.md"], "2027-01-12", {"start": "2027-01-05"})[0] == 2, "lock: a missing timeZone stops with a message")

# the lock check, weeks.py and records.js agree on every day of the program (records.js: today > w.end)
recs = build.records  # imported for the next section
agree = True
for k in range(0, 80):
    day = D("2027-01-01") + datetime.timedelta(days=k)
    for no in range(1, 11):
        end = start + datetime.timedelta(days=7 * (no - 1) + 6)
        js = day.isoformat() > end.isoformat()  # records.js compares YYYY-MM-DD strings
        if weeks.closed(start, no, day) != js:
            agree = False
for day in ("2027-01-11", "2027-01-12", "2027-02-28", "2027-03-01", "2027-03-02"):
    for no in (1, 8):
        code, _ = run_lock([f"logs/{weeks.folder(start, no)}/a.md"], day)
        if (code == 1) != weeks.closed(start, no, D(day)):
            agree = False
ok(agree, "lock check, weeks.py and records.js agree on every day")

# ---------- build_records.py ----------
demo = UP / "demo"
if (demo / "logs").exists():
    data = build.records(demo)
    ws = data["weeks"]
    ok(len(ws) == 10 and sum(w["exists"] for w in ws) == 3, "demo: 10 weeks, 3 folders", [w["exists"] for w in ws])
    ok(data["timeZone"] == "Asia/Seoul", "demo: the zone goes to the page")
    ok(ws[0]["date"] == "2027-01-05" and ws[0]["end"] == "2027-01-11", "demo: week 1 dates")
    ok(ws[1]["title"] == "First measurements", "demo: the title after — in team.md", ws[1]["title"])
    ok(sorted(ws[0]["people"]) == ["alex", "blair", "casey"], "demo: three personal logs in week 1")
    ok([x["name"] for x in ws[1]["extra"]] == ["run01_10W.csv"], "demo: other files listed, images not", ws[1]["extra"])
    ok(ws[3]["dir"] == "logs/week04_0126" and not ws[3]["exists"], "demo: a week with no folder gets its future folder name")
    shipped = json.loads((demo / "data" / "records.json").read_text("utf-8"))
    ok(shipped == data, "demo: data/records.json is up to date (python3 ../build_records.py --root . --out data/records.json)")

with tempfile.TemporaryDirectory() as tmp:
    root = pathlib.Path(tmp)
    (root / "site" / "data").mkdir(parents=True)
    (root / "site" / "data" / "team.json").write_text(json.dumps({
        "repo": "example-org/example-lab", "members": [{"id": "alex", "name": "Alex"}, {"id": "blair", "name": "Blair"}],
        "program": {"start": "2027-01-05", "end": "2027-01-18", "timeZone": "Asia/Seoul"}}))
    w = root / "logs" / "week01_0105"
    w.mkdir(parents=True)
    (w / "Alex.md").write_text("# Alex\n\nhello\n")
    (w / "team.md").write_text("# Week 1 - Kickoff\n")
    (w / "notes.md").write_text("x")
    (w / "README.md").write_text("x")
    (w / "fig.png").write_bytes(b"\x89PNG")
    (root / "logs" / "week05").mkdir()
    d = build.records(root)
    ok(len(d["weeks"]) == 5, "build: a folder past the end adds weeks up to it", len(d["weeks"]))
    ok("alex" in d["weeks"][0]["people"], "build: a shown name as file name maps to the id")
    ok(d["weeks"][0]["title"] == "Kickoff", "build: ' - ' also splits the title")
    ok([x["name"] for x in d["weeks"][0]["extra"]] == ["notes.md"], "build: README and images are not 'other files'", d["weeks"][0]["extra"])
    ok(d["weeks"][4]["exists"] and d["weeks"][4]["dir"] == "logs/week05", "build: week5 without _MMDD is found")

print(f"{'✓' if not failed else '✗'} {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
