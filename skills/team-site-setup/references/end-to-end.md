# End-to-end setup: from nothing to a live team site

Every console step, in the order that works, with the value to type and how to check it. Values in `{{…}}` are yours.
Nothing secret is ever written into the repo, a chat, or a screenshot.

Time: about 90 minutes the first time. Steps 5–7 can be done later; the site works without them.

---

## 0. Accounts

| Account | Used for | Note |
|---|---|---|
| GitHub | the one repo | GitHub Pro (or a public repo) for code-owner rules on a private repo |
| Cloudflare (free plan) | Pages (site + functions), D1 (database), one Worker (cron) | sign in yourself; dashboards refuse scripted logins |
| A Google **Workspace** account (school or company) | the sign-in client, if only that organisation may sign in ("Internal" audience) | a personal Gmail works too, with an "External" audience |
| A **personal Gmail** | the shared calendar and its service account | Workspace organisations often block service-account keys and external calendar sharing |

## 1. Repo

1. Create the repo from `team-project-playbook/assets/repo-template/` and this skill's `assets/skeleton/`.
2. Copy the design system files into `site/css/` and `site/js/` (see the READMEs there).
3. `python3 build.py --check` must print `check: nothing missing`.
4. Push to `main`.

## 2. Cloudflare Pages project

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** tab →
   **Import an existing Git repository**.
2. Connect GitHub and give the "Cloudflare Workers and Pages" app access to **only this repo**. (If the repo is missing
   later: GitHub → Settings → Applications → Cloudflare Workers and Pages → Configure → Repository access.)
3. Settings:
   - Project name: `{{PAGES_PROJECT}}` (the address becomes `https://{{PAGES_PROJECT}}.pages.dev`)
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: `python3 build.py`
   - Build output directory: `dist`
   - Root directory: empty
4. **Save and Deploy**. When it finishes, open the address: the skeleton page says "It works." and lists the settings
   it has (all "–" for now).
5. Settings → **Build** → **Branch control** → Preview branch: **None**. Production keeps deploying from `main` on every
   merge.

Search engines stay out: `robots.txt` disallows everything and the middleware sends `X-Robots-Tag: noindex`.

## 3. D1 database (sign-in sessions, notifications, chat)

1. **Workers & Pages** → **D1 SQL database** → **Create** → name `{{D1_NAME}}` → Create.
2. Pages project → **Settings** → **Bindings** → **Add** → **D1 database** → Variable name `DB` → database
   `{{D1_NAME}}` → Save. Do this for **Production** (and Preview if you use it).
3. **Deployments** → latest production deployment → **⋯** → **Retry deployment**. Bindings and variables apply only from
   the next deployment.
4. Check: `https://{{PAGES_PROJECT}}.pages.dev/api/health` shows `"DB": true`.

Tables are created by the code on first use (`CREATE TABLE IF NOT EXISTS`); there is no migration step.

## 4. Google sign-in

Full click-by-click guide: `google-signin-team-gate/references/setup.md`. Summary:

