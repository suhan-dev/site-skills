#!/usr/bin/env python3
"""Offline tests for the References build step and its lint (build_refs.py).

    python3 tools/test_refs.py        (Python 3.9+, standard library only)

Run it from the skill's assets/ folder or from a project that copied the files: it looks for build_refs.py next to this
file or one folder up. When the skill's demo is there, it also checks that demo/data/refs.json is up to date.
"""
import contextlib
import importlib.util
import io
import json
import pathlib
import sys
import tempfile

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
    sys.exit(f"{name}.py not found next to {HERE} or in {UP}")


B = load("build_refs", HERE, UP)
HEAD = "group,title,authors,year,venue,doi,url,read_by,note\n"
README_OK = "# references\n\n## Project links\n- [Course page](https://example.edu/c) — the brief. (verified)\n"


def repo(csv=None, readme=None, files=()):
    """A throwaway repository with references/papers.csv and references/README.md."""
    d = pathlib.Path(tempfile.mkdtemp())
    (d / "references").mkdir()
    if csv is not None:
        (d / "references" / "papers.csv").write_text(csv, "utf-8")
    if readme is not None:
        (d / "references" / "README.md").write_text(readme, "utf-8")
    for f in files:
        p = d / f
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"%PDF-1.4\n")
    return d


def problems(**kw):
    return B.check_refs(repo(**kw))


def has(ps, *words):
    return any(all(w in p for w in words) for p in ps)


# ---------- papers(): parsing ----------
d = repo(HEAD + 'Task 1,A title,"A. One, B. Two",2021,Journal 1,10.0000/a.1,,alex,a note\n'
         ",,No title here,2020,,,,,\n"
         " Task 2 , Spaced title , C. Three ,2019,J2,10.0000/b.2,,,\n", README_OK)
ps = B.papers(d)
ok(len(ps) == 2, "rows without a title are skipped", str(len(ps)))
ok(ps[0]["authors"] == "A. One, B. Two", "a quoted field keeps its comma", ps[0]["authors"])
ok(ps[1]["group"] == "Task 2" and ps[1]["title"] == "Spaced title", "cells are trimmed", repr(ps[1]))
ok(set(ps[0]) == set(B.COLUMNS), "every row has the nine columns", str(sorted(ps[0])))

d = repo("﻿" + HEAD + "Task 1,BOM title,A. One,2021,J,10.0000/a.1,,,\n")
ok(B.papers(d)[0].get("group") == "Task 1", "a byte-order mark (Excel's UTF-8 CSV) is ignored", repr(B.papers(d)[0]))

d = repo("step,title,authors,year,venue,doi,url,read_by,note\nStep 2,Old header,A. One,2021,J,10.0000/a.1,,,\n")
ok(B.papers(d)[0].get("step") == "Step 2", "the old column name step is kept as it is")
ok(not has(B.check_refs(d), "missing columns"), "the lint accepts step in place of group", str(B.check_refs(d)))

ok(B.papers(repo()) == [], "no papers.csv → no papers")
r = B.refs(repo())
ok(r == {"papers": [], "readme": ""}, "no files → an empty refs.json, not an error", repr(r))
r = B.refs(repo(HEAD, "# references\n\nWith ünïcode — and a dash.\n"))
ok("ünïcode — and" in r["readme"], "README.md is passed through as it is (UTF-8)")

# ---------- check_refs(): the lint ----------
ok(problems(csv=HEAD + "Task 1,T,A,2021,J,10.0000/x.1,,,\n", readme=README_OK) == [], "a clean repository has no problems",
   str(problems(csv=HEAD + "Task 1,T,A,2021,J,10.0000/x.1,,,\n", readme=README_OK)))
ok(has(problems(csv="title,authors,year\nT,A,2021\n"), "missing columns", "group", "doi"), "missing columns are named")
ok(has(problems(csv=HEAD + "T1,T,A,2021,J,https://doi.org/10.0000/x.1,,,\n"), "line 2", "doi should look like"),
   "a DOI written as a URL is caught, with its line")
