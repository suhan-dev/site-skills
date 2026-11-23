# API: Pages Functions and the event shape

All endpoints are Cloudflare Pages Functions under `functions/api/`. They answer JSON with `Cache-Control: no-store`.
Put the sign-in gate (google-signin-team-gate skill) in front of them; the calendar never checks who you are by itself.

## Endpoints

| Method and path | Body / query | Answer |
|---|---|---|
| `GET /api/status` | – | see "Status" below |
| `GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD` | at most 400 days | `{ events: [Event], now }` |
| `POST /api/events` | `EventInput` | `201 { event: Event }` |
| `GET /api/events/:id` | – | `{ event: Event }` |
| `PATCH /api/events/:id` (or `PUT`) | `EventInput` | `{ event: Event }`; on a recurring event, only that occurrence |
| `DELETE /api/events/:id` | – | `{ deleted: id }`; deleting twice answers the same (Google's 410 is success) |
| `GET /api/seed` | – | `{ events: [Event] }`: the official schedule, also the striped preview |
| `POST /api/seed` | `{ who }` | `{ added, restored, kept, skipped }` |

`from` and `to` are calendar dates in the team's zone; the range is `from 00:00` up to the end of `to`. An event is in
the answer when any part of it overlaps the range (Google's `timeMin` / `timeMax`, `singleEvents=true`, so recurring
series come as single occurrences with ids `<seriesId>_<date…>`).

## Event (what the page gets)

```js
{
  id: "…",                       // Google event id
  title: "Design review",        // summary, "(no title)" if empty
  allDay: false,
  start: "2026-12-22", end: "2026-12-22",   // inclusive dates in the team's zone
  startTime: "10:00", endTime: "11:30",     // "HH:MM" 24 h, "" for all-day
  location: "", memo: "",                   // location, description
  colorId: "7",                  // Google colour id 1–11, "" if none
  owner: "alex",                 // whose calendar: "team", "official" or a member id
  author: "alex", editor: "",    // member ids, set by the server from the session
  link: "https://calendar.google.com/…",   // htmlLink, for "Open in Google Calendar"
  recurring: false, updated: "…"
}
```

`owner`, `author` and `editor` are kept in Google's `extendedProperties.shared`, so they survive edits made in Google
Calendar itself. Google's all-day end date is exclusive; the server converts it to an inclusive one and back.

## EventInput (what the page sends)

`{ title, allDay, start, end, startTime, endTime, location, memo, owner, colorId, who }`

- `title` required, trimmed, at most 300 characters; `location` 500; `memo` 8000.
- `start`/`end` `YYYY-MM-DD`, `end ≥ start`. `startTime`/`endTime` `HH:MM`; a missing start is 09:00, a missing end is
  start + 60 min. On one date the end time must be after the start.
- `colorId` `1`–`11` (anything else is dropped). The page sends the owner's colour, so **colour follows the owner**:
  team 9, official 11, each member their own (`team.json`).
- `who` is **ignored when a session exists**: "added by" (`author`, on create) and "edited by" (`editor`, on edit) come
  from `context.data.user.member`, which the sign-in middleware sets. `who` is only a fallback for local runs without
  sign-in.
- A PATCH that switches between all day and timed sends `null` for the other kind of date (`start.dateTime: null` …),
  because Google merges PATCH bodies.

## Status

| Situation | Answer | Page |
|---|---|---|
| variables missing | `{ configured: false }` | preview mode: orange "Not connected", banner, striped seed events, read only |
| connected | `{ configured: true, ok: true, calendarName, calendarId, timeZone, seeded, serviceAccount }` | live mode |
| connected but failing | `{ configured: true, ok: false, code, error }` | error mode: red banner with the hint, card with Try again |
| API unreachable (404, network) | page sets `{ configured: false, noApi: true }` | preview mode, banner "Couldn't reach the events API." |

`seeded` is true when the first official event exists by its fixed id, or when a hand-made event of the same kind is
on that day. While it is false, the Google Calendar card shows **Add official schedule**.

## Errors

Every error answer is `{ error: <code>, message: <sentence> }`. The page maps known codes to its own words
(`cal-strings.js` `ERR`) and shows the server's message otherwise.

| Code | HTTP | Cause | What the page says |
|---|---|---|---|
| `not-configured` | 503 | `GOOGLE_SA_JSON` or `GOOGLE_CALENDAR_ID` missing | Google Calendar is not connected yet. |
| `sa-json` | 500 | the key variable is not the whole JSON file | Paste the whole key file again. |
| `sa-key` | 500 | the private key does not import | Paste the key JSON again. |
| `google-auth` | 502 | the token request failed (wrong key, deleted key, clock) | Check the service account key. |
| `google-401` | 502 | Google refused the token | Check the service account key. |
| `google-403` | 502 | the calendar is not shared with the service account, or the API is off | Share the calendar with the service account email ("Make changes to events"). |
| `google-404` | 404 | wrong calendar id, or the event is gone | Check GOOGLE_CALENDAR_ID and the sharing. |
| `google-409` | 409 | an id that exists (only the seed uses fixed ids; handled there) | – |
| `range`, `json`, `id`, `title`, `date`, `time` | 400 | bad input | the server's sentence |

401 and 403 from Google become 502 on purpose: it is our server, not the visitor, that is not allowed. The page reloads
only on its **own** 401 `{ error: "auth" }` (the sign-in expired).

## Seed (Add official schedule)

`lib/seed.js` lists the program's fixed dates as all-day events with fixed ids (`seed20270105` …; Google ids allow
only `a–v` and `0–9`). `POST /api/seed` is safe to press any number of times:

1. List every event in the program's range once.
2. For each official event: if a **hand-made event of the same kind** covers that date (`match` regex on the title,
   e.g. "Kickoff (hand-made)" on the kickoff day) → `skipped`.
3. Else insert it with its fixed id → `added`. Google answers 409 if the id exists:
   the existing one is `cancelled` (someone deleted it; Google keeps deleted ids) → PATCH `status: confirmed` → `restored`;
   otherwise → `kept`.

## Polling

The page reads `/api/status` on a full load, then `/api/events` twice per load: the range on screen (+1 day) and
today → +120 days for "Upcoming". It reloads quietly every 60 s while the tab is visible and the event sheet is closed,
and when the window regains focus after more than 15 s. One request runs at a time; a load asked for meanwhile runs
right after (`busy` / `again`). The service account's token is cached per isolate until 2 minutes before it expires.
