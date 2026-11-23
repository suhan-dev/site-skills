# Behaviour: data, numbering, navigation, place

How the reader and the Theory tab work, in the order a chapter travels: file → build → JSON → numbered HTML → page.
Code: [`assets/site/js/`](../assets/site/js/).

## 1. Data

`build_theory.py` reads the chapters folder and writes one file, `data/theory.json`:

```json
{
  "root": "theory", "base": "/repo/", "repo": "owner/name", "branch": "main",
  "sections": [
    { "id": "heat", "title": "Heat and Diffusion", "short": "Heat",
      "chapters": [ { "id": "h1-heat-flow-in-a-rod", "label": "H1", "no": 1,
                      "title": "Sample chapter: Heat flow in a rod", "md": "…Markdown without the # title line…" } ] }
  ]
}
```

- `sections` are the parts, in the order of `sections.json`. A part's chapters are in natural file-name order (`h2` before `h10`).
- `label` comes from the file name (`h1-…` → `H1`, `01-…` → `1`). The title is the first `# ` line without the label.
- `root` is the chapters folder's path in the repository. Relative links are resolved against `root/<part>`.
- `base` is where the figures are served. The build copies every image under the folder to `<out><base><root>/…`.
- `repo` / `branch` (optional) turn links to other repository files into GitHub links. Without them those links are `#`.
- The whole chapter text ships in the JSON. For a few dozen chapters this is
  one request with simple caching (`cache: "no-cache"`, so a deploy shows at once). Split it per part if it grows past a few MB.

## 2. Numbering (chapter.js)

`renderChapter(data, part, chapter, { mode })` returns `{ html, outline }`. Steps:

1. **prep** (Markdown source, before marked): splits out code first (no math or references inside code).
   - Collects every explicit `\tag{…}` so an automatic number never repeats one.
   - For each display formula: keeps its `\tag`s; removes `\label{key}` (KaTeX has none); if it had a label but no tag,
     appends `\tag{L.n}` with the next free n after the highest own number so far.
   - Maps each label key to its number.
   - Replaces `\eqref{key}` / `\ref{key}` in text (and `$\eqref{key}$` written as math) with a placeholder link
     `<a class="xref" data-kind data-ref>`. References inside other inline math are left to KaTeX.
2. **renderMd** (md.js): math out → marked (GFM) → math back as KaTeX HTML. Relative links and images are rewritten
   (see §5). External `http(s)` links get `target="_blank" rel="noopener"`.
3. **numberHeadings**: every h2 and h3 gets a GitHub-style id (lower case, punctuation dropped, spaces → hyphens,
   repeats `-1`, `-2`). If no heading starts with a hand-written number, h2 gets `L.a` and h3 `L.a.b`. If any does
   ("## 3.1 …", "## 1. …"), nothing is added and the written number is moved into the same quiet `<span class="hn">`.
   The outline is collected here: `{ level, id, num, html }`.
4. **numberEquations**: each tagged `.katex-display` gets `id="eq-<number>"` (spaces and zero-width spaces removed).
   An `align` with several tags gets one empty `<span class="eq-anchor" id>` per extra row. A hidden copy of the
   number (`.eq-n`) goes after each formula, for the wide-formula layout.
5. **numberFigures**: a paragraph that holds only an image becomes `<figure>` with the alt text as caption. If the next
   paragraph starts with italic `*Figure L.n.*`, that paragraph (math included) becomes the caption instead and the
   alt text stays on the image. Every `<figure>` (also hand-written ones) is numbered `L.1, L.2 …` in order, gets
   `id="fig-L.n"` and "Figure L.n." in front of its caption. A figure can be referred to as `fig:<image file stem>`
   or by its original `id` (`<figure id="fig:o1-regimes">`). A caption that says another number logs a console warning.
