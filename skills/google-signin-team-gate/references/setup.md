# Setup: Google sign-in, Cloudflare and D1

Click by click, for someone who has never used Google Cloud or Cloudflare. It takes about 15 minutes. You need:

- the Cloudflare Pages project of the site, already deployed (team-site-setup skill), at `https://{{PAGES_PROJECT}}.pages.dev`;
- the team members' Google addresses (they stay in Cloudflare; never in the repository, a chat log or a file);
- a Google account to own the Cloud project (see "Which Google account").

Values in `{{…}}` are placeholders. You make three values: `GOOGLE_CLIENT_ID`, `ALLOWED_EMAILS` and, if you use one
Workspace, `GOOGLE_HD`. They go only into Cloudflare. There is **no client secret** in this flow: Google posts an ID
token straight back to the site, so there is no code to exchange and nothing secret to keep for Google.

## 0. Which Google account, and which audience

| Your team signs in with | Own the Cloud project with | Audience (step 2) | `GOOGLE_HD` |
|---|---|---|---|
| Accounts of one Google Workspace (a school or a company), e.g. `@example.edu` | an account of that Workspace, project created **inside the organisation** | **Internal**: only that organisation can sign in, no review, no publishing | `example.edu` |
| Personal Google accounts, or several organisations | any account (a personal Gmail is fine) | **External**, then **Publish app** (or add each member as a test user) | empty |

Internal is the simpler and safer choice when everyone has an account in the same Workspace: Google itself refuses
everyone outside it, before the site's own checks.

## 1. Create a Google Cloud project

1. Open **console.cloud.google.com** with the owner account. Accept the terms if asked. No billing account is needed.
2. At the top, click the **project picker** → **New project**.
3. **Project name:** for example `example-lab-site`. **Organization / Location:** your Workspace organisation (for
   Internal) or "No organization" (personal account) → **Create**.
4. Wait for the notification, then make sure the picker shows the new project.

You can reuse the project that holds the calendar's service account (shared-google-calendar), but only if it lives in
the right organisation for the audience you want.

## 2. Google Auth Platform (the consent screen)

1. Menu (☰) → **Google Auth Platform** (older consoles: **APIs & Services** → **OAuth consent screen**). Click
   **Get started**.
