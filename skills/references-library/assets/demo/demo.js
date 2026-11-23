// Demo wiring: the References tab exactly as a site starts it, with the demo's own data.
// data/refs.json is made from ./references by the real build step:
//   python3 ../build_refs.py --root . --out data/refs.json      (run inside assets/demo)
// ?at=sec-papers jumps to a section · ?q=hart searches · ?f=Task%202 filters.
import { createRefs } from "../site/js/refs.js";
import { MD_VENDOR } from "../site/js/md.js";
import { initTheme } from "../../../team-site-design-system/assets/theme.js";
import { wireLangButton } from "../../../team-site-design-system/assets/i18n.js";

MD_VENDOR.katex = "./vendor/katex/katex.min.js";
const team = await (await fetch("./site/data/team.json")).json();
const q = new URLSearchParams(location.search);

const refs = createRefs({
  team,
  refsUrl: "./data/refs.json",
  overviewUrl: "./site/data/problem.json",
  highlight: { names: ["B. Hart", "C. Lin"], label: "our advisors" }, // made-up names
});
await refs.show();
if (q.get("q")) { const i = document.getElementById("paper-q"); i.value = q.get("q"); i.dispatchEvent(new Event("input", { bubbles: true })); }
if (q.get("f")) document.querySelector(`#paper-chips [data-f="${q.get("f")}"]`)?.click();
if (q.get("at")) document.getElementById(q.get("at"))?.scrollIntoView({ block: "start" });
window.demoRefs = refs;

initTheme({ button: document.getElementById("theme-btn") });
wireLangButton();
