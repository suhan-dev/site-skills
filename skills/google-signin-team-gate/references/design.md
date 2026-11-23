# Design: the sign-in screen

One picture, one pill, one line. The sign-in page is the first thing anyone sees, and for a stranger it is the only
thing. It should look like the start of the site, not like a login form. All styles are inline in `gatePage()`
(`functions/_middleware.js`), because the page must render before anything else of the site is allowed through.

## 1. What is on it

| Element | Shown when | Text |
|---|---|---|
| Poster (full screen) | always | none (`aria-hidden`) |
| Pill: Google mark + "Sign in with Google" | a normal browser, Google sign-in set up | "Sign in with Google" |
| Pill: "Open in Safari" / "Open in browser" | KakaoTalk on iPhone / on Android | |
| Hint (grey) | any in-app browser | "Google sign-in works in Safari, not inside this app." (Android: "…in your browser…") |
| Message (red, `role="alert"`) | after a refused or failed sign-in; or alone when sign-in is not set up | "This site is for the {{SITE_NAME}} team only." / "Couldn't sign in. Try again." / the setup line |

No title, no logo, no form, no "forgot password", no footer. The site's name is in the tab title and in the link
preview. The poster is the site's own intro picture, so the page already says what the site is.

## 2. Layout

The pill group (`.g`) is fixed at the centre of the viewport: `left: 50%; top: 50%; transform: translate(-50%, -50%)`,
width `min(320px, 100vw − 48px)`, a one-column grid with items centred. The message and hint flow below the pill and
push nothing: the pill stays at the centre whatever is under it.

Measured (Inter standing in for SF Pro; the pill keeps its 232 px minimum at every width):

| Viewport | Group (x, y, w) | Pill (x, y, w × h) |
|---|---|---|
| 1440 × 900 | 560, 428, 320 | 604, 428, 232 × 44 |
| 1024 × 768 | 352, 362, 320 | 396, 362, 232 × 44 |
| 390 × 844 | 35, 400, 320 | 79, 400, 232 × 44 |
| 375 × 667 | 28, 312, 320 | 72, 312, 232 × 44 |
| 320 × 568 | 24, 262, 272 | 44, 262, 232 × 44 |

```
1440 × 900 (and any landscape window)            390 × 844 (portrait phone)
┌──────────────────────────────────────────┐      ┌──────────────────────┐
│                                 ░░░░     │      │        ░░░░░░        │
│                              ░░ poster ░ │      │      ░░poster ░░     │
│                                 ░░░░     │      │        ░░░░░░        │
│            ╭────────────────────╮        │      │                      │
│            │ G  Sign in with Google│     │      │ ╭──────────────────╮ │
│            ╰────────────────────╯        │      │ │G Sign in with Go…│ │
│     This site is for the … team only.    │      │ ╰──────────────────╯ │
│▓▓▓ shade (bottom-left)                   │      │ one red line         │
│▓▓▓▓▓▓                                    │      │▓▓▓▓▓ shade (bottom)▓▓│
└──────────────────────────────────────────┘      └──────────────────────┘
```

The pill is horizontally centred at every width; vertically its centre sits on the viewport's centre line.

## 3. Background

Layers, back to front (`.bg`, fixed, `inset: 0`):

| Layer | Style | Why |
|---|---|---|
| Sky | `#111216` (`--sky`) on `html`, `body` and `.bg` | the colour under everything until the poster loads; also `theme-color` |
| Poster | `url(GATE_BG) 50% 50% / cover no-repeat`; `GATE_BG_TALL` when `max-aspect-ratio: 4/5` | a portrait picture for portrait screens, so the subject is not cropped away |
| Shade (`::before`) | wide: `radial-gradient(85% 70% at 0% 100%, rgba(10,11,14,.74) 0, rgba(10,11,14,.40) 40%, rgba(10,11,14,0) 74%)`; portrait or ≤ 700 px: `linear-gradient(to top, rgba(10,11,14,.78) 0, rgba(10,11,14,.42) 26%, rgba(10,11,14,0) 52%)` | the same shade the intro puts under its headline, so the two screens match |
| Dim (`::after`) | `#0b0c0f` at opacity `.6` | quiets the picture so the pill reads; the intro fades this same dim to 0 on arrival |

The demo's poster (`assets/site/assets/poster.svg`, `poster-tall.svg`) is a neutral placeholder: a stack of plates
under a soft light. Replace it with a still of your own intro (scroll-3d-intro) or any dark picture of your subject.
Keep the subject away from the centre, where the pill sits. WebP or JPEG under about 300 KB for a photo-like still.

