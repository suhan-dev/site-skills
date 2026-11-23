# Server: storage, endpoints, the minute tick and the alert rules

All logic is in `lib/push.js`. The Pages Functions in `functions/api/push/` are thin; the cron Worker only knocks.

```
iPhone app ──POST /api/push──► Pages Function ──► lib/push.js ──► D1 (DB)
                                                     ▲   │
cron Worker (every minute) ──POST /api/push/tick ────┘   └──► Google Calendar (read only)
  X-Push-Tick: <secret from the same D1>                 └──► Apple / Google push services
calendar POST /api/events ──notifyCreated()──► lib/push.js (new event right away)
```

## D1 tables (made on first use)

```sql
push_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)
  -- vapid (the key pair, JSON), tick_secret, baseline_at, sync_token
push_subs (endpoint TEXT PRIMARY KEY, p256dh TEXT, auth TEXT, who TEXT DEFAULT '',
           notify_new INTEGER DEFAULT 1, notify_before INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)
  -- one row per device; who = the member (from the sign-in session, not the page)
push_seen (event_id TEXT PRIMARY KEY, at INTEGER)
  -- every event id ever seen, so an event is "new" only once
push_jobs (kind TEXT, event_id TEXT, start_ms INTEGER, endpoint TEXT, title TEXT, body TEXT, url TEXT, tag TEXT,
           attempts INTEGER DEFAULT 0, next_at INTEGER, expires_at INTEGER,
           PRIMARY KEY (kind, event_id, start_ms, endpoint))
  -- kind 'new' | 'rem'; next_at > 0 waiting or leased, 0 done (kept until expires_at, so never queued again)
```

From the sign-in gate (`lib/auth.js`), used for the install pop-up:

```sql
member_seen (member TEXT NOT NULL, what TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (member, what))
```

## Endpoints

| Request | Answer | Notes |
|---|---|---|
| `GET /api/push` | `{ ready, publicKey }` | `ready` false without the `DB` binding |
| `POST /api/push` `{ endpoint, keys, notifyNew?, notifyBefore?, who? }` | `{ registered, notifyNew, notifyBefore }` | saves the device and any settings given; with Google sign-in `who` is the signed-in member, whatever the body says. A switch turned off also drops its waiting jobs. |
| `POST /api/push?read` `{ endpoint, keys }` | same | reads only; the `auth` key must match, so knowing an endpoint is not enough |
| `DELETE /api/push` `{ endpoint }` | `{ deleted: true }` | forgets the device and its jobs |
| `POST /api/push/tick` + `X-Push-Tick` | a summary `{ sync, reminders, delivery, … }` | only for the cron Worker; checked in constant time in the gate and again here |
| `GET /api/me` / `POST /api/me { seen: "install" }` | `{ auth, member, seen: { install, … } }` | the sign-in gate's; "install" must be in its `ONCE` list |

Every API needs the sign-in session (the gate), JSON only (`415` otherwise), same-origin writes. Errors are JSON
`{ error, message }`; without `DB` the write endpoints answer `503 push-off`.

## The minute tick

Each tick, in order:

1. **Prune:** with the sign-in gate, delete devices whose member is no longer on `ALLOWED_EMAILS`.
2. **New events:** list Google Calendar changes with the stored `syncToken` (all pages). The very first tick has no
   token: it lists everything, marks it all as seen, stores `baseline_at`, and sends nothing. Later ticks:
   - skip cancelled events and single dates of a series (`recurringEventId`): a recurring series counts once;
   - an event seen for the first time (`push_seen` insert succeeded) and created at most 12 hours ago is new;
   - more than 3 new at once → one "New events: N events added · from …" job instead (e.g. an official schedule
     imported at once);
   - one job per device with "New events" on, except the device whose member is the event's author;
   - a `410` from Google (the sync token expired) → list everything again; `push_seen` still knows the old events.
3. **Reminders:** list single events from now to now + 31 minutes. Timed events only (no all-day). An event starting
   **24 to 30.5 minutes** from now gets one job per device with "30 minutes before" on, keyed by
   (event, start, device): the same reminder is never queued twice, and a moved event (a new start) gets a new one.
4. **Deliver** up to 60 due jobs:
   - take a **lease** first (`next_at = now + 90 s`, only if `next_at` is unchanged): two ticks never send the same job;
   - drop it (mark done) if the switch was turned off, or for a reminder if the event has started, moved (its start in
     this tick's list differs) or is gone;
   - send; `2xx` → done; `404`/`410` → forget the device; `400`/`403`/`413` → done (never works);
   - otherwise retry after 1, 2, 4, 8 minutes, at most 4 tries, and never a reminder after its start.
5. **Clean up** jobs past `expires_at` (new: 2 days; reminders: 1 hour after the start) and jobs of forgotten
   devices. `push_seen` keeps every event id (a few bytes each), so an old event never counts as new again.

`notifyCreated(env, googleEvent)` (from the calendar's POST) runs steps 2 and 4 for that one event right away; the
tick then sees it as already seen.

## The secret header

The tick secret is 32 random bytes (base64url) in `push_meta`. Whichever side needs it first makes it with
`INSERT OR IGNORE` and both read the same row, so nobody copies it by hand. The cron Worker sends it as
`X-Push-Tick`; the gate's `MACHINE` entry and `tick.js` compare it in constant time and only for `POST`.

## What is never stored or sent

No email address, no event place, notes or guests, no member names in notification text. `push_subs.who` is a member
id (`alex`), not an address. The VAPID private key and the tick secret never leave D1.
