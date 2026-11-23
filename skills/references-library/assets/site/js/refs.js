// References tab: the project at a glance (site/data/problem.json, optional), the link lists and notes of
// references/README.md, and the reading list from references/papers.csv with search and topic filters.
// Data: refs.json (build_refs.py) and problem.json. A contents column on the left follows the reading; on phones it is a
// row of jumps that stays under the header.
import { $, $$, esc, keepPairs } from "./refs-util.js";
import { t } from "./refs-strings.js";
import { renderMd } from "./md.js";

// a CSV row's topic: the "group" column (or "step", the source site's name for it); blank → Other
const groupOf = (p) => String(p.group || p.step || "").trim().replace(/\s+/g, " ") || t("refs.other");

// Split by "## Title". A section whose items are all "- [Name](url) — description" becomes a link list, any other
// section is rendered as Markdown text.
export function sections(src) {
  const out = [];
  let curSec = null;
  for (const line of String(src || "").split("\n")) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      curSec = { title: h[1].trim(), lines: [] };
      out.push(curSec);
    } else if (curSec) curSec.lines.push(line);
  }
  for (const s of out) {
    const body = s.lines.join("\n").trim();
    const items = [];
    const lead = [];
    let allLinks = true;
    for (const l of s.lines) {
      const tt = l.trim();
      if (!tt) continue;
      const m = tt.match(/^[-*]\s+\[(.+?)\]\((\S+?)\)\s*(?:[—–-]\s*(.*))?$/);
      if (m) items.push({ title: m[1], url: m[2], desc: (m[3] || "").trim() });
      else if (!items.length && !/^[-*]\s/.test(tt)) lead.push(tt); // a sentence before the list is its lead
      else allLinks = false;
    }
    s.cards = allLinks && items.length ? items : null;
    s.lead = lead.join(" ");
    s.md = body;
    s.id = "sec-" + s.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();
  }
  return out;
}

// "(unverified)" or "(verified)" at the end of a description becomes a small coloured word after the title
export const TAG_RE = /\s*\((unverified|inferred|verified)\)\s*/gi;
export function tagOf(desc) {
  if (/\((unverified|inferred)\)/i.test(desc)) return ["guess", t("tag.guess")];
  if (/\(verified\)/i.test(desc)) return ["ok", t("tag.ok")];
  return null;
}