ok(has(problems(csv=HEAD + "T1,T,A,2021,J,doi:10.0000/x.1,,,\n"), "doi should look like"), "a doi: prefix is caught")
ok(not problems(csv=HEAD + "T1,T,A,2021,J,10.1103/PhysRevB.12.345,,,\n"), "a real-looking DOI passes")
ok(has(problems(csv=HEAD + "T1,T,A,2021,J,,,,\n"), "no doi and no url"), "a row with neither DOI nor URL is caught")
ok(not problems(csv=HEAD + "T1,T,A,2021,J,,https://example.org/paper,,\n"), "a URL alone is enough")
ok(has(problems(csv=HEAD + "T1,T,A,2021,J,,https://example.org/paper.PDF,,\n"), "links a PDF"), "a URL to a .pdf is caught")
ok(has(problems(csv=HEAD + "T1,T,A,2021,J,,https://example.org/p.pdf?dl=1,,\n"), "links a PDF"), "…also with a query")
ok(has(problems(csv=HEAD + "T1,T,A,21,J,10.0000/x.1,,,\n"), "year should be four digits"), "a two-digit year is caught")
ok(not problems(csv=HEAD + "T1,T,A,,J,10.0000/x.1,,,\n"), "a blank year is allowed")
ok(not problems(csv=HEAD + ",,,,,,,,\n"), "a row without a title is not linted")

ok(has(problems(readme="## L\n- [Page](https://example.org/) — what it is.\n"), "README.md line 2", "(verified)"),
   "a link without (verified) or (unverified) is caught, with its line")
ok(not problems(readme="## L\n- [Page](https://example.org/) — what it is. (unverified)\n"), "(unverified) passes")
ok(not problems(readme="## L\n* [Page](https://example.org/) – what it is. (verified)\n"), "* bullets and an en dash pass")
ok(has(problems(readme="## L\n- [Page](https://example.org/a.pdf) — x. (verified)\n"), "links a PDF file"),
   "a README link to a .pdf is caught")
ok(not problems(readme="## L\nSome text with [a link](https://example.org/) in it.\n"), "links inside text are not linted")
ok(has(problems(readme=README_OK, files=["references/notes/paper.pdf"]), "no PDFs in the repository"),
   "a PDF file under references/ is caught")
ok(has(problems(readme=README_OK, files=["references/a/b/c/Deep.PDF"]), "Deep.PDF", "no PDFs"),
   "the PDF scan runs in subfolders and ignores the case of .PDF")
ok(problems() == [], "an empty references/ folder has no problems")

# ---------- the command line ----------
d = repo(HEAD + "T1,T,A,2021,J,10.0000/x.1,,,\n", README_OK)
out = d / "dist" / "data" / "refs.json"
sys.argv = ["build_refs.py", "--root", str(d)]
with contextlib.redirect_stdout(io.StringIO()) as s:
    B.main()
ok(out.exists() and json.loads(out.read_text("utf-8"))["papers"][0]["title"] == "T", "--root writes dist/data/refs.json")
ok("1 papers" in s.getvalue(), "it says how many papers it wrote", s.getvalue())
sys.argv = ["build_refs.py", "--root", str(repo(HEAD + "T1,T,A,2021,J,,,,\n")), "--check"]
code = None
with contextlib.redirect_stdout(io.StringIO()):
    try:
        B.main()
    except SystemExit as e:
        code = e.code
ok(code == 1, "--check exits 1 on a problem", str(code))
sys.argv = ["build_refs.py", "--root", str(d), "--check"]
with contextlib.redirect_stdout(io.StringIO()) as s:
    try:
        B.main()
    except SystemExit as e:
        code = e.code
ok(code == 0 and "references: ok" in s.getvalue(), "--check exits 0 and says ok when clean", s.getvalue())

# ---------- the skill's own demo (only when it is there) ----------
demo = UP / "demo"
if (demo / "references" / "papers.csv").exists():
    ok(B.check_refs(demo) == [], "the demo passes the lint", str(B.check_refs(demo)))
    built = B.refs(demo)
    saved = json.loads((demo / "data" / "refs.json").read_text("utf-8"))
    ok(saved == built, "demo/data/refs.json is up to date (python3 ../build_refs.py --root . --out data/refs.json)")
    ok(len(built["papers"]) >= 6, "the demo has enough papers to show the filters", str(len(built["papers"])))
    tpl = B.check_refs(UP)
    ok(tpl == [], "the templates in references/ pass the lint", str(tpl))

print(f"{'✓' if not failed else '✗'} {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
