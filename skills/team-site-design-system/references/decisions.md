# Design decisions: before → after

From the source site's history (all in one week of November 2026). Each line: what it looked like, what it became,
and why.

| Before | After | Why |
|---|---|---|
| A first version with a password form and default styling | Apple-style system colours, light and dark, EN/KO, week calendar, a new sign-in page and link preview | The owner judged the first deployed look "graphically poor" and asked for a restrained, high-end look with good fonts. |
| Boxed cards with borders around every block | Hairline rows (`.card` = a rule on top), document layout | "No boxes": boxes made the site look like a template; hairlines read as a calm document. |
| Number pairs ("Week 3", "12/22 – 12/28") breaking across lines | `white-space: nowrap` on every label–number pair, `keep-all` for Korean | A pair split over two lines is misread. |
| A home "band": project line, four KPI tiles, a 10-week bar, a cell picture, "Replay intro" link | The calendar directly under the header; the site name replays the intro | The band pushed the calendar below the fold and repeated what the calendar shows. |
| Dark mode near black with bright lines | Apple greys (`#1c1c1e` / `#2c2c2e`) with fainter hairlines (`.07` / `.11` white) | Pure black with bright lines was harsh; Apple's dark greys are softer. |
| Tabs that ran under the header buttons at some widths | Three-column grid with `minmax(max-content,1fr)` sides; tabs move over instead of overlapping; small phones close up | Nothing in the header may ever overlap or be cut off. |
| Phone tap targets of 26–32 px | 44 px everywhere (real or invisible `::after`), tabs inside the page margins, fading edges on sideways strips | Apple's HIG minimum; teammates use phones. |
| Centred dialogs on phones that overlapped, panned sideways and zoomed on focus | Bottom sheets with their own vertical scroll, 16 px inputs, Start/End one row each | The event editor was unusable on iPhone. |
| Desktop tabs whose edges did not line up with the header | Rules and edges aligned with the header, a clearer type hierarchy, a reading measure, a contents column that follows the reading | Polish for desktop without changing phones. |
| "EN \| KO" as two buttons side by side | One language button that reads EN or KO (a tap switches), and a chat button with an unread dot after the theme button | Make room for the team chat without crowding the phone header. See `team-chat`. |

## Rejected

- Neon colours, glow and bloom.
- Status dashboards on the home page (KPI rows, progress bars).
- Decorative project motifs on the home page (the cell picture, header icon).
- A "Who are you?" picker once Google sign-in told the site who you are.
- Helper text under controls that only repeats the label.