6. **resolveRefs**: each placeholder becomes a link. Lookup order: a label key of this chapter; a figure key; an
   equation number of this chapter (`H1.4`); an equation number of another chapter, found by its label (letter labels
   are unique; number labels prefer the same part). `\eqref` prints `(H1.4)`, `\ref` prints `H1.4` (and figures never
   get brackets). Anything else becomes `<span class="xref bad">(??)</span>`.
7. **sectionize**: the text is cut into `<section class="cs">` at every h2 and h3. Each section carries
   `--t` (text length without KaTeX's hidden MathML), `--e` (display formulas), `--f` (figures) and `--r` (table rows)
   for the CSS height estimate.

`mode: "reader"` makes chapter links `/theory/<part>/<chapter>#anchor`; `mode: "tab"` makes them `#theory/<part>/<chapter>`
(the tab drops the anchor: a chapter opens at its top there).

## 3. Lazy layout

`content-visibility: auto` lets the browser skip layout and paint for sections far from the screen. The source site
measured long chapters opening about 3× faster on phones. Two rules keep it correct:

- **Never measure inside a section to find where the reader is.** `sectionAt(root, line)` reads only the sections'
  own boxes, which are known from the estimates without laying out their content. Measuring a heading inside a
  skipped section would force its layout and undo the gain.
- **fitWide** measures a formula only when its section is laid out (`checkVisibility({ contentVisibilityAuto: true })`),
  through a `ResizeObserver` that fires when the section comes near the screen.

## 4. Wide formulas (fitWide)

- Watches every `.katex-display`, `table` and `pre` with one `ResizeObserver`.
- A formula is wide when `formula width + 2 × number width + 16 > column width + 0.5`. The number's width is measured
  once, before the formula ever goes wide, so switching does not change the answer (no flicker).
- Wide: class `wide` (left-aligned, own number hidden, `.eq-n` shown under it).
- Anything that can scroll sideways gets `sx`, plus `sx-l` / `sx-r` while there is more to see on that side. A capture
  `scroll` listener on the text updates them; CSS fades that edge.
- Returns a function that stops watching. The tab calls it before drawing the next chapter.

## 5. Links and images

| In the Markdown | Becomes |
|---|---|
| `![alt](figures/x.svg)` | `<base><root>/<part>/figures/x.svg` (the build's copy) |
| raw `<img src="figures/x.svg">` | the same (rewritten in numberFigures) |
| `[text](../oscillations/o1-damped-oscillators.md#the-three-regimes)` | reader: `/theory/oscillations/o1-damped-oscillators#the-three-regimes`; tab: `#theory/oscillations/o1-damped-oscillators` |
| `[text](h3-radiation.md)` with no such chapter | `<span class="soon" title="Not published yet">text</span>` |
| `[text](../../code/run.py)` | `https://github.com/<repo>/blob/<branch>/code/run.py` (or `#` without a repo) |
| `[text](https://…)` | opens in a new tab |

## 6. The reader page (reader.js)

1. Reads `/theory/<part>/<chapter>` from the address (decoded, NFC) and finds the chapter (exact id, then
   case-insensitive). Unknown → "Chapter not found."; no JSON → "Couldn't load the chapters."
2. Renders it, builds the contents twice (side list and phone sheet, same markup), the title block, the section bar
   and previous / next across all parts (`allChapters`).
3. Title: `H1 · Chapter title · Site name`. Crumbs get the part. The back link and the part line point to the tab
   (`/#theory/<part>/<chapter>`). A click on the back link uses `history.back()` when the previous page was the
   site's main page in this tab, so the reader returns to the very spot.
4. `fitWide` on the text, then the phone bar.
5. **Where to open**: the address's `#id` if it exists (`location.replace(hash)` so the browser scrolls with
   `scroll-margin`); else the kept place of this chapter; else the top.
6. **Scroll-spy**: on scroll, at most once per animation frame, finds the section at the reading line and marks it in
   both lists (`.on`, `aria-current="location"`), opens its h2's subsection list, keeps it in view in the side list,
   and writes it into the bar.

### The reading line

The line where the reader's eye is assumed to be:

- Reader, wide screens: 140 px from the top of the window.
- Reader, phones: 48 + 56 = 104 px (the bar plus a line of text).
- Theory tab: the bottom of the site header plus a quarter of the space under it.

## 7. Keeping the place

- Key `rd_at` in `localStorage`: `{ "<part>/<chapter>": { id, f, t } }`. `id` is the heading id of the section at the
  reading line (`""` for the text before the first heading), `f` how far into that section the line is (0–1, 3
  decimals), `t` the time. The 60 most recent chapters are kept. Every read and write is in `try/catch` (private
  windows work, they just forget).
- **Reader**: saved 400 ms after scrolling stops, on `pagehide`, and when the tab is hidden. Not in the first 600 ms
  (the jump at load is not reading). Scrolled back to the top (`scrollY < 80`), the entry is removed: there is nothing
  to come back to.
- **Tab**: saved 700 ms after scrolling stops, only while a section is at the line. Scrolling back up to the chapter
  title keeps the old place, so "Open in reader" from the top still resumes where reading stopped.
- **Going back**: `goTo(section, f)` scrolls so that fraction `f` of the section sits at the reading line, then does it
  again two animation frames later, after the lazy sections around it have been laid out.

## 8. "Open in reader" (theory-tab.js)

- Two links: next to the title, and under the chapter list on wide screens.
- Just before the link is followed (`pointerdown`, `click`, `auxclick`, `contextmenu`, `focusin`, in the capture phase),
  its `href` is set to the reader address plus `#<id of the section at the reading line>`. So a click, a middle click,
  a long press and "Copy link" all get the section being read. At the top of the chapter there is no hash, and the
  reader resumes from the kept place.
- Wide screens: a new tab (`target="_blank" rel="noopener"`). Phones (≤ 760 px) and the installed Home Screen app
  (`display-mode: standalone` or `navigator.standalone`): the same window; the reader's back link returns.

## 9. Phone bar and sheet

See [design.md §4](design.md#4-phones-the-section-bar-and-the-contents-sheet) for the look. Behaviour: one button
toggles the sheet (`aria-expanded`), the scrim and a link close it, Esc closes it and returns focus to the button,
and a resize past 760 px closes it. The sheet is a `<nav aria-label="Contents">`, the same markup as the side list.

## 10. Light, dark, print

- Theme: the inline head script applies the saved choice before paint; the button toggles and saves; a `storage`
  event from the main site's tab applies at once; a system change repaints the button state.
- Print: the Print button calls `window.print()`. Everything else is CSS (design.md §5).

## 11. Routing

- Production: `lib/reader-route.js` (called from `functions/_middleware.js`) answers `GET` / `HEAD` for `/theory/<a>/<b>` (no dot in `<b>`) with
  `env.ASSETS.fetch("/reader")`. Not `/reader.html`: Cloudflare Pages redirects `*.html` to the address without it,
  which would change the address and lose the chapter.
- Behind a sign-in gate, call `readerRewrite()` only for signed-in requests. A signed-out visitor gets the sign-in page
  first, and the gate's `next` brings them back to the chapter (google-signin-team-gate does this).
- Figures under `/repo/theory/…/x.svg` and the `.md` sources have a dot in the last part, so they never match.
- Demo: `assets/demo/serve.mjs` does the same rewrite in Node.

## 12. Accessibility

- Contents: `<nav aria-label="Contents">`; current chapter `aria-current="page"`; section being read
  `aria-current="location"`. Parts are `<details>`/`<summary>`, so they open with the keyboard.
- Prev / next: `<nav aria-label="Previous and next chapter">`, `rel="prev"` / `rel="next"`.
- The article is `aria-busy` until the chapter is in.
- Equation numbers copied under wide formulas are `aria-hidden` (KaTeX's MathML already carries the tag).
- Every tap target on phones is at least 44 px.
