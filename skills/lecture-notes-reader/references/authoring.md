# Writing a chapter

For the people (or agents) who write the lecture notes. The site numbers everything; you write plain Markdown with
KaTeX. The three sample chapters in [`assets/demo/theory/`](../assets/demo/theory/) use every feature below.

## Folder and file names

```
theory/
├── sections.json                    the parts, in order
├── heat/                            one folder per part (its id)
│   ├── h1-heat-flow-in-a-rod.md     one file per chapter: <label>-slug.md, lower case
│   ├── h2-cooling-of-a-small-body.md
│   └── figures/h1-profiles.svg      that part's figures
└── oscillations/
    └── o1-damped-oscillators.md
```

`sections.json`:

```json
[
  { "id": "heat", "title": "Heat and Diffusion", "short": "Heat" },
  { "id": "oscillations", "title": "Oscillations" }
]
```

- `id` is the folder name and appears in addresses (`/theory/heat/…`). Renaming it breaks old links.
- `title` is the tab name and the part name in the reader. `short` (optional) is the tab name on phones; give one
  to every part whose title is long, so all tabs fit a 375 px screen.
- **Label.** A letter and a number (`h1-…` → `H1`), or a plain number (`01-…` → `1`). A letter label is used once
  in the whole folder; a number label once per part. Equation numbers and cross-chapter references rely on that.
- Chapters sort by name with numbers read as numbers: `h2` before `h10`, `h0` first.
- No dots in a chapter file name apart from `.md`: the reader address `/theory/<part>/<chapter>` must not look like a file.
- `python3 build_theory.py --check` fails on a broken folder (unlisted folder, listed folder missing, repeated label,
  dotted name, no title).

## The title

The first line is `# H1. Chapter title`. The site drops the label and shows it on its own: "H1 · Chapter title" in
lists, a grey "H1" before the big title. Any of `.` `:` `·` `—` `–` `-` (or a space after a letter label) may follow the label.

## Sections

