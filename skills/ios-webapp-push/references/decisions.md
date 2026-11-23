# Decisions: what changed on the way, and why

| Before or asked for | Shipped | Why |
|---|---|---|
| A native app | A web app added to the Home Screen | iOS 16.4+ gives Home Screen web apps real push notifications. No App Store, no build, the same site. |
| Instructions for every platform | iPhone only (Safari and KakaoTalk paths) | The owner asked for iPhone instructions only, and links arrive in KakaoTalk. Android and desktops simply work with the bell. |
| KakaoTalk users told to "open in Safari" in text | An **Open in Safari** button (`kakaotalk://web/openExternal?url=…`) as step 1, with the ⋯ menu path as a fallback | KakaoTalk's in-app browser cannot add to the Home Screen, and the menu path is hard to find. |
| A server push library | RFC 8291 / 8292 written with WebCrypto, tested against the RFC vector | Pages Functions have no Node crypto; a 120-line file checked against the RFC's test vector is easier to trust than a dependency. |
| VAPID subject `mailto:` an address | The site's https origin | RFC 8292 allows it, and no personal address ends up in code or in push services' logs. |
| VAPID keys and a cron secret as Cloudflare variables | Both made inside D1 on first use | Nothing to generate, paste or leak; nobody copies a secret by hand. |
| A cron on Pages | A tiny companion Worker with a `* * * * *` trigger that calls the tick | Pages has no cron. All logic stays in the site; the Worker only knocks. |
| Notify on deploy or for existing events | The first tick only records a baseline | A deploy must never flood the team. |
| One notification per date of a recurring event | A series counts once | A weekly meeting is one event to the people in it. |
| Many single notifications when a schedule is imported | More than 3 at once → one "N events added" | Ten buzzes in a row teach people to turn notifications off. |
| Reminders 26–30 minutes before | 24–30.5 minutes, once per (event, start, device) | A wider window survives a late or skipped minute tick; the key keeps it to one. |
| A reminder fixed when queued | Checked again before sending; a moved event gets a new one | Events move. A reminder for the old time is worse than none. |
| "Send a test notification" button in the sheet | Removed, with its API and strings | Once the real notifications worked it only added an endpoint to secure and a control to explain; the sheet keeps the two switches. |
| The install steps only inside the sheet | A pop-up once per member in iPhone browsers, ~0.5 s after the page, before the site guide | Steps inside a sheet are seen only by people who already look for them. Shown once, kept in the browser **and** in D1, so a second device does not nag. |
| The full site tour inside the newly installed app | The notifications sheet once instead | The installed app has its own empty storage; the member has seen the tour in Safari already, and the one thing to do in the app is to turn notifications on. |
| A password gate with session cookies (the app asked for the password after iOS closed it) | Google sign-in with 180-day sessions (`google-signin-team-gate`) | An installed app that forgets you after every notification tap is useless. Devices now belong to a member and are dropped when the member leaves the list. |
| The full project name under the icon | A one-word short name | iOS cut the full name with "…". |
| A flat icon candidate | A rendered one, in the intro's materials | "Flat" was the look already rejected for the intro. |
