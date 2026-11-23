// Every word the Research log tab shows, in one place (English). To add a language, call useStrings() with a table of the
// same keys (for example from the design system's i18n.js D.ko) and dispatch "site:lang"; records.js draws again.
// The logs themselves stay in the team's documentation language: the templates in records.js are not translated.
const EN = {
  "wk.tip": "Week {n} · {a} – {b}",
  "rec.week": "Week {n}", "rec.thisWeek": "This week", "rec.locked": "Closed", "rec.hasLog": "Has entries",
  "rec.tableSum": "Week dates and closing rule",
  "rec.tableP": "A week runs <b>{a} to the following {b}</b> ({tz}). After {b} 24:00 it closes and is not edited. Add anything missed to this week's log.",
  "rec.thWeek": "Week", "rec.thDates": "Dates", "rec.thCloses": "Closes", "rec.closesAt": "{d}, 00:00",
  "rec.teamCard": "Team notes", "rec.edit": "Edit on GitHub", "rec.viewGh": "View on GitHub",
  "rec.noTeamLocked": "No meeting notes this week.", "rec.noFile": "No file yet.", "rec.create": "Create from template",
  "rec.blankLocked": "Nothing was written this week.", "rec.blank": "Template only. Nothing written yet.", "rec.write": "Start writing",
  "rec.noPersonLocked": "{name} has no log for week {n}.", "rec.noPerson": "{name} hasn't started a log for week {n}.",
  "rec.stLocked": "<b>Closed</b> · closed at the end of {d}. Past logs stay as they are; put corrections in this week's log.",
  "rec.stOpen": "<b>This week</b> · open until the end of {d}.",
  "rec.stSoon": "<b>Not started</b> · runs {a} – {b}.",
  "rec.other": "Other files in this folder", "rec.folder": "Week folder", "rec.personal": "Personal logs", "rec.none": "No logs.",
  "rec.loadFail": "Couldn't load the logs ({m}).",
};
let table = EN;
export const useStrings = (t) => { table = { ...EN, ...(t || {}) }; };
export const t = (k, v) => {
  const s = table[k] ?? EN[k] ?? k;
  return v ? s.replace(/\{(\w+)\}/g, (_, x) => (x in v ? v[x] : `{${x}}`)) : s;
};
