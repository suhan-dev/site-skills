// Calendar — reads and writes the shared Google Calendar through /api/events. Before Google is connected it shows the
// official schedule (/api/seed) as a striped, read-only preview.
// Needs the markup in calendar.html (ids are the contract) and calendar.css on top of the design system.
//
//   import { createCalendar } from "./calendar.js";
//   const cal = createCalendar({ owners, me, nameOf, isActive });
//   cal.load();
//
// owners:   [{ id, label, colorId }]: "team", "official" and one per member (team.json). colorId is Google's 1–11.
// me():     the signed-in member { id } or null ("added by" is set by the server; me only picks the default owner).
// nameOf(): a stored member id → the name to show ("Added by Alex").
// isActive(): is the calendar the tab on screen (arrow keys and polling only then). Default: always.
// frame:    the element the page starts in (fit() measures from its top). Default: <html>.
// onEvents(state): optional, called after every render (for a status band, notifications …).
import { $, $$, esc, api, todayYMD, ymd, parse, dow, addDays, diffDays, pad2, nowMins, clock12, GCOLORS, getPref, setPref } from "./cal-util.js";
import { t, L, errText, dows, dShort, dLong, monthTitle, stamp } from "./cal-strings.js";
import { MAX_LANES, DAY0, off, calToday, place, layoutWeek, packDay } from "./cal-layout.js";
import { PREF_PREFIX } from "./cal-config.js";

const POLL_MS = 60_000; // read Google again every minute while the tab is visible
const HOUR_PX = 46; // week view: height of one hour
const weekStart = (d) => addDays(d, -dow(d)); // weeks start on Sunday
// Phones fit the whole week into the screen width (same width as the phone blocks in calendar.css)
const PHONE = matchMedia("(max-width: 760px)");
const phone = () => PHONE.matches;
// phones, week view: a timed block's title line, time line and vertical padding in px (as .wv-ev in calendar.css's phone block)
const PH_LINE = 13, PH_TIME = 12, PH_PAD = 4;