// ctx: { team, refsUrl, overviewUrl, highlight, groups, pane, lang }
//   team        team.json: repo ("owner/name"), branch
//   refsUrl     "/data/refs.json" (build_refs.py)
//   overviewUrl "/data/problem.json", or null for no Overview and Tasks sections
//   highlight   { names: ["A. Author"], label: "our advisors" }: names shown bold in author lists, with a tooltip
//   groups      ["Task 1", "Task 2", …]: the order of the topic filters (default: natural order, "Other" last)
//   pane        the tab's element ("#pane-refs"); the contents only follow the reading while it is shown
//   lang        () => "en" | "ko" …: which language block of problem.json to show
export function createRefs(ctx) {
  const { team, refsUrl = "/data/refs.json", overviewUrl = "/data/problem.json", highlight = null, pane = "#pane-refs" } = ctx;
  const lang = ctx.lang || (() => document.documentElement.lang || "en");
  const hlNames = (highlight && highlight.names) || [];
  let data = null;
  let filter = "all";
  let q = "";

  async function ensure() {
    if (data) return data;
    const [a, b] = await Promise.all([
      fetch(refsUrl, { cache: "no-cache" }).then((r) => r.json()).catch(() => ({ papers: [], readme: "" })),
      overviewUrl ? fetch(overviewUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
    ]);
    data = { ...a, problem: b, secs: sections(a.readme) };
    return data;
  }

  function order(keys) {
    const pos = (k) => { const i = (ctx.groups || []).indexOf(k); return i < 0 ? 1e6 : i; };
    const other = t("refs.other");
    return keys.sort((x, y) => (x === other) - (y === other) || pos(x) - pos(y) || x.localeCompare(y, undefined, { numeric: true }));
  }

  function authorsHtml(a) {
    if (!hlNames.length) return esc(a);
    const re = new RegExp(hlNames.map((n) => esc(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s")).join("|"), "g");
    return esc(a).replace(re, (m) => `<b title="${esc(highlight.label || "")}">${m}</b>`);
  }

  function renderPapers() {
    const box = $("#paper-list");
    if (!box) return;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = data.papers.filter((p) => (filter === "all" || groupOf(p) === filter) &&
      words.every((w) => `${p.title} ${p.authors} ${p.venue} ${p.year} ${p.note || ""}`.toLowerCase().includes(w)));
    $("#paper-count").textContent = t("refs.count", { n: rows.length, t: data.papers.length });
    if (!rows.length) { box.innerHTML = `<div class="none">${esc(t("refs.none"))}</div>`; return; }
    const groups = {};
    for (const p of rows) (groups[groupOf(p)] = groups[groupOf(p)] || []).push(p);
    box.innerHTML = order(Object.keys(groups)).map((g) => `
      <div class="grp">${esc(g)}<small>${esc(t("refs.n", { n: groups[g].length }))}</small></div>
      ${groups[g].sort((a, b) => (b.year || "").localeCompare(a.year || "")).map((p) => `<div class="paper"><span class="yr">${esc(p.year)}</span><div>
        <a class="ti" href="${esc(p.url || (p.doi ? "https://doi.org/" + p.doi : "#"))}" target="_blank" rel="noopener">${esc(p.title)}</a>
        <div class="au">${authorsHtml(p.authors)}</div>
        <div class="ve">${esc(p.venue)}${p.doi ? ` · doi:${esc(p.doi)}` : ""}</div>
        ${p.read_by || p.note ? `<div class="note">${p.read_by ? esc(t("refs.readBy", { n: p.read_by })) : ""}${p.read_by && p.note ? " · " : ""}${esc(p.note || "")}</div>` : ""}
      </div></div>`).join("")}`).join("");
    keepPairs(box);
  }

  async function render() {
    await ensure();
    const P = data.problem && (data.problem[lang()] || data.problem.en);
    const secs = data.secs;
    const counts = {};
    for (const p of data.papers) counts[groupOf(p)] = (counts[groupOf(p)] || 0) + 1;

    let toc = "";
    if (P) toc += `<b>${esc(t("refs.comp"))}</b><a href="#refs" data-jump="sec-overview">${esc(t("refs.overview"))}</a>${P.steps && P.steps.length ? `<a href="#refs" data-jump="sec-steps">${esc(t("refs.steps"))}</a>` : ""}`;
    if (secs.length) toc += `<b>${esc(t("refs.links"))}</b>` + secs.map((s) => `<a href="#refs" data-jump="${s.id}">${esc(s.title)}</a>`).join("");
    toc += `<b>${esc(t("refs.papers"))}</b><a href="#refs" data-jump="sec-papers">${esc(t("refs.lab"))}<small>${data.papers.length}</small></a>`;
    $("#refs-toc").innerHTML = toc;

    let html = "";
    if (P) {
      // facts as label · value rows; a fact with "kpi" becomes a row of numbers
      const prize = (P.facts || []).find((x) => x.kpi);
      html += `<section class="refs-sec" id="sec-overview">${P.eyebrow ? `<p class="eyebrow">${esc(P.eyebrow)}</p>` : ""}<h2>${esc(P.title)}</h2>
        <dl class="facts">${(P.facts || []).filter((x) => !x.kpi).map((x) => `<div class="fact"><dt>${esc(x.k)}</dt><dd>${esc(x.v)}</dd></div>`).join("")}</dl>
        ${prize ? `<div class="prize"><p class="prize-l">${esc(prize.k)}</p><div class="kpis">${prize.kpi.map(([l, n]) => `<div class="kpi"><div class="kpi-l">${esc(l)}</div><div class="kpi-v"><b>${esc(n)}</b><small>${esc(prize.unit || "")}</small></div></div>`).join("")}</div></div>` : ""}
        <div class="doc">${P.background ? `<p>${esc(P.background)}</p>` : ""}${P.premises && P.premises.length ? `<h3>${esc(t("refs.premises"))}</h3><ul>${P.premises.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div></section>`;
      if (P.steps && P.steps.length) {
        html += `<section class="refs-sec" id="sec-steps"><h2>${esc(t("refs.stepsH"))}</h2>${P.grading ? `<p class="lead">${esc(P.grading)}</p>` : ""}
        <ol class="steps">${P.steps.map((s) => `<li class="step"><div class="step-h"><span class="no">${esc(t("refs.step", { n: s.no }))}</span><b>${esc(s.name)}</b></div><p>${esc(s.q)}</p></li>`).join("")}</ol></section>`;
      }
    }
    for (const s of secs) {
      html += `<section class="refs-sec" id="${s.id}"><h2>${esc(s.title)}</h2>`;
      if (s.cards) {
        if (s.lead) html += `<p class="lead">${esc(s.lead)}</p>`;
        html += `<div class="links">${s.cards.map((c) => {
          const tg = tagOf(c.desc);
          const desc = c.desc.replace(TAG_RE, " ").trim();
          let host = "";
          try { host = new URL(c.url).host.replace(/^www\./, ""); } catch (e) { host = c.url; }
          return `<a class="link-row" href="${esc(c.url)}" target="_blank" rel="noopener"><b>${esc(c.title)}${tg ? `<span class="tag ${tg[0]}">${esc(tg[1])}</span>` : ""}</b>${desc ? `<span class="d">${esc(desc)}</span>` : ""}<span class="u">${esc(host)}</span></a>`;
        }).join("")}</div>`;
      } else {
        html += `<div class="doc">${await renderMd(s.md, { dir: "references", repo: team.repo, branch: team.branch || "main" })}</div>`;
      }
      html += `</section>`;
    }
    const csv = `<a href="https://github.com/${esc(team.repo)}/blob/${esc(team.branch || "main")}/references/papers.csv" target="_blank" rel="noopener">references/papers.csv</a>`;
    const hl = hlNames.length && highlight.label ? t("refs.hl", { label: highlight.label }) : "";
    const lead = esc(t("refs.papersLead", { hl, link: "\u0001" })).replace("\u0001", csv);
    html += `<section class="refs-sec" id="sec-papers"><h2>${esc(t("refs.papersH"))}</h2>
      <p class="lead">${lead}</p>
      <div class="paper-tools"><input type="search" id="paper-q" placeholder="${esc(t("refs.search"))}" aria-label="${esc(t("refs.search"))}" value="${esc(q)}">
      <div class="chips" id="paper-chips"><button type="button" data-f="all" aria-pressed="${filter === "all"}">${esc(t("refs.all"))}</button>${order(Object.keys(counts)).map((g) => `<button type="button" data-f="${esc(g)}" aria-pressed="${filter === g}">${esc(g)} · ${counts[g]}</button>`).join("")}</div>
      <span class="paper-count" id="paper-count"></span></div>
      <div class="papers" id="paper-list"></div></section>`;
    // phones (the contents column is hidden there): a row of jumps that stays under the header; the link sections share
    // one entry
    const jump = `<nav class="refs-jump" aria-label="${esc(t("refs.toc"))}">${P ? `<a href="#refs" data-jump="sec-overview">${esc(t("refs.overview"))}</a>` : ""}${P && P.steps && P.steps.length ? `<a href="#refs" data-jump="sec-steps">${esc(t("refs.steps"))}</a>` : ""}${secs.length ? `<a href="#refs" data-jump="${secs[0].id}">${esc(t("refs.links"))}</a>` : ""}<a href="#refs" data-jump="sec-papers">${esc(t("refs.papers"))}</a></nav>`;
    $("#refs-body").innerHTML = jump + html;
    keepPairs($("#refs-body"));
    renderPapers();
  }

  document.addEventListener("click", (e) => {
    const j = e.target.closest("[data-jump]");
    if (j) {
      e.preventDefault();
      const el = document.getElementById(j.dataset.jump);
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (el) el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      $$("#refs-toc a, .refs-jump a").forEach((a) => a.classList.toggle("on", a.dataset.jump === j.dataset.jump));
      return;
    }
    const c = e.target.closest("#paper-chips [data-f]");
    if (c) {
      filter = c.dataset.f;
      $$("#paper-chips button").forEach((b) => b.setAttribute("aria-pressed", String(b === c)));
      renderPapers();
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "paper-q") { q = e.target.value; renderPapers(); }
  });

  // The contents follow the reading: the last section whose top has reached the line just under the header (where a
  // jump from the contents puts it); at the very bottom of the page, the last section. Phones mark the same place in
  // the jump row under the header, where the link sections share one entry.
  let raf = 0;
  function spy() {
    raf = 0;
    const p = $(pane);
    if (p && p.hidden) return;
    const secs = $$("#refs-body .refs-sec");
    if (!secs.length) return;
    const row = $(".refs-jump"), onPhone = !!(row && row.offsetParent);
    const bar = $(".bar");
    const top = onPhone ? row.getBoundingClientRect().bottom : bar ? bar.getBoundingClientRect().bottom : 0;
    const line = top + 48;
    let cur = secs[0];
    for (const s of secs) if (s.getBoundingClientRect().top <= line) cur = s;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) cur = secs[secs.length - 1];
    $$("#refs-toc a").forEach((a) => a.classList.toggle("on", a.dataset.jump === cur.id));
    if (onPhone) {
      const ids = secs.map((x) => x.id), at = ids.indexOf(cur.id);
      let on = null;
      for (const a of row.querySelectorAll("a")) if (ids.indexOf(a.dataset.jump) <= at) on = a;
      row.querySelectorAll("a").forEach((a) => a.classList.toggle("on", a === on));
    }
  }
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(spy); }, { passive: true });

  let shown = false;
  window.addEventListener("site:lang", async () => { if (shown) { await render(); spy(); } });
  return { show: async () => { if (!shown) { shown = true; await render(); } spy(); }, ensure };
}
