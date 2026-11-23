// Link-preview tags for the one page crawlers can see. Crawlers (KakaoTalk, Slack, iMessage, X…) never sign in, so on a
// signed-in site the SIGN-IN page must carry these tags, answer 200 (not a redirect), and the picture itself must be
// served without signing in (add OG.path to the gate's public paths).
import { OG } from "./og.js"; // lib/og.js, written by og_version.py; copy this file to lib/og-tags.js

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function ogTags(origin, { siteName = "{{SITE_NAME}}", title = "{{SITE_NAME}}", description = "{{OG_DESCRIPTION}}" } = {}) {
  const img = `${origin}${OG.path}?v=${OG.v}`;
  return `<meta property="og:site_name" content="${esc(siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(origin + "/")}">
<meta property="og:locale" content="en_US"><meta property="og:locale:alternate" content="ko_KR">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:type" content="${OG.path.endsWith(".png") ? "image/png" : "image/jpeg"}">
<meta property="og:image:width" content="${OG.w}"><meta property="og:image:height" content="${OG.h}">
<meta property="og:image:alt" content="${esc(OG.alt)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">
<meta name="description" content="${esc(description)}">`;
}
