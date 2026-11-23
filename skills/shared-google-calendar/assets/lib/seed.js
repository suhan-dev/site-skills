// The official schedule (from the program's notice). "Add official schedule" puts it into the shared calendar once.
// Event ids are fixed (SEED_PREFIX + the date), so pressing the button twice adds nothing twice. Google event ids use
// only the letters a–v and the digits 0–9, 5 to 1024 characters: keep SEED_PREFIX to those.
// `match` says what a hand-made event of the same kind looks like: if one is already on that day, the button skips it.
//
// EXAMPLE DATA: replace the dates, titles and notes below with your program's own. Nothing else needs to change.

export const SEED_PREFIX = "seed";
const OFFICIAL = { owner: "official", colorId: "11" };
const KIND = {
  kickoff: /kickoff|kick-off|orientation|interview/i,
  session: /session|meeting|class/i,
  last: /last day|final|closing/i,
};

// every 7 days from `from` to `to` (both YYYY-MM-DD, same weekday)
function weekly(from, to) {
  const out = [];
  const d = new Date(from + "T00:00:00Z");
  while (d.toISOString().slice(0, 10) <= to) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

export function seedEvents() {
  const list = [
    {
      start: "2027-01-05",
      title: "Kickoff",
      match: KIND.kickoff,
      location: "Main hall, room 101",
      memo: "All members attend.\nThe exact time will be emailed to the team lead. When it arrives, set the time on this event.",
    },
  ];
  for (const day of weekly("2027-01-12", "2027-02-23")) {
    list.push({
      start: day,
      title: "Weekly session (Tue)",
      match: KIND.session,
      location: "",
      memo: "Every Tuesday during the program. Update the time and place once they are set.",
    });
  }
  list.push({
    start: "2027-03-02",
    title: "Last day",
    match: KIND.last,
    location: "",
    memo: "Program period: 2027-01-05 – 2027-03-02.",
  });
  return list.map((e) => ({
    id: SEED_PREFIX + e.start.replace(/-/g, ""),
    allDay: true,
    end: e.start,
    startTime: "",
    endTime: "",
    ...OFFICIAL,
    ...e,
  }));
}
