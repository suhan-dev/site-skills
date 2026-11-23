# Setup: Google Calendar, a service account, and Cloudflare

Click by click, for someone who has never used Google Cloud or Cloudflare. It takes about 20 minutes. You need:

- a Google account that will own the calendar and the Cloud project (see "Which Google account" first);
- the Cloudflare Pages project of the site, already deployed (team-site-setup skill);
- the sign-in gate in front of `/api/*` (google-signin-team-gate skill), so strangers cannot write to the calendar.

Values in `{{…}}` are placeholders. Nothing here is ever written into the repository. The two values you make
(`GOOGLE_CALENDAR_ID` and `GOOGLE_SA_JSON`) go only into Cloudflare.

## 0. Which Google account

The calendar, the Cloud project and the key should all belong to **one account that you control**.

| Account | Works? | Notes |
|---|---|---|
| A personal Gmail account | Yes, always | The safe default. Make a new one for the team if you like ("examplelab.calendar" style), so it does not depend on one person. |
| A Google Workspace account (school, company) | Often blocked | Two Workspace rules break this setup: **(1)** organisation policy `iam.disableServiceAccountKeyCreation` (on by default for organisations made since 2024) stops you from making a key: "Service account key creation is disabled". **(2)** Calendar's external sharing setting may forbid sharing with addresses outside the domain, and a service account counts as outside. Only a Workspace admin can change either one. |

If you are on Workspace and you see either error, use a personal Gmail account for the calendar and the Cloud project.
Teammates can still use their school accounts to *see* the calendar if their domain allows it; the site itself does
not care which account owns the calendar.

## 1. Create the shared calendar

1. Open **calendar.google.com** with the owner account.
2. In the left column, next to **Other calendars**, click **+** → **Create new calendar**.
3. Fill in:
   - **Name:** `{{SITE_NAME}}` (for example `Example Lab`). The site shows this name on its Google Calendar card.
   - **Description:** optional.
   - **Time zone:** the team's zone, the same as `{{TIMEZONE}}` (for example `(GMT+09:00) Seoul` for `Asia/Seoul`).
4. Click **Create calendar**.

Why a new calendar and not the account's main one: you will share it with a robot account and with the whole team.
A separate calendar keeps the owner's private events out of it.

## 2. Create a Google Cloud project

1. Open **console.cloud.google.com** with the same account. Accept the terms if asked. No billing account is needed:
   the Calendar API is free at this size.
2. At the top, click the **project picker** (it says "Select a project" or a project name) → **New project**.
3. **Project name:** for example `example-lab-calendar`. Leave **Location** as "No organization" (personal Gmail) →
   **Create**.
4. Wait for the notification, then make sure the picker at the top shows the new project.

## 3. Turn on the Calendar API

1. Menu (☰) → **APIs & Services** → **Library**.
2. Search `Google Calendar API` → click it → **Enable**.

If you skip this, every call fails with 403 and the site says "The service account has no access…" (the same code as
missing sharing). Check this step first when you see 403.

## 4. Create the service account

A service account is a robot Google account. The site signs in as this robot, not as a person.

1. Menu (☰) → **IAM & Admin** → **Service accounts** → **+ Create service account**.
2. **Service account name:** for example `calendar-site`. The ID fills itself in. **Description:** optional.
3. Click **Create and continue**.
4. **Grant this service account access to project:** leave it empty. Click **Continue**.
5. **Grant users access to this service account:** leave it empty. Click **Done**.
6. In the list, copy the new account's **Email** (it is `calendar-site@<project-id>.` followed by Google's service-account
   domain). You need it in step 6. This address is not a secret, but do not commit it either.

The robot needs no project roles. Its only permission is the calendar sharing in step 6.

## 5. Make a key (this is the secret)

1. Click the service account's email → **Keys** tab → **Add key** → **Create new key**.
2. **Key type:** JSON → **Create**. A `.json` file downloads.
3. Treat this file like a password:
   - Never put it in the repository, an issue, a pull request, a chat, or a screenshot.
   - Do not save it inside the project folder (a careless `git add .` would commit it). Leave it in Downloads.
   - After step 8 you can delete it. If you lose it, make a new key and delete the old one (see "Rotate the key").

The file is one JSON object with fields such as `type`, `project_id`, `private_key_id`, a `private_key` field, and
`client_email`. The site needs **the whole file**, not only the key part.

## 6. Share the calendar

1. Back in **calendar.google.com**, hover the new calendar in the left column → **⋮** → **Settings and sharing**.
2. Scroll to **Share with specific people or groups** → **+ Add people and groups**.
3. Paste the **service account email** from step 4. **Permissions:** **Make changes to events** → **Send**.
   - "See all event details" is not enough: the site could read but every save would fail with 403.
   - "Make changes and manage sharing" also works but gives more than needed.
4. Add each teammate's Google account the same way (**Make changes to events**). The calendar then shows in their own
   Google Calendar app, and edits they make there show on the site within a minute.
5. Leave **Access permissions for events → Make available to public** off. The site has its own sign-in; the calendar
   does not need to be public.

## 7. Copy the calendar ID

1. On the same **Settings and sharing** page, scroll to **Integrate calendar**.
2. Copy **Calendar ID**. For a calendar made in step 1 it is a long string of letters and digits, then `@`, then
   Google's group-calendar domain. (A main calendar's ID is the Gmail address itself; do not use that one.)

The ID is not a password, but treat it as private: it is only ever stored in Cloudflare, never in the repository.

