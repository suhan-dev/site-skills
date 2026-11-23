#!/usr/bin/env python3
"""Build step for the References tab: references/README.md + references/papers.csv → dist/data/refs.json.

Put this file next to build.py and add it as a step (team-site-setup's skeleton):

    from build_refs import refs, check_refs
    STEPS = {"build": build_info, "refs": refs}
    IMAGE_DIRS = [ROOT / "references"]     # images in references/README.md
    # in check(): problems = check_refs(); print them and exit 1 if any

Or run it alone (the demo and the tests do this):

    python3 build_refs.py --root path/to/repo --out path/to/refs.json
    python3 build_refs.py --root path/to/repo --check      # lint the CSV and the link lists, exit 1 on a problem

papers.csv columns: group,title,authors,year,venue,doi,url,read_by,note (the source site called "group" "step"; both
work). Rows without a title are skipped. Standard library only.
"""
import argparse
import csv
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
COLUMNS = ["group", "title", "authors", "year", "venue", "doi", "url", "read_by", "note"]
LINK = re.compile(r"^[-*]\s+\[(.+?)\]\((\S+?)\)\s*(?:[—–-]\s*(.*))?$")
DOI = re.compile(r"^10\.\d{4,9}/\S+$")


def read(p):
    return p.read_text("utf-8-sig") if p.exists() else ""


def papers(root=HERE):
    out = []
    f = pathlib.Path(root) / "references" / "papers.csv"
    if f.exists():
        with f.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
                if row.get("title"):
                    out.append(row)
    return out


def refs(root=HERE):
    root = pathlib.Path(root)
    return {"papers": papers(root), "readme": read(root / "references" / "README.md")}


def check_refs(root=HERE):
    """Problems a reviewer would catch: missing columns, a DOI that is a URL, a PDF link, a link without its mark."""
    root = pathlib.Path(root)
    problems = []
    f = root / "references" / "papers.csv"
    if f.exists():
        with f.open(encoding="utf-8-sig", newline="") as fh:
            rd = csv.DictReader(fh)
            head = [h.strip() for h in (rd.fieldnames or [])]
            missing = [c for c in COLUMNS if c not in head and not (c == "group" and "step" in head)]
            if missing:
                problems.append(f"papers.csv: missing columns {', '.join(missing)}")
            for i, row in enumerate(rd, start=2):
                row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
                if not row.get("title"):
                    continue
                doi, url = row.get("doi", ""), row.get("url", "")
                if doi and not DOI.match(doi):
                    problems.append(f"papers.csv line {i}: doi should look like 10.xxxx/… (no https://doi.org/): {doi}")
                if not doi and not url:
                    problems.append(f"papers.csv line {i}: no doi and no url")
                if re.search(r"\.pdf($|\?)", url, re.I):
                    problems.append(f"papers.csv line {i}: links a PDF file; link the DOI or the publisher's page instead")
                if row.get("year") and not re.fullmatch(r"\d{4}", row["year"]):
                    problems.append(f"papers.csv line {i}: year should be four digits: {row['year']}")
    for n, line in enumerate(read(root / "references" / "README.md").splitlines(), start=1):
        m = LINK.match(line.strip())
        if not m:
            continue
        if re.search(r"\.pdf($|\?)", m.group(2), re.I):
            problems.append(f"README.md line {n}: links a PDF file: {m.group(2)}")
        if not re.search(r"\((verified|unverified)\)\s*$", m.group(3) or ""):
            problems.append(f"README.md line {n}: end the description with (verified) or (unverified): {m.group(1)}")
    for p in sorted((root / "references").rglob("*")) if (root / "references").exists() else []:
        if p.is_file() and p.suffix.lower() == ".pdf":
            problems.append(f"{p.relative_to(root)}: no PDFs in the repository (copyright)")
    return problems


def main():
    ap = argparse.ArgumentParser(description="Write refs.json from references/.")
    ap.add_argument("--root", default=str(HERE))
    ap.add_argument("--out", default=None, help="default: <root>/dist/data/refs.json")
    ap.add_argument("--check", action="store_true", help="only lint references/, exit 1 on a problem")
    a = ap.parse_args()
    if a.check:
        problems = check_refs(a.root)
        print("\n".join(problems) if problems else "references: ok")
        sys.exit(1 if problems else 0)
    out = pathlib.Path(a.out or pathlib.Path(a.root) / "dist" / "data" / "refs.json")
    data = refs(a.root)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", "utf-8")
    print(f"refs.json: {len(data['papers'])} papers, README {len(data['readme'])} characters → {out}")


if __name__ == "__main__":
    main()