1. [console.cloud.google.com](https://console.cloud.google.com) → project picker → **New project** → `{{GCP_PROJECT}}`.
   Create it under the Workspace organisation if only that organisation may sign in.
2. **Google Auth Platform** → **Get started**: app name `{{SITE_NAME}}`, support email (yours), audience
   **Internal** (Workspace: only your organisation, no review) or **External** (then **Publish app**; the scopes
   `openid email profile` need no verification), contact email → Create.
3. **Clients** → **Create client** → **Web application** → name `{{SITE_NAME}} site`:
   - Authorised redirect URIs (the only field this flow uses): `https://{{PAGES_PROJECT}}.pages.dev/__auth/google`,
     `http://localhost:8788/__auth/google`. Authorised JavaScript origins can stay empty.
   - Create. Copy the **Client ID** (public). Ignore the client secret: it is not used. Do not save it anywhere.
4. Cloudflare Pages → **Settings** → **Variables and Secrets** → Production:
   - `GOOGLE_CLIENT_ID` — type **Text** — the client id
   - `ALLOWED_EMAILS` — type **Secret** — `first@{{GOOGLE_HD}}=alex, second@{{GOOGLE_HD}}=blair, third@{{GOOGLE_HD}}=casey`
     (one `address=member-id` per person, commas or new lines)
   - `GOOGLE_HD` — type **Text** — `{{GOOGLE_HD}}` if only one Workspace domain may sign in; leave it out for personal
     Google accounts
5. Retry deployment. Open the site signed out: one "Sign in with Google" button. Sign in with each account.

## 5. Shared Google Calendar

Full guide: `shared-google-calendar/references/setup.md`. Summary, signed in with the **personal Gmail**:

1. [calendar.google.com](https://calendar.google.com) → **+** next to "Other calendars" → **Create new calendar** →
   name `{{SITE_NAME}}`, time zone `{{TIMEZONE}}` → Create.
2. [console.cloud.google.com](https://console.cloud.google.com) (same Gmail) → New project `{{GCP_CAL_PROJECT}}` →
   **APIs & Services** → **Library** → **Google Calendar API** → **Enable**.
3. **IAM & Admin** → **Service accounts** → **Create service account** → name `site-calendar` → Create and continue →
   no roles → Done.
4. Open it → **Keys** → **Add key** → **Create new key** → **JSON**. A file downloads. It is a secret: never commit it,
   never paste it in chat. Delete the download after step 7.
5. Google Calendar → the calendar → **Settings and sharing** → **Share with specific people or groups** → **Add**:
   - the service account's email (`client_email` in the JSON) → **Make changes to events**
   - each teammate's Google account → **Make changes to events** (it then shows in their own Google Calendar)
6. Same page → **Integrate calendar** → copy the **Calendar ID**.
7. Cloudflare Pages → Variables and Secrets → Production:
   - `GOOGLE_CALENDAR_ID` — **Text** — the calendar id
   - `GOOGLE_SA_JSON` — **Secret** — the whole JSON file's contents, pasted as is
8. Retry deployment. The Calendar tab's status says connected; press **Add official schedule** once if you use the
   seed.

Errors: 403 → the sharing in step 5; 404 → the id in step 6; "auth" → paste the JSON again.

## 6. Notifications (Home Screen app, web push)

Full guide: `ios-webapp-push/references/setup.md`. Summary:

1. Needs the `DB` binding from step 3. The VAPID key pair and the tick secret are generated **inside D1** on first use:
   nothing to create or copy.
2. **Workers & Pages** → **Create** → **Worker** → name `{{PAGES_PROJECT}}-push-cron` → Deploy → **Edit code** → paste
   `ios-webapp-push/assets/push-cron/worker.js` → Deploy. Then give it the site's address: Settings → **Variables and
   Secrets** → `SITE_URL` (Text) = `https://{{PAGES_PROJECT}}.pages.dev` (or edit the `SITE` constant in the code).
3. That Worker → **Settings** → **Bindings** → **Add** → **D1 database** → `DB` → `{{D1_NAME}}`.
4. That Worker → **Settings** → **Trigger events** → **Add** → **Cron trigger** → every minute (`* * * * *`).
5. Check: the bell in the site header says "Notifications are off on this device" (not "aren't set up on the server
   yet"). On an iPhone (iOS 16.4+) add the site to the Home Screen, open it from there, turn notifications on.

## 7. Link preview

`kakao-link-preview`: put a 2400 × 1260 `site/assets/og.jpg`, run `python3 og_version.py`, commit, then clear the Kakao
cache in the sharing debugger.

---

## Every setting in one table

| Name | Kind | Where | Used by | Secret? |
|---|---|---|---|---|
| `GOOGLE_CLIENT_ID` | variable (Text) | Pages → Production | sign-in | no (it is in the sign-in page) |
| `ALLOWED_EMAILS` | variable (Secret) | Pages → Production | sign-in allow-list | **yes** (addresses) |
| `GOOGLE_CALENDAR_ID` | variable (Text) | Pages → Production | calendar | not secret, but keep it out of the repo |
| `GOOGLE_SA_JSON` | variable (Secret) | Pages → Production | calendar | **yes** (private key) |
| `GOOGLE_HD` | variable (Text, optional) | Pages → Production | sign-in: one Workspace domain only | no |
| `DB` | D1 binding | Pages → Bindings, and the cron Worker | sessions, push, chat, "seen once" | — |
| `SITE_URL` | variable (Text) | the cron Worker | which site to tick | no |
| `DEV_MEMBER` | `.dev.vars` only | your machine | local preview without Google | never set it in Cloudflare |
| VAPID keys, tick secret | rows in D1 | made by the code | push | **yes**, never leave D1 |

## Changing things later

| Task | How |
|---|---|
| Add a person | Add `address=id` to `ALLOWED_EMAILS`, add the member to `team.json`, share the calendar with them, Retry deployment |
| Remove a person | Remove them from `ALLOWED_EMAILS` and Retry deployment: their next request is signed out and their devices stop getting notifications |
| Rotate the calendar key | Service account → Keys → add a new JSON key → replace `GOOGLE_SA_JSON` → Retry deployment → delete the old key |
| Sign everyone out | Delete the rows of the sessions table in D1 (Console tab) |
| Turn notifications off for everyone | Remove the cron trigger from the Worker |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Setting added but nothing changed | variables apply from the next deployment | Retry deployment |
| Sign-in page says sign-in isn't set up | `GOOGLE_CLIENT_ID` or `DB` missing | steps 3–4 |
| Google says `redirect_uri_mismatch` | the address is not in the client's redirect URIs | add `https://…/__auth/google` exactly |
| "This site is for the team only" for a teammate | address not on `ALLOWED_EMAILS`, or not in `{{GOOGLE_HD}}` | fix the list, Retry deployment |
| Sign-in fails inside KakaoTalk | Google blocks embedded browsers | use "Open in Safari" (shown automatically) |
| Calendar 403 | service account not shared with "Make changes to events" | step 5.5 |
| Bell says the server isn't set up | no `DB` binding on Pages | step 3 |
| No notifications at all | cron Worker missing its D1 binding or trigger | step 6.3–6.4; check the Worker's Logs |