export function createCalendar(ctx) {
  // chat (optional): the team-chat skill's createChat() result. With it, the event sheet shows a Comment button.
  const { owners, me = () => null, nameOf = (x) => x, isActive = () => true, chat = null } = ctx;
  const frame = ctx.frame || document.documentElement;
  const ownerById = Object.fromEntries(owners.map((o) => [o.id, o]));
  const ownerByColor = Object.fromEntries(owners.map((o) => [o.colorId, o]));
  const t0 = parse(calToday());
  const S = {
    y: t0.y, m: t0.m,
    view: getPref(PREF_PREFIX + "view") === "month" ? "month" : "week", // week (default) | month
    ws: weekStart(calToday()), // first day (Sunday) of the week shown in week view
    events: [], upcoming: [],
    status: null, mode: "loading", // loading | live | preview | error
    hidden: new Set((getPref(PREF_PREFIX + "hidden") || "").split(",").filter(Boolean)),
    lastSync: 0, busy: false, again: false, editing: null,
  };

  const ownerOf = (ev) => ownerById[ev.owner] || ownerByColor[ev.colorId] || ownerById.team || owners[0];
  const colorOf = (ev) => GCOLORS[ev.colorId] || GCOLORS[ownerOf(ev).colorId] || GCOLORS[9];
  const visible = (ev) => !S.hidden.has(ownerOf(ev).id);
  const writable = () => S.mode === "live";

  /* ---------- loading ---------- */
  function gridRange() {
    if (S.view === "week") return { start: S.ws, end: addDays(S.ws, 6), weeks: 1 };
    const first = ymd(S.y, S.m, 1);
    const start = addDays(first, -dow(first));
    const last = ymd(S.y, S.m + 1, 0);
    const end = addDays(last, 6 - dow(last));
    return { start, end, weeks: (diffDays(start, end) + 1) / 7 };
  }

  async function loadStatus() {
    try {
      S.status = await api("/api/status");
    } catch (e) {
      S.status = { configured: false, error: e.message, noApi: true };
    }
  }

  async function seedPreview() {
    try { return (await api("/api/seed")).events; } catch (e) { return []; }
  }

  async function load({ quiet = false } = {}) {
    // one request at a time; a load asked for meanwhile (other dates in view) runs right after
    if (S.busy) { S.again = true; return; }
    S.busy = true;
    setSync(quiet ? null : "busy");
    try {
      if (!S.status || !quiet) await loadStatus();
      const st = S.status;
      const today = todayYMD();
      if (!st.configured || st.ok === false) {
        const seed = await seedPreview();
        S.events = seed;
        S.upcoming = seed;
        S.mode = st.configured ? "error" : "preview";
      } else {
        const g = gridRange();
        const [a, b] = await Promise.all([
          api(`/api/events?from=${g.start}&to=${addDays(g.end, 1)}`), // the last day runs to DAY0 the next morning
          api(`/api/events?from=${today}&to=${addDays(today, 120)}`),
        ]);
        S.events = a.events;
        S.upcoming = b.events;
        S.mode = "live";
        S.lastSync = Date.now();
      }
    } catch (e) {
      S.mode = "error";
      S.status = { ...(S.status || {}), ok: false, error: e.message, code: e.code };
    } finally {
      S.busy = false;
    }
    render();
    if (S.again) { S.again = false; load({ quiet: true }); }
  }

  /* ---------- drawing ---------- */
  function setSync(kind) {
    const el = $("#sync");
    if (!el) return;
    if (kind === "busy") {
      el.className = "sync busy";
      el.lastElementChild.textContent = t("sync.busy");
      return;
    }
    if (S.mode === "live") {
      el.className = "sync ok";
      el.lastElementChild.textContent = t("sync.ok", { t: clock12(S.lastSync) });
      el.title = t("sync.okTitle");
    } else if (S.mode === "preview") {
      el.className = "sync warn";
      el.lastElementChild.textContent = t("sync.preview");
      el.title = "";
    } else if (S.mode === "error") {
      el.className = "sync bad";
      el.lastElementChild.textContent = t("sync.error");
      el.title = "";
    }
  }

  function render() {
    setSync();
    renderBanner();
    renderGrid();
    renderSide();
    ctx.onEvents && ctx.onEvents(S);
  }

  function renderBanner() {
    const b = $("#cal-banner");
    const st = S.status || {};
    if (S.mode === "preview") {
      b.className = "banner";
      b.innerHTML = esc(st.noApi ? t("banner.noapi") : t("banner.preview"));
      b.hidden = false;
    } else if (S.mode === "error") {
      b.className = "banner bad";
      b.innerHTML = `<b>${esc(t("banner.error"))}</b> ${esc(errText(st.code, st.error))}`;
      b.hidden = false;
    } else b.hidden = true;
  }

  function evButton(it, weekStart) {
    const e = it.e;
    const col = colorOf(e);
    const contL = place(e).ds < weekStart;
    const contR = place(e).de > addDays(weekStart, 6);
    const cls = ["ev", it.bar ? "allday" : "timed"];
    if (contL) cls.push("cont-l");
    if (contR) cls.push("cont-r");
    if (S.mode !== "live") cls.push("preview");
    const time = !e.allDay && e.startTime ? `<span class="tm">${e.startTime}</span>` : "";
    const tip = `${e.title}${e.allDay ? "" : ` · ${e.startTime}–${e.endTime}`}${e.location ? ` · ${e.location}` : ""}`;
    return `<button type="button" class="${cls.join(" ")}" style="--c:${col};grid-column:${it.s + 1}/${it.en + 2};grid-row:${it.lane + 1}" data-ev="${esc(e.id)}" data-st="${e.start}" title="${esc(tip)}">${time}<span class="t">${esc(e.title)}</span></button>`;
  }

  // "+n more" for a day; just "+n" in the narrow day columns on phones (the full words stay for screen readers)
  function moreBtn(d, n) {
    if (!(n > 0)) return "";
    const label = t("cal.more", { n });
    return phone()
      ? `<button type="button" class="more" data-more="${d}" aria-label="${esc(label)}">+${n}</button>`
      : `<button type="button" class="more" data-more="${d}">${label}</button>`;
  }

  function paintView() {
    $$("#cal-view [data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === S.view)));
    $("#cal-grid").classList.toggle("is-week", S.view === "week");
    $("#cal-today .tdy").textContent = parse(calToday()).d; // phones show Today as a small calendar page with the date
  }

  function renderGrid() {
    paintView();
    if (S.view === "week") { renderWeekView(); return; }
    $("#cal-title").textContent = phone() ? shortTitle(ymd(S.y, S.m, 1), ymd(S.y, S.m, 1)) : monthTitle(S.y, S.m);
    const g = gridRange();
    const today = calToday();
    let html = `<div class="dow">${dows().map((d) => `<span>${d}</span>`).join("")}</div>`;
    for (let w = 0; w < g.weeks; w++) {
      const ws = addDays(g.start, w * 7);
      const { items, hiddenPerDay } = layoutWeek(ws, S.events, visible);
      let days = "";
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i);
        const p = parse(d);
        const cls = ["day"];
        if (p.m !== S.m) cls.push("out");
        if (d === today) cls.push("today");
        const more = moreBtn(d, hiddenPerDay[i]);
        days += `<div class="${cls.join(" ")}" data-day="${d}"><span class="dn">${p.d === 1 ? esc(dShort(d)) : p.d}</span>${more}</div>`;
      }
      const bars = items.filter((it) => it.lane < MAX_LANES).map((it) => evButton(it, ws)).join("");
      html += `<div class="week"><div class="days">${days}</div><div class="lanes">${bars}</div></div>`;
    }
    $("#cal-grid").innerHTML = html;
    $("#cal-grid").style.setProperty("--weeks", g.weeks);
    fit();
  }

  /* ---------- week view: time slots (team time), all-day row on top ---------- */
  function weekTitle(ws) {
    const we = addDays(ws, 6), a = parse(ws), b = parse(we);
    if (a.y !== b.y) return `${dShort(ws)}, ${a.y} – ${dShort(we)}, ${b.y}`;
    if (a.m !== b.m) return `${dShort(ws)} – ${dShort(we)}, ${b.y}`;
    return `${dShort(ws)} – ${b.d}, ${b.y}`;
  }
  // phones: only the month ("November", "Nov – Dec"), the year when it isn't this year; the dates are in the day strip
  function shortTitle(a, b) {
    const pa = parse(a), pb = parse(b), yr = pb.y !== parse(calToday()).y ? ` ${pb.y}` : "";
    if (pa.m === pb.m) return monthTitle(pa.y, pa.m).replace(/ \d+$/, "") + yr;
    return `${dShort(a).split(" ")[0]} – ${dShort(b).split(" ")[0]}${yr}`;
  }

  function timedBlock(it) {
    const e = it.e;
    const top = (it.s / 60) * HOUR_PX;
    const h = Math.max(((it.en - it.s) / 60) * HOUR_PX - 2, 20);
    // the block may grow past its end time to show all its text, up to where the next event of the day starts
    const room = Math.max(h, ((it.next - it.s) / 60) * HOUR_PX - 2);
    const cls = ["wv-ev"];
    if (S.mode !== "live") cls.push("preview");
    const tm = `${e.startTime}${e.endTime ? `–${e.endTime}` : ""}`;
    const tip = `${e.title} · ${tm}${e.location ? ` · ${e.location}` : ""}`;
    const w = 100 / it.n;
    let clamp = "", time = `<span class="tm">${esc(tm)}</span>`, gap = 2;
    if (phone()) {
      gap = 1;
      // the block keeps its own height; the title gets the lines that fit (ellipsis); the start time only in a
      // full-width block with room for two title lines above it
      const inner = h - PH_PAD, withTime = it.n === 1 && inner >= 2 * PH_LINE + PH_TIME + 1;
      clamp = `;--cl:${Math.max(1, Math.floor((inner - (withTime ? PH_TIME + 1 : 0)) / PH_LINE))}`;
      time = withTime ? `<span class="tm">${esc(e.startTime)}</span>` : "";
    }
    return `<button type="button" class="${cls.join(" ")}" style="--c:${colorOf(e)};--hh:${h.toFixed(1)}px;--hmax:${room.toFixed(1)}px${clamp};top:${top.toFixed(1)}px;left:calc(${(it.k * w).toFixed(3)}% + ${gap}px);width:calc(${w.toFixed(3)}% - ${2 * gap}px)" data-ev="${esc(e.id)}" data-st="${e.start}" title="${esc(tip)}"><span class="t">${esc(e.title)}</span>${time}</button>`;
  }

  // phones: a day's column is about 40 px wide, too narrow to split. Events that overlap become one block with the
  // first one's title and "+n"; a tap on it opens that day's list. Wider screens put them side by side.
  function dayBlocks(timed, date) {
    if (!phone()) return timed.map(timedBlock).join("");
    const groups = new Map();
    for (const it of timed) {
      if (!groups.has(it.g)) groups.set(it.g, []);
      groups.get(it.g).push(it);
    }
    return [...groups.values()].map((g) => (g.length === 1 ? timedBlock(g[0]) : groupBlock(g, date))).join("");
  }
  function groupBlock(g, date) {
    const first = g[0]; // packDay sorts by start time, the longest first
    const s = first.s, en = Math.max(...g.map((it) => it.en));
    const top = (s / 60) * HOUR_PX, h = Math.max(((en - s) / 60) * HOUR_PX - 2, 20);
    const two = h - PH_PAD >= PH_LINE + PH_TIME + 1; // room for the title and "+n" under it
    const lines = two ? Math.max(1, Math.floor((h - PH_PAD - PH_TIME - 1) / PH_LINE)) : 1;
    const more = t("cal.more", { n: g.length - 1 }).replace(/ .*/, ""); // "+1"
    const tip = g.map((it) => `${it.e.title} · ${it.e.startTime}${it.e.endTime ? `–${it.e.endTime}` : ""}`).join("\n");
    const cls = ["wv-ev", "wv-grp"];
    if (S.mode !== "live") cls.push("preview");
    if (!two) cls.push("tight");
    return `<button type="button" class="${cls.join(" ")}" style="--c:${colorOf(first.e)};--hh:${h.toFixed(1)}px;--hmax:${h.toFixed(1)}px;--cl:${lines};top:${top.toFixed(1)}px;left:1px;width:calc(100% - 2px)" data-grp="${date}" title="${esc(tip)}" aria-label="${esc(`${g.length} events: ${g.map((it) => it.e.title).join(", ")}`)}">${two ? "" : `<span class="n">${more}</span>`}<span class="t">${esc(first.e.title)}</span>${two ? `<span class="n">${more}</span>` : ""}</button>`;
  }

  function renderWeekView() {
    const ws = S.ws;
    const today = calToday();
    const ph = phone();
    $("#cal-title").textContent = ph ? shortTitle(ws, addDays(ws, 6)) : weekTitle(ws);
    const old = $("#cal-grid .wv-body");
    const keep = old && old.dataset.ws === ws ? { top: old.scrollTop } : null;

    // all-day row: all-day events and anything that runs over more than one calendar day
    const bars = S.events.filter((e) => !place(e).grid);
    const { items, hiddenPerDay } = layoutWeek(ws, bars, visible);
    const lanes = items.filter((it) => it.lane < MAX_LANES).map((it) => evButton(it, ws)).join("");

    let head = `<div class="wv-corner"></div>`, cells = "", cols = "";
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const td = d === today ? " today" : "";
      head += `<button type="button" class="wv-dh${td}" data-wday="${d}" title="${esc(dLong(d))}"><span class="wv-dw">${ph ? dows()[i][0] : dows()[i]}</span><span class="wv-dn">${parse(d).d}</span></button>`;
      cells += `<div class="wv-allcell${td}" data-allday="${d}" style="--i:${i}">${moreBtn(d, hiddenPerDay[i])}</div>`;
      const timed = packDay(S.events
        .filter((e) => place(e).grid && place(e).ds === d && visible(e))
        .map((e) => ({ e, s: place(e).top, en: place(e).end })));
      for (const it of timed) it.next = Math.min(1440, ...timed.filter((o) => o.s >= it.en).map((o) => o.s));
      cols += `<div class="wv-col${td}" data-wcol="${d}">${dayBlocks(timed, d)}${td ? `<div class="wv-now" aria-hidden="true"></div>` : ""}</div>`;
    }
    // hour labels from DAY0 + 1 h to DAY0 − 1 h (the top edge is DAY0); midnight also gets a line across the days
    let hours = "";
    for (let i = 1; i < 24; i++) {
      const h = (i + DAY0 / 60) % 24;
      hours += `<span data-h="${i}"${h === 0 ? ' class="mid"' : ""} style="top:${i * HOUR_PX}px">${pad2(h)}:00</span>`;
    }
    const mid = DAY0 ? `<div class="wv-mid" aria-hidden="true" style="top:${((1440 - DAY0) / 60) * HOUR_PX}px"></div>` : "";
    const nowLbl = today >= ws && today <= addDays(ws, 6) ? `<span class="wv-nowlbl" aria-hidden="true"></span>` : "";
    const hasMore = hiddenPerDay.some((k) => k > 0) ? " has-more" : "";

    $("#cal-grid").innerHTML = `<div class="wv-body" data-ws="${ws}" style="--wv-h:${HOUR_PX}px">
      <div class="wv-inner">
        <div class="wv-top">
          <div class="wv-head">${head}</div>
          <div class="wv-all"><div class="wv-gut">all-day</div><div class="wv-allarea${hasMore}">${cells}<div class="wv-alllanes">${lanes}</div></div></div>
        </div>
        <div class="wv-grid"><div class="wv-hours">${hours}${nowLbl}</div>${cols}${mid}</div>
      </div>
    </div>`;
    S.nowDay = today;
    updateNow();
    fit();

    const body = $("#cal-grid .wv-body");
    if (keep) { body.scrollTop = keep.top; return; }
    // first look at a week: from the top (DAY0), or around now if now would be below the fold
    let top = 0;
    const ti = diffDays(ws, today);
    if (ti >= 0 && ti < 7) {
      const y = (off(nowMins()) / 60) * HOUR_PX;
      const room = body.clientHeight - $(".wv-top", body).offsetHeight;
      if (y > room - HOUR_PX) top = y - room / 2;
    }
    body.scrollTop = Math.max(0, top);
  }

  // the "now" line on today's column and its time in the hour gutter (team time)
  function updateNow() {
    if (S.view !== "week") return;
    if (S.nowDay && S.nowDay !== calToday()) { renderGrid(); return; }
    const m = nowMins(), o = off(m);
    const y = ((o / 60) * HOUR_PX).toFixed(1) + "px";
    const line = $("#cal-grid .wv-now");
    if (line) line.style.top = y;
    const lbl = $("#cal-grid .wv-nowlbl");
    if (lbl) { lbl.style.top = y; lbl.textContent = `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`; }
    // the hour label under the now label fades out, so the two never overlap
    $$("#cal-grid .wv-hours [data-h]").forEach((h) => h.classList.toggle("near", !!lbl && Math.abs(+h.dataset.h * 60 - o) < 14));
  }
  setInterval(updateNow, 30_000);

  // at: week view only, a day the week must contain (phones: the day tapped in month view)
  function setView(v, at) {
    if (v === S.view && !at) return;
    if (v === "month") {
      const p = parse(addDays(S.ws, 3));
      S.y = p.y; S.m = p.m;
    } else {
      const today = calToday(), p = parse(today);
      S.ws = weekStart(at || (p.y === S.y && p.m === S.m ? today : ymd(S.y, S.m, 1)));
    }
    S.view = v;
    setPref(PREF_PREFIX + "view", v);
    renderGrid();
    load({ quiet: true });
  }

  function step(n) {
    slide(n);
    if (S.view === "week") {
      S.ws = addDays(S.ws, 7 * n);
      const p = parse(addDays(S.ws, 3));
      S.y = p.y; S.m = p.m;
    } else {
      S.m += n;
      if (S.m < 0) { S.m = 11; S.y--; }
      if (S.m > 11) { S.m = 0; S.y++; }
    }
    renderGrid();
    load({ quiet: true });
  }

  // the width crossed 760 px (rotation, resize): same dates, drawn for the other width
  PHONE.addEventListener("change", () => renderGrid());

  // The grid fills the window from where it starts down to the bottom (calendar.css uses --cal-top), so on phones the
  // calendar is one screen with nothing to scroll but the hours.
  function fit() {
    const g = $("#cal-grid");
    if (!g.offsetParent) return; // another tab is showing
    g.style.setProperty("--cal-top", `${Math.round(g.getBoundingClientRect().top - frame.getBoundingClientRect().top)}px`);
  }
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => fit());
    [$(".cal-head"), $("#cal-banner"), $(".bar")].forEach((el) => el && ro.observe(el));
  }
  addEventListener("resize", fit);

  // next or previous week (month): the grid comes in from that side
  function slide(n) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    $("#cal-grid").animate([{ transform: `translateX(${n * 22}px)`, opacity: 0.25 }, { transform: "none", opacity: 1 }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
  // phones: swipe the calendar sideways for the next or previous week (month): quick (< 700 ms), longer than 56 px,
  // and clearly sideways (|dx| > 1.8 |dy|), so scrolling the hours never changes the week
  let sw = null;
  $("#cal-grid").addEventListener("touchstart", (e) => {
    const tc = e.touches[0];
    sw = e.touches.length === 1 && phone() ? { x: tc.clientX, y: tc.clientY, t: e.timeStamp } : null;
  }, { passive: true });
  $("#cal-grid").addEventListener("touchend", (e) => {
    if (!sw) return;
    const tc = e.changedTouches[0], dx = tc.clientX - sw.x, dy = tc.clientY - sw.y, quick = e.timeStamp - sw.t < 700;
    sw = null;
    if (quick && Math.abs(dx) > 56 && Math.abs(dx) > 1.8 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
  }, { passive: true });
  $("#cal-grid").addEventListener("touchcancel", () => { sw = null; }, { passive: true });

  function evMeta(e) {
    const bits = [];
    if (!e.allDay && e.startTime) bits.push(e.start === e.end ? `${e.startTime}–${e.endTime}` : `${dShort(e.start)} ${e.startTime} → ${dShort(e.end)} ${e.endTime}`);
    else if (e.start !== e.end) bits.push(`${dShort(e.start)} → ${dShort(e.end)}`);
    else bits.push(t("cal.allday"));
    if (e.location) bits.push(e.location);
    return bits.join(" · ");
  }

  function listItems(evs) {
    return evs.map((e) => `<li><button type="button" data-ev="${esc(e.id)}" data-st="${e.start}" style="--c:${colorOf(e)}">
      <span class="up-d"><b>${stamp(e.start).big}</b>${esc(stamp(e.start).small)}</span>
      <span class="up-t"><span class="tt"><span>${esc(e.title)}</span></span><span class="mt">${esc(evMeta(e))}</span></span></button></li>`).join("");
  }

  function renderSide() {
    const today = todayYMD();
    const up = S.upcoming
      .filter((e) => e.end >= today && visible(e))
      .sort((a, b) => a.start.localeCompare(b.start) || (a.allDay ? -1 : 0) - (b.allDay ? -1 : 0) || (a.startTime || "").localeCompare(b.startTime || ""))
      .slice(0, 7);
    $("#up-list").innerHTML = up.length ? listItems(up) : `<li class="up-empty">${esc(t("side.none"))}</li>`;

    $("#legend").innerHTML = owners.map((o) => `<button type="button" data-owner="${o.id}" class="${S.hidden.has(o.id) ? "off" : ""}" style="--c:${GCOLORS[o.colorId]}" aria-pressed="${!S.hidden.has(o.id)}">${esc(L(o.label))}</button>`).join("");

    renderGcal();
  }

  function renderGcal() {
    const el = $("#gcal-card");
    const st = S.status || {};
    const h = `<h3 class="card-h"><span class="gmark" aria-hidden="true"></span>${esc(t("gcal.h"))}</h3>`;
    if (S.mode === "live") {
      const add = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(st.calendarId || "")}`;
      el.innerHTML = `${h}<p>${t("gcal.live", { name: esc(st.calendarName || t("gcal.shared")) })}</p>
        <div class="acts"><a class="btn ghost small" href="${add}" target="_blank" rel="noopener">${esc(t("gcal.open"))}<span class="ext" aria-hidden="true">↗</span></a>
        ${st.seeded === false ? `<button class="btn primary small" type="button" id="seed-btn">${esc(t("gcal.seed"))}</button>` : ""}</div>`;
    } else if (S.mode === "preview") {
      el.innerHTML = `${h}<p class="muted">${esc(t("gcal.preview"))}</p>`;
    } else {
      el.innerHTML = `${h}<p>${esc(errText(st.code, st.error) || t("gcal.checking"))}</p><div class="acts"><button class="btn ghost small" type="button" id="retry-btn">${esc(t("gcal.retry"))}</button></div>`;
    }
  }

  /* ---------- event sheet (a dialog on wide screens, a bottom sheet on phones) ---------- */
  const dlg = $("#ev-dlg");
  const form = $("#ev-form");
  const f = (n) => form.elements[n];

  function paintOwners() {
    const cur = (form.querySelector("input[name=owner]:checked") || {}).value;
    $("#owner-seg").innerHTML = owners.map((o) => `<label style="--c:${GCOLORS[o.colorId]}"><input type="radio" name="owner" value="${o.id}"${o.id === cur ? " checked" : ""}><span>${esc(L(o.label))}</span></label>`).join("");
  }
  paintOwners();

  function syncAllDay() {
    $(".dt-row", form).classList.toggle("allday", f("allDay").checked);
  }

  function openEditor(ev, defaults = {}) {
    if (!writable() && !ev) { flashBanner(); return; }
    S.editing = ev || null;
    form.reset();
    $("#ev-err").textContent = "";
    const del = $("#ev-del");
    del.classList.remove("armed");
    del.textContent = t("ev.delete");
    const today = todayYMD();
    const v = ev || {
      title: "", allDay: defaults.allDay ?? false, start: defaults.date || today, end: defaults.endDate || defaults.date || today,
      startTime: defaults.startTime || "14:00", endTime: defaults.endTime || "15:00", location: "", memo: "",
      owner: me() ? me().id : "team",
    };
    $("#ev-dlg-h").textContent = ev ? (writable() ? t("ev.edit") : t("ev.view")) : t("ev.new");
    f("title").value = v.title;
    f("allDay").checked = !!v.allDay;
    f("start").value = v.start;
    f("end").value = v.end;
    f("startTime").value = v.startTime || "14:00";
    f("endTime").value = v.endTime || "15:00";
    f("location").value = v.location || "";
    f("memo").value = v.memo || "";
    const own = ev ? ownerOf(ev).id : v.owner;
    const r = form.querySelector(`input[name=owner][value="${own}"]`) || form.querySelector("input[name=owner]");
    r.checked = true;
    syncAllDay();
    del.hidden = !(ev && writable());
    const gl = $("#ev-glink");
    gl.hidden = !(ev && ev.link);
    if (ev && ev.link) gl.href = ev.link;
    // Comment (team-chat): only for an existing event, and only when a chat was passed in; the count after the word once it has some
    const cb = $("#ev-comment");
    if (cb) {
      cb.hidden = !(ev && chat);
      const n = ev && chat && chat.countFor ? chat.countFor("event/" + ev.id) : 0;
      $(".n", cb).textContent = n ? String(n) : "";
      cb.setAttribute("aria-label", n ? `${t("ev.comment")} (${n})` : t("ev.comment"));
    }
    const notes = [];
    if (ev && ev.author) notes.push(t("ev.by", { n: nameOf(ev.author) }));
    if (ev && ev.editor) notes.push(t("ev.editedBy", { n: nameOf(ev.editor) }));
    if (ev && ev.recurring) notes.push(t("ev.recurring"));
    if (!writable()) notes.push(t("ev.readonly"));
    $("#ev-note").textContent = notes.join(" · ");
    $$("input,textarea", form).forEach((el) => (el.disabled = !writable()));
    $("#ev-save").hidden = !writable();
    dlg.showModal();
    if (writable()) setTimeout(() => f("title").focus(), 30);
  }

  form.addEventListener("change", (e) => {
    if (e.target.name === "allDay") syncAllDay();
    if (e.target.name === "start" && f("end").value < f("start").value) f("end").value = f("start").value;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#ev-err");
    err.textContent = "";
    const owner = (form.querySelector("input[name=owner]:checked") || {}).value || "team";
    const body = {
      title: f("title").value.trim(),
      allDay: f("allDay").checked,
      start: f("start").value,
      end: f("end").value || f("start").value,
      startTime: f("startTime").value,
      endTime: f("endTime").value,
      location: f("location").value.trim(),
      memo: f("memo").value,
      owner,
      colorId: (ownerById[owner] || ownerById.team || owners[0]).colorId,
      who: me() ? me().id : "", // used by the server only when nobody is signed in
    };
    if (!body.title) { err.textContent = t("err.title"); f("title").focus(); return; }
    if (!body.start) { err.textContent = t("err.date"); return; }
    if (body.end < body.start) { err.textContent = t("err.endDate"); return; }
    if (!body.allDay && body.start === body.end && body.endTime && body.startTime && body.endTime <= body.startTime) { err.textContent = t("err.endTime"); return; }
    const save = $("#ev-save");
    save.disabled = true;
    save.textContent = t("ev.saving");
    try {
      if (S.editing) await api(`/api/events/${encodeURIComponent(S.editing.id)}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/api/events", { method: "POST", body: JSON.stringify(body) });
      dlg.close();
      const cd = place(body).ds, p = parse(cd); // its calendar day (02:00 belongs to the day before)
      if (!S.editing) { S.y = p.y; S.m = p.m; S.ws = weekStart(cd); }
      await load({ quiet: true });
    } catch (x) {
      err.textContent = t("err.save", { m: errText(x.code, x.message) });
    } finally {
      save.disabled = false;
      save.textContent = t("ev.save");
    }
  });

  // Delete asks twice: the first click arms the button (red, "Click again to delete"), the second deletes
  $("#ev-del").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    if (!b.classList.contains("armed")) {
      b.classList.add("armed");
      b.textContent = t("ev.deleteSure");
      return;
    }
    b.disabled = true;
    try {
      await api(`/api/events/${encodeURIComponent(S.editing.id)}`, { method: "DELETE" });
      dlg.close();
      await load({ quiet: true });
    } catch (x) {
      $("#ev-err").textContent = t("err.delete", { m: errText(x.code, x.message) });
    } finally {
      b.disabled = false;
    }
  });

  // Comment: the words selected in the title or the notes (or the whole title) go to the chat as the quote. The sheet
  // closes first, because a modal dialog keeps the chat out of reach.
  const cbtn = $("#ev-comment");
  if (cbtn) cbtn.addEventListener("click", () => {
    const ev = S.editing;
    if (!ev || !chat) return;
    const sel = (el) => (el && el.selectionEnd > el.selectionStart ? el.value.slice(el.selectionStart, el.selectionEnd) : "");
    const quote = sel(f("title")) || sel(f("memo")) || ev.title;
    dlg.close();
    chat.commentOn(ev, quote);
  });

  $$("#ev-dlg [data-close], #day-dlg [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  [$("#ev-dlg"), $("#day-dlg")].forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); })); // a click on the backdrop

  /* ---------- one day ---------- */
  const dayDlg = $("#day-dlg");
  let dayDate = "";
  function openDay(date) {
    dayDate = date;
    $("#day-dlg-h").textContent = dLong(date);
    // the calendar day: DAY0 to DAY0 the next morning
    const evs = S.events.filter((e) => place(e).ds <= date && place(e).de >= date && visible(e))
      .sort((a, b) => (place(a).grid ? place(a).top : -1) - (place(b).grid ? place(b).top : -1));
    $("#day-list").innerHTML = listItems(evs);
    $("#day-add").hidden = !writable();
    dayDlg.showModal();
  }
  $("#day-add").addEventListener("click", () => { dayDlg.close(); openEditor(null, { date: dayDate }); });

  function findEv(id, st) {
    return [...S.events, ...S.upcoming].find((e) => e.id === id && (!st || e.start === st)) || [...S.events, ...S.upcoming].find((e) => e.id === id);
  }

  /* ---------- open a day's week with one event open (a tapped notification: /?event=<id>&date=<day>) ---------- */
  const settle = async () => { while (S.busy) await new Promise((r) => setTimeout(r, 80)); };
  async function focus(date, id) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return;
    const show = async (d) => {
      const p = parse(d);
      S.y = p.y; S.m = p.m; S.ws = weekStart(d);
      renderGrid();
      await settle();
      await load({ quiet: true });
      await settle();
    };
    await show(date);
    if (!id) return;
    // a recurring series is notified by its master id; the calendar holds its dates as <id>_<date>
    const ev = findEv(id, date) || S.events.find((e) => e.start === date && e.id.startsWith(id + "_"));
    // an event before DAY0 on a Sunday sits on the Saturday before, in the week before
    if (ev && weekStart(place(ev).ds) !== S.ws) await show(place(ev).ds);
    [dlg, dayDlg].forEach((d) => d.open && d.close());
    if (ev) openEditor(ev); else openDay(date);
  }

  // a tap on the calendar before Google is connected: nudge the banner that says why nothing can be added
  function flashBanner() {
    const b = $("#cal-banner");
    b.hidden = false;
    b.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 300 });
  }

  /* ---------- clicks and taps ---------- */
  document.addEventListener("click", (e) => {
    const tg = e.target;
    const evb = tg.closest("[data-ev]");
    if (evb && (evb.closest("#pane-calendar") || evb.closest("#day-dlg"))) {
      e.stopPropagation();
      if (evb.closest("#day-dlg")) dayDlg.close();
      const ev = findEv(evb.dataset.ev, evb.dataset.st);
      if (ev) openEditor(ev);
      return;
    }
    // phones, month view: a tap anywhere in a day (its thin bars and "+n" too) opens the week of that day
    const pday = phone() && tg.closest("#cal-grid .day");
    if (pday) { setView("week", pday.dataset.day); return; }
    const more = tg.closest("[data-more], #cal-grid [data-grp]");
    if (more) { e.stopPropagation(); openDay(more.dataset.more || more.dataset.grp); return; }
    const vb = tg.closest("#cal-view [data-view]");
    if (vb) { setView(vb.dataset.view); return; }
    const col = tg.closest("#cal-grid .wv-col");
    if (col) {
      const date = col.dataset.wcol;
      if (!writable()) { openDay(date); return; }
      // the slot's hour on the clock: the column starts at DAY0, so the rows after midnight are the next date
      const i = Math.max(0, Math.min(23, Math.floor((e.clientY - col.getBoundingClientRect().top) / HOUR_PX)));
      const h = (i + DAY0 / 60) % 24;
      const sd = i + DAY0 / 60 >= 24 ? addDays(date, 1) : date;
      openEditor(null, { date: sd, endDate: h === 23 ? addDays(sd, 1) : sd, allDay: false, startTime: `${pad2(h)}:00`, endTime: `${pad2((h + 1) % 24)}:00` });
      return;
    }
    const ac = tg.closest("#cal-grid [data-allday]");
    if (ac) {
      if (writable()) openEditor(null, { date: ac.dataset.allday, allDay: true }); else openDay(ac.dataset.allday);
      return;
    }
    const dh = tg.closest("#cal-grid [data-wday]");
    if (dh) { openDay(dh.dataset.wday); return; }
    const day = tg.closest("#cal-grid .day");
    if (day) {
      if (writable()) openEditor(null, { date: day.dataset.day });
      else openDay(day.dataset.day);
      return;
    }
    const lg = tg.closest("#legend [data-owner]");
    if (lg) {
      const id = lg.dataset.owner;
      if (S.hidden.has(id)) S.hidden.delete(id); else S.hidden.add(id);
      setPref(PREF_PREFIX + "hidden", [...S.hidden].join(","));
      renderGrid();
      renderSide();
      return;
    }
    if (tg.closest("#seed-btn")) {
      const b = tg.closest("#seed-btn");
      b.disabled = true;
      b.textContent = t("gcal.seeding");
      api("/api/seed", { method: "POST", body: JSON.stringify({ who: me() ? me().id : "" }) })
        .then(() => load())
        .catch((x) => { b.textContent = t("gcal.fail", { m: errText(x.code, x.message) }); });
      return;
    }
    if (tg.closest("#retry-btn")) load();
  });

  $("#cal-prev").addEventListener("click", () => step(-1));
  $("#cal-next").addEventListener("click", () => step(1));
  $("#cal-today").addEventListener("click", () => { const td = calToday(), p = parse(td); S.y = p.y; S.m = p.m; S.ws = weekStart(td); renderGrid(); load({ quiet: true }); });
  $("#cal-add").addEventListener("click", () => openEditor(null, {}));

  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input,textarea,dialog") || !isActive()) return;
    if (e.key === "ArrowLeft") $("#cal-prev").click();
    else if (e.key === "ArrowRight") $("#cal-next").click();
  });

  // Google is the source of truth: read it again every minute while visible, and on return after 15 s away.
  // Never while the event sheet is open (a reload would not touch the form, but keeps the sheet's event current).
  setInterval(() => { if (document.visibilityState === "visible" && isActive() && !dlg.open) load({ quiet: true }); }, POLL_MS);
  window.addEventListener("focus", () => { if (isActive() && Date.now() - S.lastSync > 15_000 && !dlg.open) load({ quiet: true }); });

  return { load, render, focus, openEditor, setView, state: S };
}
