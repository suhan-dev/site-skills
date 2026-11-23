# Decisions, and what was tried first

From the source site's git history (all in November 2026) and its sign-in spec. "Before → after" where the design
changed.

## Timeline (before → after)

1. **A shared password (Nov 17).** The first site had one team password. A correct password set a cookie holding the
   password's HMAC; changing the password signed everyone out. Same day, the page was redesigned: the intro's poster
   behind it, an underlined password field, the sign-in and the intro made into one scene (the field fades, the
   picture brightens, the title stays).
2. **Stay signed in (Nov 23).** The password cookie was a session cookie, so closing the browser asked again; the
   installed Home Screen app was given 180 days because iOS closes Home Screen apps and every notification tap asked for
   the password. → The owner asked for **180 days in the browser too**: a closed browser should not ask again either.
3. **Google sign-in (Nov 23).** The owner asked for sign-in with each member's school Google account instead of a shared
   password, "like the admin sign-in of an earlier project", for exactly the team's three accounts: no approval flow,
   no members panel. → A fixed allow-list in a Cloudflare variable (`address=member`), the `hd` domain check,
   `email_verified`, RS256 checked with WebCrypto (no library: Pages Functions have no `jose`), sessions as random
   tokens hashed in D1, the Google `sub` pinned on first sign-in. The password gate stayed only until
   `GOOGLE_CLIENT_ID` was set.
4. **Password removed (Nov 23).** Once Google sign-in worked on the live site the password path was deleted, and
   `DEV_MEMBER` was added so local previews and screenshots still work without Google (localhost only).
5. **Our own pill instead of Google's button (Nov 23).** The first version used Google Identity Services (GIS): its
   script drew Google's button (`filled_black` in dark, `outline` in light), a pop-up in the browser, a redirect with a
   `g_csrf_token` double-submit cookie in the installed app, and a `fetch` back to the site in the pop-up case. →
   **A plain link to Google's OpenID Connect sign-in with `response_mode=form_post`**, drawn as the site's own
   translucent grey pill. Why:
   - GIS draws its button in an iframe that the page cannot restyle: a white or black Google button sat on the dark
     poster and broke the scene. Google expects its button to stay visible as drawn (the script checks), so hiding
     it under a look-alike is not an option either.
   - One path for the browser and the installed app (no pop-up, no `fetch`, no second CSRF scheme), and it works
     without JavaScript.
   - No Google script on the page at all.
6. **Shown once per member, on any device (Nov 23).** "Add to Home Screen" was shown once per browser
   (`localStorage`); a member who cleared storage or used a second phone saw it again. → `member_seen` in D1 and
   `/api/me` `seen`, kept by member id.

## Rules that came from use

- **One line for everyone who is refused.** "This site is for the … team only." Whether the address is unknown, outside
  the domain or unverified, a stranger learns nothing about who is on the team.
- **Cancel is not an error.** Pressing Cancel at Google comes back to the plain page with no message.
- **A 200 at `/`, not a redirect.** Link-preview crawlers (KakaoTalk, Slack) read the sign-in page; many do not follow
  redirects. The preview image and the poster are public paths.
- **KakaoTalk first sends you to Safari.** Google refuses sign-in in embedded browsers, and the team shares links in
  KakaoTalk. The page detects it and offers `kakaotalk://web/openExternal`.
- **Side requests do not reset the nonce.** Safari asks for `/apple-touch-icon-precomposed.png` and `/favicon.ico` on its
  own; answering those with a new sign-in page (and a new nonce cookie) broke the sign-in that was open. Only a page
  load gets the sign-in page.
- **Two open sign-in tabs both work.** A nonce still inside its 10 minutes is reused.
- **Back where you were.** The nonce cookie carries the path you opened, so a shared link to a chapter lands on that
  chapter after signing in.
- **The address never reaches a page.** `/api/me` answers with the member id; functions read `data.user.member`.
- **Removing someone is a variable change.** The allow-list is read on every request, so a removed address is out on
  its next request; no code change, no database edit.

## Changes made in this skill (not in the source)

- `GOOGLE_HD` is a variable, optional. The source had its school domain in the code. Without it any Google account on
  the list may sign in (teams without one Workspace).
- The nonce cookie is `SameSite=None; Secure` on `http://localhost` too (the source used Lax there). A cross-site POST
  from Google does not carry a Lax cookie, so a local run with the real Google always said "try again"; Chromium
  browsers accept `Secure` cookies on localhost (checked with headless Chromium: the Lax cookie stayed behind, the
  None one arrived).
- `safeNext` also refuses `/\…`, which browsers read as `//…` (another host).
- The old `/__login` (password page) redirect is gone; new sites never had it.
- Cookie names are `site_sid` / `site_nonce` (the source had its own prefix); the arrival flag is the intro skill's
  `intro_arrive`.
- `ONCE` lists `install` and `guide`, so the onboarding tour is also once per member on any device (the source kept the
  tour's "seen" in the browser only).
- Hooks instead of imports for the optional parts: `MACHINE` (secret-header paths such as the push tick), `REWRITES`
  (the lecture reader) and `HEAD_EXTRA` (link-preview tags), so the gate runs on its own and each skill plugs in.
- The demo runs the real gate in Node with a mock Google (`assets/demo/serve.mjs`), so the whole flow can be tried and
  tested in a browser without an account. The mock is only in the demo: the shipped code always talks to Google.