## 4. The pill

| Property | Value |
|---|---|
| Box | `inline-flex`, centred, gap 10 px, `min-width: 232px`, height 44 px, padding 0 22 px, `border-radius: 999px` |
| Fill | `rgba(255,255,255,.12)`, border 1 px `rgba(255,255,255,.16)` |
| Glass | `backdrop-filter: blur(20px) saturate(1.4)` (with `-webkit-` prefix) |
| Text | 15 px, weight 500, letter-spacing −.01em, `#f5f5f7` (`--ink`), no underline |
| Font | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Pretendard Variable", Pretendard, "Segoe UI", system-ui, sans-serif` (Pretendard from jsDelivr) |
| Mark | Google "G", 17 × 17 px, one colour (`currentColor`), opacity .92 |
| Tap | `-webkit-tap-highlight-color: transparent` |

States:

| State | Change | Motion |
|---|---|---|
| Hover (pointer devices only, `@media (hover: hover)`) | fill `.18`, border `.24` | `background-color .2s ease`, `border-color .2s ease` |
| Pressed (`:active`) | `transform: scale(.98)` | `transform .15s ease` |
| Keyboard focus (`:focus-visible`) | outline 2 px `rgba(255,255,255,.7)`, offset 3 px | none |
| Just clicked (`.go`) | opacity .5, `pointer-events: none` (a second tap does nothing while Google loads) | `opacity .3s ease` |
| Back from Google with the Back button | `.go` removed on `pageshow` | |
| Reduced motion | all transitions off | |

"Open in Safari" uses the same pill without the mark.

## 5. Text under the pill

| | Size / line height | Colour | Margin above | Notes |
|---|---|---|---|---|
| Hint | 13 / 1.45 | `#a1a1a6` (`--ink2`) | 12 px | centred |
| Message | 13 / 1.45 | `#ff6961` (`--bad`) | 14 px | centred; `role="alert"`; `display: none` while empty |

The message is one short line. It never says why in detail ("not on the list", "wrong domain", "not verified" all read
the same), so the page tells a stranger nothing about who is on the team.

## 6. Light and dark

There is one look. The page sets `color-scheme: dark` and has no `prefers-color-scheme` rule: it sits on a dark
picture in both modes, like the intro it opens into. The screenshots `signin-1440-light.png` and
`signin-1440-dark.png` are the same picture on purpose. `theme-color` is `#111216`, so the phone's browser bar
matches the sky.

## 7. Inside KakaoTalk and other in-app browsers

Google refuses to sign in inside embedded browsers (`disallowed_useragent`). The page finds them by user agent
(`KAKAOTALK`, `NAVER(inapp`, `Instagram`, `FBAN`, `FBAV`, `Line/`, `DaumApps`, `everytimeApp`, `; wv)`) and:

- hides the Google pill;
- KakaoTalk only: shows "Open in Safari" (iPhone, iPad) or "Open in browser" (Android), a link to
  `kakaotalk://web/openExternal?url=<this address>`, which KakaoTalk hands to the system browser;
- shows the one-line hint under it.

Other in-app browsers have no such link, so only the hint shows; their own menu has "Open in browser".

## 8. From sign-in to the intro (one scene)

With scroll-3d-intro on the site, signing in reads as one continuous scene:

1. The sign-in page shows the poster (the intro's settled first frame) under the shade and the `.6` dim.
2. A click on the pill (only when the return address is `/`) sets `sessionStorage.intro_arrive = "1"` and removes
   `intro_seen`, so the intro plays once more.
3. Google posts back, the gate answers 303 to `/`.
4. The intro's head script sees `intro_arrive` and adds `html.ix-login`: the stage starts on the same poster with the
   same `.6` dim, which fades to 0 over `.7s cubic-bezier(.3,0,.2,1)` while the headline rises (`.8s`, delay `.3s`).
   Then the 3D scene takes over from the still.

Without the intro, `/` simply opens the app.

## 9. Accessibility

- The pill is a real link (`<a href>`): it works without JavaScript, with the keyboard (it is the first stop of Tab),
  and with screen readers ("Sign in with Google, link").
- The poster is `aria-hidden`; the mark is `aria-hidden`.
- The message is `role="alert"`, so it is read out when the page comes back with it.
- Text contrast, measured on the demo screenshots: pill text on the pill 11.6 : 1, the red message 6.7 : 1 and the
  grey hint 7.3 : 1 on the dimmed sky. Check again with your own poster: a bright picture behind the centre lowers it.
- 44 px tap height. Nothing scrolls (`overflow: hidden` on `body`; the group fits a 320 × 480 screen).
