# Components and their states

> Written by hand. Every value is copied from the skill CSS (or JS where a state is set by script) and links to its line.
> Token values for light and dark are in [tokens.md](tokens.md); every transition is in [motion.md](motion.md). When a
> value changes in the code, change it here in the same pull request.

Each table lists the states a control can be in:

| State | Meaning here |
|---|---|
| Default | How it looks at rest, wider than a phone. |
| Hover | `:hover` with a pointer. |
| Pressed | `:active`. |
| Focus | `:focus-visible` (keyboard focus), or `:focus` where the CSS uses that. |
| Disabled | `:disabled`, or a class that does the same job. |
| Selected | `:checked`, `aria-pressed`, `aria-selected`, `aria-checked` or `aria-expanded`, whichever the control uses. |
| Dark | What changes in dark mode. "Tokens" means only token values change (see [tokens.md](tokens.md)). |
| Phone | What changes at `max-width:760px` and below. |

"Not specified" means the skill CSS has no rule for that state; only the rules in the next section apply.

## Contents

- [Rules every component shares](#rules-every-component-shares)
- [The 44 px tap-area rule](#the-44-px-tap-area-rule)
- [Header bar and tabs](#header-bar-and-tabs)
- [Icon buttons](#icon-buttons)
- [Language and theme buttons](#language-and-theme-buttons)
- [Name pill](#name-pill)
- [Buttons: primary, ghost, danger, small](#buttons-primary-ghost-danger-small)
- [Pill nav ‹ Today ›](#pill-nav--today-)
- [Segmented control](#segmented-control)
- [Choice pills](#choice-pills)
- [Switch](#switch)
- [Fields](#fields)
- [Dialogs and phone sheets](#dialogs-and-phone-sheets)
- [Banners, notes and status lines](#banners-notes-and-status-lines)
- [Document typography](#document-typography)
- [Chat: Copy · Comment bar and marks](#chat-copy--comment-bar-and-marks)

## Rules every component shares

| Rule | Value | Where |
|---|---|---|
| Focus ring | `:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 55%,transparent);outline-offset:1px}`. Every focusable control gets it unless a row below says otherwise. | [tokens.css:65](../../skills/team-site-design-system/assets/tokens.css#L65) |
| Pressed | No skill CSS file has an `:active` rule. The only one is on the sign-in page's own button, inside a JS file: `.pill:active{transform:scale(.98)}`. | [_middleware.js:121](../../skills/google-signin-team-gate/assets/functions/_middleware.js#L121) |
| Button reset | `button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0;letter-spacing:inherit}` | [tokens.css:63](../../skills/team-site-design-system/assets/tokens.css#L63) |
| Field reset | `input,textarea,select{font:inherit;color:inherit;letter-spacing:inherit}` | [tokens.css:64](../../skills/team-site-design-system/assets/tokens.css#L64) |
| Links | `--accent`, no underline; on hover an underline 2 px below the text. | [tokens.css:61–62](../../skills/team-site-design-system/assets/tokens.css#L61-L62) |
| Double tap | `html{touch-action:manipulation}`: no double-tap zoom anywhere. Upright phones: `pan-x pan-y`. | [tokens.css:53](../../skills/team-site-design-system/assets/tokens.css#L53), [components.css:213](../../skills/team-site-design-system/assets/components.css#L213) |
| Dark mode | Through the tokens. Rules written for dark mode directly: the Copy · Comment bar, the reader's dim layer and SVG figures (below). | [chat.css:107–108](../../skills/team-chat/assets/site/css/chat.css#L107-L108), [reader.css:63–64](../../skills/lecture-notes-reader/assets/site/css/reader.css#L63-L64), [reader.css:148–153](../../skills/lecture-notes-reader/assets/site/css/reader.css#L148-L153), [theory.css:74–75](../../skills/lecture-notes-reader/assets/site/css/theory.css#L74-L75) |
| Reduced motion | Removes the dialog and sheet animation and the switch transitions in `components.css`. Colour transitions stay. | [components.css:214](../../skills/team-site-design-system/assets/components.css#L214) |

## The 44 px tap-area rule

On phones (`max-width:760px`) every control can be tapped over at least 44 px. Controls in the page rhythm get the real
size; small text controls keep their look and get an invisible hit area from `::after`.

| How | Controls | Where |
|---|---|---|
| Real size, 44 px | `.brand` (44 tall), `.me` (44 × min 44), `.lang-btn` (44 × min 44, round), `.icon-btn` (44 × 44), `.btn` (44 tall, padding `0 16px`), `.btn.sq` (44 wide), `.fld input` (44 tall), `.chk` (min-height 44) | [components.css:177–188](../../skills/team-site-design-system/assets/components.css#L177-L188) |
| Hit area `::after`, `width:max(100%,44px);height:max(100%,44px)`, centred | `.pill-nav .btn`, `.segmented button`, `.btn.small`, `.dlg-top .icon-btn`, `.seg span` | [components.css:190–192](../../skills/team-site-design-system/assets/components.css#L190-L192) |
| Hit area `::after`, full width, 44 tall | the calendar's `.cal-nav .btn` and `.cal-view button` | [calendar.css:206–207](../../skills/shared-google-calendar/assets/site/css/calendar.css#L206-L207) |
| Hit area `::after`, centred, max(100%,44px) | the reading-list filters `.chips button` | [refs.css:130–131](../../skills/references-library/assets/site/css/refs.css#L130-L131) |
| Hit area `::after`, centred, max(100%,44px) | the log's column links, member-tab links and the closing-table summary | [records.css:111–113](../../skills/weekly-research-log/assets/site/css/records.css#L111-L113) |
| Real size, 44 px, elsewhere | calendar legend buttons, reading-list search, week tabs (min-height), member tabs, chat close button, reader tools, guide buttons, intro dots on a touch screen | [calendar.css:195](../../skills/shared-google-calendar/assets/site/css/calendar.css#L195), [refs.css:129](../../skills/references-library/assets/site/css/refs.css#L129), [records.css:105](../../skills/weekly-research-log/assets/site/css/records.css#L105), [records.css:110](../../skills/weekly-research-log/assets/site/css/records.css#L110), [chat.css:89](../../skills/team-chat/assets/site/css/chat.css#L89), [reader.css:203](../../skills/lecture-notes-reader/assets/site/css/reader.css#L203), [guide.css:18](../../skills/first-visit-spotlight-guide/assets/site/css/guide.css#L18), [intro.css:72](../../skills/scroll-3d-intro/assets/intro.css#L72) |

Small phones narrow some header controls; the height stays 44 px:

| Width | `.icon-btn` | `.lang-btn` | `.me` | Where |
|---|---|---|---|---|
| 761 px and up | 32 × 32 | 32 tall, min-width 34 | 30 tall | [components.css:31](../../skills/team-site-design-system/assets/components.css#L31), [components.css:24](../../skills/team-site-design-system/assets/components.css#L24), [components.css:18](../../skills/team-site-design-system/assets/components.css#L18) |
| 375–760 px | 44 × 44 | 44 × min 44 | 44 × min 44 | [components.css:179–181](../../skills/team-site-design-system/assets/components.css#L179-L181) |
| 341–374 px | 38 wide | min-width 38 | min-width 38 | [components.css:197–199](../../skills/team-site-design-system/assets/components.css#L197-L199) |
| 340 px and less | 36 wide | min-width 36 | min-width 36 | [components.css:205–207](../../skills/team-site-design-system/assets/components.css#L205-L207) |

The `max-width:460px` block also sets `.icon-btn{width:30px}`, `.lang-btn{min-width:30px;padding:0 4px}` and
`.me{padding:0 8px}` ([components.css:167–170](../../skills/team-site-design-system/assets/components.css#L167-L170)). The 44 px block comes later in the same file with the same selectors ([components.css:179–181](../../skills/team-site-design-system/assets/components.css#L179-L181)), so
between 375 and 460 px those three lines have no effect: the controls stay 44 px (checked in a browser). The other lines
of that block (name text hidden, no gap between header buttons) do apply.

Controls that stay under 44 px on phones, with no hit area:

| Control | Size on phones | Where |
|---|---|---|
| Header tabs | 38 px tall (the second header row) | [components.css:159](../../skills/team-site-design-system/assets/components.css#L159) |
| Chat filter tabs (All · This page) | 30 px tall | [chat.css:88](../../skills/team-chat/assets/site/css/chat.css#L88) |
| Chat send button | 34 × 34 | [chat.css:100](../../skills/team-chat/assets/site/css/chat.css#L100) |
| Chat: remove the quote | 36 × 36 | [chat.css:101](../../skills/team-chat/assets/site/css/chat.css#L101) |
| Chat: Delete on a message | min-height 32 | [chat.css:93](../../skills/team-chat/assets/site/css/chat.css#L93) |

## Header bar and tabs

`components.css`. The bar is sticky, glass, one row of 52 px; on phones two rows (44 + 38).

| Part | Value | Where |
|---|---|---|
| Bar | `position:sticky;top:0;z-index:30`, background `color-mix(in srgb,var(--paper) 78%,transparent)`, `backdrop-filter:saturate(1.8) blur(20px)`, bottom hairline `.5px solid var(--sep2)` | [components.css:6–7](../../skills/team-site-design-system/assets/components.css#L6-L7) |
| Inner row | max-width 1280 px, padding `0 28px`, height 52 px, grid `minmax(max-content,1fr) auto minmax(max-content,1fr)`, gap 20 px | [components.css:10](../../skills/team-site-design-system/assets/components.css#L10) |
| Inner row, 761–1023 px | padding `0 20px`, gap 12 px | [components.css:145](../../skills/team-site-design-system/assets/components.css#L145) |
| Inner row, phones | height auto, grid `auto 1fr`, padding `0 6px 0 16px`; the buttons on row 1, the tabs on row 2 across the width | [components.css:156–158](../../skills/team-site-design-system/assets/components.css#L156-L158) |
| Inner row, ≤ 460 / ≤ 374 px | column gap 8 px / padding-left 14 px and column gap 6 px | [components.css:165](../../skills/team-site-design-system/assets/components.css#L165), [components.css:196](../../skills/team-site-design-system/assets/components.css#L196) |
| Right side | flex, gap 6 px; gap 0 on phones | [components.css:17](../../skills/team-site-design-system/assets/components.css#L17), [components.css:178](../../skills/team-site-design-system/assets/components.css#L178) |
| Brand | 15 px 600, −.015em, radius 8 px, padding `4px 6px 4px 2px`; hover opacity .72; phones 44 px tall, padding `0 8px 0 0`; ≤ 340 px 14 px | [components.css:11–12](../../skills/team-site-design-system/assets/components.css#L11-L12), [components.css:177](../../skills/team-site-design-system/assets/components.css#L177), [components.css:204](../../skills/team-site-design-system/assets/components.css#L204) |

Tabs (`.tabs a`):

| State | Look | Where |
|---|---|---|
| Default | 52 px tall, padding `0 14px`, `--ink3`, 13.5 px 500, −.006em; `box-shadow:inset 0 0 0 transparent`; `transition:color .15s,box-shadow .15s` | [components.css:14](../../skills/team-site-design-system/assets/components.css#L14) |
| Hover | `--ink` | [components.css:15](../../skills/team-site-design-system/assets/components.css#L15) |
| Pressed | Not specified | |
| Focus | The shared focus ring | [tokens.css:65](../../skills/team-site-design-system/assets/tokens.css#L65) |
| Disabled | Not specified | |
| Selected (`aria-selected=true`) | `--ink`, 600, a 2 px underline drawn as `box-shadow:inset 0 -2px 0 var(--ink)` (no layout shift) | [components.css:16](../../skills/team-site-design-system/assets/components.css#L16) |
| Dark | Tokens: `--ink3` and `--ink` change | [tokens.css:7](../../skills/team-site-design-system/assets/tokens.css#L7), [tokens.css:22](../../skills/team-site-design-system/assets/tokens.css#L22) |
| 761–1023 px | padding `0 10px` | [components.css:146](../../skills/team-site-design-system/assets/components.css#L146) |
| Phone | 38 px tall, padding `0 4px`, spread edge to edge (`justify-content:space-between`), right margin 10 px; ≤ 374 px 12.5 px and padding `0 3px`; ≤ 340 px 11.5 px, padding `0 2px`, no gap | [components.css:158–159](../../skills/team-site-design-system/assets/components.css#L158-L159), [components.css:200–201](../../skills/team-site-design-system/assets/components.css#L200-L201), [components.css:208–209](../../skills/team-site-design-system/assets/components.css#L208-L209) |

## Icon buttons

`.icon-btn` in `components.css`: the bell, the chat button, sign out, the theme button and the dialog close button.

| State | Look | Where |
|---|---|---|
| Default | 32 × 32 circle, `--ink2`; icon 18 px, `fill:none`, `stroke:currentColor`, stroke 1.7, round caps and joins | [components.css:31](../../skills/team-site-design-system/assets/components.css#L31), [components.css:33](../../skills/team-site-design-system/assets/components.css#L33) |
| Hover | `--fill` background, `--ink` | [components.css:32](../../skills/team-site-design-system/assets/components.css#L32) |
| Pressed | Not specified | |
| Focus | The shared focus ring | [tokens.css:65](../../skills/team-site-design-system/assets/tokens.css#L65) |
| Disabled | Not specified | |
| Selected | Chat button open (`aria-expanded=true`): `--ink` on `--fill` | [components.css:29](../../skills/team-site-design-system/assets/components.css#L29) |
| Dark | Tokens | |
| Phone | 44 × 44; 38 wide at ≤ 374 px, 36 wide at ≤ 340 px (see the 44 px rule) | [components.css:181](../../skills/team-site-design-system/assets/components.css#L181), [components.css:199](../../skills/team-site-design-system/assets/components.css#L199), [components.css:207](../../skills/team-site-design-system/assets/components.css#L207) |

Variants:

| Variant | Value | Where |
|---|---|---|
| Chat button | the bubble icon is 19 px; unread: `.chat-dot`, 8 px, `--accent`, ring `0 0 0 2px var(--paper)`, at `top:calc(50% - 11px);left:calc(50% + 5px)` | [components.css:27–30](../../skills/team-site-design-system/assets/components.css#L27-L30) |
| Chat button in the reader | `.rd-tool.chat-btn`: 30 px wide, round; dot at `top:calc(50% - 10px);left:calc(50% + 4px)`; phones 44 px wide | [chat.css:134–136](../../skills/team-chat/assets/site/css/chat.css#L134-L136) |
| Sign out | hidden at `max-width:960px` (it moves into the name menu) | [components.css:154](../../skills/team-site-design-system/assets/components.css#L154) |
| Dialog close | `.dlg-top .icon-btn`: 28 × 28 on `--fill`, icon 14 px with stroke 2.2. It keeps 28 px on phones (its two-class selector beats `.icon-btn{width:44px;height:44px}`) and gets the 44 px hit area | [components.css:91–92](../../skills/team-site-design-system/assets/components.css#L91-L92), [components.css:190–192](../../skills/team-site-design-system/assets/components.css#L190-L192) |
| Chat close | `.chat-x`: 30 × 30, icon 15 px stroke 2; phones 44 × 44 | [chat.css:26–27](../../skills/team-chat/assets/site/css/chat.css#L26-L27), [chat.css:89](../../skills/team-chat/assets/site/css/chat.css#L89) |

## Language and theme buttons

Language (`.lang-btn`): one button that shows the language in use, EN or KO.

| State | Look | Where |
|---|---|---|
| Default | 32 px tall, min-width 34 px, padding `0 6px`, radius 999 px, 12 px 600, +.03em, `--ink2` | [components.css:24](../../skills/team-site-design-system/assets/components.css#L24) |
| Hover | `--fill` background, `--ink` | [components.css:25](../../skills/team-site-design-system/assets/components.css#L25) |
| Pressed | Not specified | |
| Focus | The shared focus ring | [tokens.css:65](../../skills/team-site-design-system/assets/tokens.css#L65) |
| Disabled | Not specified | |
| Selected | No selected style: the label itself shows the language | |
| Dark | Tokens | |
| Phone | 44 px tall, min-width 44 px, padding `0 6px`, `border-radius:50%`; min-width 38 px and padding `0 4px` at ≤ 374 px; min-width 36 px at ≤ 340 px | [components.css:180](../../skills/team-site-design-system/assets/components.css#L180), [components.css:198](../../skills/team-site-design-system/assets/components.css#L198), [components.css:206](../../skills/team-site-design-system/assets/components.css#L206) |

Theme (`.theme-btn`, an icon button). `aria-pressed=true` means dark.

| State | Look | Where |
|---|---|---|
| Default (light) | a filled moon, 17 px, `fill:currentColor`, no stroke | [components.css:34–35](../../skills/team-site-design-system/assets/components.css#L34-L35) |
| Selected (`aria-pressed=true`, dark) | the moon is hidden and the sun shows | [components.css:36–37](../../skills/team-site-design-system/assets/components.css#L36-L37), [theme.js:26](../../skills/team-site-design-system/assets/theme.js#L26) |
| Other states | As the icon button above | |
| Reader | `#rd-theme` in the reader's top line: the same two icons, the moon 15 px | [reader.css:18–21](../../skills/lecture-notes-reader/assets/site/css/reader.css#L18-L21) |

## Name pill

`.me` in `components.css`: a coloured dot and the member's name; it opens the name menu.

| State | Look | Where |
|---|---|---|
| Default | 30 px tall, padding `0 10px 0 8px`, radius 999 px, gap 7 px, 13 px 500, `--ink2`; with `.set`: `--ink`. The CSS does not say what `.set` means; [design.md](../../skills/team-site-design-system/references/design.md) calls the other state "not signed in", and the demos write `.set` in the markup | [components.css:18](../../skills/team-site-design-system/assets/components.css#L18), [components.css:22](../../skills/team-site-design-system/assets/components.css#L22) |
| Dot | 10 px circle in the member colour `var(--c,var(--ink4))`, ring `inset 0 0 0 1px rgba(0,0,0,.06)` | [components.css:20](../../skills/team-site-design-system/assets/components.css#L20) |
| Without `.set` | an empty ring: no fill, `inset 0 0 0 1.5px var(--ink4)` | [components.css:21](../../skills/team-site-design-system/assets/components.css#L21) |
| Hover | `--fill` background | [components.css:19](../../skills/team-site-design-system/assets/components.css#L19) |
| Pressed, disabled | Not specified | |
| Focus | The shared focus ring | [tokens.css:65](../../skills/team-site-design-system/assets/tokens.css#L65) |
| Dark | Tokens; the dot's `rgba(0,0,0,.06)` ring stays the same | [components.css:20](../../skills/team-site-design-system/assets/components.css#L20) |
| 761–900 px | padding `0 10px`; the name is hidden, the dot stays | [components.css:151–152](../../skills/team-site-design-system/assets/components.css#L151-L152) |
| Phone | 44 px tall, min-width 44 px, centred, padding `0 10px`; the name at most 6em with an ellipsis; at ≤ 460 px the name is hidden; min-width 38 px and padding `0 6px` at ≤ 374 px; min-width 36 px at ≤ 340 px | [components.css:179](../../skills/team-site-design-system/assets/components.css#L179), [components.css:160](../../skills/team-site-design-system/assets/components.css#L160), [components.css:168](../../skills/team-site-design-system/assets/components.css#L168), [components.css:197](../../skills/team-site-design-system/assets/components.css#L197), [components.css:205](../../skills/team-site-design-system/assets/components.css#L205) |

## Buttons: primary, ghost, danger, small

`.btn` in `components.css`, plus `.btn.tint` from `push.css`.

| Variant | Default | Hover | Disabled | Armed / selected | Where |
|---|---|---|---|---|---|
| `.btn` | inline-flex, 32 px tall, padding `0 15px`, radius 999 px, 13.5 px 500, −.01em, `--ink`, gap 6 px; icon 16 px, stroke 2; `transition:background .15s,opacity .15s` | no change (no underline) | Not specified | — | [components.css:43–46](../../skills/team-site-design-system/assets/components.css#L43-L46) |
| `.btn.ghost` | `--fill` | `--fill2` | Not specified | — | [components.css:48–49](../../skills/team-site-design-system/assets/components.css#L48-L49) |
| `.btn.primary` | `--accent`, text `--on-accent` | `--accent2` | `opacity:.4;cursor:default` | — | [components.css:50–52](../../skills/team-site-design-system/assets/components.css#L50-L52) |
| `.btn.danger` | text `--bad` on `color-mix(in srgb,var(--bad) 10%,transparent)` | 16 % | Not specified | `.armed`: solid `--bad`, text `#fff` | [components.css:53–55](../../skills/team-site-design-system/assets/components.css#L53-L55) |
| `.btn.small` | 28 px tall, padding `0 12px`, 12.5 px | as its colour class | as its colour class | — | [components.css:56](../../skills/team-site-design-system/assets/components.css#L56) |
| `.btn.sq` | 32 px wide, no padding (an icon) | as its colour class | as its colour class | — | [components.css:47](../../skills/team-site-design-system/assets/components.css#L47) |
| `.btn.tint` | `--accent` text on `color-mix(in srgb,var(--accent) 12%,transparent)` | 18 % | Not specified | — | [push.css:64–65](../../skills/ios-webapp-push/assets/site/css/push.css#L64-L65) |

| State | All variants | Where |
|---|---|---|
| Pressed | Not specified | |
| Focus | The shared focus ring | [tokens.css:65](../../skills/team-site-design-system/assets/tokens.css#L65) |
| Armed (calendar Delete) | The first click adds `.armed` and changes the label; the second deletes. The calendar clears `.armed` when the event sheet opens again (no timer). The chat's own Delete link disarms after 3000 ms. | [calendar.js:547–553](../../skills/shared-google-calendar/assets/site/js/calendar.js#L547-L553), [calendar.js:456](../../skills/shared-google-calendar/assets/site/js/calendar.js#L456), [chat.js:550](../../skills/team-chat/assets/site/js/chat.js#L550) |
| Dark | Tokens: `--fill`, `--fill2`, `--accent`, `--accent2`, `--bad` change; `--on-accent` and the armed `#fff` stay white | [tokens.css:23](../../skills/team-site-design-system/assets/tokens.css#L23), [tokens.css:25–26](../../skills/team-site-design-system/assets/tokens.css#L25-L26) |
| Phone | `.btn` 44 px tall, padding `0 16px`; `.btn.sq` 44 px wide; `.btn.small` keeps 28 px (two classes beat one) and gets the 44 px hit area | [components.css:182–183](../../skills/team-site-design-system/assets/components.css#L182-L183), [components.css:190–192](../../skills/team-site-design-system/assets/components.css#L190-L192) |
| External-link mark | `.btn .ext` at opacity .55 | [components.css:57](../../skills/team-site-design-system/assets/components.css#L57) |

Buttons with their own sizes:

| Where it is | Value | Where |
|---|---|---|
| "Add to Home Screen" sheet | buttons 36 px tall, padding `0 18px`, 14 px; "Not now" `--ink2`, hover `--fill`. Phones: stacked, "Got it" 50 px tall, 16 px 600; "Not now" 44 px tall, 500 | [push.css:67–69](../../skills/ios-webapp-push/assets/site/css/push.css#L67-L69), [push.css:72–74](../../skills/ios-webapp-push/assets/site/css/push.css#L72-L74) |
| Install steps | `.install-steps .btn` 36 px tall, padding `0 16px`, 14 px | [push.css:63](../../skills/ios-webapp-push/assets/site/css/push.css#L63) |
| Guide Next | `.guide-next`: 44 px tall, min-width 76 px, padding `0 18px`, 14 px 500, `--on-accent`. The blue pill is its `::before`, inset `4px 0`, `--accent` (so it looks 36 px tall inside a 44 px target); hover `--accent2`; focus ring drawn on the `::before` | [guide.css:27–32](../../skills/first-visit-spotlight-guide/assets/site/css/guide.css#L27-L32) |
| Guide Skip and Back | plain text, min 44 × 44, padding `0 12px`, radius 10 px, 500; Skip 13.5 px `--ink3`, Back 14 px `--ink2`; hover `--ink`; Back disabled on the first step: `visibility:hidden` | [guide.css:18–22](../../skills/first-visit-spotlight-guide/assets/site/css/guide.css#L18-L22) |
| Log page head, phones | the GitHub link: 30 px tall, padding `0 12px`, 12.5 px, with a 44 px tall `::after` | [records.css:99–100](../../skills/weekly-research-log/assets/site/css/records.css#L99-L100) |

## Pill nav ‹ Today ›

Previous · Today · Next in one pill. `components.css` styles the buttons inside `.pill-nav` but has no rule for the
`.pill-nav` box itself ([components.css:69–72](../../skills/team-site-design-system/assets/components.css#L69-L72)). The calendar uses its own `.cal-nav`, which adds the track ([calendar.css:13–17](../../skills/shared-google-calendar/assets/site/css/calendar.css#L13-L17)).

| State | Look | Where |
|---|---|---|
| Track (`.cal-nav`) | flex, padding 2 px, radius 999 px, `--fill` | [calendar.css:13](../../skills/shared-google-calendar/assets/site/css/calendar.css#L13) |
| Default | the buttons are `.btn.ghost` at 28 px tall, padding `0 12px`, 13 px, no background; arrows (`.sq`) 30 px wide; icons 16 px, stroke 2.3 | [components.css:69–70](../../skills/team-site-design-system/assets/components.css#L69-L70), [components.css:72](../../skills/team-site-design-system/assets/components.css#L72), [calendar.css:14–15](../../skills/shared-google-calendar/assets/site/css/calendar.css#L14-L15), [calendar.css:17](../../skills/shared-google-calendar/assets/site/css/calendar.css#L17) |
| Hover | `--fill` (on the `--fill` track) | [components.css:71](../../skills/team-site-design-system/assets/components.css#L71), [calendar.css:16](../../skills/shared-google-calendar/assets/site/css/calendar.css#L16) |
| Pressed | Not specified | |
| Focus | The shared focus ring | [tokens.css:65](../../skills/team-site-design-system/assets/tokens.css#L65) |
| Disabled, selected | Not specified | |
| Dark | Tokens | |
| Phone | buttons 30 px tall, padding `0 11px`; arrows stay 30 px wide; 44 px hit areas (see the rule above) | [components.css:184–185](../../skills/team-site-design-system/assets/components.css#L184-L185), [calendar.css:198–199](../../skills/shared-google-calendar/assets/site/css/calendar.css#L198-L199) |
| Phone, calendar | Today becomes a small calendar page with the date: `#cal-today` 34 px wide, its word hidden; `.tdy` 18 × 18, border 1.5 px (top 3.5 px), radius 4.5 px, `700 9.5px/1` | [calendar.css:201–204](../../skills/shared-google-calendar/assets/site/css/calendar.css#L201-L204) |
| ≤ 340 px, calendar | arrows 26 px wide | [calendar.css:267](../../skills/shared-google-calendar/assets/site/css/calendar.css#L267) |

## Segmented control

Week | Month. `.segmented` in `components.css`; the calendar's `.cal-view` repeats the same values.

| State | Look | Where |
|---|---|---|
| Track | flex, padding 2 px, radius 999 px, `--fill` | [components.css:76](../../skills/team-site-design-system/assets/components.css#L76), [calendar.css:19](../../skills/shared-google-calendar/assets/site/css/calendar.css#L19) |
| Default | buttons 28 px tall, min-width 62 px, padding `0 12px`, radius 999 px, 13 px 500, `--ink2`; `transition:background .15s,color .15s` | [components.css:77](../../skills/team-site-design-system/assets/components.css#L77), [calendar.css:20](../../skills/shared-google-calendar/assets/site/css/calendar.css#L20) |
| Hover | `--ink` | [components.css:78](../../skills/team-site-design-system/assets/components.css#L78), [calendar.css:21](../../skills/shared-google-calendar/assets/site/css/calendar.css#L21) |
| Pressed | Not specified | |
| Focus | The shared focus ring | [tokens.css:65](../../skills/team-site-design-system/assets/tokens.css#L65) |
| Disabled | Not specified | |
| Selected (`aria-pressed=true`) | the knob: `--seg-on` background, `--ink`, 600, `box-shadow:0 1px 3px rgba(0,0,0,.1),0 0 0 .5px rgba(0,0,0,.04)` | [components.css:79](../../skills/team-site-design-system/assets/components.css#L79), [calendar.css:22](../../skills/shared-google-calendar/assets/site/css/calendar.css#L22) |
| Dark | Tokens: `--seg-on` `#ffffff` → `#636366`, `--fill` .12 → .24. The knob's shadow is written in `rgba()` and stays the same | [tokens.css:8](../../skills/team-site-design-system/assets/tokens.css#L8), [tokens.css:23](../../skills/team-site-design-system/assets/tokens.css#L23) |
| Phone | buttons 30 px tall, min-width 0, padding `0 10px`; 44 px hit areas; calendar at ≤ 340 px: 12 px, padding `0 7px` | [components.css:186](../../skills/team-site-design-system/assets/components.css#L186), [calendar.css:205](../../skills/shared-google-calendar/assets/site/css/calendar.css#L205), [calendar.css:268](../../skills/shared-google-calendar/assets/site/css/calendar.css#L268) |

The chat's filter (`.chat-tabs`, All · This page) is a smaller cousin: track radius 8 px, padding 2 px, `--fill`;
buttons 26 px tall, padding `0 10px`, radius 6 px, 12.5 px 500, `--ink2`; selected with `aria-selected=true`:
`--seg-on`, `--ink`, `box-shadow:0 1px 2px rgba(0,0,0,.08)`; the unread count `.n` 600 in `--accent`. It has no hover
rule. Phones: 30 px tall, padding `0 12px`, 13 px, no hit area ([chat.css:21–25](../../skills/team-chat/assets/site/css/chat.css#L21-L25), [chat.css:88](../../skills/team-chat/assets/site/css/chat.css#L88)).

## Choice pills

`.seg` in `components.css`: a radio input hidden inside each pill, a dot in the member colour `--c`.

| State | Look | Where |
|---|---|---|
| Default | row, wrap, gap 6 px; the input is `opacity:0`; the pill 30 px tall, padding `0 12px 0 10px`, radius 999 px, `--fill`, 13 px 500, `--ink2`; a 9 px dot in `--c` | [components.css:103–107](../../skills/team-site-design-system/assets/components.css#L103-L107) |
| Hover | Not specified | |
| Pressed | Not specified | |
| Focus | the ring is drawn on the pill: `.seg input:focus-visible+span` | [components.css:109](../../skills/team-site-design-system/assets/components.css#L109) |
| Disabled | Not specified | |
| Selected (`:checked`) | `color-mix(in srgb,var(--c) var(--ev-bg),var(--card))`, `--ink`, 600, ring `inset 0 0 0 1.5px var(--c)` | [components.css:108](../../skills/team-site-design-system/assets/components.css#L108) |
| Dark | Tokens: `--ev-bg` 15 % → 26 %, `--card` `#ffffff` → `#2c2c2e`, the member colours | [tokens.css:16](../../skills/team-site-design-system/assets/tokens.css#L16), [tokens.css:31](../../skills/team-site-design-system/assets/tokens.css#L31) |
| Phone | gap `10px 8px`; 44 px hit area on each pill | [components.css:193](../../skills/team-site-design-system/assets/components.css#L193), [components.css:190–192](../../skills/team-site-design-system/assets/components.css#L190-L192) |

## Switch

`.sw` inside a `.sw-row` button, in `components.css`. Green when on.

| State | Look | Where |
|---|---|---|
| Default (off) | 51 × 31 px, radius 16 px, `--sw-off`; knob 27 px at `left:2px;top:2px`, `--sw-knob`, shadow `0 3px 8px rgba(0,0,0,.15),0 1px 1px rgba(0,0,0,.16)` | [components.css:121–123](../../skills/team-site-design-system/assets/components.css#L121-L123) |
| Selected (`aria-checked=true`) | track `--sw-on`, knob `translateX(20px)` | [components.css:124–125](../../skills/team-site-design-system/assets/components.css#L124-L125) |
| Motion | track `background .2s ease`, knob `transform .22s cubic-bezier(.3,.7,.4,1)`; none with reduced motion | [components.css:121](../../skills/team-site-design-system/assets/components.css#L121), [components.css:123](../../skills/team-site-design-system/assets/components.css#L123), [components.css:214](../../skills/team-site-design-system/assets/components.css#L214) |
| Hover, pressed | Not specified | |
| Focus | the row shows no ring; the track does, with offset 2 px | [components.css:126–127](../../skills/team-site-design-system/assets/components.css#L126-L127) |
| Disabled | in the notifications sheet: `.push-row:disabled` dims the words and the switch to opacity .42, `cursor:default` | [push.css:19–20](../../skills/ios-webapp-push/assets/site/css/push.css#L19-L20) |
| Dark | `--sw-on` `#34c759` → `#30d158`, `--sw-off` `rgba(120,120,128,.16)` → `.32`; the knob stays `#ffffff` | [components.css:117–119](../../skills/team-site-design-system/assets/components.css#L117-L119) |
| Phone | the same size; a notification row is at least 60 px tall | [push.css:18](../../skills/ios-webapp-push/assets/site/css/push.css#L18) |

## Fields

`.fld` in `components.css`: a label above an input or textarea, no border.

| State | Look | Where |
|---|---|---|
| Label | `.fld>span`: 12 px 500, `--ink3`, padding-left 2 px; label and field 5 px apart | [components.css:93–94](../../skills/team-site-design-system/assets/components.css#L93-L94) |
| Default | 38 px tall, padding `0 12px`, radius 10 px, no border, `--fill`, `outline:none`; `transition:box-shadow .15s,background .15s` | [components.css:95](../../skills/team-site-design-system/assets/components.css#L95) |
| Textarea | height auto, padding `9px 12px`, `resize:vertical`, line height 1.55 | [components.css:96](../../skills/team-site-design-system/assets/components.css#L96) |
| Placeholder | `--ink4` | [components.css:98](../../skills/team-site-design-system/assets/components.css#L98) |
| Hover | Not specified | |
| Focus (`:focus`) | background `--card`, ring `0 0 0 1px var(--accent),0 0 0 4px color-mix(in srgb,var(--accent) 22%,transparent)` | [components.css:97](../../skills/team-site-design-system/assets/components.css#L97) |
| Disabled | Not specified in the CSS. The calendar disables its fields when it cannot write | [calendar.js:495](../../skills/shared-google-calendar/assets/site/js/calendar.js#L495) |
| Dark | Tokens: `--fill`, `--card`, `--accent` | |
| Phone | 16 px text (iOS does not zoom in on focus); inputs 44 px tall | [components.css:137](../../skills/team-site-design-system/assets/components.css#L137), [components.css:187](../../skills/team-site-design-system/assets/components.css#L187) |

Other fields:

| Field | Value | Where |
|---|---|---|
| Date and time (event sheet) | `.dt-row`: Starts · Ends side by side wider than a phone; inputs `display:block`, min-width 0, `padding-block:8px`, `appearance:none`, value from the left; the arrow `--ink4` | [calendar.css:156–161](../../skills/shared-google-calendar/assets/site/css/calendar.css#L156-L161) |
| Date and time, phones | `padding-block:10px`; the word beside the field, 15 px 400 `--ink`; touch screens hide the picker icon; ≤ 340 px the words go back above the fields (12 px 500 `--ink3`) | [calendar.css:239–243](../../skills/shared-google-calendar/assets/site/css/calendar.css#L239-L243), [calendar.css:257](../../skills/shared-google-calendar/assets/site/css/calendar.css#L257), [calendar.css:269–272](../../skills/shared-google-calendar/assets/site/css/calendar.css#L269-L272) |
| Event sheet width | 620 px wider than a phone | [calendar.css:155](../../skills/shared-google-calendar/assets/site/css/calendar.css#L155) |
| Reading-list search | 34 px tall, min-width 240 px, max-width 380 px, radius 10 px, `--fill`; focus as `.fld`; phones 44 px tall, 16 px, full width | [refs.css:62–63](../../skills/references-library/assets/site/css/refs.css#L62-L63), [refs.css:129](../../skills/references-library/assets/site/css/refs.css#L129) |
| Chat composer | `.chat-in textarea`: min 36 px, max 132 px tall, padding `8px 12px`, radius 18 px, `.5px solid var(--sep2)`, `--paper`, 14 px / 1.4; focus: border `color-mix(in srgb,var(--accent) 60%,transparent)` and ring `0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent)`; phones 16 px, min 38 px, padding `8px 14px` | [chat.css:66–68](../../skills/team-chat/assets/site/css/chat.css#L66-L68), [chat.css:99](../../skills/team-chat/assets/site/css/chat.css#L99) |
| Chat send | 32 px circle, `--accent`, `--on-accent`, icon 16 px stroke 2.4; disabled opacity .5; phones 34 px | [chat.css:69–71](../../skills/team-chat/assets/site/css/chat.css#L69-L71), [chat.css:100](../../skills/team-chat/assets/site/css/chat.css#L100) |
| Checkbox `.chk` | box 16 px, `accent-color:var(--accent)`, label 13.5 px, gap 8 px; phones: box 18 px, label 15 px, min-height 44 px | [components.css:99–100](../../skills/team-site-design-system/assets/components.css#L99-L100), [components.css:138–139](../../skills/team-site-design-system/assets/components.css#L138-L139), [components.css:188](../../skills/team-site-design-system/assets/components.css#L188) |

## Dialogs and phone sheets

`<dialog class="dlg">` in `components.css`. A centred card wider than a phone, a bottom sheet on a phone.

| State | Look | Where |
|---|---|---|
| Default | no border or padding, radius 20 px, `--card`, `--ink`, `box-shadow:var(--shadow)`, width `min(560px,calc(100vw - 32px))`, max-height `calc(100vh - 48px)`, `overflow-x:hidden` | [components.css:83](../../skills/team-site-design-system/assets/components.css#L83) |
| Wider dialogs | `.dlg.wide` and the event sheet `min(620px,…)`; notifications `min(460px,…)`; Add to Home Screen `min(440px,…)` | [components.css:102](../../skills/team-site-design-system/assets/components.css#L102), [calendar.css:155](../../skills/shared-google-calendar/assets/site/css/calendar.css#L155), [push.css:5](../../skills/ios-webapp-push/assets/site/css/push.css#L5), [push.css:56](../../skills/ios-webapp-push/assets/site/css/push.css#L56) |
| Opening | `dlg-in`, 220 ms `cubic-bezier(.2,.8,.2,1)`, from `opacity:0;transform:translateY(8px) scale(.98)` | [components.css:85–86](../../skills/team-site-design-system/assets/components.css#L85-L86) |
| Backdrop | `rgba(0,0,0,.28)`, `backdrop-filter:blur(6px)` | [components.css:87](../../skills/team-site-design-system/assets/components.css#L87) |
| Inside | `.dlg-in`: padding `20px 22px 20px`, one column `minmax(0,1fr)`, gap 14 px. `.dlg-top`: title 19 px 700, −.02em, and the close button. `.dlg-act`: wrap, gap 8 px, 4 px above | [components.css:88–90](../../skills/team-site-design-system/assets/components.css#L88-L90), [components.css:113](../../skills/team-site-design-system/assets/components.css#L113) |
| Focus | the dialog itself never shows a ring (its first control does); the Add to Home Screen sheet takes the focus itself and shows none | [components.css:84](../../skills/team-site-design-system/assets/components.css#L84), [push.css:57](../../skills/ios-webapp-push/assets/site/css/push.css#L57) |
| Pressed, hover, disabled, selected | Not specified | |
| Dark | Tokens: `--card` `#2c2c2e`, `--shadow` `0 24px 64px rgba(0,0,0,.6),0 0 0 .5px rgba(255,255,255,.1)` | [tokens.css:21](../../skills/team-site-design-system/assets/tokens.css#L21), [tokens.css:28](../../skills/team-site-design-system/assets/tokens.css#L28) |
| Reduced motion | no animation | [components.css:214](../../skills/team-site-design-system/assets/components.css#L214) |

Phones (`max-width:760px`):

| Part | Value | Where |
|---|---|---|
| Sheet | `dialog.dlg`: full width, `margin:auto 0 0`, max-height `calc(100dvh - 32px)`, radius `18px 18px 0 0`, `overflow-y:auto`, `overscroll-behavior:contain` | [components.css:133–134](../../skills/team-site-design-system/assets/components.css#L133-L134) |
| Opening | `dlg-sheet`, 320 ms `cubic-bezier(.2,.8,.2,1)`, from `translateY(100%)` | [components.css:135](../../skills/team-site-design-system/assets/components.css#L135), [components.css:141](../../skills/team-site-design-system/assets/components.css#L141) |
| Inside | padding `18px max(16px,calc((100% - 560px) / 2)) max(20px,calc(var(--sab) + 10px))`: 560 px of content in the middle on wide phones, room for the home indicator below | [components.css:136](../../skills/team-site-design-system/assets/components.css#L136) |
| Actions | 8 px above | [components.css:189](../../skills/team-site-design-system/assets/components.css#L189) |
| The page behind | `html.locked` stops scrolling; `sheet.js` also stops the finger and closes the sheet on a tap outside or a pull down (thresholds in [motion.md](motion.md)) | [components.css:131](../../skills/team-site-design-system/assets/components.css#L131), [sheet.js:21](../../skills/team-site-design-system/assets/sheet.js#L21), [sheet.js:116–130](../../skills/team-site-design-system/assets/sheet.js#L116-L130) |

Other sheets on phones:

| Sheet | Value | Where |
|---|---|---|
| Team chat | not a `<dialog>`: a full-height sheet under a gap of `max(env(safe-area-inset-top,0px),44px)`, radius `14px 14px 0 0`, `--card`, `box-shadow:0 -8px 32px rgba(0,0,0,.18)`; a grab handle 36 × 5 px in `--fill2`; the dim layer `rgba(0,0,0,.28)` | [chat.css:76](../../skills/team-chat/assets/site/css/chat.css#L76), [chat.css:80–85](../../skills/team-chat/assets/site/css/chat.css#L80-L85) |
| Team chat, wider | a 380 px panel on the right, `--paper`, a `--sep2` hairline on its left; slides in over 280 ms; from 1100 px the page makes room beside it | [chat.css:5–15](../../skills/team-chat/assets/site/css/chat.css#L5-L15) |
| Guide panel | docked at the bottom, radius `14px 14px 0 0`, shadow `0 -.5px 0 var(--sep2),0 -10px 36px rgba(0,0,0,.16)` | [guide.css:36–40](../../skills/first-visit-spotlight-guide/assets/site/css/guide.css#L36-L40) |
| Reader contents | hangs from the section bar, max-height `min(72vh,620px)`, `--paper`; the dim layer `rgba(0,0,0,.18)`, `.45` in dark | [reader.css:182–184](../../skills/lecture-notes-reader/assets/site/css/reader.css#L182-L184), [reader.css:62–64](../../skills/lecture-notes-reader/assets/site/css/reader.css#L62-L64) |

## Banners, notes and status lines

| Element | Look | Where |
|---|---|---|
| `.banner` | a 2 px `--warn` rule on the left, padding `1px 0 1px 12px`, 13.5 px `--ink2`; bold words `--ink` 600 | [components.css:63–64](../../skills/team-site-design-system/assets/components.css#L63-L64) |
| `.banner.bad` | the rule in `--bad` | [components.css:65](../../skills/team-site-design-system/assets/components.css#L65) |
| Calendar banner, read-only | shown and shaken sideways when someone tries to add an event (300 ms, see [motion.md](motion.md)) | [calendar.js:623–627](../../skills/shared-google-calendar/assets/site/js/calendar.js#L623-L627) |
| `.dlg-note` | 12.5 px `--ink3`; hidden when empty | [components.css:110–111](../../skills/team-site-design-system/assets/components.css#L110-L111) |
| `.dlg-err` | 13 px `--bad`; hidden when empty | [components.css:111–112](../../skills/team-site-design-system/assets/components.css#L111-L112) |
| `.chat-err`, `.chat-st` | 12 px `--bad`, hidden when empty; status 12.5 px `--ink3` | [chat.css:72–73](../../skills/team-chat/assets/site/css/chat.css#L72-L73), [chat.css:28](../../skills/team-chat/assets/site/css/chat.css#L28) |
| Sync note `.sync` | 12 px `--ink3`, tabular numbers; a 7 px dot, `--ink4` | [components.css:74–75](../../skills/team-site-design-system/assets/components.css#L74-L75), [calendar.css:25–26](../../skills/shared-google-calendar/assets/site/css/calendar.css#L25-L26) |
| Sync dot states | `.ok` `--ok`, `.warn` `--warn`, `.bad` `--bad`; `.busy` pulses (`cal-pulse`, 1 s, opacity .3 at the middle); with reduced motion it rests at opacity .6 | [calendar.css:27–31](../../skills/shared-google-calendar/assets/site/css/calendar.css#L27-L31), [calendar.css:276](../../skills/shared-google-calendar/assets/site/css/calendar.css#L276) |
| Notification status `.push-status` | 13.5 px `--ink2`, a 7 px dot: on `--sw-on`; checking and note `--ink4`; denied, server, oldios, nosupport `--warn`; install and kakao `--accent` | [push.css:10–15](../../skills/ios-webapp-push/assets/site/css/push.css#L10-L15) |
| Empty states | the log's `.empty-box` 13.5 px `--ink3`, padding 22 px; the chat's `.chat-empty` 13.5 px `--ink3`; Upcoming `.up-empty` 13 px `--ink3` | [records.css:48](../../skills/weekly-research-log/assets/site/css/records.css#L48), [chat.css:34](../../skills/team-chat/assets/site/css/chat.css#L34), [calendar.css:83](../../skills/shared-google-calendar/assets/site/css/calendar.css#L83) |
| Dark | Tokens | |

## Document typography

`.doc` in `team-site-design-system/assets/doc.css` (the lecture-notes reader ships a copy with the same rules).
Hairlines and fills, no boxes.

| Element | Value | Where |
|---|---|---|
| Text | 15 px / 1.7, `--ink2` | [doc.css:2](../../skills/team-site-design-system/assets/doc.css#L2) |
| h1 | 22 px / 1.3, 700, −.022em, `--ink`, margin `18px 0 8px` | [doc.css:3](../../skills/team-site-design-system/assets/doc.css#L3) |
| h2 | 17 px / 1.4, 650, −.015em, `--ink`, margin `22px 0 6px` | [doc.css:4](../../skills/team-site-design-system/assets/doc.css#L4) |
| h3 | 15 px 600, `--ink`, margin `16px 0 4px` | [doc.css:5](../../skills/team-site-design-system/assets/doc.css#L5) |
| Paragraphs, lists | `p` margin 8 px; lists margin 6 px, indent 22 px; items 2 px apart; task-list boxes hang in the indent | [doc.css:6–11](../../skills/team-site-design-system/assets/doc.css#L6-L11) |
| Bold | `--ink` 600 | [doc.css:12](../../skills/team-site-design-system/assets/doc.css#L12) |
| Links | `--accent`, underline on hover (shared rule); long ones break anywhere | [tokens.css:61–62](../../skills/team-site-design-system/assets/tokens.css#L61-L62), [doc.css:13](../../skills/team-site-design-system/assets/doc.css#L13) |
| Inline code | `--mono`, .86em, `--fill`, padding `1px 5px`, radius 5 px | [doc.css:14](../../skills/team-site-design-system/assets/doc.css#L14) |
| Code block | `--fill`, padding `12px 14px`, radius 10 px, 12.5 px / 1.55, scrolls sideways | [doc.css:15–16](../../skills/team-site-design-system/assets/doc.css#L15-L16) |
| Quote | 3 px `--sep2` rule, padding `4px 14px`, `--ink3` | [doc.css:17](../../skills/team-site-design-system/assets/doc.css#L17) |
| Table | full width, 13.5 px, tabular numbers, scrolls sideways inside itself; rows `.5px solid var(--sep2)`, cells `7px 12px 7px 0`; head 600 `--ink`, no wrap | [doc.css:18–20](../../skills/team-site-design-system/assets/doc.css#L18-L20) |
| Rule, images | `hr` `.5px solid var(--sep2)`, margin 18 px; images radius 10 px | [doc.css:21–22](../../skills/team-site-design-system/assets/doc.css#L21-L22) |
| Wide formulas | scroll sideways; an edge with more to see fades over 22 px (left) and 28 px (right). The reader's script sets the classes | [doc.css:35–38](../../skills/team-site-design-system/assets/doc.css#L35-L38), [chapter.js:317](../../skills/lecture-notes-reader/assets/site/js/chapter.js#L317) |
| First child | margin-top 14 px | [doc.css:40](../../skills/team-site-design-system/assets/doc.css#L40) |
| Hover, focus | links only (above); checkboxes use `accent-color:var(--accent)` | [doc.css:10](../../skills/team-site-design-system/assets/doc.css#L10) |
| Dark | Tokens. Figures that are SVG files are inverted in dark (`invert(1) hue-rotate(180deg)`) in the reader and the Theory tab | [reader.css:148–153](../../skills/lecture-notes-reader/assets/site/css/reader.css#L148-L153), [theory.css:74–75](../../skills/lecture-notes-reader/assets/site/css/theory.css#L74-L75) |
| Phone | h1 19 px, margin-top 14 px; h2 16.5 px | [doc.css:43–46](../../skills/team-site-design-system/assets/doc.css#L43-L46) |
| Log column | wider than a phone, `.doc-card .doc h1` is 19 px / 1.35, −.018em | [records.css:85](../../skills/weekly-research-log/assets/site/css/records.css#L85) |

## Chat: Copy · Comment bar and marks

`chat.css`. A dark bar appears over a text selection; a commented passage is underlined.

The bar (`.selpop`):

| State | Look | Where |
|---|---|---|
| Default (mouse) | absolute, `z-index:45`, 34 px tall, padding `0 4px`, radius 9 px, `#1d1d1f` with `#fff` text, `box-shadow:0 8px 24px rgba(0,0,0,.22),0 0 0 .5px rgba(255,255,255,.08)`, 13 px 500; no text selection inside; appears with `pop-in` (opacity, 140 ms `ease-out`) | [chat.css:105–106](../../skills/team-chat/assets/site/css/chat.css#L105-L106), [chat.css:123](../../skills/team-chat/assets/site/css/chat.css#L123) |
| Buttons | full height, padding `0 11px`, radius 6 px; between them a `.5px` × 16 px divider in `rgba(255,255,255,.28)` | [chat.css:110](../../skills/team-chat/assets/site/css/chat.css#L110), [chat.css:112](../../skills/team-chat/assets/site/css/chat.css#L112) |
| Hover | button background `rgba(255,255,255,.12)` | [chat.css:111](../../skills/team-chat/assets/site/css/chat.css#L111) |
| Pressed | Not specified (a press keeps the selection: the bar cancels `mousedown`) | [chat.js:646](../../skills/team-chat/assets/site/js/chat.js#L646) |
| Focus | The shared focus ring | [tokens.css:65](../../skills/team-site-design-system/assets/tokens.css#L65) |
| Done (`.done`, after Copy) | Comment and the divider hide; the Copy button reads "Copied"; the bar hides 900 ms later | [chat.css:113](../../skills/team-chat/assets/site/css/chat.css#L113), [chat.js:653](../../skills/team-chat/assets/site/js/chat.js#L653) |
| Dark | background `#3a3a3c` | [chat.css:107–108](../../skills/team-chat/assets/site/css/chat.css#L107-L108) |
| Touch screens (`.dock`) | only Comment shows, as one bar fixed at the bottom centre, `bottom:calc(16px + var(--sab))`, 44 px tall, radius 22 px, 15 px; the button gets a 17 px speech-bubble icon, padding `0 20px 0 16px`, radius 20 px; `.dock.up` moves it to `top:calc(env(safe-area-inset-top,0px) + 12px)` when the selection ends near the bottom | [chat.css:116–122](../../skills/team-chat/assets/site/css/chat.css#L116-L122) |
| Print | hidden | [chat.css:131](../../skills/team-chat/assets/site/css/chat.css#L131) |

Marks (`mark.cm-mark`) and quotes:

| State | Look | Where |
|---|---|---|
| Default | no background, the text colour kept; an underline in `color-mix(in srgb,var(--accent) 55%,transparent)`, 1.5 px thick, 3 px below, `text-decoration-skip-ink:none`; radius 2 px; pointer cursor | [chat.css:126–127](../../skills/team-chat/assets/site/css/chat.css#L126-L127) |
| Hover | background `color-mix(in srgb,var(--accent) 9%,transparent)` | [chat.css:128](../../skills/team-chat/assets/site/css/chat.css#L128) |
| Selected (`.flash`, after a jump) | `mk-flash`, 1.8 s `ease-out`: `--accent` at 22 % for the first 35 %, then fading out | [chat.css:129–130](../../skills/team-chat/assets/site/css/chat.css#L129-L130) |
| Focus, pressed, disabled | Not specified | |
| Dark | Tokens (`--accent`) | |
| Print | no underline | [chat.css:131](../../skills/team-chat/assets/site/css/chat.css#L131) |
| Quote in a message `.cm-q` | a 2 px `--sep2` rule on the left, `--ink3`, three lines at most; hover: the rule turns `--accent` | [chat.css:47–50](../../skills/team-chat/assets/site/css/chat.css#L47-L50) |
| Quote in the composer `.chat-q` | a 2 px `--accent` rule; the label 11.5 px 600 `--accent`; two lines at most, 13 px `--ink3` | [chat.css:58–61](../../skills/team-chat/assets/site/css/chat.css#L58-L61) |
| A message after a jump `.cm.flash` | `cm-flash`, 1.6 s `ease-out`: `--accent` at 12 % for the first 30 %, then fading out | [chat.css:53–54](../../skills/team-chat/assets/site/css/chat.css#L53-L54) |
| Delete on your own message `.cm-del` | 12 px `--ink4`, hidden until the message is hovered or the link focused; `.armed`: `--bad` 600; phones: always shown, min-height 32 px | [chat.css:42–44](../../skills/team-chat/assets/site/css/chat.css#L42-L44), [chat.css:93](../../skills/team-chat/assets/site/css/chat.css#L93) |
