# References tab: decisions

Why the tab looks and works the way it does. Each entry is a before → after pair. The first group comes from the source
site's history (commit ids are from the private source repository); the second lists what changed when the tab became
this skill.

## From the source site

### Cards → hairline rows (23b4244)

- **Before:** links were a grid of white cards (`minmax(290px,1fr)`, 16 px radius, shadow, lift on hover); facts were
  boxed tiles (`minmax(210px,1fr)`); tasks were boxed cards; the contents column used grey pill highlights.
- **After:** every list is rows separated by 0.5 px rules: link rows with the host on the right, label · value fact
  rows, task rows with the number and name on the left, and a 2 px rule beside the contents entry being read.
- **Why:** boxes made a long page of mostly text look busy and pushed the eye from box to box. Rules keep one reading
  line and match the rest of the site.

### One "group" for every paper (f8aa765 → this skill)

- **Before:** the CSV had a `step` column; only values that matched `Step 0` … `Step 6` got a filter, the rest went
  to Other; the filter labels were rebuilt from a fixed list.
- **After:** any text in `group` is a topic; topics sort naturally with Other last, or in the order you pass.
- **Why:** a team's topics are not always numbered steps. `step` still works for old files.

### Phone jump row (853406c)

- **Before:** on phones the contents column was simply hidden; the only way to the reading list was a long scroll.
- **After:** a row of four jumps (Overview · Tasks · Links · Papers) sticks under the header, frosted like it, and a
  jump lands below both (`scroll-margin-top: 136px`).
- **Why:** the reading list is the part people come back to, and it is at the bottom.

### Contents follow the reading, desktop polish (f4f56e2)

- **Before:** the contents marked only the entry you clicked; section titles were as large as the page title; the
  topic filters were a row of buttons beside the search.
- **After:** the contents mark the section being read as you scroll; the contents text lines up with the page edge and
  the marker hangs in the margin; one large page title and 24 px section titles; prose at 68ch; the filters became a
  strip of tabs on the list's top rule, under the search and count.
- **Why:** a clicked mark is wrong as soon as you scroll. The new type scale shows one page with parts, not many pages.

### One tracker for both places (72b589e)

- **Before:** two scroll handlers: one for the contents (line 48 px under the header) and one for the jump row (24 px
  under the row, by entry). They could disagree at a section boundary.
- **After:** one function finds the current section and marks it in both; the jump row marks the last of its entries at
  or before that section.
- **Why:** one rule, one answer; half the scroll work.

## Changes made for this skill

| Before (source) | After (skill) | Why |
|---|---|---|
| `(unverified)` showed as "Inferred" | Shows as "Unverified" | The mark should say what the file says. `(inferred)` still reads as a guess. |
| Marks also in the team's own language, hard-coded | English marks only; add your words to `TAG_RE` and `tagOf` | Keeps the parser and the lint in step (they share one pattern; a test checks it). |
| Two advisors' names hard-coded and shown bold | `highlight: { names, label }` | Every team has different people to point out, or none. |
| Overview and Tasks always drawn | Optional: no `problem.json` (or `overviewUrl: null`) leaves them out, with their contents and jump entries | Not every team has a brief worth a page. |
| Project-specific eyebrow and titles in the code | `eyebrow` and `title` in `problem.json`; section words in `refs-strings.js` | Nothing about one project in the code. |
| Search box 15 px on phones | 16 px | iOS zooms the page in when a smaller text field gets focus. |
| Jump links 40 px tall | 44 px | The 44 px tap-target rule of the design system. |
| Only `.gitignore` kept PDFs out (`*.pdf`, lower case); marks and DOIs were checked by eye | `build_refs.py --check`: PDF files under `references/` in any case, links to `.pdf`, DOI written as a URL, rows with no DOI and no URL, years, unmarked links; `.gitignore` uses `*.[pP][dD][fF]` | Git matches ignore patterns case-sensitively on Linux, and a reviewer misses a missing mark. The check runs in the build, so it fails before the site ships. |
| Header height fixed at 82 px in the jump row rule | `--refs-bar-h` (default 82 px) | Other headers have other heights. |
| A language-change event with the site's own name | `site:lang` | The design system's name. |

## Rejected

- **A full-text search over notes:** notes are separate Markdown files; the reading list search covers the CSV only.
  Use the repository search for notes.
- **Showing a link's description as Markdown:** a link row is one plain line; Markdown and math belong in text
  sections.
- **Uploading PDFs to a private bucket:** still copying; the DOI is the stable link and every member can reach the
  publisher through the library.
- **A filter per reader (`read_by`):** the note line shows who read it; a filter would add a second row of chips on
  phones for little use.
