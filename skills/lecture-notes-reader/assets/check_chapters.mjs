// Check chapters before publishing. Node 18+, no dependencies apart from the pinned KaTeX file.
//
//   node check_chapters.mjs [--katex path/to/katex.min.js] [--require "## Key results"]… [folder | chapter.md …]
//
// A folder is a chapters folder holding sections.json (default: ./theory). It mirrors what md.js and chapter.js do
// with a chapter, so a chapter that passes here renders without surprises. It reports:
//   - KaTeX parse errors (display and inline), with \label and $\eqref{…}$ handled the way chapter.js does
//   - a stray "$" that the renderer would leave as text
//   - display math that does not start a paragraph at column 0 (it breaks lists and quotes)
//   - a \tag used twice, a \tag of another chapter's label, equation numbers out of order
//   - \eqref / \ref keys that do not resolve (the page would show "(??)"), here or in another chapter
//   - more or fewer than one "# Title" line, a title that does not start with the file's label
//   - images whose file does not exist, alt text holding $ (alt text cannot hold math)
//   - a "*Figure L.n.*" caption whose number is not that figure's place in the chapter
//   - sections named with --require that are missing
// Links to chapter files that do not exist yet are fine: the site shows them as grey text until they are published.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let katexPath = path.join(HERE, "demo/vendor/katex/katex.min.js");
const required = [];
const inputs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--katex") katexPath = args[++i];
  else if (args[i] === "--require") required.push(args[++i]);
  else inputs.push(args[i]);
}
if (!fs.existsSync(katexPath)) {
  console.error(`KaTeX not found at ${katexPath}. Run bash fetch-vendor.sh, or pass --katex path/to/katex.min.js`);
  process.exit(2);
}
const ctx = { window: {}, self: {}, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(katexPath, "utf8"), ctx);
const katex = ctx.katex || ctx.window.katex || ctx.self.katex;

/* ---------- the chapters to check, and every chapter of the folder (for references across chapters) ---------- */
const CHAPTER = /^([A-Za-z]?)(\d+)(?:[-_ ]|$)/;
const labelOf = (file) => { const m = path.basename(file, ".md").match(CHAPTER); return m ? m[1].toUpperCase() + String(+m[2]) : ""; };
function folderFiles(dir) {
  const spec = JSON.parse(fs.readFileSync(path.join(dir, "sections.json"), "utf8"));
  return spec.flatMap((s) => {
    const d = path.join(dir, s.id);
    return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md").sort().map((f) => path.join(d, f)) : [];
  });
}
let files = [], all = [];
if (!inputs.length) inputs.push("theory");
for (const x of inputs) {
  if (fs.statSync(x).isDirectory()) { const f = folderFiles(x); files.push(...f); all.push(...f); }
  else { files.push(x); const dir = path.dirname(path.dirname(x)); if (fs.existsSync(path.join(dir, "sections.json"))) all.push(...folderFiles(dir)); }
}
all = [...new Set([...all, ...files].map((f) => path.resolve(f)))];

/* ---------- equation numbers, the same way chapter.js prep() gives them ---------- */
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/;
const TAG = /\\tag\*?\s*\{([^{}]*)\}/g;
const LABEL = /\\label\s*\{([^{}]*)\}/g;
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function numbers(src, label) {
  const pieces = src.split(CODE);
  const used = new Set();
  for (let i = 0; i < pieces.length; i += 2) for (const m of pieces[i].matchAll(/\$\$([\s\S]+?)\$\$/g)) for (const t of m[1].matchAll(TAG)) used.add(t[1].trim());
  const own = new RegExp(`^${escRe(label)}\\.(\\d+)$`, "i");
  const eqs = new Map(), order = [];
  let last = 0;
  for (let i = 0; i < pieces.length; i += 2) {
    for (const m of pieces[i].matchAll(/\$\$([\s\S]+?)\$\$/g)) {
      const tags = [...m[1].matchAll(TAG)].map((t) => t[1].trim());
      const keys = [...m[1].matchAll(LABEL)].map((l) => l[1].trim());
      if (!tags.length && keys.length) {
        let n = last + 1;
        while (used.has(`${label}.${n}`)) n++;
        tags.push(`${label}.${n}`);
        used.add(tags[0]);
      }
      for (const t of tags) { const mm = t.match(own); if (mm) { order.push(+mm[1]); last = Math.max(last, +mm[1]); } }
      keys.forEach((k, n) => eqs.set(k, tags[Math.min(n, tags.length - 1)]));
    }
  }
  return { eqs, nums: new Set([...used]), order };
}
const book = new Map(); // label → Set of equation numbers
for (const f of all) { const l = labelOf(f); if (l) book.set(l.toUpperCase(), numbers(fs.readFileSync(f, "utf8"), l).nums); }

