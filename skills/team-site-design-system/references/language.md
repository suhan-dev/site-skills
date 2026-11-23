# Language rules (EN / KO)

The site is English by default. A second language (Korean in the source team) is one click away in the header. These
rules kept the two from drifting apart.

## What switches and what does not

| Area | EN mode | KO mode |
|---|---|---|
| Sign-in page, intro | English | English |
| Header (tabs, buttons, tooltips) | English | English |
| Main screen (Calendar tab, its dialogs, the status line) | English | English |
| Content tabs (Research log, References, Theory) — UI strings | English | Korean on the source site; the skills ship English tables only (`rec-strings.js`, `refs-strings.js`, `theory-tab.js`) with a place to add a KO table |
| Content itself (logs, notes, chapters) | as written (English, by the repo rule) | as written |
| Terms and proper names (technical terms, a company's name, a simulator's name …) | English | English |

Mark a fixed section with `data-lang-fixed`; `i18n.js` then uses the English table inside it whatever the language.

## How strings are organised

- One object with two tables, `D.en` and `D.ko`, the same keys in the same order, side by side in one file, so a missing
  translation is visible in review. `check()` returns keys missing from either table.
- Markup carries keys, never text that code later replaces by hand:
  `data-i18n` (textContent), `data-i18n-html` (trusted markup with `<b>`), `data-i18n-title`, `data-i18n-ph`
  (placeholder), `data-i18n-aria`.
- Placeholders in strings use `{name}`: `t("wk.tip", { n: 3, a: "12/22", b: "12/28" })`.
- Dates and weekdays are formatted by small helpers per language (`dows`, `dShort`, `monthTitle`), not by
  `toLocaleString` (its output differs by browser). One exception: the calendar's "Synced 2:20 PM" note uses
  `toLocaleTimeString("en-US")` (`cal-util.js`), which is fixed to English like the rest of the Calendar tab.
- The choice is saved in `localStorage` (`site_lang`) and applied before first paint (`<html lang>`), and a
  `site:lang` event lets each tab re-render.

## Writing UI text

- One to three words for labels and buttons ("New event", "Open in reader", "Not now").
- Sentence case. No trailing full stops on labels; full stops on sentences.
- Say what happens, not how it works ("Changes go straight to Google Calendar").
- No helper text that repeats the label.
- Errors say what to do next ("Add a title.", "The end time is before the start.").
- Korean strings keep English terms in English and break only between words (`word-break: keep-all`).
