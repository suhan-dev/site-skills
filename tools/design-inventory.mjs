// Design inventory, generated from the skills' own CSS and JS: node tools/design-inventory.mjs
//
// Reads every .css file under skills/*/assets/ (not vendor/ or node_modules/) and writes
//   docs/design/tokens.md          every custom property in each scope, then font sizes, weights, line heights,
//                                  letter spacing, radii, spacing, z-index, shadows, breakpoints and colour literals,
//                                  each row with file:line links
//   docs/design/motion.md          every transition, animation and @keyframes, what reduced motion does, and the
//                                  timers in the skill JS that drive what people see
//   docs/design/palette-light.svg  one swatch per colour token, light
//   docs/design/palette-dark.svg   the same, dark
// Node 22, standard library only. Deterministic: running it twice gives no diff.
// The hand-written parts (motion roles, JS timers) are checked against the code on every run: when the code moves on,
// the run stops and names the entry to update.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = path.join(ROOT, "skills");
const OUT = path.join(ROOT, "docs", "design");
const CMD = "node tools/design-inventory.mjs";
const DS = "skills/team-site-design-system/assets/";

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const posix = (p) => p.split(path.sep).join("/");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const uniq = (a) => [...new Set(a)];

/* ---------- files ---------- */
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name))) {
    if (e.name === "vendor" || e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
const SKILL_NAMES = fs.readdirSync(SKILLS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(cmp);
const ASSETS = SKILL_NAMES.flatMap((s) => {
  const a = path.join(SKILLS, s, "assets");
  return fs.existsSync(a) ? walk(a) : [];
}).map((f) => posix(path.relative(ROOT, f))).filter((f) => !/\/(vendor|node_modules)\//.test(f));
const CSS_FILES = ASSETS.filter((f) => f.endsWith(".css")).sort(cmp);
const JS_FILES = ASSETS.filter((f) => /\.m?js$/.test(f)).sort(cmp);
const skillOf = (f) => f.split("/")[1];
const baseOf = (f) => f.split("/").pop();
// a file's short name: its base name, or skill/base name when two skills share it, or skill/path when one skill has two
function labels(files) {
  const count = (key) => files.reduce((m, f) => ((m[key(f)] = (m[key(f)] || 0) + 1), m), {});
  const nb = count(baseOf), ns = count((f) => `${skillOf(f)}/${baseOf(f)}`);
  return Object.fromEntries(files.map((f) => {
    const sb = `${skillOf(f)}/${baseOf(f)}`;
    return [f, nb[baseOf(f)] === 1 ? baseOf(f) : ns[sb] === 1 ? sb : `${skillOf(f)}/${f.split("/assets/")[1]}`];
  }));
}
const LABEL = { ...labels(JS_FILES), ...labels(CSS_FILES) };
const ORDER = Object.fromEntries([...CSS_FILES, ...JS_FILES].map((f, i) => [f, i]));
const byPlace = (a, b) => ORDER[a.file] - ORDER[b.file] || a.line - b.line || (a.pos || 0) - (b.pos || 0);

/* ---------- Markdown helpers ---------- */
const href = (f, line) => `../../${f}${line ? `#L${line}` : ""}`;
const link = (f, line) => `[${LABEL[f] || baseOf(f)}:${line}](${href(f, line)})`;
const code = (s) => {
  s = String(s).replace(/\|/g, "\\|");
  return s.includes("`") ? "`` " + s + " ``" : "`" + s + "`";
};
const short = (s, n = 80) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const mediaOf = (d) => (d.media.length ? " " + code(d.media.join(" › ")) : "");
const at = (d) => `${code(short(d.selector))} ${link(d.file, d.line)}${mediaOf(d)}`;
const atList = (list) => list.slice().sort(byPlace).map(at).join("<br>");
// compact: "file.css 12 40 · other.css 7", each number a link to that line
function cite(list) {
  const by = new Map();
  for (const d of list.slice().sort(byPlace)) {
    if (!by.has(d.file)) by.set(d.file, []);
    if (!by.get(d.file).includes(d.line)) by.get(d.file).push(d.line);
  }
  return [...by].map(([f, ls]) => `${LABEL[f]} ${ls.map((l) => `[${l}](${href(f, l)})`).join(" ")}`).join(" · ");
}
function table(head, rows, right = []) {
  return [
    `| ${head.join(" | ")} |`,
    `|${head.map((_, i) => (right.includes(i) ? "---:" : "---")).join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}
const ms = (t) => {
  const n = parseFloat(t);
  return Math.round((/ms$/i.test(t) ? n : n * 1000) * 1000) / 1000;
};
const showMs = (n) => `${n} ms`;

/* ---------- CSS parser ---------- */
// Comments become spaces (lines kept); strings and parentheses are respected; every declaration keeps its selector, the
// @media / @supports blocks around it and the line where it starts.
function stripComments(src) {
  let out = "", i = 0, q = null;
  while (i < src.length) {
    const c = src[i];
    if (q) {
      out += c;
      if (c === "\\" && i + 1 < src.length) { out += src[i + 1]; i += 2; continue; }
      if (c === q) q = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") { q = c; out += c; i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2), stop = end < 0 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
const normPrelude = (s) => s.replace(/\s+/g, " ").replace(/\s*:\s*/g, ":").replace(/\s*,\s*/g, ", ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
function parseCss(src, file, lineOffset = 0) {
  const s = stripComments(src);
  const decls = [], medias = [], keyframes = [], stack = [];
  let buf = "", empty = true, bufLine = 0, bufPos = 0, line = 1 + lineOffset, q = null, paren = 0, rules = 0;
  const groups = () => stack.filter((b) => b.kind === "group");
  const flush = () => {
    const text = buf.trim();
    buf = ""; empty = true;
    const top = stack[stack.length - 1];
    if (!text || !top || (top.kind !== "rule" && top.kind !== "step")) return;
    const k = text.indexOf(":");
    if (k < 0) return;
    let prop = text.slice(0, k).trim();
    if (!prop.startsWith("--")) prop = prop.toLowerCase();
    let value = text.slice(k + 1).trim().replace(/\s+/g, " ");
    const imp = /\s*!\s*important\s*$/i.exec(value);
    if (imp) value = value.slice(0, imp.index).trim();
    const d = { file, line: bufLine, pos: bufPos, prop, value, important: !!imp, selector: top.selector, media: groups().map((g) => g.query) };
    if (top.kind === "step") { d.kf = top.parent.name; top.decls.push(d); return; }
    for (const g of groups()) if (g.rec) g.rec.decls++;
    decls.push(d);
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      buf += c;
      if (c === "\\" && i + 1 < s.length) { buf += s[++i]; continue; }
      if (c === "\n") line++;
      if (c === q) q = null;
      continue;
    }
    if (paren === 0 && c === "{") {
      const pre = buf.trim().replace(/\s+/g, " "), preLine = bufLine, prePos = bufPos;
      buf = ""; empty = true;
      const top = stack[stack.length - 1];
      let blk;
      if (pre.startsWith("@")) {
        const name = (/^@([\w-]+)/.exec(pre) || [, ""])[1].toLowerCase();
        if (/keyframes$/.test(name)) {
          blk = { kind: "kf", name: pre.replace(/^@[\w-]+\s*/, ""), file, line: preLine, pos: prePos, steps: [], media: groups().map((g) => g.query) };
          keyframes.push(blk);
        } else if (["media", "supports", "layer", "container", "document"].includes(name)) {
          blk = { kind: "group", query: normPrelude(pre) };
          if (name === "media") {
            blk.rec = { file, line: preLine, pos: prePos, query: normPrelude(pre.replace(/^@media\s*/i, "")), outer: groups().map((g) => g.query), rules: 0, decls: 0 };
            medias.push(blk.rec);
          }
        } else blk = { kind: "rule", selector: pre, line: preLine }; // @page, @font-face
      } else if (top && top.kind === "kf") {
        blk = { kind: "step", selector: pre, line: preLine, decls: [], parent: top };
        top.steps.push(blk);
      } else blk = { kind: "rule", selector: pre, line: preLine };
      if (blk.kind === "rule") { rules++; for (const g of groups()) if (g.rec) g.rec.rules++; }
      stack.push(blk);
      continue;
    }
    if (paren === 0 && c === "}") { flush(); stack.pop(); continue; }
    if (paren === 0 && c === ";") { flush(); continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === "(") paren++;
    else if (c === ")") paren = Math.max(0, paren - 1);
    if (c === "\n") line++;
    if (empty && !/\s/.test(c)) { empty = false; bufLine = line; bufPos = i; }
    buf += c;
  }
  return { file, decls, medias, keyframes, rules, lines: src.split("\n").length - (src.endsWith("\n") ? 1 : 0) };
}
// split at top-level separators (outside quotes and parentheses)
function splitTop(v, sep) {
  const out = [];
  let cur = "", depth = 0, q = null;
  for (const c of v) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (depth === 0 && (sep === " " ? /\s/.test(c) : c === sep)) { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const PARSED = CSS_FILES.map((f) => parseCss(read(f), f));
const D = PARSED.flatMap((p) => p.decls);
const MEDIA = PARSED.flatMap((p) => p.medias);
const KF = PARSED.flatMap((p) => p.keyframes);
const KF_DECLS = KF.flatMap((k) => k.steps.flatMap((s) => s.decls));
const isRM = (d) => d.media.some((m) => /prefers-reduced-motion/.test(m));

/* ---------- custom properties ---------- */
function scopeOf(d) {
  const sel = d.selector.replace(/\s+/g, "").replace(/["']/g, "");
  const mq = d.media.join(" ");
  if (/@media print/.test(mq) && /:root/.test(sel)) return "print";
  if (/prefers-color-scheme:dark/.test(mq) && sel === ":root:not([data-theme=light])") return "sysdark";
  if (!d.media.length && sel === ":root") return "light";
  if (!d.media.length && sel === ":root[data-theme=dark]") return "dark";
  return "local";
}
const PROPS = D.filter((d) => d.prop.startsWith("--"));
const TOK = new Map();
for (const d of PROPS) {
  const sc = scopeOf(d);
  if (sc === "local") continue;
  if (!TOK.has(d.prop)) TOK.set(d.prop, { name: d.prop, light: [], dark: [], sysdark: [], print: [] });
  TOK.get(d.prop)[sc].push(d);
}
const LOCAL = PROPS.filter((d) => scopeOf(d) === "local");
const last = (a) => a[a.length - 1];
const val = (t, sc) => (t[sc].length ? last(t[sc]).value : null);
// how often each custom property is read with var() in the skill CSS
const READS = new Map();
for (const d of [...D, ...KF_DECLS]) {
  for (const m of d.value.matchAll(/var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*(?:\([^()]*\)[^()]*)*\))*))?\)/g)) {
    if (!READS.has(m[1])) READS.set(m[1], []);
    READS.get(m[1]).push({ ...d, fallback: m[2] ? m[2].trim() : null });
  }
}
const GROUPS = [
  ["Surfaces", /^--(paper|card2?)$/],
  ["Ink (text)", /^--ink\d?$/],
  ["Fills and the segment knob", /^--(fill2?|seg-on)$/],
  ["Hairlines", /^--sep2?$/],
  ["Accent", /^--(accent2?|on-accent|today)$/],
  ["Status", /^--(ok|warn|bad)$/],
  ["Switch", /^--sw-/],
  ["Event tints", /^--ev-/],
  ["Member and calendar colours (Google Calendar colorId 1 to 11)", /^--gc-\d+$/],
  ["Cell colours", /^--cell-/],
  ["Fonts", /^--(sans|mono)$/],
  ["Shadows", /^--(lift|shadow)$/],
];
const tokOrder = (t) => {
  const d = t.light[0] || t.dark[0] || t.sysdark[0] || t.print[0];
  return [d.file === DS + "tokens.css" ? 0 : 1, ORDER[d.file], d.line, d.pos];
};
const TOKENS = [...TOK.values()].sort((a, b) => {
  const x = tokOrder(a), y = tokOrder(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || x[3] - y[3];
});
const groupOf = (name) => (GROUPS.find(([, re]) => re.test(name)) || ["Other"])[0];

/* ---------- colours ---------- */
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^()]*\)|hsla?\([^()]*\)/g;
function parseColor(v) {
  v = v.trim().toLowerCase();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (m) {
    const h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)$/.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  return null;
}
const hex = (c) => "#" + [c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
const over = (c, bg) => ({ r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a), a: 1 });
// a token's colour in a theme: its own value, the light value it inherits, or one var() step to another token
function colorIn(t, theme, seen = new Set()) {
  const v = theme === "dark" ? val(t, "dark") ?? val(t, "light") : val(t, "light");
  if (v == null) return null;
  const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(v);
  if (ref && TOK.has(ref[1]) && !seen.has(ref[1])) {
    seen.add(ref[1]);
    const c = colorIn(TOK.get(ref[1]), theme, seen);
    return c && { ...c, via: v };
  }
  const c = parseColor(v);
  return c && { ...c, text: v };
}

/* ---------- palette SVGs ---------- */
function paletteSvg(theme) {
  const tok = (n) => colorIn(TOK.get(n), theme);
  const paper = tok("--paper"), ink = tok("--ink"), ink3 = tok("--ink3"), sep2 = tok("--sep2");
  const groups = [];
  for (const [g] of [...GROUPS, ["Other"]]) {
    const items = TOKENS.filter((t) => groupOf(t.name) === g).map((t) => ({ name: t.name, c: colorIn(t, theme), inherited: theme === "dark" && val(t, "dark") == null }))
      .filter((it) => it.c);
    if (items.length) groups.push({ title: g, items });
  }
  const COLS = 6, SW = 160, GAP = 14, PAD = 28, SH = 56, CARD = SH + 54, ROW = CARD + GAP;
  const W = PAD * 2 + COLS * SW + (COLS - 1) * GAP;
  const font = `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;
  const mono = `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fill = (c, attr) => `${attr}="${hex(c)}"${c.a < 1 ? ` ${attr}-opacity="${+c.a.toFixed(3)}"` : ""}`;
  const body = [];
  let y = PAD;
  body.push(`<text x="${PAD}" y="${y + 20}" font-size="20" font-weight="700" ${fill(ink, "fill")}>Colour tokens · ${theme}</text>`);
  body.push(`<text x="${PAD}" y="${y + 42}" font-size="12" ${fill(ink3, "fill")}>Generated by ${xml(CMD)} from the :root${theme === "dark" ? "[data-theme=dark]" : ""} blocks. Translucent colours are drawn on --paper, as on the page.</text>`);
  y += 66;
  for (const g of groups) {
    body.push(`<text x="${PAD}" y="${y + 14}" font-size="13" font-weight="600" ${fill(ink, "fill")}>${xml(g.title)}</text>`);
    y += 24;
    g.items.forEach((it, i) => {
      const x = PAD + (i % COLS) * (SW + GAP), yy = y + Math.floor(i / COLS) * ROW, c = it.c;
      const value = c.via || c.text;
      const third = c.via ? `= ${c.text || hex(c)}` : c.a < 1 ? `on --paper ≈ ${hex(over(c, paper))}` : it.inherited ? "same as light" : "";
      body.push(`<g><rect x="${x}" y="${yy}" width="${SW}" height="${SH}" rx="10" ${fill(paper, "fill")}/>` +
        `<rect x="${x}" y="${yy}" width="${SW}" height="${SH}" rx="10" ${fill(c, "fill")} ${fill(sep2, "stroke")} stroke-width="1"/>` +
        `<text x="${x + 2}" y="${yy + SH + 18}" font-size="12" font-weight="600" ${fill(ink, "fill")}>${xml(it.name)}</text>` +
        `<text x="${x + 2}" y="${yy + SH + 34}" font-size="11" font-family="${mono}" ${fill(ink, "fill")}>${xml(value)}</text>` +
        (third ? `<text x="${x + 2}" y="${yy + SH + 49}" font-size="11" font-family="${mono}" ${fill(ink3, "fill")}>${xml(third)}</text>` : "") + `</g>`);
    });
    y += Math.ceil(g.items.length / COLS) * ROW + 10;
  }
  const H = y + PAD - 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${font}">\n` +
    `<rect width="${W}" height="${H}" ${fill(paper, "fill")}/>\n${body.join("\n")}\n</svg>\n`;
}

/* ---------- tokens.md ---------- */
function tokensMd() {
  const o = [];
  const p = (s = "") => o.push(s);
  const totalLines = PARSED.reduce((a, x) => a + x.lines, 0);
  p("# Design tokens and measurements");
  p();
  p(`> Generated by \`${CMD}\` from every \`.css\` file under \`skills/*/assets/\` (${CSS_FILES.length} files, ${totalLines} lines, ${D.length} declarations). Do not edit by hand: change the CSS and run the command again.`);
  p(`> The hand-written guide is [design.md](../../skills/team-site-design-system/references/design.md). Component states: [components.md](components.md). Motion: [motion.md](motion.md).`);
  p();
  p("Every row links to the line it comes from. `›` joins nested `@media` blocks. The sign-in page keeps its own small style sheet inside `functions/_middleware.js`; it is not part of these tables (its motion is in [motion.md](motion.md)).");
  p();
  p("## Contents");
  p();
  for (const h of ["Files scanned", "Colour palette", "Tokens on :root", "Print overrides", "Custom properties on components", "Custom properties set outside the CSS", "Colour literals outside the token blocks", "Font sizes", "Font weights", "Line heights", "Letter spacing", "Radii", "Spacing", "Z-index layers", "Box shadows", "Breakpoints", "Media queries in the JS"])
    p(`- [${h}](#${h.toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/ /g, "-")})`);
  p();

  p("## Files scanned");
  p();
  p(table(["File", "Skill", "Lines", "Rules", "Declarations", "`@media` blocks"],
    PARSED.map((x) => [`[${LABEL[x.file]}](${href(x.file)})`, skillOf(x.file), x.lines, x.rules, x.decls.length, x.medias.length]), [2, 3, 4, 5]));
  p();

  p("## Colour palette");
  p();
  p("Every token whose value is a colour, drawn by this script. Translucent fills and hairlines are drawn on `--paper`, as they appear on the page; the third line gives the colour that results.");
  p();
  p("![Colour tokens, light](palette-light.svg)");
  p();
  p("![Colour tokens, dark](palette-dark.svg)");
  p();

  p("## Tokens on :root");
  p();
  p("Three blocks carry the same names: `:root` (light), `:root[data-theme=dark]` (dark chosen with the theme button) and `@media (prefers-color-scheme:dark) { :root:not([data-theme=light]) }` (dark from the system when nothing is chosen). An empty cell means the block does not set the token, so the light value is inherited. **Read** counts the `var()` reads in all skill CSS.");
  p();
  const mismatch = TOKENS.filter((t) => t.dark.length && t.sysdark.length && val(t, "dark") !== val(t, "sysdark"))
    .concat(TOKENS.filter((t) => !!t.dark.length !== !!t.sysdark.length));
  p(mismatch.length
    ? `**Check:** dark and system dark differ for ${uniq(mismatch.map((t) => code(t.name))).join(", ")}.`
    : "**Check:** the dark block and the system-dark block set the same tokens to the same values (compared by this script).");
  p();
  // tokens no CSS rule reads: does the skill JS or the site HTML (not the demos) name them? `var(--gc-${k})` counts
  // for every --gc-N.
  const SITE_SRC = ASSETS.filter((f) => /\.(m?js|html)$/.test(f) && !/\/demo\//.test(f)).sort(cmp).map((f) => [f, read(f)]);
  const jsReads = (name) => SITE_SRC.filter(([, s]) => new RegExp(name.replace(/[-]/g, "\\-") + "(?![\\w-])").test(s) || (/\d$/.test(name) && s.includes(name.replace(/\d+$/, "") + "${"))).map(([f]) => f);
  const unread = TOKENS.filter((t) => !READS.has(t.name));
  const viaJs = unread.filter((t) => jsReads(t.name).length);
  const nowhere = unread.filter((t) => !jsReads(t.name).length);
  if (viaJs.length) {
    p(`**Read only from the JS** (no CSS rule reads them; the JS writes \`var(...)\` into an inline style): ${viaJs.map((t) => code(t.name)).join(", ")}, in ${uniq(viaJs.flatMap((t) => jsReads(t.name))).map((f) => `[${LABEL[f] || baseOf(f)}](${href(f)})`).join(", ")}.`);
    p();
  }
  if (nowhere.length) {
    p(`**Not read anywhere** (no skill CSS, no site JS or HTML outside the demos): ${nowhere.map((t) => code(t.name)).join(", ")}.`);
    p();
  }
  const cell = (t, sc) => (t[sc].length ? code(val(t, sc)) : "");
  const defs = (t) => cite([...t.light, ...t.dark, ...t.sysdark]);
  for (const [g] of [...GROUPS, ["Other"]]) {
    const list = TOKENS.filter((t) => groupOf(t.name) === g && (t.light.length || t.dark.length || t.sysdark.length));
    if (!list.length) continue;
    p(`### ${g}`);
    p();
    p(table(["Token", "Light `:root`", "Dark `[data-theme=dark]`", "System dark `@media`", "Read", "Defined at"],
      list.map((t) => [code(t.name), cell(t, "light"), cell(t, "dark"), cell(t, "sysdark"), (READS.get(t.name) || []).length, defs(t)]), [4]));
    p();
  }

  p("## Print overrides");
  p();
  const pr = TOKENS.filter((t) => t.print.length);
  p(pr.length ? "Tokens set again for paper (`@media print`)." : "No token is set for print.");
  p();
  if (pr.length) {
    p(table(["Token", "Print value", "Screen light value", "Where"], pr.map((t) => [code(t.name), code(val(t, "print")), t.light.length ? code(val(t, "light")) : "", cite(t.print)])));
    p();
  }

  p("## Custom properties on components");
  p();
  p("Custom properties defined on a component selector, not on `:root`.");
  p();
  p(table(["Property", "Value", "Selector", "Where"], LOCAL.slice().sort(byPlace).map((d) => [code(d.prop), code(d.value), code(short(d.selector, 60)) + mediaOf(d), link(d.file, d.line)])));
  p();

  p("## Custom properties set outside the CSS");
  p();
  p("Read with `var()` in the skill CSS but defined by no rule there: the JS or the HTML sets them inline (for example `--c`, a member's colour, on each event). The fallback is the value after the comma in `var()`, used until they are set.");
  p();
  const defined = new Set(PROPS.map((d) => d.prop));
  const outside = [...READS.keys()].filter((n) => !defined.has(n)).sort(cmp);
  p(table(["Property", "Reads", "Fallbacks written", "Read at"], outside.map((n) => {
    const r = READS.get(n);
    return [code(n), r.length, uniq(r.map((x) => x.fallback).filter((x) => x != null)).map(code).join(" ") || "none", cite(r)];
  }), [1]));
  p();

  p("## Colour literals outside the token blocks");
  p();
  p("Hex and `rgb()` colours written anywhere except the `:root` token blocks: shadows, scrims, masks, the intro's own dark scene and a few fixed colours. Use it to check that new colours go into `tokens.css`.");
  p();
  const lits = new Map();
  for (const d of [...D, ...KF_DECLS]) {
    if (d.prop.startsWith("--") && scopeOf(d) !== "local") continue;
    for (const m of d.value.matchAll(COLOR_RE)) {
      const k = m[0].toLowerCase().replace(/\s+/g, "");
      if (!lits.has(k)) lits.set(k, []);
      lits.get(k).push(d);
    }
  }
  p(table(["Literal", "Count", "Where (selector · property)"], [...lits].sort((a, b) => b[1].length - a[1].length || cmp(a[0], b[0]))
    .map(([k, l]) => [code(k), l.length, uniq(l.slice().sort(byPlace).map((d) => `${code(short(d.selector, 60))} · ${d.prop} ${link(d.file, d.line)}${mediaOf(d)}`)).join("<br>")]), [1]));
  p();

  // ---- type
  const sizes = [], weights = [], lhs = [];
  for (const d of D) {
    if (d.prop === "font-size") sizes.push({ ...d, v: d.value });
    if (d.prop === "font-weight") weights.push({ ...d, v: d.value });
    if (d.prop === "line-height") lhs.push({ ...d, v: d.value });
    if (d.prop === "font") {
      const toks = splitTop(d.value, " ");
      const sizeAt = toks.findIndex((t) => /^((?:\d*\.)?\d+(?:px|em|rem|pt|%|vw)|(?:clamp|calc|min|max)\(.*\))(?:\/.+)?$/.test(t));
      if (sizeAt < 0) continue;
      const [sz, lh] = toks[sizeAt].split("/");
      sizes.push({ ...d, v: sz, from: "font" });
      if (lh) lhs.push({ ...d, v: lh, from: "font" });
      const w = toks.slice(0, sizeAt).find((t) => /^([1-9]00|bold|normal|bolder|lighter)$/.test(t));
      if (w) weights.push({ ...d, v: w, from: "font" });
    }
  }
  const numKey = (v) => {
    const m = /^(-?(?:\d*\.)?\d+)(px|em|rem|pt|%|ch|vw|vh|mm)?$/.exec(v);
    if (!m) return [9, 0, v];
    const unitRank = { px: 0, "": 1, em: 3, rem: 3, "%": 4, pt: 6, ch: 5, vw: 5, vh: 5, mm: 7 }[m[2] || ""] ?? 8;
    return [unitRank, -parseFloat(m[1]), v];
  };
  const sortVals = (a, b) => {
    const x = numKey(a), y = numKey(b);
    return x[0] - y[0] || x[1] - y[1] || cmp(x[2], y[2]);
  };
  const groupBy = (list) => {
    const m = new Map();
    for (const d of list) { if (!m.has(d.v)) m.set(d.v, []); m.get(d.v).push(d); }
    return m;
  };
  const from = (d) => (d.from ? ` (in \`${d.from}\`)` : "");
  const atF = (d) => at(d) + from(d);

  p("## Font sizes");
  p();
  p("Every `font-size`, and the size inside a `font` shorthand. Largest first; `clamp()` and relative sizes after the pixel sizes, print sizes last. The body is 15 px (`tokens.css`).");
  p();
  p(table(["Size", "Count", "Where"], [...groupBy(sizes)].sort((a, b) => sortVals(a[0], b[0])).map(([v, l]) => [code(v), l.length, l.slice().sort(byPlace).map(atF).join("<br>")]), [1]));
  p();
  p("## Font weights");
  p();
  p(table(["Weight", "Count", "Where"], [...groupBy(weights)].sort((a, b) => sortVals(a[0], b[0])).map(([v, l]) => [code(v), l.length, cite(l)]), [1]));
  p();
  p("## Line heights");
  p();
  p(table(["Line height", "Count", "Where"], [...groupBy(lhs)].sort((a, b) => sortVals(a[0], b[0])).map(([v, l]) => [code(v), l.length, cite(l)]), [1]));
  p();
  p("## Letter spacing");
  p();
  p(table(["Letter spacing", "Count", "Where"], [...groupBy(D.filter((d) => d.prop === "letter-spacing").map((d) => ({ ...d, v: d.value })))]
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]) || cmp(a[0], b[0])).map(([v, l]) => [code(v), l.length, cite(l)]), [1]));
  p();

  p("## Radii");
  p();
  p("Every `border-radius` (and its corner longhands), grouped by the value as written.");
  p();
  const radii = D.filter((d) => /^border(-[a-z]+)*-radius$/.test(d.prop)).map((d) => ({ ...d, v: d.prop === "border-radius" ? d.value : `${d.prop.replace(/^border-|-radius$/g, "")}: ${d.value}` }));
  p(table(["Radius", "Count", "Where"], [...groupBy(radii)].sort((a, b) => sortVals(a[0], b[0])).map(([v, l]) => [code(v), l.length, atList(l)]), [1]));
  p();

  p("## Spacing");
  p();
  p("Each length in `padding`, `margin` and `gap` (with their longhands), counted one by one: `padding:0 15px` counts `15px` once. Zero and `auto` are left out; a `calc()`, `max()` or `env()` counts as one value. The most used first.");
  p();
  const SPACE = /^(padding|margin|gap|row-gap|column-gap|grid-gap)(-[a-z]+)*$/;
  const sp = [];
  for (const d of D.filter((x) => SPACE.test(x.prop))) for (const t of splitTop(d.value, " ")) if (!/^(0|auto|inherit|initial|unset)$/.test(t)) sp.push({ ...d, v: t });
  const spRows = [...groupBy(sp)].sort((a, b) => b[1].length - a[1].length || sortVals(a[0], b[0])).map(([v, l]) => {
    const props = Object.entries(l.reduce((m, d) => ((m[d.prop] = (m[d.prop] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))
      .map(([k, n]) => `${k} ×${n}`).join(", ");
    return [code(v), l.length, props, cite(l)];
  });
  const TOP = 30;
  p(table(["Value", "Count", "Properties", "Where"], spRows.slice(0, TOP), [1]));
  p();
  if (spRows.length > TOP) {
    p(`<details><summary>${spRows.length - TOP} more values</summary>`);
    p();
    p(table(["Value", "Count", "Properties", "Where"], spRows.slice(TOP), [1]));
    p();
    p("</details>");
    p();
  }

  p("## Z-index layers");
  p();
  p("Highest first.");
  p();
  p(table(["z-index", "Selector", "Where"], D.filter((d) => d.prop === "z-index").sort((a, b) => parseFloat(b.value) - parseFloat(a.value) || byPlace(a, b))
    .map((d) => [code(d.value), code(short(d.selector)) + mediaOf(d), link(d.file, d.line)]), [0]));
  p();

  p("## Box shadows");
  p();
  p("Every `box-shadow` value as written, the most used first. `inset 0 -2px 0` is the underline of a selected tab; `inset 0 0 0 1.5px` draws a ring without changing the size.");
  p();
  const shadows = D.filter((d) => d.prop === "box-shadow").map((d) => ({ ...d, v: d.value }));
  p(table(["Shadow", "Count", "Where"], [...groupBy(shadows)].sort((a, b) => b[1].length - a[1].length || cmp(a[0], b[0])).map(([v, l]) => [code(v), l.length, atList(l)]), [1]));
  p();

  p("## Breakpoints");
  p();
  p("Every `@media` query, with how many blocks use it and how many rules and declarations they hold. Width queries first, widest first.");
  p();
  const mq = new Map();
  for (const m of MEDIA) {
    const k = (m.outer.length ? m.outer.join(" › ") + " › " : "") + m.query;
    if (!mq.has(k)) mq.set(k, []);
    mq.get(k).push(m);
  }
  const mqKey = (k) => {
    const w = /(max|min)-width:(\d+)px/.exec(k);
    if (w && !/prefers|print/.test(k)) return [0, -parseInt(w[2], 10) - (w[1] === "min" ? 0.5 : 0), k];
    return [/aspect/.test(k) ? 1 : /pointer|hover/.test(k) ? 2 : /orientation/.test(k) ? 3 : /prefers-color/.test(k) ? 4 : /prefers-reduced/.test(k) ? 5 : 6, 0, k];
  };
  p(table(["Query", "Blocks", "Rules", "Declarations", "Where"], [...mq].sort((a, b) => {
    const x = mqKey(a[0]), y = mqKey(b[0]);
    return x[0] - y[0] || x[1] - y[1] || cmp(x[2], y[2]);
  }).map(([k, l]) => [code(k), l.length, l.reduce((a, m) => a + m.rules, 0), l.reduce((a, m) => a + m.decls, 0), cite(l)]), [1, 2, 3]));
  p();

  p("## Media queries in the JS");
  p();
  p("Query strings in the skill JS (`matchMedia` and the constants passed to it). They must agree with the CSS breakpoints above.");
  p();
  const jsq = [];
  for (const f of JS_FILES) {
    read(f).split("\n").forEach((l, i) => {
      for (const m of l.matchAll(/["'`](\((?:max-width|min-width|prefers-[\w-]+|hover|pointer|display-mode|orientation)[^"'`]*)["'`]/g))
        jsq.push({ file: f, line: i + 1, v: m[1].replace(/\s*:\s*/g, ":"), selector: "" });
    });
  }
  p(table(["Query", "Count", "Where"], [...groupBy(jsq)].sort((a, b) => cmp(a[0], b[0])).map(([v, l]) => [code(v), l.length, cite(l)]), [1]));
  p();
  return o.join("\n");
}

/* ---------- motion ---------- */
const TIME = /^-?(?:\d*\.)?\d+m?s$/i;
const EASING = /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)$|^(cubic-bezier|steps|linear)\(/;
function parseTransition(v) {
  if (v === "none") return [{ none: true, property: "none" }];
  return splitTop(v, ",").map((item) => {
    const o = { property: null, easing: null, times: [] };
    for (const t of splitTop(item, " ")) {
      if (TIME.test(t)) o.times.push(ms(t));
      else if (EASING.test(t)) o.easing = t;
      else o.property = t;
    }
    return { property: o.property || "all", duration: o.times[0] ?? 0, delay: o.times[1] ?? 0, easing: o.easing };
  });
}
function parseAnimation(v) {
  if (v === "none") return [{ none: true, name: "none" }];
  return splitTop(v, ",").map((item) => {
    const o = { name: null, easing: null, times: [], iter: null, dir: null, fill: null };
    for (const t of splitTop(item, " ")) {
      if (TIME.test(t)) o.times.push(ms(t));
      else if (EASING.test(t)) o.easing = t;
      else if (/^(infinite|\d*\.?\d+)$/.test(t)) o.iter = t;
      else if (/^(normal|reverse|alternate|alternate-reverse)$/.test(t)) o.dir = t;
      else if (/^(forwards|backwards|both)$/.test(t)) o.fill = t;
      else if (/^(running|paused)$/.test(t)) continue;
      else o.name = t;
    }
    return { name: o.name, duration: o.times[0] ?? 0, delay: o.times[1] ?? 0, easing: o.easing, iter: o.iter, dir: o.dir, fill: o.fill };
  });
}
const MOTION_PROP = /^(transition|animation)(-|$)/;
// the sign-in page's style sheet lives in a JS template; it is parsed the same way, with its own line numbers
const EMBEDDED = [];
for (const f of JS_FILES) {
  const src = read(f);
  for (const m of src.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    const before = src.slice(0, m.index + "<style>".length);
    const r = parseCss(m[1], f, before.split("\n").length - 1);
    EMBEDDED.push(r);
  }
}
const EMB_D = EMBEDDED.flatMap((r) => r.decls);
const EMB_KF = EMBEDDED.flatMap((r) => r.keyframes);
const ALL_D = [...D, ...EMB_D];
const ALL_KF = [...KF, ...EMB_KF];

// Elements that sit inside another in the markup, so a reduced-motion rule written for the outer one reaches them.
// guide.js build() puts every .guide-* element inside the .guide root.
const INSIDE = [[/^\.guide-/, ".guide"]];
function covers(rs, s) {
  if (rs === s) return true;
  const m = /^(.+?) \*(::?[\w-]+)?$/.exec(rs);
  if (!m) return false;
  const outer = m[1], pe = (m[2] || "").replace(/^:+/, "");
  const ps = ((/::?(before|after)$/.exec(s) || [""])[0]).replace(/^:+/, "");
  if (pe !== ps) return false;
  if (s.startsWith(outer + " ")) return true;
  return INSIDE.some(([re, o]) => o === outer && re.test(s));
}
const RM_DECLS = ALL_D.filter((d) => isRM(d) && MOTION_PROP.test(d.prop));
function coverage(d, kind) {
  const sels = splitTop(d.selector, ",");
  for (const r of RM_DECLS) {
    if (!r.prop.startsWith(kind)) continue;
    const rsels = splitTop(r.selector, ",");
    if (sels.every((s) => rsels.some((rs) => covers(rs, s)))) return r;
  }
  return null;
}
const MOVES_PROP = /^(all|transform|translate|scale|rotate|padding(-[a-z]+)?|margin(-[a-z]+)?|width|height|top|left|right|bottom|inset)$/;
const kfMoves = (name, file) => {
  const k = ALL_KF.find((x) => x.name === name && x.file === file) || ALL_KF.find((x) => x.name === name);
  return !!k && k.steps.some((s) => s.decls.some((d) => /^(transform|translate|scale|rotate)$/.test(d.prop)));
};
const ROWS = [];
for (const d of ALL_D.filter((x) => MOTION_PROP.test(x.prop) && !isRM(x))) {
  if (d.prop === "transition" || d.prop === "animation") {
    const kind = d.prop;
    const items = kind === "transition" ? parseTransition(d.value) : parseAnimation(d.value);
    const cov = coverage(d, kind);
    for (const it of items) {
      const moves = it.none ? false : kind === "transition" ? MOVES_PROP.test(it.property) : kfMoves(it.name, d.file);
      ROWS.push({ ...d, kind, ...it, cov, moves });
    }
  } else ROWS.push({ ...d, kind: d.prop.split("-")[0], raw: d.value, cov: coverage(d, d.prop.split("-")[0]), moves: false });
}
ROWS.sort(byPlace);
const easeTxt = (e) => (e ? code(e) : "not written (`ease`)");
const covTxt = (r) => (r.none ? "" : r.cov ? `off ${link(r.cov.file, r.cov.line)}` : "kept");

/* ---------- hand-written: the motion vocabulary (each row is looked up in the CSS) ---------- */
const VOCAB = [
  ["Colour, fill and the tab underline on hover, focus and selection", [
    ["components.css", ".tabs a"], ["components.css", ".btn"], ["components.css", ".segmented button"], ["components.css", ".fld input,.fld textarea"],
    ["calendar.css", ".cal-view button"], ["records.css", ".week-tabs button"], ["guide.css", ".guide-next::before"], ["chat.css", ".cm-del"]]],
  ["Calendar day cell on hover", [["calendar.css", ".day"]]],
  ["Small fades: switch track, guide layer and dots, an hour label under the now label", [
    ["components.css", ".sw"], ["guide.css", ".guide"], ["guide.css", ".guide-dots i"], ["calendar.css", ".wv-hours span"]]],
  ["Disclosure chevrons turning", [["theory.css", ".th-mtoc summary::after"], ["records.css", ".wk-table summary::after"], ["push.css", ".push-ios summary::after"], ["reader.css", ".rd-bar-btn svg"]]],
  ["Switch knob sliding 20 px", [["components.css", ".sw::after"]]],
  ["Dialog rising into place (wider than a phone)", [["components.css", ".dlg[open]", "dlg-in"]]],
  ["Chat panel sliding in, and the page making room beside it", [["chat.css", ".chat"], ["chat.css", "body"]]],
  ["Bottom sheet sliding up (phones)", [["components.css", ".dlg[open]", "dlg-sheet"]]],
  ["Copy · Comment bar appearing", [["chat.css", ".selpop"]]],
  ["Highlight after a jump (a message, a commented passage, a section, an equation)", [
    ["chat.css", ".cm.flash"], ["chat.css", "mark.cm-mark.flash"], ["theory.css", ".th-doc .hit"], ["reader.css", ".rd-text :is(.katex-display,figure,h2,h3):target"]]],
  ["Sync dot while the calendar loads", [["calendar.css", ".sync.busy i"]]],
  ["Intro: the scene dots (the current one grows)", [["intro.css", ".ix-dots button::after"]]],
  ["Intro: the app fading in after the intro, and out before a replay", [["intro.css", "html.intro-arrive .app"], ["intro.css", "html.ix-leave .app"]]],
  ["Intro: the scene fading in, and the arrival after sign-in (dim lifts, the title rises)", [
    ["intro.css", "html:not(.ix-login) .ix-gl"], ["intro.css", "html.ix-login.ix-go .ix-dim"], ["intro.css", "html.ix-login.ix-go .h0 .rise"]]],
  ["Sign-in button (its own page)", [["_middleware.js", ".pill"]]],
];
function vocabRows() {
  return VOCAB.map(([role, ms]) => {
    const rows = ms.flatMap(([f, sel, kf]) => {
      const r = ROWS.filter((x) => (LABEL[x.file] === f || baseOf(x.file) === f) && x.selector === sel && !x.none && (!kf || x.name === kf));
      if (!r.length) throw new Error(`motion vocabulary "${role}": no transition or animation for ${f} ${sel}${kf ? " " + kf : ""}. Update VOCAB in tools/design-inventory.mjs.`);
      return r;
    });
    const durs = uniq(rows.map((r) => r.duration)).sort((a, b) => a - b).map(showMs).join(", ");
    const eases = uniq(rows.map((r) => r.easing || "")).sort(cmp).map((e) => (e ? code(e) : "not written (`ease`)")).join(", ");
    const delays = uniq(rows.filter((r) => r.delay).map((r) => showMs(r.delay)));
    const what = uniq(rows.map((r) => (r.kind === "animation" ? `@keyframes ${r.name}` : r.property))).join(", ");
    const many = uniq(rows.map((r) => r.duration)).length > 1;
    const where = uniq(rows.map((r) => `${code(short(r.selector, 50))}${many ? " " + showMs(r.duration) : ""} ${link(r.file, r.line)}`)).join("<br>");
    return [role, durs + (delays.length ? ` (delay ${delays.join(", ")})` : ""), eases, code(what), where];
  });
}

/* ---------- hand-written: what the JS timers do (line numbers are found by this script) ---------- */
// file, a piece of code that occurs once in that file, a pattern that reads the number(s) from that line, how to show
// them, and what people see.
const CAL = "skills/shared-google-calendar/assets/site/js/calendar.js";
const CHAT = "skills/team-chat/assets/site/js/chat.js";
const SHEET = DS + "sheet.js";
const GUIDE = "skills/first-visit-spotlight-guide/assets/site/js/guide.js";
const FIRST = "skills/first-visit-spotlight-guide/assets/site/js/first-visit.js";
const PUSH = "skills/ios-webapp-push/assets/site/js/push.js";
const INTRO = "skills/scroll-3d-intro/assets/intro.js";
const SCENE = "skills/scroll-3d-intro/assets/intro-scene.js";
const DEVICE = "skills/scroll-3d-intro/assets/scenes/example-device.js";
const num = (s) => Number(String(s).replace(/_/g, ""));
const JS_MOTION = [
  [SHEET, 'const ease = "transform .26s cubic-bezier(.2,.8,.2,1)"', /"(transform [^"]+)"/, (m) => code(m[1]),
    "Pull to close, on release: the sheet slides out (`translateY(100%)`) or springs back with this transition. While the finger moves there is no transition."],
  [SHEET, "if (dy > 110 || (dy > 36 && v > 0.55))", /dy > (\d+) \|\| \(dy > (\d+) && v > ([\d.]+)\)/, (m) => `> ${m[1]} px, or > ${m[2]} px at > ${m[3]} px/ms`,
    "A pull closes the sheet past this distance, or as a flick; less springs back."],
  [SHEET, "if (Math.abs(d) < 8 && Math.abs(dx) < 8) return;", /< (\d+) &&/, (m) => `${m[1]} px`, "The pull is decided after this much movement: down is a pull, up or sideways is a scroll."],
  [SHEET, "sheet.style.transform = \"\"; }, 240)", /}, (\d+)\)/, (m) => showMs(m[1]), "After a pull that closes, `close()` runs this long after the slide-out starts."],
  [SHEET, 'setTimeout(() => { sheet.style.transition = ""; }, 280)', /}, (\d+)\)/, (m) => showMs(m[1]), "After a spring back, the inline transition is cleared."],
  [CAL, '{ duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" }', /duration: (\d+), easing: "([^"]+)"/, (m) => `${showMs(m[1])}, ${code(m[2])}`,
    "Next or previous week (month): the grid slides in from that side (`translateX(±22px)`, opacity .25 → 1). Skipped with reduced motion."],
  [CAL, "b.animate([{ transform: \"translateX(0)\" }", /duration: (\d+)/, (m) => showMs(m[1]),
    "Adding an event while the calendar cannot be written shows `#cal-banner` and shakes it (translateX 0 → −6 px → 6 px → 0). No reduced-motion check."],
  [CAL, "quick = e.timeStamp - sw.t < 700", /< (\d+);/, (m) => `under ${showMs(m[1])}`,
    "Phones: a sideways swipe changes the week (month) only if it is this quick, longer than 56 px and clearly sideways (|dx| > 1.8 |dy|)."],
  [CAL, 'setTimeout(() => f("title").focus(), 30)', /, (\d+)\)/, (m) => showMs(m[1]), "The event sheet puts the cursor in the title field this long after it opens (only when the calendar can be written)."],
  [CAL, "setInterval(updateNow, 30_000)", /updateNow, ([\d_]+)\)/, (m) => showMs(num(m[1])),
    "The now line and its time label move; an hour label within 14 minutes of it fades out (`.near`, opacity `.2s` in calendar.css)."],
  [CHAT, "setTimeout(() => { if (!isOpen) box.hidden = true; }, 260)", /}, (\d+)\)/, (m) => showMs(m[1]),
    "Closing the chat: the panel slides out (`.chat` transform, `.28s` in chat.css) and is hidden (`display:none`) this long after close starts."],
  [CHAT, "const settle = () => { place(); setTimeout(place, 120)", /place, (\d+)\); setTimeout\(place, (\d+)\); setTimeout\(place, (\d+)\)/, (m) => `0, ${m[1]}, ${m[2]} and ${m[3]} ms`,
    "When the composer gains or loses focus (the phone keyboard comes or goes), the sheet measures the visible area again at these times, because iPhone settles the keyboard over several frames."],
  [CHAT, "markT = setTimeout(markNow, 60)", /markNow, (\d+)\)/, (m) => showMs(m[1]), "Comment marks in the page are drawn again this long after a change (one redraw for a burst of changes)."],
  [CHAT, 'b.textContent = t("chat.delete"); }, 3000)', /}, (\d+)\)/, (m) => showMs(m[1]), "Delete on your own message asks twice: the first tap arms it (`.cm-del.armed`, red); it disarms after this long."],
  [CHAT, "popT = setTimeout(showPop, mm(TOUCH) ? 400 : 10)", /\? (\d+) : (\d+)/, (m) => `${showMs(m[1])} touch, ${showMs(m[2])} mouse`,
    "Copy · Comment appears this long after the selection settles (touch: after `selectionchange` stops; mouse: after `mouseup` or Shift `keyup`)."],
  [CHAT, "if (!s2 || s2.isCollapsed) hidePop(); }, 150)", /}, (\d+)\)/, (m) => showMs(m[1]), "The bar hides this long after the selection is cleared, if it is still empty then."],
  [CHAT, "setTimeout(hidePop, 900)", /hidePop, (\d+)\)/, (m) => showMs(m[1]), "After Copy the bar says “Copied” and hides after this long."],
  [GUIDE, "const EASE = 280;", /EASE = (\d+)/, (m) => `${showMs(m[1])}, cubic ease-out`,
    "The spotlight hole and the panel move to the next step (`easeOut = 1 - (1 - x) ** 3`). With reduced motion they jump."],
  [GUIDE, "delay = 400, // after the member is known", /delay = (\d+)/, (m) => showMs(m[1]), "The tour starts this long after the member is known (when it has not been seen yet)."],
  [GUIDE, "setTimeout(() => r.remove(), 240)", /, (\d+)\)/, (m) => showMs(m[1]),
    "Done, Skip or Esc: the layer gets `.is-off` (opacity `.2s` in guide.css) and is removed this long after. With reduced motion it is removed at once."],
  [GUIDE, "timer = setTimeout(start, 120); // after the menu has closed", /start, (\d+)\)/, (m) => showMs(m[1]), "“Site guide” in the name menu: the tour starts this long after the menu closes."],
  [FIRST, "window.addEventListener(introDoneEvent, () => setTimeout(askOnce, 400)", /askOnce, (\d+)\)/, (m) => showMs(m[1]),
    "After the intro ends (`intro:done`), the first-visit step (install sheet, app welcome or tour) starts this long after."],
  [FIRST, "} else setTimeout(askOnce, 600);", /askOnce, (\d+)\)/, (m) => showMs(m[1]), "With no intro, the first-visit step starts this long after the page is up."],
  [PUSH, "if (f) setTimeout(f, 300);", /f, (\d+)\)/, (m) => showMs(m[1]), "When “Add to Home Screen” closes, the next step (the tour, say) starts this long after."],
  [PUSH, "setTimeout(open, 400);", /open, (\d+)\)/, (m) => showMs(m[1]), "First start of the installed app: the notifications sheet opens this long after."],
  [INTRO, "const OUT_S = 0.5", /OUT_S = ([\d.]+)/, (m) => `${m[1]} s`, "Skip: the picture fades into the page colour over this time, then the app shows."],
  [INTRO, "const OUT_S = 0.5", /IN_S = ([\d.]+)/, (m) => `${m[1]} s`, "Replay: the scene fades in out of the page colour over this time."],
  [INTRO, "const OUT_S = 0.5", /LEAVE_MS = (\d+)/, (m) => showMs(m[1]),
    "Replay: the app first fades to the page colour (`html.ix-leave .app`, `.26s` in intro.css); the intro starts this long after."],
  [INTRO, "now - inAt > 3000", /> (\d+)\)/, (m) => `${showMs(m[1])} at most`, "Replay: the fade-in waits for the scene's first frame, or this long."],
  [INTRO, "else { sS += (sT - sS) * (1 - Math.exp(-dt * 7))", /-dt \* (\d+)/, (m) => `rate ${m[1]} per second`,
    "The scene follows the scroll with an exponential ease (the code comment says: time constant 1/7 s), never ahead of it. With reduced motion it follows the scroll exactly."],
  [INTRO, 'setTimeout(() => html.classList.remove("intro-arrive"), 600)', /, (\d+)\)/, (m) => showMs(m[1]),
    "End of the intro: `intro-arrive` (the app's `.4s` fade-in, `ix-arrive`) is taken off again after this long."],
  [INTRO, "until = performance.now() + 1500", /\+ (\d+)/, (m) => `${showMs(m[1])} at most`, "After the intro ends, the wheel or swipe that ended it is swallowed, so the app does not scroll on."],
  [INTRO, "clearTimeout(t); t = setTimeout(off, 180)", /off, (\d+)\)/, (m) => showMs(m[1]), "…until this long after the last wheel or touch event…"],
  [INTRO, "t = setTimeout(off, 400);", /off, (\d+)\)/, (m) => showMs(m[1]), "…or this long when none comes."],
  [INTRO, 'setTimeout(() => html.classList.add("ix-go"), 4000)', /, (\d+)\)/, (m) => `${showMs(m[1])} at most`,
    "Arrival after sign-in: `ix-go` (which starts the dim fade and the title rise in intro.css) comes with the first frame, or after this long, so a slow scene never leaves the page dimmed."],
  [SCENE, "const A = (ARRIVE || REDUCED) ? 1 : easeOut(tNow / 2.5);", /tNow \/ ([\d.]+)/, (m) => `${m[1]} s, cubic ease-out`,
    "Arrival: the camera dollies in (distance ×1.38 → 1) with a small swing. Not after sign-in (`ARRIVE`) and not with reduced motion."],
  [DEVICE, "{ k: 'lid', p: 0.18, dur: 1.1 }", /p: ([\d.]+), dur: ([\d.]+)/, (m) => `${m[2]} s at p ${m[1]}`,
    "Example scene: the lid opens once the story passes p. Every event finishes even if scrolling stops; reduced motion jumps to the end (intro-scene.js `stepEvents`)."],
  [DEVICE, "{ k: 'layers', p: 0.47, dur: 1.2 }", /p: ([\d.]+), dur: ([\d.]+)/, (m) => `${m[2]} s at p ${m[1]}`, "Example scene: the layers lift."],
  [DEVICE, "{ k: 'chip', p: 0.84, dur: 1.2 }", /p: ([\d.]+), dur: ([\d.]+)/, (m) => `${m[2]} s at p ${m[1]}`, "Example scene: the chip step."],
];
// timers that run but move nothing on screen
const JS_QUIET = [
  [CAL, "const POLL_MS = 60_000;", "Reads Google again every minute while the tab is visible."],
  [CAL, "Date.now() - S.lastSync > 15_000", "Reads again on return to the tab after 15 s away."],
  [CAL, "setTimeout(r, 80)", "Waits for a running load before opening an event from a notification."],
  [CHAT, "const POLL_OPEN = 4000, POLL_SHUT = 45000, POLL_OFF = 300000;", "Polling: every 4 s while the chat is open, 45 s while closed, 5 min when the server is off."],
  ["skills/lecture-notes-reader/assets/site/js/reader.js", "setTimeout(() => { ready = true; }, 600);", "The reader ignores the jump at load, then keeps the reading place…"],
  ["skills/lecture-notes-reader/assets/site/js/reader.js", "tm = setTimeout(keep, 400)", "…400 ms after scrolling stops."],
  ["skills/lecture-notes-reader/assets/site/js/theory-tab.js", "}, 700);", "The Theory tab keeps the reading place 700 ms after scrolling stops."],
  [SCENE, "new Promise(r => setTimeout(r, 1500))", "Waits at most 1.5 s for the fonts before drawing canvas text."],
  [SCENE, "new Promise(r => setTimeout(r, 8000))", "Waits at most 8 s for shader compilation."],
  ["skills/shared-google-calendar/assets/demo/fake-api.js", "await wait(120);", "Demo only: the fake API answers after 120 ms."],
  ["skills/lecture-notes-reader/assets/demo/test-reader.mjs", "await new Promise((r) => setTimeout(r, 500));", "Demo test only: waits 500 ms before checking the page."],
];
// lines that use a value explained above (through a constant or a helper) instead of holding it
const JS_ALSO = [
  [GUIDE, "timer = setTimeout(start, delay);"],
  [INTRO, "setTimeout(() => enter(true), LEAVE_MS);"],
  [SHEET, 'sheet.style.transition = "none";'],
  [SHEET, "sheet.style.transition = ease;"],
  ["skills/lecture-notes-reader/assets/site/js/theory-tab.js", "tm = setTimeout(() => {"],
  [CAL, "load({ quiet: true }); }, POLL_MS);"],
  [CHAT, "off ? POLL_OFF : isOpen ? POLL_OPEN : POLL_SHUT"],
  ["skills/shared-google-calendar/assets/demo/fake-api.js", "const wait = (ms) => new Promise((r) => setTimeout(r, ms));"],
];
// reduced motion in the JS
const JS_RM = [
  [CAL, 'if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;', "No slide when the week or month changes."],
  [GUIDE, "const k = reduced() ? 1 : easeOut(", "The spotlight and the panel jump to the next step."],
  [GUIDE, "if (reduced()) r.remove();", "The layer is removed at once, without the fade."],
  [GUIDE, 'window.scrollBy({ top: dy, behavior: reduced() ? "auto" : "smooth" })', "The page scrolls to the next target without smooth scrolling."],
  ["skills/lecture-notes-reader/assets/site/js/theory-tab.js", "const still = matchMedia(", "A link inside a chapter jumps without smooth scrolling."],
  ["skills/references-library/assets/site/js/refs.js", "const smooth = !matchMedia(", "The jump row and contents jump without smooth scrolling."],
  [CHAT, 'behavior: mm("(prefers-reduced-motion: reduce)") ? "auto" : "smooth"', "Opening a comment jumps to its mark without smooth scrolling."],
  [INTRO, "if (rm || snapMode) sS = sT;", "The scene follows the scroll exactly, with no easing."],
  [INTRO, "if (RMQ.matches || !running) finish(to);", "Skip ends the intro at once, without the fade."],
  [INTRO, 'if (RMQ.matches || html.classList.contains("ix-leave")) { enter(false); return; }', "Replay starts at once, without the fade out and in."],
  [INTRO, "const scrollToP = (p) => scrollTo({", "The scene dots jump without smooth scrolling."],
  [INTRO, 'window.scrollTo({ top: 0, behavior: RMQ.matches ? "auto" : "smooth" });', "Phones: the site name goes to the top without smooth scrolling."],
  [SCENE, "if (REDUCED) e.v = tg;", "Scene events (lid, layers, chip) jump to their end state."],
  [SCENE, "let tNow = qT != null ? qT : 0, clockRun = !(REDUCED || qT != null);", "The slow drift of the camera and the turntable stops."],
];
const JS_SRC = Object.fromEntries(JS_FILES.map((f) => [f, read(f).split("\n")]));
function findLine(file, find, what) {
  const lines = JS_SRC[file];
  if (!lines) throw new Error(`${what}: ${file} is missing. Update tools/design-inventory.mjs.`);
  const hits = lines.map((l, i) => (l.includes(find) ? i + 1 : 0)).filter(Boolean);
  if (hits.length !== 1) throw new Error(`${what}: "${find}" is found ${hits.length} times in ${file} (needs exactly 1). Update tools/design-inventory.mjs.`);
  return hits[0];
}
const sameCopies = (f) => {
  const s = read(f);
  return JS_FILES.filter((g) => g !== f && baseOf(g) === baseOf(f) && read(g) === s);
};

