// Markdown → HTML (marked + KaTeX). Math ($…$ and $$…$$) is taken out before marked runs, so marked never touches it,
// and put back afterwards as KaTeX HTML.
// Relative links: images point at the copy the build puts on the site (`base`, "/repo/" by default); other files point
// at GitHub, unless `link()` returns a site address for them (chapters stay inside the site, see chapter.js).
import { Marked } from "/vendor/marked/marked.esm.js";

let katexP = null;
function ensureKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  if (!katexP) {
    katexP = new Promise((res) => {
      const s = document.createElement("script");
      s.src = "/vendor/katex/katex.min.js";
      s.onload = () => res(window.katex);
      s.onerror = () => res(null);
      document.head.appendChild(s);
    });
  }
  return katexP;
}

/** "theory/heat" + "../waves/w1.md" → "theory/waves/w1.md" */
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

// link(path, hash): optional. Gets each relative link as a repository path ("theory/heat/h1-x.md", "#anchor" or "")
// and may return a site address for it instead of GitHub (chapters open inside the site, see chapter.js).
// base: where the build copied the images ("/repo/" → /repo/theory/heat/figures/x.svg).
export async function renderMd(src, { dir = "", repo = "", branch = "main", link = null, base = "/repo/" } = {}) {
  const math = [];
  // a $ inside code is not math
  const pieces = String(src || "").split(/(```[\s\S]*?```|`[^`\n]*`)/);
  for (let i = 0; i < pieces.length; i += 2) {
    pieces[i] = pieces[i]
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => {
        math.push([t, true]);
        return `\n\nMATHPH${math.length - 1}X\n\n`;
      })
      // inline: no space just inside the dollars, and not "$5 and $6" (a digit right after the closing $)
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
        try { raw = decodeURI(raw); } catch (e) { /* keep as is */ }
        const path = resolve(dir, raw);
        const hash = tok.href.includes("#") ? "#" + tok.href.split("#")[1] : "";
        const own = tok.type === "link" && link ? link(path, hash) : null;
        tok.href = tok.type === "image" ? base + encPath(path)
          : own || (repo ? `https://github.com/${repo}/blob/${branch}/${encPath(path)}${hash}` : "#");
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
      if (display) return out; // a display formula replaces its whole placeholder paragraph
      return (p1 || "") + out + (p2 || "");
    });
  }
  return html;
}
