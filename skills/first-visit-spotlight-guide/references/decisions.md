# Decisions, and what was tried first

From the source site's spec for the guide (November 2026), its git history and the earlier project it was modelled on.
"Before → after" where the design changed.

## Where it came from

The owner asked for a tour "only on a teammate's real first visit, after they've logged in and we know who they are",
explaining that the calendar is linked to their school account and how the site works, "popup feel", modelled on the
tutorial of an earlier game-like project. That tutorial had the right mechanics and the wrong look for a quiet,
document-like team site.

| Kept from the earlier tutorial | Changed for this site |
|---|---|
| A spotlight over the **real** page: a dim layer with a rounded hole (`box-shadow: 0 0 0 200vmax`) | Dim `rgba(12,14,34,.64)` → neutral `rgba(0,0,0,.55)`; hole radius 16 → 12 px |
| The rest of the page can't be clicked | Five transparent blocker `div`s around and over the hole → the app wrapper made `inert` (also blocks focus and screen readers) |
| Title + one or two sentences, Skip, Back / Next, dots | 8-bit box (black, 2 px white border, 4 px radius, hard shadow), yellow pixel title, blinking cursor → the site's paper card: one hairline, 14 px radius, soft shadow, 15 px type |
| Skip at the top right, 44 px | A fixed button in the window's corner → a text button inside the panel's title row |
| Next as the strong button | Red 3D button → the site's blue pill |
| Arrow keys, Enter, Esc, focus trapped | same |
| The box places itself where it doesn't cover the hole | It also slid toward the centre and could narrow itself to fit beside the hole → whole panel or nothing: below, above, right, left, else bottom with a shortened hole, else centred |
| Phones: docked at the bottom above the safe area | same, as a sheet with 14 px top corners |
| Reduced motion: no animation | same |
| | A dashed white outline that pulsed around the hole and confetti at the end → none; a 1 px white hairline at 60 % |

## Timeline

1. **The guide (Nov 17–18).** Spotlight tour of the calendar, the tabs and the header, started about 400 ms after a member
   picked their name in "Who are you?", once per member per browser (`localStorage`), never by itself for the owner,
   reopened from "Site guide" in that dialog. Eight steps, always English.
2. **Phones say it differently (Nov 23).** Phones had no "New event" button and no intro, so steps that mentioned them
   were wrong there. → `text` can be a function of the screen: "Tap an empty slot" without "or New event", and no
   "replay the intro" on phones.
3. **Google sign-in (Nov 23).** "Who are you?" went away: the account says who it is. → The tour starts on the
   member's first signed-in visit on a device, and "Site guide" moved to the name menu.
4. **One thing at a time (Nov 23).** In an iPhone browser, "Add to Home Screen" (once per member, kept in D1) opens
   first, and the tour follows when it closes. Inside the installed app the notifications sheet opens once instead of
   the tour.

## Rules that came from use

- **Nothing is written during the tour.** The page under it is inert; the tour can point at "New event" but not press it.
- **Skip and Esc count as seen.** Someone who skipped does not want it again; it is one tap away in the menu.
- **Never by itself for the owner.** They built the site.
- **Spotlight what is visible.** A step whose element is hidden at this width spotlights its container (`alt`), or shows
  centred without a hole.
- **Tabs are spotlit by their words.** A header tab's link is the full 52 px bar height; the hole around the words reads
  as "this tab", the box read as "this whole bar".
- **Never under the header.** The header is sticky; a hole below it is clipped at its bottom edge, and the page scrolls
  so the target sits between the header and the panel.
- **Nothing cut off at 375 × 600.** The smallest phone in the spec. The sheet's max height is the screen minus 72 px and
  scrolls inside if it ever has to.
- **No address in a step.** "Your school Google account", never the address itself.

## Changes made in this skill (not in the source)

- **Seen on the server too.** The source kept "seen" in the browser only. Here `markSeen` posts
  `{ seen: "guide" }` to `/api/me` and `serverSeen` reads it back (google-signin-team-gate keeps it in D1 by member id),
  so a second device or the installed app does not start the tour again.
- **Configuration instead of site constants.** Steps, the owner list, the app wrapper, the header, the home pane, the
  menu item, the storage key and the button words are options; the source had them in the file.
- **`first-visit.js`** holds the order (install sheet → app sheet → tour) that lived in the source's main script.
- **Storage key** `site_guide_v1_<id>` (the source used its own prefix), and the menu link class is `.guide-link`.
