# Decisions, and what was tried first

Mined from the source site's git history (all in November 2026) and its specs. "Before → after" where the design changed.

## Why there is a reader page at all

- The Theory tab lives inside the app: 15 px text, a 208 px chapter list, the site header on top. Fine for looking
  something up, tiring for a 30-minute read.
- The reader is the same chapter as a document: 17 px at a 72-character measure, the outline beside it, print styles,
  and its own address that can be shared or bookmarked (`/theory/heat/h1-…#eq-H1.4`).
- One renderer (`chapter.js`) serves both, so a number in the tab is the same number in the reader and on paper.

## Numbering is the site's job

- With hand numbering, inserting a section means renumbering everything below it and every "Eq. (3.4)" in the text.
  So the site numbers `##`/`###` (L.1, L.1.1), equations from `\tag` or `\label`,
  and figures in order, and turns `\eqref` into links.
- Labels come from file names (`b3-…` → B3 in the source, `h1-…` → H1 here), so numbers read "B3.4", unique across
  the whole book, and a reference to another chapter's equation needs no lookup table.
- Hand-numbered headings are still respected ("## 3.1 …"): the source's own chapters were written that way, with a
  stricter checker that forbade `\label`/`\ref`/`\eqref` and required explicit `\tag{B3.4}` numbers, so the plain
  text "Eq. (B3.4)" always matched. This skill's checker allows labels and references and verifies they resolve.

## Timeline (before → after)

1. **Theory tab first (Nov 17).** Sub-tabs from `theory/sections.json`, chapters named `NN-slug.md`.
   → Same day: letter labels (`b3-…`), so numbers are unique across parts.
2. **The first reader (Nov 17).** `/theory/<part>/<chapter>`, numbered sections, equations and figures, in-site
   chapter links. Its contents listed **only this chapter's sections**; the side column was 188 px
   (`minmax(188px, 1fr)`), the list 232 px; on phones the outline folded into a disclosure under the title;
   h2 was 23 px / 650 with 56 px above.
3. **Long captions (Nov 17).** A paragraph starting with `*Figure B1.1.*` after an image becomes the caption, math
   kept, number shown once. Before, captions were alt text only, which cannot hold math.
4. **Unpublished chapters (Nov 17).** Links to chapters not written yet showed as dead links → grey text with
   "Not published yet", live as soon as the chapter exists.
5. **Phones: 44 px targets and fading edges (Nov 17).** Everything tappable at least 44 px; sideways strips fade at
   the edge that has more.
6. **Lazy sections (Nov 21).** Long chapters were slow to open on phones → the text is cut into sections with
   `content-visibility: auto` and an estimated height fitted to real heights; about 3× faster to open. The scroll-spy
   was changed in the same commit to measure **sections, not headings**: measuring a heading inside a skipped section
   forced the browser to lay it out.
7. **The reader grows up (Nov 23).**
   - Contents: only this chapter → **every part (I–IV) with its chapter range**, this chapter unfolded into its
     sections and the section being read into its subsections. Side column 188 → 220 px minimum, list 232 → 264 px.
   - Phones: a disclosure under the title → **a sticky bar** that always names the section being read and opens the
     same contents as a sheet.
   - Headings: h2 23 px / 650 → **26 px / 700**, margins 56 / 28 → **64 / 32** (phones 20 → 21.5 px, 44 / 22 → 52 / 24).
   - Wide formulas: the number sat on top of the formula on phones → **the formula scrolls on its own and its number
     moves to the line under it** (fitWide).
   - Place: the reader always opened at the top → **"Open in reader" opens at the section being read**, and each
     chapter **resumes where reading stopped**, in the tab or the reader (one key for both).
   - Parts: the part is named above the title, and previous / next say **"Previous part" / "Next part"** with the
     part's name when they cross into another part.
8. **Phones: parts fit by short names (Nov 23).** Four long sub-tab names scrolled sideways → `short` names in
   `sections.json`, spread edge to edge, nothing to scroll.
9. **Desktop polish (Nov 23).** "Open in reader" moved from beside the title to the eyebrow line at the right, so a
   long title keeps the full width; the current chapter's label turns ink too.

## Rules that came from use

- **No boxes.** The site's brief: Apple-restrained, document-like, hairlines instead of cards. The reader has no card
  background, no shadow and no rounded panel anywhere; code and quotes are a thin left rule.
- **72ch, not a pixel width.** The measure follows the text size, so it stays about 70 characters if the size changes.
- **Numbers are grey.** Section, equation and figure numbers are `--ink4` (figure "Figure H1.1." is the exception, 600
  ink, because it starts a sentence).
- **The reading line is not the top of the window.** 140 px on wide screens, 104 px on phones: what you are reading
  is a little below the top edge, and the bar covers the top on phones.
- **The top of a chapter is not a place.** Scrolling back to the top removes (reader) or keeps the previous (tab)
  place, so going back up to press "Open in reader" never erases where you were.
- **The first 600 ms are not reading.** The jump to a kept place would otherwise save itself.
- **`/reader`, not `/reader.html`.** Cloudflare Pages answers `*.html` with a redirect to the address without it;
  fetching `/reader.html` through `env.ASSETS` would send the browser to `/reader` and lose the chapter address.
- **Figures are black on transparent** so one file works on screen in both themes (inverted in dark) and on paper.
- **Print is a real output.** A4, 18 mm margins, 11 pt, no controls, no splitting of equations, figures or tables.

## Changes made in this skill (not in the source)

- Reduced motion turns off the jump flash, the chevron turn and the tab's smooth scroll (the source had no rule).
- The site name comes from `<meta name="application-name">`, the theme key is the design system's `site_theme`, and
  the place key is `rd_at` (the source used its own prefixed keys).
- `repo`, `branch`, `root` and `base` travel in `theory.json` instead of a separate team file, so the reader makes one
  request. Without a repository, links to non-chapter files become `#` instead of a broken GitHub address.
- The dark `theme-color` is the dark paper (`#1c1c1e`) instead of black.
