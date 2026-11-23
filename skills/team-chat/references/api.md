# Team chat: API, storage, polling and anchors

## Endpoint

Everything goes through `functions/_middleware.js` (`google-signin-team-gate`) first: no session → 401, a write from
another origin → 403. The endpoint then reads the member from `data.user.member`.

| Request | Answer |
|---|---|
| `GET /api/messages` | `{ messages: [Msg], rev, me }`: the newest 500 messages that are not deleted, oldest first |
| `GET /api/messages?since=REV` | `{ messages: [Msg \| Gone], rev, me }`: every row with `rev > REV`, by rev, 1,000 at most |
| `POST /api/messages` `{ text, page?, title?, anchor?, quote?, prefix?, suffix? }` | `201 { message: Msg, rev }` |
| `DELETE /api/messages?id=ID` | `{ deleted: ID, rev }`; only the author |

```
Msg  = { id, rev, ts, member, text, page, title, anchor, quote, prefix, suffix }
Gone = { id, rev, deleted: true }
rev  = the highest rev in the table (0 when empty). A since answer cut at 1,000 rows gives the last row's rev instead,
       so the next poll goes on from there and skips nothing.
me   = the signed-in member
```

Errors are `{ error, message }`:

| Status | `error` | When |
|---|---|---|
| 400 | `json` | the body isn't a JSON object |
| 400 | `text` | text missing, empty after trimming and removing control characters, or over 4,000 characters |
| 401 | `auth` | no signed-in member (the client reloads into the sign-in page) |
| 403 | `owner` | deleting someone else's message |
| 404 | `none` | no such message, already deleted, or a bad id |
| 405 | `method` | anything but GET, POST, DELETE (with `Allow`) |
| 500 | `server` | D1 failed (logged with `console.warn`) |
| 503 | `db` | no `DB` binding (the client shows "Chat isn't connected yet" and polls every 5 minutes) |

Answers are `application/json` with `Cache-Control: no-store`.

## Fields

| Field | Rule |
|---|---|
| `text` | Trimmed, control characters removed (new lines and tabs stay), 1–4,000 code points |
| `page` | The `data-chat-page` key, cut to 200 |
| `title` | The words above the quote, cut to 300 |
| `anchor` | The id of the heading the passage is under (or an event's date), cut to 200 |
| `quote` | The selected words, white space made single, cut to 2,000 |
| `prefix` | Up to 40 characters before the quote (stored up to 80, keeping the end) |
| `suffix` | Up to 40 characters after it (stored up to 80, keeping the start) |
| `member`, `ts`, `id`, `rev` | Set by the server; values in the body are ignored |

Non-string values become `""`. No field is ever `NULL`.

## Table

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, rev INTEGER NOT NULL, ts INTEGER NOT NULL, member TEXT NOT NULL,
  text TEXT NOT NULL, page TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '', anchor TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '', prefix TEXT NOT NULL DEFAULT '', suffix TEXT NOT NULL DEFAULT '',
  deleted INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS chat_messages_rev ON chat_messages (rev);
```

Made on the first request of each isolate (and again after a failure). There is no email column.

## rev and polling

- `rev` is one counter for the whole table. An insert sets `rev = (SELECT COALESCE(MAX(rev),0)+1 FROM chat_messages)`
  in the same statement; a delete sets the row's `rev` the same way, `deleted = 1`, and clears `text`, `quote`,
  `prefix`, `suffix`, `title`. D1 runs one write at a time, so no two changes share a rev.
- A row appears once in a `since` answer, at its newest rev: a message posted and then deleted comes back as `Gone`.
- The client keeps the highest `rev` it has seen and polls `?since=rev`: every 4 s while the chat is open, 45 s while
  closed, 5 min while the API is missing, and at once when the tab becomes visible again. It never polls a hidden tab.
- A `since` past the end (the table was reset) returns no rows and the real `rev`.

## How a quote finds its place again

1. The client turns the comment root (`[data-chat-page]`) into one string: text nodes in order, runs of white space made
   single, a space between blocks, skipping `SKIP` (KaTeX's hidden source, buttons, inputs, `[data-chat-skip]`). It
   keeps, for each character, the text node and offset it came from.
2. On Comment, the selection becomes `quote` plus 40 characters on each side (`prefix`, `suffix`), and the nearest heading
   above it gives `anchor` (its id) and the second half of `title`.
3. To mark it, every occurrence of `quote` in the string is scored by how many characters of `prefix` (from its end) and
   `suffix` (from its start) match around it. The best one wins.
4. The characters are wrapped in `<mark class="cm-mark" data-id>`, one per text node; math is not split.
5. A `MutationObserver` re-marks when another script draws new content (a tab, chapter or week). Each root remembers
   which comment ids it has marked, so nothing is redrawn needlessly.

If the quoted words are gone, nothing is marked and the comment stays in the chat. Quotes never depend on DOM paths or
character offsets, so edits elsewhere on the page don't break them.

## Links back

`hrefOf()` turns a comment into a URL that works from anywhere, with `c=<id>` to scroll to it:

| `page` | URL |
|---|---|
| `theory/<part>/<chapter>` | `/theory/<part>/<chapter>?c=<id>` (the reader page) |
| `log/<week>/<member>` | `/?c=<id>#records/<week>/<member>` |
| `refs` | `/?c=<id>#refs` |
| `event/<id>` | `/?event=<id>&date=<anchor>#calendar` |

On the same page, `goTo()` switches tab first and scrolls without a reload. `?c=` is removed from the address after use.
