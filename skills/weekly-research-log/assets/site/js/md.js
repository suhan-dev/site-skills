// Markdown → HTML (marked + KaTeX), for logs and notes in the repository.
// Math ($…$ and $$…$$) is taken out before marked runs, so marked never touches it, and put back afterwards.
// Relative links: images go to the copy on the site (/repo/<path>, made by the build), other files to GitHub.
// Libraries (not committed; assets/fetch-vendor.sh downloads the pinned versions): marked 15.0.12, KaTeX 0.16.22.
import { Marked } from "/vendor/marked/marked.esm.js";

// where KaTeX is; it is loaded only when a page has math. Change it before the first render if your vendor path differs.
export const MD_VENDOR = { katex: "/vendor/katex/katex.min.js" };

let katexP = null;
function ensureKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  if (!katexP) {
    katexP = new Promise((res) => {
      const s = document.createElement("script");
      s.src = MD_VENDOR.katex;
      s.onload = () => res(window.katex);
      s.onerror = () => res(null); // no KaTeX: the math stays as $…$ text
      document.head.appendChild(s);
    });
  }
  return katexP;
}

export function resolve(dir, href) {
  const parts = dir ? dir.split("/") : [];
  for (const seg of href.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

export const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");

// dir: the file's folder in the repository ("logs/week03_0119"), so relative links resolve.
// imgBase: where the build copied the images ("/repo/" by default).
// link(path, hash): optional; may return a site address for a repository path instead of GitHub.
export async function renderMd(src, { dir = "", repo = "", branch = "main", link = null, imgBase = "/repo/" } = {}) {
  const math = [];
  // a $ inside code is not math
  const pieces = String(src || "").split(/(```[\s\S]*?```|`[^`\n]*`)/);
  for (let i = 0; i < pieces.length; i += 2) {
    pieces[i] = pieces[i]
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => {
        math.push([t, true]);
        return `\n\nMATHPH${math.length - 1}X\n\n`;
      })
      .replace(/(^|[^\\$])\$([^\s$](?:[^$\n]*?[^\s$\\])?)\$(?!\d)/g, (_, pre, t) => {
        math.push([t, false]);
        return `${pre}MATHPH${math.length - 1}X`;
      });
  }
  const m = new Marked({ gfm: true, breaks: false });
  m.use({
    walkTokens(tok) {
      if ((tok.type === "link" || tok.type === "image") && tok.href && !/^([a-z]+:|#|\/)/i.test(tok.href)) {
        let raw = tok.href.split("#")[0];
        try { raw = decodeURI(raw); } catch (e) { /* keep it as it is */ }
        const path = resolve(dir, raw);
        const hash = tok.href.includes("#") ? "#" + tok.href.split("#")[1] : "";
        const own = tok.type === "link" && link ? link(path, hash) : null;
        tok.href = tok.type === "image" ? imgBase + encPath(path) : own || `https://github.com/${repo}/blob/${branch}/${encPath(path)}${hash}`;
      }
    },
  });
  let html = m.parse(pieces.join(""));
  html = html.replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
  if (math.length) {
    const k = await ensureKatex();
    html = html.replace(/(<p>)?MATHPH(\d+)X(<\/p>)?/g, (all, p1, i, p2) => {
      const [t, display] = math[+i];
      let out;
      try {
        out = k ? k.renderToString(t, { displayMode: display, throwOnError: false }) : display ? `$$${t}$$` : `$${t}$`;
      } catch (e) {
        out = t;
      }
      if (display) return out;
      return (p1 || "") + out + (p2 || "");
    });
  }
  return html;
}

// Is this only a template nobody has written in yet? Headings, empty bullets and check boxes, "Label:" bullets, empty
// table rows, comments and "> hint" quotes do not count as writing.
export function isBlank(src) {
  const rest = String(src || "").split("\n").filter((l) => {
    const s = l.trim();
    if (!s) return false;
    if (/^#{1,6}\s/.test(s)) return false;
    if (/^[-*+]\s*(\[[ xX]?\])?\s*$/.test(s)) return false;
    if (/^[-*+]\s*[^:：]{1,20}[:：]\s*$/.test(s)) return false;
    if (/^\|[\s|:-]*\|?$/.test(s)) return false;
    if (/^\|[^|]*\|(\s*\|)*\s*$/.test(s)) return false;
    if (/^<!--.*-->$/.test(s)) return false;
    if (/^>\s/.test(s)) return false;
    return true;
  });
  return rest.length === 0;
}
