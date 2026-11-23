# How KakaoTalk builds a link card

- KakaoTalk's crawler fetches the URL without cookies, reads `og:title`, `og:description` and `og:image`, downloads
  the picture once, and caches the card **per URL** for a long time (days or more). Later edits to the page do not show
  until the cache is cleared or the URL changes.
- The large card is shown at about 800 × 400 (2 : 1). A 1.91 : 1 picture is trimmed slightly at the top and bottom;
  small cards and some layouts crop to a square from the centre. Hence the rule: everything readable inside the centre
  square, nothing important near the edges.
- Pictures are shown at high density on phones; a 1200 × 630 picture looks soft. 2400 × 1260 stays sharp.
- A redirect at the shared URL often gives an empty card. A signed-in site must answer the crawler with the sign-in page
  itself (200) carrying the tags.
- In-app browser: opening the link inside KakaoTalk uses its own browser, where Google refuses to sign in. The sign-in
  page offers "Open in Safari" there (`google-signin-team-gate`).

## Notice posts (pictures in a group notice)

Whether a picture shows inline or as a file box depends on **how it is attached**, not on its pixel size:

- photo album / gallery → inline picture;
- "File" → a file box with a download button.

Keep the notice picture as JPEG in a few sizes (3840 × 2016, and versions 1000, 800 and 640 px tall) so one fits whatever
the group's settings compress to.

## How the source team got there (all on one day)

| Step | Change | Why |
|---|---|---|
| 1 | Preview bots allowed to read the sign-in page; a hand-picked 3D wafer picture as the preview (PNG, with `?v=` written by the build) | The gate hid the tags from crawlers, so links showed an empty card |
| 2 | A narrower version of the picture | The title did not fit KakaoTalk's middle square |
| 3 | A sharper 2400 × 1260 JPEG, size-checked by the build | The 1200 × 630 picture looked soft on phones; JPEG is smaller than PNG for a render |
| — | After each change: Kakao sharing debugger → Clear cache | KakaoTalk keeps the old card for a URL until it is cleared |
