// Checks every skill folder before a push: node tools/check-skills.mjs
// - SKILL.md frontmatter: name equals the folder, one-line description under 1024 characters
// - the required sections exist
// - every relative link and image in every Markdown file resolves
// - no file over 2 MB, screenshots under 1.2 MB
// - the plugin marketplace lists every skill, and nothing else
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SKILLS = path.join(ROOT, "skills");
const REQUIRED = [/^## When to use/m, /^## What you get/m, /^## Steps/m, /^## Rules/m, /^## Self-check/m, /^## References/m];
const errors = [];
const err = (f, m) => errors.push(`${path.relative(ROOT, f)}: ${m}`);

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  if (e.name === ".git" || e.name === "node_modules" || e.name === "vendor") return [];
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

const names = fs.readdirSync(SKILLS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
for (const n of names) {
  const f = path.join(SKILLS, n, "SKILL.md");
  if (!fs.existsSync(f)) { err(f, "missing"); continue; }
  const s = fs.readFileSync(f, "utf8");
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(s);
  if (!fm) { err(f, "no frontmatter"); continue; }
  const name = /^name:\s*(.+)$/m.exec(fm[1])?.[1].trim();
  const desc = /^description:\s*(.+)$/m.exec(fm[1])?.[1].trim();
  if (name !== n) err(f, `name "${name}" is not the folder name "${n}"`);
  if (!desc) err(f, "no description");
  else if (desc.length > 1024) err(f, `description is ${desc.length} characters (max 1024)`);
  else if (/[<>]/.test(desc)) err(f, "description has angle brackets");
  for (const re of REQUIRED) if (!re.test(s)) err(f, `missing section ${re.source.replace(/\^|\\|\/m/g, "")}`);
}

for (const f of walk(ROOT)) {
  const size = fs.statSync(f).size;
  if (size > 2 * 1024 * 1024) err(f, `${(size / 1048576).toFixed(1)} MB (max 2 MB)`);
  if (/\/screenshots\//.test(f) && size > 1.2 * 1024 * 1024) err(f, `screenshot ${(size / 1048576).toFixed(1)} MB (max 1.2 MB)`);
  if (!f.endsWith(".md") || /\/assets\//.test(f)) continue; // templates and demos link to files of the project they are copied into
  const s = fs.readFileSync(f, "utf8").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  for (const m of s.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const target = path.resolve(path.dirname(f), decodeURIComponent(href.split("#")[0]));
    if (!fs.existsSync(target)) err(f, `broken link ${href}`);
  }
}

const mp = path.join(ROOT, ".claude-plugin", "marketplace.json");
if (fs.existsSync(mp)) {
  const j = JSON.parse(fs.readFileSync(mp, "utf8"));
  const listed = j.plugins.flatMap((p) => p.skills || []).map((s) => path.basename(s)).sort();
  for (const n of names) if (!listed.includes(n)) err(mp, `does not list ${n}`);
  for (const n of listed) if (!names.includes(n)) err(mp, `lists ${n}, which has no folder`);
} else err(mp, "missing");

if (errors.length) { console.log(errors.map((e) => "✗ " + e).join("\n")); process.exit(1); }
console.log(`✓ ${names.length} skills: frontmatter, sections, links, sizes and marketplace all fine`);
