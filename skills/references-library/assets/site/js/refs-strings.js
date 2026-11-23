// Every word the References tab shows, in one place (English). To add a language, call useStrings() with a table of the
// same keys and dispatch "site:lang"; refs.js draws again. Change "refs.steps", "refs.stepsH", "refs.papersH" and
// "refs.papersLead" to your project's words.
const EN = {
  "refs.toc": "Contents",
  "refs.comp": "Project", "refs.overview": "Overview", "refs.steps": "Tasks", "refs.links": "Links", "refs.papers": "Papers",
  "refs.lab": "Reading list",
  "refs.premises": "Premises", "refs.stepsH": "Tasks", "refs.step": "Task {n}",
  "refs.papersH": "Reading list, by topic",
  "refs.papersLead": "Papers we read or plan to read, by topic.{hl} PDFs are not stored here for copyright; follow the DOI. Edit the list in {link} (read_by, note).",
  "refs.hl": " Bold names are {label}.",
  "refs.search": "Search title, author, journal", "refs.all": "All", "refs.count": "{n} of {t}", "refs.n": "{n}",
  "refs.none": "No matching papers.", "refs.readBy": "Read by {n}", "refs.other": "Other",
  "tag.guess": "Unverified", "tag.ok": "Verified",
};
let table = EN;
export const useStrings = (t) => { table = { ...EN, ...(t || {}) }; };
export const t = (k, v) => {
  const s = table[k] ?? EN[k] ?? k;
  return v ? s.replace(/\{(\w+)\}/g, (_, x) => (x in v ? v[x] : `{${x}}`)) : s;
};
