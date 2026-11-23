// Writes the two generated indexes, in the build order of docs/START-HERE.md:
//   docs/gallery.md  every skill's screenshots on one page (captions from the file names, <what>-<width>-<theme>.png)
//   llms.txt         the index for LLM tools (llmstxt.org format), with each skill's description from its SKILL.md
//   node tools/make-index.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ORDER = [
  "team-project-playbook", "team-site-setup", "team-site-design-system", "google-signin-team-gate", "shared-google-calendar",
  "weekly-research-log", "references-library", "lecture-notes-reader", "ios-webapp-push", "team-chat",
  "first-visit-spotlight-guide", "kakao-link-preview", "scroll-3d-intro",
];
const all = fs.readdirSync(path.join(ROOT, "skills")).filter((n) => fs.existsSync(path.join(ROOT, "skills", n, "SKILL.md")));
const names = [...ORDER.filter((n) => all.includes(n)), ...all.filter((n) => !ORDER.includes(n)).sort()];

function caption(file) {
  const base = file.replace(/\.(png|jpe?g|webp|gif)$/i, "");
  const parts = base.split("-");
  const out = [];
  const words = [];
  for (const p of parts) {
    if (/^\d{3,4}$/.test(p)) out.push(p + " px");
    else if (/^\d{3,4}x\d{3,4}$/.test(p)) out.push(p.replace("x", " × "));
    else if (p === "light" || p === "dark") out.push(p);
    else words.push(p);
  }
  const what = words.join(" ");
  return (what.charAt(0).toUpperCase() + what.slice(1)) + (out.length ? " · " + out.join(" · ") : "");
}
const skillMd = (skill) => fs.readFileSync(path.join(ROOT, "skills", skill, "SKILL.md"), "utf8");
const title = (skill) => (/^# (.+)$/m.exec(skillMd(skill)) || [, skill])[1].trim();
const desc = (skill) => (/^description:\s*(.+)$/m.exec(skillMd(skill)) || [, ""])[1].trim();

let md = "# Gallery\n\nEvery screenshot in the repository, skill by skill, in build order. All data is placeholder data.\n" +
  "Regenerate with `node tools/make-index.mjs`.\n";
for (const n of names) {
  const dir = path.join(ROOT, "skills", n, "screenshots");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)).sort() : [];
  if (!files.length) continue;
  md += `\n## [${title(n)}](../skills/${n}/SKILL.md)\n\n`;
  // two per row: wide shots read better large; phone shots sit side by side
  const rows = [];
  for (let i = 0; i < files.length; i += 2) rows.push(files.slice(i, i + 2));
  md += "| | |\n|---|---|\n";
  for (const r of rows) {
    const cell = (f) => (f ? `![${caption(f)}](../skills/${n}/screenshots/${f})<br>${caption(f)}` : "");
    md += `| ${cell(r[0])} | ${cell(r[1])} |\n`;
  }
}
fs.writeFileSync(path.join(ROOT, "docs", "gallery.md"), md);

/* ---------- llms.txt ---------- */
const RAW = "https://raw.githubusercontent.com/suhan-dev/site-skills/main/";
let tx = `# site-skills

> Claude skills that rebuild a private team site (shared Google Calendar, weekly research log, references, lecture-notes
> reader, Google sign-in for a fixed team, iPhone Home Screen app with notifications, team chat with comments on text,
> onboarding tour, link previews, 3D scroll intro) on Cloudflare Pages + D1, plus the team working rules around it.
> Placeholder data only; no secrets are ever in this repository.

To build a site for a user: read CLAUDE.md, then docs/START-HERE.md (intake questions, build order, what only the user
can do in a console, checks after each step). Never ask the user to paste a secret into chat; secrets go into
Cloudflare Variables and Secrets by the user's own hand.

## Start here

- [CLAUDE.md](${RAW}CLAUDE.md): the two jobs (build a site, change this library) and the never list
- [docs/START-HERE.md](${RAW}docs/START-HERE.md): intake questions, build order, checks, settings checklist, handover
- [team-site-setup/references/end-to-end.md](${RAW}skills/team-site-setup/references/end-to-end.md): every console click from an empty account to a live site
- [SECURITY.md](${RAW}SECURITY.md): what is never committed and where each secret lives

## Skills (build order)

`;
for (const n of names) tx += `- [${n}](${RAW}skills/${n}/SKILL.md): ${desc(n)}\n`;
tx += `
## Optional

- [docs/gallery.md](${RAW}docs/gallery.md): every screenshot
- [CONTRIBUTING.md](${RAW}CONTRIBUTING.md): how a skill folder is built, placeholders, screenshots
- [.claude-plugin/marketplace.json](${RAW}.claude-plugin/marketplace.json): install as a Claude Code plugin
`;
fs.writeFileSync(path.join(ROOT, "llms.txt"), tx);
console.log("wrote docs/gallery.md and llms.txt:", names.length, "skills");