function motionMd() {
  const o = [];
  const p = (s = "") => o.push(s);
  p("# Motion");
  p();
  p(`> Generated by \`${CMD}\` from every \`.css\` file under \`skills/*/assets/\`, the style sheet inside \`google-signin-team-gate/assets/functions/_middleware.js\`, and the timers in the skill JS. Do not edit by hand: change the code and run the command again.`);
  p("> The roles in the first table and the explanations of the JS timers are written by hand in the script; the script finds every value and line in the code and stops when one is gone.");
  p();
  p("Durations are shown in ms. **Easing** \"not written\" means the CSS initial value `ease` applies. **Reduced motion** says whether a `prefers-reduced-motion: reduce` rule turns the motion off (with a link to that rule) or whether it is kept.");
  p();
  p("## Contents");
  p();
  for (const h of ["The motion vocabulary", "Every transition and animation", "Durations at a glance", "Reduced motion", "Timers in the JS"]) p(`- [${h}](#${h.toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/ /g, "-")})`);
  p();

  p("## The motion vocabulary");
  p();
  p("What moves, how long it takes, and where. Every value is read from the CSS.");
  p();
  p(table(["Role", "Duration", "Easing", "What changes", "Where"], vocabRows()));
  p();
  p("Motion started from the JS:");
  p();
  const jsv = [
    [CAL, '{ duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" }', "Calendar week or month change"],
    [SHEET, 'const ease = "transform .26s cubic-bezier(.2,.8,.2,1)"', "Bottom sheet let go after a pull (slides out or springs back)"],
    [GUIDE, "const EASE = 280;", "Guide spotlight and panel moving between steps"],
    [CAL, "b.animate([{ transform: \"translateX(0)\" }", "Banner shake when the calendar is read-only"],
    [SCENE, "const A = (ARRIVE || REDUCED) ? 1 : easeOut(tNow / 2.5);", "Intro camera arrival"],
  ];
  p(table(["Role", "Value", "Where"], jsv.map(([f, find, role]) => {
    const e = JS_MOTION.find((x) => x[0] === f && x[1] === find);
    const line = findLine(f, find, role), m = e[2].exec(JS_SRC[f][line - 1]);
    if (!m) throw new Error(`${role}: the value is gone from ${f}:${line}`);
    return [role, e[3](m), link(f, line)];
  })));
  p();

  p("## Every transition and animation");
  p();
  p("By skill, then file and line. A `transition` with several properties gives one row per property.");
  p();
  const files = uniq(ROWS.map((r) => r.file)).sort((a, b) => ORDER[a] - ORDER[b]);
  const skills = uniq(files.map(skillOf));
  for (const s of skills) {
    p(`### ${s}`);
    p();
    const tr = ROWS.filter((r) => skillOf(r.file) === s && r.kind === "transition");
    const an = ROWS.filter((r) => skillOf(r.file) === s && r.kind === "animation");
    const kf = ALL_KF.filter((k) => skillOf(k.file) === s).sort(byPlace);
    if (tr.length) {
      p("Transitions:");
      p();
      p(table(["Selector", "Property", "Duration", "Easing", "Delay", "Reduced motion", "Where"], tr.map((r) => r.raw != null
        ? [code(short(r.selector, 60)) + mediaOf(r), code(r.prop), code(r.raw), "", "", covTxt(r), link(r.file, r.line)]
        : [code(short(r.selector, 60)) + mediaOf(r), code(r.property), r.none ? "" : showMs(r.duration), r.none ? "" : easeTxt(r.easing), r.delay ? showMs(r.delay) : "", covTxt(r), link(r.file, r.line)])));
      p();
    }
    if (an.length) {
      p("Animations:");
      p();
      p(table(["Selector", "Keyframes", "Duration", "Easing", "Delay", "Repeat", "Fill", "Reduced motion", "Where"], an.map((r) => r.raw != null
        ? [code(short(r.selector, 60)) + mediaOf(r), code(r.prop), code(r.raw), "", "", "", "", covTxt(r), link(r.file, r.line)]
        : [code(short(r.selector, 60)) + mediaOf(r), code(r.name), r.none ? "" : showMs(r.duration), r.none ? "" : easeTxt(r.easing), r.delay ? showMs(r.delay) : "", r.iter || "", r.fill || "", covTxt(r), link(r.file, r.line)])));
      p();
    }
    if (kf.length) {
      p("Keyframes:");
      p();
      p(table(["@keyframes", "Steps", "Used by", "Where"], kf.map((k) => {
        const steps = k.steps.map((st) => `${st.selector}{${st.decls.map((d) => `${d.prop}:${d.value}`).join(";")}}`).join(" ");
        const users = ROWS.filter((r) => r.kind === "animation" && r.name === k.name).map((r) => `${code(short(r.selector, 50))}${mediaOf(r)}`);
        return [code(k.name), code(steps), uniq(users).join("<br>") || "nothing", link(k.file, k.line)];
      })));
      p();
    }
  }

  p("## Durations at a glance");
  p();
  p("Every CSS duration, shortest first, with what it moves. Generated from the table above.");
  p();
  const byDur = new Map();
  for (const r of ROWS.filter((x) => !x.none && x.raw == null)) {
    if (!byDur.has(r.duration)) byDur.set(r.duration, []);
    byDur.get(r.duration).push(r);
  }
  p(table(["Duration", "Count", "Easings", "What changes", "Where"], [...byDur].sort((a, b) => a[0] - b[0]).map(([d, l]) => [
    showMs(d), l.length, uniq(l.map((r) => r.easing || "")).sort(cmp).map((e) => (e ? code(e) : "not written")).join(", "),
    uniq(l.map((r) => (r.kind === "animation" ? `@keyframes ${r.name}` : r.property))).map(code).join(", "),
    uniq(l.map((r) => `${code(short(r.selector, 50))} ${link(r.file, r.line)}`)).join("<br>")]), [1]));
  p();

  p("## Reduced motion");
  p();
  p("### In the CSS");
  p();
  p("Every rule inside `@media (prefers-reduced-motion:reduce)`, by file.");
  p();
  const rmAll = ALL_D.filter(isRM).sort(byPlace);
  const rmFiles = uniq(rmAll.map((d) => d.file));
  p(table(["File", "Selector", "Declaration", "Where"], rmAll.map((d) => [LABEL[d.file] || baseOf(d.file), code(short(d.selector, 70)), code(`${d.prop}:${d.value}${d.important ? "!important" : ""}`), link(d.file, d.line)])));
  p();
  const noRm = uniq(ROWS.map((r) => r.file)).filter((f) => !rmFiles.includes(f));
  p(noRm.length ? `Files with motion but no reduced-motion block: ${noRm.map((f) => LABEL[f] || baseOf(f)).join(", ")}.` : "Every file that has a transition or an animation also has a reduced-motion block.");
  p();
  p("### What reduced motion keeps");
  p();
  p("Motion with no reduced-motion rule over it. Colour and opacity fades are expected to stay; the **Moves** column marks the ones that move or resize something (a transform, a size or padding, or keyframes with a transform).");
  p();
  const kept = ROWS.filter((r) => !r.none && !r.cov && !r.media.some((m) => /print/.test(m)));
  p(table(["Selector", "What changes", "Duration", "Moves", "Where"], kept.map((r) => [code(short(r.selector, 60)) + mediaOf(r),
    code(r.raw != null ? r.prop : r.kind === "animation" ? `@keyframes ${r.name}` : r.property), r.raw != null ? code(r.raw) : showMs(r.duration), r.moves ? "**yes**" : "no", link(r.file, r.line)])));
  p();
  p("### In the JS");
  p();
  p(table(["What changes with reduced motion", "Where"], JS_RM.map(([f, find, what]) => [what, link(f, findLine(f, find, what))])));
  p();
  p("Not checked in the JS: the calendar banner shake (`calendar.js`), and the pull-to-close transition in `sheet.js` (it follows the finger, and an inline style is not reached by the CSS rules above).");
  p();

  p("## Timers in the JS");
  p();
  p("Timing constants in the skill JS that change what people see. Read from the code around each one; the value column is read from the line itself.");
  p();
  const jsRows = JS_MOTION.map(([f, find, re, show, what]) => {
    const line = findLine(f, find, what), m = re.exec(JS_SRC[f][line - 1]);
    if (!m) throw new Error(`JS timer "${what}": the pattern ${re} does not match ${f}:${line}. Update tools/design-inventory.mjs.`);
    const copies = sameCopies(f);
    return { f, line, row: [show(m), what, link(f, line) + (copies.length ? `<br>(the same file: ${copies.map((c) => `[${LABEL[c]}](${href(c, line)})`).join(", ")})` : "")] };
  });
  const jsFiles = uniq(jsRows.map((r) => r.f)).sort((a, b) => ORDER[a] - ORDER[b]);
  for (const f of jsFiles) {
    p(`### ${LABEL[f]} (${skillOf(f)})`);
    p();
    p(table(["Value", "What people see", "Where"], jsRows.filter((r) => r.f === f).sort((a, b) => a.line - b.line).map((r) => r.row)));
    p();
  }
  p("### Timers that move nothing");
  p();
  p("Found by the same search, left out above because nothing on screen moves with them.");
  p();
  p(table(["What it does", "Where"], JS_QUIET.map(([f, find, what]) => [what, link(f, findLine(f, find, what))])));
  p();
  p("### Every timer call in the skill JS");
  p();
  const knownAt = [...JS_MOTION, ...JS_QUIET].map((e) => [e[0], findLine(e[0], e[1], "list")]);
  for (const [f, find] of JS_ALSO) {
    const hits = JS_SRC[f].map((l, i) => (l.includes(find) ? i + 1 : 0)).filter(Boolean);
    if (!hits.length) throw new Error(`JS_ALSO: "${find}" is gone from ${f}. Update tools/design-inventory.mjs.`);
    for (const h of hits) knownAt.push([f, h]);
  }
  // an identical copy of a file is explained by the same rows
  const known = new Set(knownAt.flatMap(([f, l]) => [f, ...sameCopies(f)].map((g) => `${g}:${l}`)));
  const calls = [];
  for (const f of JS_FILES) JS_SRC[f].forEach((l, i) => {
    if (/\bset(Timeout|Interval)\s*\(|\.animate\s*\(|\.style\.transition\s*=|\bwait\(\d/.test(l)) calls.push({ f, line: i + 1, text: l.trim() });
  });
  p(`<details><summary>${calls.length} lines with <code>setTimeout</code>, <code>setInterval</code>, <code>.animate()</code> or an inline transition</summary>`);
  p();
  p(table(["Code", "Explained above", "Where"], calls.map((c) => [code(short(c.text, 110)), known.has(`${c.f}:${c.line}`) ? "yes" : "", link(c.f, c.line)])));
  p();
  p("</details>");
  p();
  return o.join("\n");
}

/* ---------- write ---------- */
fs.mkdirSync(OUT, { recursive: true });
const outputs = {
  "tokens.md": tokensMd() + "\n",
  "motion.md": motionMd() + "\n",
  "palette-light.svg": paletteSvg("light"),
  "palette-dark.svg": paletteSvg("dark"),
};
for (const [name, text] of Object.entries(outputs)) {
  const f = path.join(OUT, name);
  const old = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
  if (old !== text) fs.writeFileSync(f, text);
  console.log(`${old === text ? "unchanged" : "wrote    "} docs/design/${name} (${Buffer.byteLength(text)} bytes)`);
}