## 8. Add the variables in Cloudflare

1. Open **dash.cloudflare.com** → **Workers & Pages** → your Pages project → **Settings** → **Variables and Secrets**.
2. Make sure the environment is **Production** (add the same to **Preview** only if preview deployments should reach
   the real calendar too).
3. Click **+ Add**:

| Type | Variable name | Value |
|---|---|---|
| Text | `GOOGLE_CALENDAR_ID` | the Calendar ID from step 7 |
| **Secret** | `GOOGLE_SA_JSON` | the **entire contents** of the JSON file from step 5: open it in a text editor, select all, copy, paste. Keep it as it is, braces included. Do not add quotes around it |

4. Click **Save**.

Do not set `GOOGLE_TOKEN_URL` or `GOOGLE_API_BASE` in Cloudflare. They exist only to point local tests at the mock.

## 9. Redeploy

Variables apply from the next deployment. **Deployments** → the latest production deployment → **⋯** → **Retry
deployment**. Wait until it says Success (about a minute).

## 10. Check that it works

1. Open `{{SITE_ORIGIN}}/api/status` while signed in. You should see:
   `{"configured":true,"ok":true,"calendarName":"Example Lab", … ,"seeded":false}`.
2. Open the Calendar tab. The sync note shows a green dot and "Synced …". The **Google Calendar** card says
   "Connected to **Example Lab**".
3. Add a test event on the site. Open Google Calendar: it is there, in the owner's colour.
4. Change its time in Google Calendar. Within a minute (or when you switch back to the tab) the site shows the change.
5. Delete the test event on the site (Delete, then Click again to delete).

## 11. Add the official schedule (optional)

1. Edit `lib/seed.js` first: put your program's fixed dates there (kickoff, the weekly session, the last day), each with
   a title, a date and a `match` regex for its kind. Commit and deploy.
2. On the Calendar tab, the Google Calendar card shows **Add official schedule** while the first official date is
   missing. Press it once. It answers with what it added.
3. Pressing it again adds nothing twice. A date that already has a hand-made event of the same kind (by the `match`
   regex) is skipped. An official event someone deleted is restored.

## Run it on your own computer

- **Without Google (recommended for development):**

  ```bash
  node tools/mock-google.mjs 8790 .dev.vars     # a fake Google; writes a fake key and the four variables
  npx wrangler pages dev dist --binding DEV_MEMBER=alex
  ```

  The mock checks the real JWT signature and answers like Calendar API v3. Calendar id `forbidden-calendar` answers
  403 and any other id but `mock-calendar` answers 404, so you can see the error texts.
- **Against the real calendar:** copy `.dev.vars.example` to `.dev.vars` (git-ignored) and fill
  `GOOGLE_CALENDAR_ID` and `GOOGLE_SA_JSON` (on one line, in single quotes). Leave the two mock variables empty.
  Delete `.dev.vars` when you are done.

## Common errors

The page shows a sentence for each code (see [api.md](api.md#errors)).

| What you see | Code | Cause | Fix |
|---|---|---|---|
| "Not connected", striped events, orange dot | `configured:false` | one of the two variables is missing in this environment | step 8 (check Production vs Preview), then step 9 |
| "Couldn't reach the events API." | – | the Functions are not deployed, or the page is on a static server | deploy with `functions/`; locally use `wrangler pages dev` |
| "GOOGLE_SA_JSON is not valid. Paste the whole key file again." | `sa-json` | only part of the file was pasted, or it was wrapped in quotes | paste the whole file again, as Secret, then Retry deployment |
| "Couldn't read the service account key." | `sa-key` | the `private_key` text was changed (line breaks lost) | download a new key (step 5) and paste it |
| "Google sign-in failed. Check the service account key." | `google-auth` | the key was deleted in Google Cloud, or the project was deleted | make a new key, paste it, Retry deployment |
| "Google refused the credentials." | `google-401` | same as above | same as above |
| "The service account has no access to this calendar." | `google-403` | the calendar is not shared with the robot, it has "See all event details" only, or the Calendar API is off | step 6 with **Make changes to events**, and step 3 |
| "Calendar not found. Check GOOGLE_CALENDAR_ID and the sharing." | `google-404` | a typo in the ID, the main calendar's ID, or a deleted calendar | step 7, then step 8 and 9 |
| "Service account key creation is disabled" (in Google Cloud) | – | a Workspace organisation policy | use a personal Gmail account (section 0) |
| "Sharing with people outside … is not allowed" (in Google Calendar) | – | Workspace external sharing is off | use a personal Gmail account, or ask the Workspace admin |
| Events show at the wrong hour | – | the calendar's time zone and `{{TIMEZONE}}` differ | step 1, point 3; and `TZ` in `lib/gcal.js`, `TIMEZONE` in `cal-config.js` |

## Rotate the key

Do this when someone who had the file leaves, or if the file may have leaked.

1. Google Cloud → IAM & Admin → Service accounts → the robot → **Keys** → **Add key** → JSON (a new file).
2. Cloudflare → Variables and Secrets → `GOOGLE_SA_JSON` → **Edit** → paste the new file → Save → Retry deployment.
3. Check `/api/status` says `ok:true`.
4. Back in **Keys**, delete the old key (the trash icon on its row). Delete both downloaded files.

## Remove a teammate

Remove them from the calendar's sharing (step 6), from the sign-in allow-list (google-signin-team-gate), and from
`team.json`. Their past events stay; "Added by" keeps their id.
