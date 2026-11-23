// Where events sit: the calendar day model and the two layouts (lanes for bars, columns for overlapping blocks).
// Pure functions (no DOM), so tools/test-calendar.mjs can test them in Node.
import { DAY_START_HOUR } from "./cal-config.js";
import { addDays, diffDays, mins, nowMins, todayYMD } from "./cal-util.js";

// at most this many bar rows per week (month view, and the week view's all-day row); the rest is "+n more"
export const MAX_LANES = 3;

// A calendar day runs DAY0 → DAY0 the next morning (team time), so a late night stays on the day it started: the week
// view's columns, the month view, the day list and "today" all use it. Dates and times of the events themselves are
// unchanged (Google Calendar has the real ones).
export const DAY0 = DAY_START_HOUR * 60;
export const off = (m) => (m - DAY0 + 1440) % 1440; // minutes after the calendar day's start
export const calToday = () => (nowMins() < DAY0 ? addDays(todayYMD(), -1) : todayYMD());

// Where an event sits on that calendar: ds/de its first and last calendar day; a timed event that fits inside one
// calendar day (grid: true) also gets top/end, its minutes after DAY0. Everything else (all-day, longer, or crossing
// DAY0) is a bar in the all-day row.
const placed = new WeakMap();
export function place(e) {
  let p = placed.get(e);
  if (p) return p;
  if (e.allDay || !e.startTime) p = { ds: e.start, de: e.end || e.start, grid: false };
  else {
    const s = mins(e.startTime);
    const ds = s < DAY0 ? addDays(e.start, -1) : e.start;
    let len = e.endTime ? diffDays(e.start, e.end || e.start) * 1440 + mins(e.endTime) - s : 60;
    if (len <= 0) len = 30;
    const top = off(s), end = top + len;
    p = { ds, de: addDays(ds, Math.floor((end - 1) / 1440)), grid: end <= 1440, top, end };
  }
  placed.set(e, p);
  return p;
}

// Bars of one week in lanes (rows): all-day before timed, earlier first, longer first. Each bar takes the first lane
// that is free on all its days. hiddenPerDay: how many bars of each day fall below MAX_LANES ("+n more").
export function layoutWeek(weekStart, evs, visible = () => true) {
  const weekEnd = addDays(weekStart, 6);
  const items = evs
    .filter((e) => place(e).ds <= weekEnd && place(e).de >= weekStart && visible(e))
    .map((e) => {
      const p = place(e);
      const s = Math.max(0, diffDays(weekStart, p.ds));
      const en = Math.min(6, diffDays(weekStart, p.de));
      return { e, s, en, span: en - s + 1, bar: !p.grid };
    })
    .sort((a, b) => (b.bar - a.bar) || (a.s - b.s) || (b.span - a.span) || ((place(a.e).top ?? -1) - (place(b.e).top ?? -1)) || a.e.title.localeCompare(b.e.title));
  const lanes = [];
  const perDay = Array(7).fill(0);
  const shown = Array(7).fill(0);
  for (const it of items) {
    for (let d = it.s; d <= it.en; d++) perDay[d]++;
    let lane = 0;
    while (true) {
      lanes[lane] = lanes[lane] || Array(7).fill(false);
      let free = true;
      for (let d = it.s; d <= it.en; d++) if (lanes[lane][d]) { free = false; break; }
      if (free) break;
      lane++;
    }
    for (let d = it.s; d <= it.en; d++) lanes[lane][d] = true;
    it.lane = lane;
    if (lane < MAX_LANES) for (let d = it.s; d <= it.en; d++) shown[d]++;
  }
  return { items, hiddenPerDay: perDay.map((n, i) => n - shown[i]) };
}

// Side-by-side columns for overlapping timed blocks in one day. list: [{ s, en }] in minutes after DAY0.
// Sets it.k (its column) and it.n (columns in its overlap group): the block is 1/n wide at k/n.
export function packDay(list) {
  list.sort((a, b) => a.s - b.s || b.en - a.en);
  let cols = [], group = [], gEnd = -1;
  const flush = () => { group.forEach((it) => (it.n = cols.length)); cols = []; group = []; };
  for (const it of list) {
    if (group.length && it.s >= gEnd) flush();
    let k = cols.findIndex((end) => end <= it.s);
    if (k < 0) { k = cols.length; cols.push(0); }
    cols[k] = it.en;
    it.k = k;
    group.push(it);
    gEnd = Math.max(gEnd, it.en);
  }
  if (group.length) flush();
  return list;
}
