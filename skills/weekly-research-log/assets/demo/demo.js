// Demo wiring: the Research log tab exactly as a site starts it, with the demo's own records.json.
// data/records.json is made from ./logs by the real build step:
//   python3 ../build_records.py --root . --out data/records.json      (run inside assets/demo)
// ?week=2 opens week 2 · ?person=blair opens Blair's log · ?table=1 opens the closing table.
import { createRecords } from "../site/js/records.js";
import { MD_VENDOR } from "../site/js/md.js";
import { initTheme } from "../../../team-site-design-system/assets/theme.js";
import { wireLangButton } from "../../../team-site-design-system/assets/i18n.js";

MD_VENDOR.katex = "./vendor/katex/katex.min.js";
const team = await (await fetch("./site/data/team.json")).json();
const me = () => team.members[0]; // signed in as Alex
const q = new URLSearchParams(location.search);

const rec = createRecords({ team, me, dataUrl: "./data/records.json", imgBase: "./", hash: "" });
await rec.show(q.get("week") ? +q.get("week") : null);
if (q.get("person")) document.querySelector(`#week-body [data-person="${q.get("person")}"]`)?.click();
if (q.get("table")) document.getElementById("week-table").open = true;
window.demoRec = rec;

initTheme({ button: document.getElementById("theme-btn") });
wireLangButton();