- `##` sections and `###` subsections are numbered by the site: H1.1, H1.1.1. **Do not number them yourself.**
- If you prefer your own numbers (`## 0. Assumptions`, `## 3.1 …`), write them in every heading: as soon as one heading
  starts with a number, the site adds none and shows yours in the same grey style. Unnumbered headings ("## Key
  results", "### Worked example …") then stay unnumbered.
- `####` is allowed for small run-in headings; it is not numbered and not in the contents.
- Every heading gets a GitHub-style anchor: `## Fourier's law` → `#fouriers-law`. These anchors appear in addresses
  (`/theory/heat/h1-heat-flow-in-a-rod#fouriers-law`), so changing a heading changes its links.

## Math

KaTeX: `$…$` inline, `$$…$$` for display.

| You write | You get |
|---|---|
| `$$ q = -k\,\partial_x T \tag{H1.1} $$` | the number (H1.1) at the right, anchor `#eq-H1.1` |
| `$$ … $$` with no `\tag` and no `\label` | no number |
| `$$ … \label{eq:heat} $$` with no `\tag` | the next free number of the chapter, never one a `\tag` already uses |
| `\eqref{eq:heat}` in the text | "(H1.3)", a link to the equation |
| `\ref{eq:heat}` | "H1.3", a link |
| `\eqref{H1.1}` | a link to the equation tagged H1.1 in this chapter |
| `\eqref{H1.6}` in chapter O1 | a link to equation H1.6 in chapter H1 (another part works too) |
| `\ref{fig:h1-profiles}` | "H1.1", a link to the figure whose image file is `h1-profiles.svg` |
| `\begin{align} a \tag{O1.2} \\ b \tag{O1.3} \end{align}` | one number per tagged row; rows without a tag have none |

Rules (the checker enforces them):

- Inline math stays on one line, with no space just inside the dollars (`$x$`, not `$ x $`). A `$` followed by a digit
  does not close math. Write a literal dollar sign as `\$`.
- Display math: `$$` starts at column 0 with a blank line before it. Not inside a list item, a table or a quote.
- Write references in the text, outside `$…$`. `$\eqref{x}$` alone also works.
- Number equations in reading order. Explicit tags and automatic numbers share one sequence, so keep tags increasing.
- Each formula is rendered on its own: no `\newcommand`. Prefer plain KaTeX (`\frac{d}{dx}`, `\mathrm{}`) to package macros.
- A formula wider than the column is fine. On a narrow screen it scrolls sideways and its number moves under it.

## Figures

Figures are SVG files in the part's `figures/` folder: black lines and text on a transparent background. In dark mode
the site inverts them; on paper they print as drawn. Name them `<label>-slug.svg`.

Put the image alone in its own paragraph. The alt text is the caption:

```markdown
![Temperature along the rod at three times](figures/h1-profiles.svg)
```

The site shows "Figure H1.1. Temperature along the rod at three times" under the picture (anchor `#fig-H1.1`).

A caption with math, or longer than a line, goes in the paragraph right after the image, starting with the figure's
number in italics. The site moves that paragraph under the picture, drops your "Figure H1.1." and shows its own.
The alt text stays on the image as a short title for screen readers. Number figures in reading order so yours match:

```markdown
![Temperature along the rod at three times](figures/h1-profiles.svg)

*Figure H1.1.* Temperature along the rod. At $t = 0$ (dashed) the inside is uniform …
```

An inline `<svg>` inside `<figure>…</figure>` with a `<figcaption>` is numbered the same way. Keep blank lines out of
the figure, give the `<svg>` a `viewBox` and a `width`, and colour it with the design system's tokens so it follows
light and dark. Give the figure an `id` if you want to refer to it:

```html
<figure id="fig:o1-regimes">
<svg viewBox="0 0 520 220" width="520" role="img" aria-label="Displacement against time">
  <path d="M40 110H500" stroke="var(--ink4)"/>
  <path d="M40 30C80 30 110 96 160 106S300 110 500 110" fill="none" stroke="var(--accent)" stroke-width="2"/>
</svg>
<figcaption>Displacement after a release from rest.</figcaption>
</figure>
```

- Lines and text: `stroke="var(--ink)"`, `fill="var(--ink2)"`. Light lines: `var(--ink4)` or `var(--sep2)`. Highlights: `var(--accent)`.
- Keep SVG text at least 15 units high in a 520-wide `viewBox`: on a 390 px phone it shrinks to about 60 %.

## Links between chapters

Link to the other chapter's file, relative to this one:

```markdown
the [overdamped oscillator](../oscillations/o1-damped-oscillators.md#the-three-regimes)
a small body is treated in [H2](h2-cooling-of-a-small-body.md)
```

The site keeps these inside the site: in the reader they open the reader (with the anchor), in the tab they switch the
tab. A link to a chapter that does not exist yet shows as grey text and starts working once the chapter is published.
Links to other files in the repository go to GitHub when the build knows the repository (`--repo owner/name`).

## Other Markdown

GitHub-flavoured Markdown: tables (inline math only inside), lists, task lists, code blocks, blockquotes, `---`. In the
reader, code blocks and quotes are a thin rule on the left, with no box. Raw HTML other than `<figure>`/`<svg>` is
allowed by the renderer but best avoided.

## Checking a chapter

```bash
bash assets/fetch-vendor.sh                           # once: the pinned KaTeX the checker renders with
node assets/check_chapters.mjs theory                 # every chapter of the folder
node assets/check_chapters.mjs theory/heat/h1-heat-flow-in-a-rod.md --require "## Key results"
python3 assets/build_theory.py --src theory --out dist --check
```

`check_chapters.mjs` renders every formula with the site's KaTeX and reports, with line numbers: KaTeX errors, stray
`$`, display math inside a list or paragraph, a `\tag` used twice or belonging to another chapter, numbers out of
order, references that would show `(??)`, a missing or extra title line, a title without its label, missing images,
math in alt text, a `*Figure L.n.*` caption with the wrong number, and missing required sections. A chapter is ready
when it reports 0 issues. The demo chapters pass:

```
demo/theory/heat/h1-heat-flow-in-a-rod.md: 594 words, 6 numbered equations, 1 figures, 0 issue(s)
demo/theory/heat/h2-cooling-of-a-small-body.md: 178 words, 3 numbered equations, 0 figures, 0 issue(s)
demo/theory/oscillations/o1-damped-oscillators.md: 381 words, 5 numbered equations, 1 figures, 0 issue(s)
```

## Style

- Short, plain sentences. One idea per paragraph.
- Say what is assumed at the start ("Assumptions and symbols"), and end with "Key results".
- Mark a schematic figure as such in its caption ("schematic, not to scale").
- Put numbers that come from a calculation in a script next to the chapter, and say so; do not compute them by hand.
