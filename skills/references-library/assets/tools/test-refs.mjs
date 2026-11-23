// Offline tests for the References page's parser: how references/README.md becomes link lists and text sections, and
// how a description's (verified)/(unverified) becomes a mark. No browser, no network, no libraries.
//   node tools/test-refs.mjs        (Node 20.6+; run from the skill's assets/ folder or a project that copied the files)
import { register } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// md.js imports marked from /vendor/…; the parser never calls it, so a stub stands in.
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s, c, next) {
    if (s === "/vendor/marked/marked.esm.js") return { url: "data:text/javascript,export class Marked{}", shortCircuit: true };
    return next(s, c);
  }`));

const here = path.dirname(fileURLToPath(import.meta.url));
const find = (...rel) => rel.map((r) => path.join(here, r)).find((p) => existsSync(p));
const js = find("../site/js/refs.js", "../js/refs.js", "../../site/js/refs.js");
if (!js) { console.error("refs.js not found (looked in ../site/js, ../js, ../../site/js)"); process.exit(2); }
const { sections, tagOf, TAG_RE } = await import(pathToFileURL(js).href);
const { t, useStrings } = await import(pathToFileURL(path.join(path.dirname(js), "refs-strings.js")).href);

let passed = 0, failed = 0;
const ok = (cond, name, extra = "") => { if (cond) passed++; else { failed++; console.log("✗", name, extra); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, `\n   got  ${JSON.stringify(a)}\n   want ${JSON.stringify(b)}`);

// ---------- sections() ----------
const md = `# references

Text before the first section is the file's own introduction; the page leaves it out.

## Project links
Pages the course gave us.
- [Course page](https://example.edu/c) — the brief and the schedule. (verified)
* [Data sheet](https://example.com/ds) – sensor accuracy. (unverified)
- [Bare link](https://example.org/b)

## Earlier projects
No report from earlier years was found online.

## Mixed
- [A link](https://example.org/a) — fine. (verified)
- a plain bullet, not a link

## Données & outils 2027
- [Outil](https://example.org/o) — un outil. (verified)
`;
const s = sections(md);
eq(s.map((x) => x.title), ["Project links", "Earlier projects", "Mixed", "Données & outils 2027"], "split by ## headings; the intro is left out");
eq(s.map((x) => x.id), ["sec-project-links", "sec-earlier-projects", "sec-mixed", "sec-données-outils-2027"], "ids keep letters of any language");
ok(s[0].cards && s[0].cards.length === 3, "a section of links becomes a link list", JSON.stringify(s[0].cards));
eq(s[0].lead, "Pages the course gave us.", "a sentence before the list is its lead");
eq(s[0].cards[0], { title: "Course page", url: "https://example.edu/c", desc: "the brief and the schedule. (verified)" }, "title, url and description");
eq(s[0].cards[1].desc, "sensor accuracy. (unverified)", "* bullets and an en dash work");
eq(s[0].cards[2].desc, "", "a link without a description");
ok(s[1].cards === null && s[1].md.startsWith("No report"), "a section of text is rendered as Markdown");
ok(s[2].cards === null, "one plain bullet makes the whole section Markdown (nothing is dropped)");
ok(s[3].cards && s[3].cards[0].title === "Outil", "a section title with accents and & works");
eq(sections(""), [], "an empty README → no sections");
eq(sections("## Only a title").map((x) => [x.title, x.cards, x.md]), [["Only a title", null, ""]], "a section with nothing in it");
eq(sections("##No space\n## Real\n- [A](https://example.org/) — d. (verified)").map((x) => x.title), ["Real"], "## needs a space after it");

// ---------- tagOf() and TAG_RE ----------
eq(tagOf("what it is. (verified)"), ["ok", "Verified"], "(verified) → Verified");
eq(tagOf("what it is. (unverified)"), ["guess", "Unverified"], "(unverified) → Unverified, not Verified");
eq(tagOf("what it is. (inferred)"), ["guess", "Unverified"], "the source's old word (inferred) still reads as a guess");
eq(tagOf("what it is. (Unverified)"), ["guess", "Unverified"], "case does not matter");
eq(tagOf("what it is."), null, "no mark → no tag (the lint asks for one)");
eq("the brief. (verified)".replace(TAG_RE, " ").trim(), "the brief.", "the mark is taken out of the description");
eq("a (verified) b".replace(TAG_RE, " ").trim(), "a b", "…wherever it is");

// ---------- strings ----------
eq(t("refs.count", { n: 3, t: 8 }), "3 of 8", "placeholders are filled");
eq(t("refs.step", { n: 2 }), "Task 2", "Task {n}");
useStrings({ "refs.step": "Step {n}" });
eq(t("refs.step", { n: 2 }), "Step 2", "useStrings() replaces a word");
eq(t("refs.all"), "All", "…and keeps the others");
useStrings(null);
eq(t("no.such.key"), "no.such.key", "an unknown key shows itself");

// ---------- the page and the lint read link lines the same way ----------
const py = find("../build_refs.py", "../../build_refs.py", "build_refs.py");
if (py) {
  const pyRe = readFileSync(py, "utf8").match(/^LINK = re\.compile\(r"(.+)"\)$/m);
  const jsRe = readFileSync(js, "utf8").match(/const m = tt\.match\(\/(.+)\/\);/);
  ok(pyRe && jsRe && pyRe[1] === jsRe[1], "build_refs.py LINK and refs.js use the same link pattern", `\n   py ${pyRe && pyRe[1]}\n   js ${jsRe && jsRe[1]}`);
}

console.log(`${failed ? "✗" : "✓"} ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
