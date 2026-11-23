// Demo wiring: the fake API first, then the calendar exactly as a site would start it.
import "./fake-api.js";
import { createCalendar } from "../site/js/calendar.js";
import { initTheme } from "../../../team-site-design-system/assets/theme.js";
import { wireLangButton } from "../../../team-site-design-system/assets/i18n.js";

const team = { // the shape of team-site-setup's team.json
  members: [
    { id: "alex", name: "Alex", colorId: "7" },
    { id: "blair", name: "Blair", colorId: "10" },
    { id: "casey", name: "Casey", colorId: "6" },
  ],
  owners: [
    { id: "team", label: "Team", colorId: "9" },
    { id: "official", label: "Official", colorId: "11" },
  ],
};
const owners = [...team.owners, ...team.members.map((m) => ({ id: m.id, label: m.name, colorId: m.colorId }))];
const me = () => team.members[0]; // signed in as Alex
const nameOf = (id) => (team.members.find((m) => m.id === id) || {}).name || id;

// The team-chat skill's createChat() goes here on a real site. This stand-in only shows where the event sheet's
// Comment button sits (it appears because a chat is passed in) and lights the header's chat dot when pressed.
const chat = {
  countFor: (page) => (page === "event/demo2" ? 2 : 0), // "Design review" already has two comments
  commentOn: () => { document.querySelector("#chat-btn .chat-dot").hidden = false; },
};

const cal = createCalendar({ owners, me, nameOf, chat });
cal.load();
window.demoCal = cal; // for screenshots: demoCal.openEditor(…), demoCal.setView("month")

// header: light / dark and EN | KO from the design system (the calendar itself stays English, as on the source site)
initTheme({ button: document.getElementById("theme-btn") });
wireLangButton();
