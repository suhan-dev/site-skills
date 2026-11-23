# Setup: from code to a notification on an iPhone

What you need first:

- The site on Cloudflare Pages with Pages Functions (`team-site-setup`).
- The shared calendar working (`shared-google-calendar`): `GOOGLE_SA_JSON` and `GOOGLE_CALENDAR_ID` set, the calendar
  tab shows events.
- The sign-in gate (`google-signin-team-gate`), so a device belongs to a member. Without it, see "Without the sign-in
  gate" at the end.
- An iPhone with iOS 16.4 or later for the real test.

There is **no secret to create or paste** for this skill. The VAPID key pair and the tick secret are made inside D1 the
first time they are needed, and both the site and the cron Worker read them from there. Never paste them into chat, a
file or a variable.

Console labels move from time to time. If a label below is not where it says, look for the same word in the
left-hand menu; the order of the steps does not change.

## A. Put the code in the site

1. Copy from `assets/`:
   - `lib/push.js`, `lib/webpush.js` → `lib/`
   - `functions/api/push/index.js`, `tick.js` → `functions/api/push/`
   - `site/sw.js`, `site/manifest.webmanifest` → the site root (served at `/sw.js` and `/manifest.webmanifest`)
   - `site/js/push.js`, `site/js/push-strings.js` → `site/js/` (next to the design system's `i18n.js`)
   - `site/css/push.css` → `site/css/`
2. Fill `{{SITE_ORIGIN}}` (`lib/push.js`, `push-cron/worker.js`), `{{SITE_NAME}}` (manifest, `sw.js`) and
   `{{SITE_SHORT_NAME}}` (manifest, `head.html`, the `appName` you pass to `createPush`).
3. Paste `site/head.html` into the `<head>` of `index.html` **and** of the sign-in page.
4. Paste `site/push-dialogs.html`: the bell first in the header's `.bar-right`, the two dialogs at the end of `<body>`.
5. Make the icons (`app-icon.md`) and put them in `site/icons/`.
6. Wire the other skills:
   - **Sign-in gate** (`functions/_middleware.js`): uncomment `import { tickAllowed } from "../lib/push.js";` and add
     `"/api/push/tick": { header: "X-Push-Tick", allowed: tickAllowed }` to `MACHINE`. Its `PUBLIC` list already opens
     `/manifest.webmanifest`, `/sw.js` and `/icons/*.png`; keep them there.
   - **Calendar** (`functions/api/events/index.js` of `shared-google-calendar`): in `onRequestPost`, uncomment the
     `notifyCreated` import and call, and `waitUntil` in the parameters. The calendar already stores the author's
     member id in `extendedProperties.shared.author`, which is how the author is skipped.
   - **`/api/me`** (sign-in gate): `ONCE` must contain `"install"`. The page passes `seen` from `GET /api/me` to
     `createPush()`.
7. Start it in the page's script, after the member is known:
   ```js
   import { createPush } from "./push.js";
   const push = createPush({ appName: "{{SITE_SHORT_NAME}}", member: me.member, seen: me.seen,
     onOpen: (url) => openFromAddress(url) });             // a tapped notification while the site is open
   const after = () => { if (!push.welcome()) setTimeout(() => push.offerInstall(showGuide), 500); };
   document.documentElement.classList.contains("intro-off") ? after() : addEventListener("intro:done", after, { once: true });
   ```
8. Run `node assets/tests/test-push.mjs` (Node 22.13 or later). It must end with `checks passed`.
9. Deploy (push the branch, merge, let Pages build).

## B. D1: the database the notifications live in

Skip step 1 if the site already has a D1 database bound as `DB` (the sign-in gate and the chat use the same one).

1. **dash.cloudflare.com** → **Storage & databases** → **D1 SQL database** → **Create** → name `{{D1_NAME}}`
   (e.g. `example-lab-db`) → **Create**.
2. **Workers & Pages** → your Pages project → **Settings** → **Bindings** → **+ Add** → **D1 database** →
   Variable name `DB` → database `{{D1_NAME}}` → **Save**. Do it for **Production** (and Preview if you use previews).
3. **Deployments** → the latest production deployment → **⋯** → **Retry deployment**. Bindings apply only from the
   next deployment.
4. Check: open the site → the bell → the status line must **not** say "Notifications aren't set up on the server
   yet." (On a computer it says "Notifications are off on this device.")

The tables (`push_meta`, `push_subs`, `push_seen`, `push_jobs`) are created on first use.

## C. The cron Worker: the minute clock

Pages has no cron, so a tiny Worker calls `POST /api/push/tick` every minute. Do it in the dashboard (no tools) or
with wrangler.

**Dashboard:**

1. **Workers & Pages** → **Create** → **Worker** → name `{{PAGES_PROJECT}}-push-cron` → **Deploy**.
2. **Edit code** → replace everything with `assets/push-cron/worker.js` → **Deploy**.
3. That Worker → **Settings** → **Variables and Secrets** → **+ Add** → type **Text**, name `SITE_URL`, value your
   address (`{{SITE_ORIGIN}}`, e.g. `https://example-lab.pages.dev`) → **Deploy**.
4. **Settings** → **Bindings** → **+ Add** → **D1 database** → Variable name `DB` → `{{D1_NAME}}` → **Deploy**.
5. **Settings** → **Trigger events** → **+ Add** → **Cron triggers** → **Every minute** (`* * * * *`) → **Add**.

**Wrangler** (when it is already signed in on your computer):

1. Copy `assets/push-cron/` somewhere outside the repository, fill `{{PAGES_PROJECT}}`, `{{SITE_ORIGIN}}`,
   `{{D1_NAME}}` and the database id (**D1** → your database → copy the ID) in `wrangler.toml`.
2. `cd push-cron && npx wrangler deploy`. Do not commit the filled-in `wrangler.toml`.

**Check:**

- That Worker → **Logs** (turn on **Workers Logs** if asked) → one invocation a minute, no `tick failed` lines.
- **D1** → `{{D1_NAME}}` → **Console** → `SELECT k FROM push_meta;` lists `tick_secret`, `vapid`, `baseline_at` and
  `sync_token` after the first tick. Never select `v`: those are the keys.

## D. On the iPhone

1. Open the site in **Safari** (in KakaoTalk, use **Open in Safari** in the pop-up).
2. **Share** → **Add to Home Screen** → keep **Open as Web App** on → **Add**.
3. Open the app from the Home Screen, sign in, tap the bell → **Turn on notifications** → **Allow**. The status line
   turns to "Notifications are on for this device." with a green dot.
4. Test: add an event in Google Calendar starting in about 35 minutes. Within a minute: **New event**. About 30
   minutes before it starts: **In 30 minutes**. Tap one: the app opens on that day with the event open.
5. Add an event on the site yourself: you get nothing (the author is skipped); a teammate gets "New event".

## E. Common failures

| What you see | Why | Fix |
|---|---|---|
| "Notifications aren't set up on the server yet." | No `DB` binding in this environment (Production vs Preview), or no redeploy since. | B.2, then B.3 (Retry deployment). |
| The bell opens the "Add to Home Screen" steps on the iPhone | It is Safari, not the installed app. Notifications work only in the app opened from the Home Screen. | Follow the steps, open the app from the Home Screen. |
| "Notifications need iOS 16.4 or later." | Older iOS has no web push. | Update iOS. |
| "Notifications are off for this app. Turn them on in Settings → Notifications → …" | **Don't Allow** was tapped once; iOS never asks again. | iPhone Settings → Notifications → the app → Allow Notifications. |
| Everything says on, but nothing ever arrives | The cron Worker is missing, has no trigger, no `DB` binding, or the wrong `SITE_URL`. | C, then its Logs. A `403` in the logs: the Worker and the site use different databases. |
| New events arrive, reminders do not | The event is all-day (no reminder by design), or starts in less than 24 minutes. | Use a timed event at least 31 minutes ahead. |
| Nothing for events that were already there | By design: the first tick only records what exists, so a deploy never floods anyone. | Add a new event. |
| The Home Screen icon is a grey letter, or the app opens in Safari's frame | `/manifest.webmanifest` or `/icons/…` needs a sign-in. | Keep them in the gate's `PUBLIC` list (A.6). Remove the app and add it again. |
| A member who left the team still gets notifications | — | Remove them from `ALLOWED_EMAILS` and redeploy; the next tick forgets their devices. |

## F. Turning it off, and keys

- **Off for everyone:** remove the Worker's cron trigger. Devices stay registered; nothing is sent.
- **One device:** the member turns both switches off, or removes the app from the Home Screen (the push service then
  answers 410 and the device is forgotten).
- **Rotating keys:** the tick secret can be rotated any time: `DELETE FROM push_meta WHERE k = 'tick_secret';` in the
  D1 console (both sides make and read a new one). Rotate the VAPID keys only if they leaked: delete the `vapid` row
  and all `push_subs` rows; every member then removes the app and adds it again.

## G. Local runs

| What | How |
|---|---|
| The server logic, offline | `node assets/tests/test-push.mjs` (fake clock, fake Google, fake Apple push service, D1 on `node:sqlite`) |
| The screens, no server | serve the repository root, open `/skills/ios-webapp-push/assets/demo/?ua=ios` (see the demo's header for all switches) |
| Your site with a local D1 | `npx wrangler pages dev dist --d1 DB={{D1_NAME}}`, then `curl -X POST -H "X-Push-Tick: <the value from the local D1>" http://localhost:8788/api/push/tick` to run one tick by hand |

## Without the sign-in gate

In `lib/push.js` replace `import { allowedMembers } from "./auth.js";` with `const allowedMembers = () => null;`.
Devices then belong to no member (`who` is whatever the page sends), nobody is pruned, and the tick needs your own gate
to let `POST /api/push/tick` through with the `X-Push-Tick` header checked by `tickAllowed`.