2. **App information:** App name `{{SITE_NAME}}` (people see it on Google's account chooser). User support email:
   your own address (shown only to people signing in). **Next**.
3. **Audience:** **Internal** or **External** (table above). **Next**.
4. **Contact information:** your address (Google writes to it about the project). **Next**.
5. Tick the user data policy → **Continue** → **Create**.
6. **Data Access** → **Add or remove scopes** → tick `openid`, `.../auth/userinfo.email` and
   `.../auth/userinfo.profile` → **Update** → **Save**. These are basic scopes: no Google review.
7. External only: **Audience** → **Publish app** → **Confirm**. Status becomes "In production". (Or stay in
   "Testing" and add each member under **Test users**; Google then refuses everyone else.)

Branding (logo, home page) is optional. A logo may need Google's brand verification for an External app; leave it empty.

## 3. The OAuth client

1. **Google Auth Platform** → **Clients** → **+ Create client**.
2. **Application type:** **Web application**. **Name:** `{{SITE_NAME}} site`.
3. **Authorised redirect URIs** → **+ Add URI**, one per line, exactly:
   - `https://{{PAGES_PROJECT}}.pages.dev/__auth/google`
   - `https://{{CUSTOM_DOMAIN}}/__auth/google` (only if the site has its own domain)
   - `http://localhost:8788/__auth/google` (only if you want to test with the real Google on your machine)
4. **Authorised JavaScript origins:** not used by this flow (they are for Google's own button script). Adding the site
   address there does no harm.
5. **Create**. A dialog shows the **Client ID** (`….apps.googleusercontent.com`) and a client secret.
   - Copy the **Client ID**. It is public (it is in every sign-in link), but keep it out of the repository anyway.
   - **Ignore the client secret.** This flow never uses it. Do not download the JSON, do not save the secret anywhere.

Changes to redirect URIs can take a few minutes to apply at Google.

## 4. D1 (sessions)

Skip this if the site already has a D1 database bound as `DB` (the other skills use the same one).

1. **dash.cloudflare.com** → **Storage & databases** → **D1 SQL database** → **Create** → name `{{D1_NAME}}`
   (e.g. `example-lab`) → **Create**.
2. **Workers & Pages** → your Pages project → **Settings** → **Bindings** → **+ Add** → **D1 database** →
   Variable name `DB` → database `{{D1_NAME}}` → **Save**. Do it for **Production** (and **Preview** if you use preview
   deployments).

The code makes its three tables on first use (`auth_accounts`, `auth_sessions`, `member_seen`). No migration step.

## 5. Cloudflare variables

**Workers & Pages** → your Pages project → **Settings** → **Variables and Secrets** → **+ Add**, for **Production**:

| Name | Type | Value |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Text | the Client ID from step 3 |
| `ALLOWED_EMAILS` | **Secret** | `first@{{GOOGLE_HD}}=alex, second@{{GOOGLE_HD}}=blair, third@{{GOOGLE_HD}}=casey` |
| `GOOGLE_HD` | Text | `{{GOOGLE_HD}}` (e.g. `example.edu`), or leave it out for personal accounts |

- `ALLOWED_EMAILS`: one `address=member` per person, separated by commas or new lines. The member id is the
  lower-case id the site uses everywhere (`alex`, `blair`, `casey`; letters, digits, `-`, `_`). Case in the address does
  not matter.
- Type it in by hand in the Cloudflare page. Never paste it into a chat, an issue or a file. A Secret cannot be read
  back after saving; keep the list in a password manager.
- Never add `DEV_MEMBER` here. It only works on localhost, but it has no business on the live site.

Then **Deployments** → the latest production deployment → **⋯** → **Retry deployment**. Variables and bindings apply
only from the next deployment.

## 6. Check it

1. Open the site in a private window: the poster with one "Sign in with Google" pill. Nothing else of the site.
2. `curl -s -o /dev/null -w "%{http_code}\n" https://{{PAGES_PROJECT}}.pages.dev/api/me` → `401`.
3. `curl -s -o /dev/null -w "%{http_code}\n" https://{{PAGES_PROJECT}}.pages.dev/` → `200` (link previews need it).
4. Each member signs in once. They land where they started, and `/api/me` in the address bar shows
   `{"auth":"google","member":"alex",…}`, never an address.
5. Sign in with an account that is not on the list: one red line, "This site is for the {{SITE_NAME}} team only."
6. Sign out (the header's sign-out link goes to `/__logout`): back on the sign-in page.
7. Send the site link to yourself in KakaoTalk and open it there: "Open in Safari" (or "Open in browser" on Android).
8. Optional, in the D1 console (**D1** → `{{D1_NAME}}` → **Console**):
   `SELECT email, datetime(expires_at/1000,'unixepoch') FROM auth_sessions;` shows one row per signed-in browser and no
   token, only its hash (the primary key).

## Adding or removing a person

- **Add:** edit `ALLOWED_EMAILS` (type the whole list again, with the new `address=member`) → **Save** → Retry deployment.
  The new person signs in; their first sign-in pins their Google account to the address.
- **Remove:** the same, without their entry. They are signed out on their next request: every request reads the list.
  Their session rows stay until they expire; to delete them now, run
  `DELETE FROM auth_sessions WHERE email = '<address>';` in the D1 console.
- **A member changes Google account** (same address, new account, e.g. the account was deleted and made again): they
  get the one-line refusal, because the address is pinned to the first account. Run
  `DELETE FROM auth_accounts WHERE email = '<address>';` and they can sign in again.
- **Sign everyone out:** `DELETE FROM auth_sessions;`.

## Run it locally

| You want | Do |
|---|---|
| The demo of this skill, no account at all | `node assets/demo/serve.mjs` → `http://localhost:8124` (the real gate, a mock Google, D1 in memory) |
| Your site, signed in as a member, no Google | `npx wrangler pages dev dist --binding DEV_MEMBER=alex` → `http://localhost:8788` |
| Your site with the real Google | `.dev.vars` from `assets/.dev.vars.example` with `GOOGLE_CLIENT_ID`, `GOOGLE_HD`, your own `ALLOWED_EMAILS` entry; the `http://localhost:8788/__auth/google` redirect URI on the client (step 3); then `npx wrangler pages dev dist --d1 DB=local` |

- `DEV_MEMBER` needs both the variable and a `localhost` / `127.0.0.1` address. On any other host it does nothing.
- The real-Google local run works in Chrome, Edge and other Chromium browsers: the nonce cookie is `SameSite=None;
  Secure`, which they accept on `http://localhost` (checked with headless Chromium). Other browsers may drop it there;
  test them on the deployed site.
- `.dev.vars` is in `.gitignore`. Never commit it.

## Common errors

| What you see | Why | Fix |
|---|---|---|
| Google: **Error 400: redirect_uri_mismatch** | The address the site sent is not on the client's list. | Step 3: add `https://<the exact host>/__auth/google` (no trailing slash; custom domain and `pages.dev` are different). |
| Google: **Error 403: org_internal** | The app is Internal and the account is outside the organisation. | Use an account of the organisation, or make the app External (step 0). |
| Google: **Access blocked: … has not completed the Google verification process** | External app in Testing, account not a test user. | Publish the app, or add the member as a test user (step 2.7). |
| Google: **Error 403: disallowed_useragent** / "Use secure browsers" | Opened inside KakaoTalk or another in-app browser. | The sign-in page shows "Open in Safari" there; use it. |
| Site: "Sign-in isn't set up yet: GOOGLE_CLIENT_ID and the D1 binding DB." (503) | One of them is missing in this environment (Production vs Preview), or no redeploy since. | Step 4 and 5, then Retry deployment. |
| Site: "This site is for the {{SITE_NAME}} team only." | The address is not on `ALLOWED_EMAILS` (typo, wrong member id format), the account is outside `GOOGLE_HD`, Google says the address is not verified, or the address is pinned to another Google account. | Check the list; check `GOOGLE_HD`; see "A member changes Google account". |
| Site: "Couldn't sign in. Try again." | The token did not check out: `GOOGLE_CLIENT_ID` is not this client's id, more than 10 minutes passed on Google's page, or the sign-in started in another browser or tab whose nonce has gone. | Check the id (Text, no spaces). Try again from the sign-in page. Real-time logs (Pages project → **Functions**) show `auth …` lines. |
| Back on the sign-in page after choosing the account, no message | You pressed Cancel at Google. | Nothing to fix. |
| Signed out after a while on one device only | That browser cleared its cookies, or 180 days passed. | Sign in again. |

## What lives where

| Thing | Where | Never |
|---|---|---|
| Client ID | Cloudflare `GOOGLE_CLIENT_ID` (Text) | in the repository |
| Client secret | nowhere (not used) | saved, pasted, committed |
| Team addresses | Cloudflare `ALLOWED_EMAILS` (Secret), D1 `auth_accounts` / `auth_sessions` | in the repository, on a page, in `/api/me`, in logs, in notifications |
| Session token | the browser's HttpOnly cookie; D1 keeps its SHA-256 | readable by scripts, stored in clear |
| `DEV_MEMBER` | your `.dev.vars` | Cloudflare |