/* ---------- one chapter ---------- */
const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;
let total = 0;
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const label = labelOf(file);
  const errs = [];
  const err = (line, msg) => errs.push(`  L${line}: ${msg}`);
  const { eqs, nums, order } = numbers(src, label);

  // title
  const h1 = [...src.split(CODE).filter((_, i) => i % 2 === 0).join("").matchAll(/^# .+$/gm)];
  if (h1.length !== 1) err(1, `expected exactly one "# Title" line, found ${h1.length}`);
  else if (label && !new RegExp(`^# ${escRe(label)}[.:·—– -]`, "i").test(h1[0][0])) err(1, `title should start with the label: "# ${label}. …"`);

  // math, per text piece (code is not math)
  const pieces = src.split(CODE);
  let offset = 0;
  const tagLine = new Map();
  for (let i = 0; i < pieces.length; i++) {
    const text = pieces[i];
    if (i % 2 === 1) { offset += text.length; continue; }
    const masked = text.replace(/\$\$([\s\S]+?)\$\$/g, (all, t, at) => {
      const ln = lineOf(src, offset + at);
      const before = text.slice(0, at);
      const lineStart = before.lastIndexOf("\n") + 1;
      if (at !== lineStart) err(ln, "display math must start at column 0 on its own line (inside a list, quote or paragraph?)");
      const prev = before.slice(0, lineStart).split("\n").slice(-2)[0];
      if (lineStart > 0 && prev.trim() !== "") err(ln, "display math needs a blank line before it");
      try { katex.renderToString(t.replace(LABEL, ""), { displayMode: true, throwOnError: true }); }
      catch (e) { err(ln, "KaTeX: " + String(e.message).slice(0, 160)); }
      for (const tm of t.matchAll(TAG)) {
        const tag = tm[1].trim();
        if (tagLine.has(tag)) err(ln, `\\tag{${tag}} is used twice (first at L${tagLine.get(tag)})`);
        else tagLine.set(tag, ln);
        const m = tag.match(/^([A-Za-z]?\d+)\.\d+[a-z]?$/);
        if (label && m && m[1].toUpperCase() !== label.toUpperCase()) err(ln, `\\tag{${tag}} belongs to chapter ${m[1]}, not ${label}`);
      }
      return " ".repeat(all.length);
    });
    // a reference written as math ($\eqref{x}$) is a link, not math (chapter.js REF_MATH)
    const noRefMath = masked.replace(/\$\s*\\(eqref|ref)\s*\{([^{}]+)\}\s*\$/g, (all) => " ".repeat(all.length));
    const masked2 = noRefMath.replace(/(^|[^\\$])\$([^\s$](?:[^$\n]*?[^\s$\\])?)\$(?!\d)/g, (all, pre, t, at) => {
      const ln = lineOf(src, offset + at);
      try { katex.renderToString(t, { displayMode: false, throwOnError: true }); }
      catch (e) { err(ln, "KaTeX inline: " + String(e.message).slice(0, 160)); }
      if (/\\tag/.test(t)) err(ln, "\\tag in inline math");
      return pre + " ".repeat(all.length - pre.length);
    });
    for (const sm of masked2.matchAll(/(^|[^\\])\$/g)) {
      const ln = lineOf(src, offset + sm.index + sm[1].length);
      err(ln, `stray $ (the page would show it as text): ${src.split("\n")[ln - 1].trim().slice(0, 90)}`);
    }
    offset += text.length;
  }
  for (let k = 1; k < order.length; k++) if (order[k] <= order[k - 1]) { err(0, `equation numbers out of order: ${label}.${order[k]} after ${label}.${order[k - 1]}`); break; }

  // figures, in order: a paragraph that is only an image, or a <figure>
  const text = src.split(CODE).map((p, i) => (i % 2 ? " ".repeat(p.length) : p)).join("");
  const figs = new Set();
  let figN = 0;
  for (const fm of text.matchAll(/(^|\n\n)[ \t]*(!\[([^\]]*)\]\(([^)\s]+)\))[ \t]*(?=\n\n|\n?$)|<figure\b[^>]*>/g)) {
    figN++;
    if (fm[0].startsWith("<figure")) { const id = fm[0].match(/id="([^"]+)"/); if (id) figs.add(id[1]); continue; }
    const [alt, href] = [fm[3], fm[4]];
    const at = fm.index + fm[1].length;
    if (alt.includes("$")) err(lineOf(src, at), "alt text holds $ (alt text cannot hold math: put the math in a *Figure* caption paragraph)");
    figs.add("fig:" + decodeURI(href).split(/[?#]/)[0].split("/").pop().replace(/\.[^.]+$/, ""));
    const cap = text.slice(at + fm[2].length).replace(/^[ \t]*\n\s*\n/, "").match(/^\*Figure\s+([A-Za-z]*\d+)\.(\d+)\.?\*/);
    if (cap && (cap[1].toUpperCase() !== label.toUpperCase() || +cap[2] !== figN)) err(lineOf(src, at), `caption says Figure ${cap[1]}.${cap[2]}; it is Figure ${label}.${figN}`);
  }
  for (const im of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
    if (/^([a-z]+:|\/)/i.test(im[1])) continue;
    const p = path.resolve(path.dirname(file), decodeURI(im[1]).split(/[?#]/)[0]);
    if (!fs.existsSync(p)) err(lineOf(src, im.index), `image not found: ${im[1]}`);
  }

  // references outside math
  const plain = text.replace(/\$\$[\s\S]+?\$\$/g, (a) => " ".repeat(a.length))
    .replace(/\$\s*\\(eqref|ref)\s*\{([^{}]+)\}\s*\$/g, (a, k, key) => `\\${k}{${key}}` + " ".repeat(a.length - k.length - key.length - 3))
    .replace(/(^|[^\\$])\$([^\s$](?:[^$\n]*?[^\s$\\])?)\$(?!\d)/g, (a, pre) => pre + " ".repeat(a.length - pre.length));
  for (const rm of plain.matchAll(/\\(eqref|ref)\s*\{([^{}]+)\}/g)) {
    const key = rm[2].trim();
    let ok = eqs.has(key) || figs.has(key) || nums.has(key);
    const m = !ok && key.match(/^([A-Za-z]?\d+)\.\d+[a-z]?$/);
    if (m) ok = (book.get(m[1].toUpperCase()) || new Set()).has(key);
    if (!ok) err(lineOf(src, rm.index), `\\${rm[1]}{${key}} does not resolve (the page shows "(??)")`);
  }
  for (const r of required) if (!new RegExp("^" + escRe(r), "m").test(src)) err(0, `missing section "${r}"`);

  const words = text.replace(/\$\$[\s\S]+?\$\$/g, " ").split(/\s+/).filter(Boolean).length;
  console.log(`${path.relative(process.cwd(), file)}: ${words} words, ${nums.size} numbered equations, ${figN} figures, ${errs.length} issue(s)`);
  for (const e of errs) console.log(e);
  total += errs.length;
}
process.exit(total ? 1 : 0);
