// Research log tab: shows logs/weekNN_MMDD/team.md (meeting notes) and <id>.md (personal logs) as week tabs.
// Data comes from records.json, written by build_records.py. Logs are written on GitHub; this tab links to the right
// page (edit, view, or a new file with the template filled in).
//
// A week runs 7 days from its first day. Once its last day has passed in the team's time zone, it is closed: a lock in
// its tab, a "Closed" line, and no edit links (the record-lock check on GitHub refuses edits too).
import { $, esc, todayIn, diffDays, addDays, md, dShort, dLong, dow, GCOLORS, keepPairs, sideStrip } from "./rec-util.js";
import { t } from "./rec-strings.js";
import { renderMd, isBlank } from "./md.js";

const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Templates for a new file (GitHub's new-file page opens with them). Change them to the team's own headings;
// keep them in the team's documentation language.
const TEAM_TPL = (w) => `# Week ${w.no} · ${md(w.date)} (${DOW_LONG[dow(w.date)].slice(0, 3)}) —

- Scribe:
- Attendees:

## Decisions this week
-

## Progress
| Topic | Owner | This week | Next week |
|---|---|---|---|
| | | | |
| | | | |

## To do by next week
- [ ]
`;

const PERSON_TPL = (w, name) => `# ${name} · Week ${w.no} (${md(w.date)})

## Done
-

## Learned · results
-

## Stuck · questions
-

## Next week
- [ ]

## Links (notes · code · figures)
-
`;

const LOCK = `<svg class="lk" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 7V5.5a3.5 3.5 0 0 1 7 0V7"/><rect x="3" y="7" width="10" height="7" rx="1.6"/></svg>`;
const EXT = `<span class="ext" aria-hidden="true">↗</span>`;

// ctx: { team, me, dataUrl, imgBase, hash, templates }
//   team      team.json: repo ("owner/name"), branch, members [{ id, name, colorId }]
//   me        () => the signed-in member { id } or null: their own log tab opens first
//   dataUrl   where records.json is ("/data/records.json")
//   imgBase   where the build copied the images ("/repo/")
//   hash      the address prefix for a week ("#records/"), or "" to leave the address alone
//   templates { team(w), person(w, name) } to replace the default templates
export function createRecords(ctx) {
  const { team, me = () => null, dataUrl = "/data/records.json", imgBase = "/repo/", hash = "#records/" } = ctx;
  const teamTpl = (ctx.templates && ctx.templates.team) || TEAM_TPL;
  const personTpl = (ctx.templates && ctx.templates.person) || PERSON_TPL;
  const repo = team.repo, branch = team.branch || "main";
  const gh = (kind, path) => `https://github.com/${repo}/${kind}/${branch}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const ghNew = (dir, name, value) => `https://github.com/${repo}/new/${branch}/${dir.split("/").map(encodeURIComponent).join("/")}?filename=${encodeURIComponent(name)}&value=${encodeURIComponent(value)}`;
  const nm = (m) => m.name || m.en || m.id;
  let data = null;
  let cur = 0;
  let person = null;

  const today = () => todayIn(data && data.timeZone);
  // closed once the week's last day has passed (team time): the same rule as tools/check_record_lock.py and weeks.py
  const isLocked = (w) => today() > w.end;

  async function ensure() {
    if (data) return data;
    try {
      const r = await fetch(dataUrl, { cache: "no-cache" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      data = await r.json();
    } catch (e) {
      data = { weeks: [], error: e.message };
    }
    return data;
  }

  // the week that holds today; before the first week, the first week with a folder; after the last, the last
  function defaultWeek() {
    const td = today();
    const ws = data.weeks;
    if (!ws.length) return 0;
    if (td < ws[0].date) return Math.max(0, ws.findIndex((w) => w.exists));
    let idx = ws.length - 1;
    for (let i = 0; i < ws.length; i++) if (ws[i].date <= td) idx = i;
    return idx;
  }

  function renderTabs() {
    const td = today();
    $("#week-tabs").innerHTML = data.weeks.map((w, i) => {
      const now = td >= w.date && diffDays(w.date, td) < 7;
      const has = w.exists && (w.team && !isBlank(w.team.md) || Object.values(w.people || {}).some((p) => p && !isBlank(p.md)));
      const locked = isLocked(w);
      return `<button type="button" role="tab" data-week="${i}" aria-selected="${i === cur}" class="${w.exists ? "" : "empty"} ${now ? "now" : ""} ${locked ? "locked" : ""}" title="${esc(t("wk.tip", { n: w.no, a: dLong(w.date), b: dLong(w.end) }))}${locked ? " · " + esc(t("rec.locked")) : ""}">
        <b>${locked ? LOCK : ""}${esc(t("rec.week", { n: w.no }))}${has ? `<span class="dot" title="${esc(t("rec.hasLog"))}"></span>` : ""}</b><small>${esc(dShort(w.date))} – ${esc(dShort(w.end))}${now ? ` · <em>${esc(t("rec.thisWeek"))}</em>` : ""}</small></button>`;
    }).join("");
    const rows = data.weeks.map((w) => `<tr class="${isLocked(w) ? "locked" : ""}${td >= w.date && !isLocked(w) ? " now" : ""}"><td>${esc(t("rec.week", { n: w.no }))}</td><td>${esc(dLong(w.date))} – ${esc(dLong(w.end))}</td><td>${esc(t("rec.closesAt", { d: dLong(addDays(w.end, 1)) }))}</td><td>${isLocked(w) ? `${LOCK}${esc(t("rec.locked"))}` : td >= w.date ? esc(t("rec.thisWeek")) : ""}</td></tr>`).join("");
    const w0 = data.weeks[0];
    const rule = w0 ? t("rec.tableP", { a: DOW_LONG[dow(w0.date)], b: DOW_LONG[dow(w0.end)], tz: esc(data.timeZone || "") }) : "";
    $("#week-table").innerHTML = `<summary>${esc(t("rec.tableSum"))}</summary><p>${rule}</p><table><thead><tr><th>${esc(t("rec.thWeek"))}</th><th>${esc(t("rec.thDates"))}</th><th>${esc(t("rec.thCloses"))}</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    sideStrip($("#week-tabs"), $(`#week-tabs [data-week="${cur}"]`));
  }

  async function docCard(title, file, dir, newLink, locked) {
    const head = `<header><h3>${esc(title)}</h3><span class="sp"></span>
      ${file && !locked ? `<a href="${gh("edit", file.path)}" target="_blank" rel="noopener">${esc(t("rec.edit"))}${EXT}</a>` : ""}
      ${file && locked ? `<a href="${gh("blob", file.path)}" target="_blank" rel="noopener">${esc(t("rec.viewGh"))}${EXT}</a>` : ""}</header>`;
    if (!file) {
      return `<article class="doc-card">${head}<div class="empty-box"><p>${esc(locked ? t("rec.noTeamLocked") : t("rec.noFile"))}</p>${newLink && !locked ? `<a class="btn ghost small" href="${newLink}" target="_blank" rel="noopener">${esc(t("rec.create"))}${EXT}</a>` : ""}</div></article>`;
    }
    if (isBlank(file.md)) {
      return `<article class="doc-card">${head}<div class="empty-box"><p>${esc(locked ? t("rec.blankLocked") : t("rec.blank"))}</p>${locked ? "" : `<a class="btn ghost small" href="${gh("edit", file.path)}" target="_blank" rel="noopener">${esc(t("rec.write"))}${EXT}</a>`}</div></article>`;
    }
    const html = await renderMd(file.md, { dir, repo, branch, imgBase });
    return `<article class="doc-card">${head}<div class="doc">${html}</div></article>`;
  }

  async function renderWeek() {
    const w = data.weeks[cur];
    const body = $("#week-body");
    if (!w) { body.innerHTML = `<div class="empty-box">${esc(data.error ? t("rec.loadFail", { m: data.error }) : t("rec.none"))}</div>`; return; }
    const repoLink = $("#rec-repo");
    if (repoLink) repoLink.href = gh("tree", "logs");
    const title = w.title ? ` <span class="wk-sub">— ${esc(w.title)}</span>` : "";
    const members = team.members;
    const mine = me();
    if (!person || !members.some((m) => m.id === person)) person = mine && members.some((m) => m.id === mine.id) ? mine.id : members[0].id;

    const locked = isLocked(w);
    const teamCard = await docCard(t("rec.teamCard"), w.team, w.dir, ghNew(w.dir, "team.md", teamTpl(w)), locked);
    const m = members.find((x) => x.id === person);
    const pf = (w.people || {})[person];
    const personHtml = await (async () => {
      if (!pf) {
        if (locked) return `<div class="empty-box"><p>${esc(t("rec.noPersonLocked", { name: nm(m), n: w.no }))}</p></div>`;
        return `<div class="empty-box"><p>${esc(t("rec.noPerson", { name: nm(m), n: w.no }))}</p><a class="btn ghost small" href="${ghNew(w.dir, m.id + ".md", personTpl(w, nm(m)))}" target="_blank" rel="noopener">${esc(t("rec.create"))}${EXT}</a></div>`;
      }
      if (isBlank(pf.md)) {
        if (locked) return `<div class="empty-box"><p>${esc(t("rec.blankLocked"))}</p></div>`;
        return `<div class="empty-box"><p>${esc(t("rec.blank"))}</p><a class="btn ghost small" href="${gh("edit", pf.path)}" target="_blank" rel="noopener">${esc(t("rec.write"))}${EXT}</a></div>`;
      }
      return `<div class="doc">${await renderMd(pf.md, { dir: w.dir, repo, branch, imgBase })}</div>`;
    })();
    const ptabs = members.map((x) => {
      const f = (w.people || {})[x.id];
      const empty = !f || isBlank(f.md);
      return `<button type="button" role="tab" data-person="${esc(x.id)}" aria-selected="${x.id === person}" class="${empty ? "empty" : ""}" style="--c:${GCOLORS[x.colorId] || "var(--ink4)"}">${esc(nm(x))}</button>`;
    }).join("");
    const editLink = pf ? (locked ? `<a href="${gh("blob", pf.path)}" target="_blank" rel="noopener">${esc(t("rec.viewGh"))}${EXT}</a>` : `<a href="${gh("edit", pf.path)}" target="_blank" rel="noopener">${esc(t("rec.edit"))}${EXT}</a>`) : "";
    const td = today();
    const state = locked
      ? `<div class="wk-state locked">${LOCK}<span>${t("rec.stLocked", { d: esc(dLong(w.end)) })}</span></div>`
      : td >= w.date
        ? `<div class="wk-state open"><i></i><span>${t("rec.stOpen", { d: esc(dLong(w.end)) })}</span></div>`
        : `<div class="wk-state soon"><i></i><span>${t("rec.stSoon", { a: esc(dLong(w.date)), b: esc(dLong(w.end)) })}</span></div>`;

    let extra = "";
    if (w.extra && w.extra.length) {
      extra = `<div class="card wk-extra"><h3 class="card-h">${esc(t("rec.other"))}</h3><ul>${w.extra.map((x) => `<li><a href="${gh("blob", x.path)}" target="_blank" rel="noopener">${esc(x.name)}</a></li>`).join("")}</ul></div>`;
    }

    body.innerHTML = `
      <div class="wk-top"><div><div class="meta">${esc(dLong(w.date))} – ${esc(dLong(w.end))} · ${esc(w.dir)}/</div><h2>${esc(t("rec.week", { n: w.no }))}${title}</h2></div>
        ${w.exists ? `<a class="btn ghost small" href="${gh("tree", w.dir)}" target="_blank" rel="noopener">${esc(t("rec.folder"))}${EXT}</a>` : ""}</div>
      ${state}
      <div class="wk-grid">
        ${teamCard}
        <article class="doc-card"><nav class="person-tabs" role="tablist" aria-label="${esc(t("rec.personal"))}">${ptabs}<span class="sp"></span>${editLink}</nav>${personHtml}</article>
      </div>${extra}`;
    keepPairs(body);
  }

  // show(n): week n (from the address, "#records/3"); show(): the week that holds today
  async function show(weekNo) {
    await ensure();
    if (weekNo != null) {
      const i = data.weeks.findIndex((w) => w.no === +weekNo);
      cur = i >= 0 ? i : defaultWeek();
    } else if (!show.done) {
      cur = defaultWeek();
    }
    show.done = true;
    renderTabs();
    await renderWeek();
  }

  document.addEventListener("click", (e) => {
    const wb = e.target.closest("#week-tabs [data-week]");
    if (wb) {
      cur = +wb.dataset.week;
      if (hash) history.replaceState(null, "", `${hash}${data.weeks[cur].no}`);
      renderTabs();
      renderWeek();
      return;
    }
    const pb = e.target.closest("#week-body [data-person]");
    if (pb) {
      person = pb.dataset.person;
      renderWeek();
    }
  });

  // another language chosen in the header (design system i18n.js): draw again with its words
  window.addEventListener("site:lang", () => { if (data && show.done) { renderTabs(); renderWeek(); } });

  return { show, ensure };
}
