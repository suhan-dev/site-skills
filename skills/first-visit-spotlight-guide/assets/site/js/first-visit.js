// What a member sees first, in order, once the page is up. One thing at a time, never two sheets on top of each other.
//
//   1. In an iPhone or iPad browser: "Add to Home Screen", once per member (ios-webapp-push: push.offerInstall(after)).
//      When it closes, step 2 runs.
//   2. Inside the installed Home Screen app: the notifications sheet, once on this device, instead of the tour
//      (ios-webapp-push: push.welcome()). The app has its own storage on iPhone; the tour stays under "Site guide".
//   3. Otherwise: the tour, once per member (guide.picked).
//
// "Once the page is up" means 600 ms after load when there is no intro, or 400 ms after the intro ends
// (scroll-3d-intro fires "intro:done"), so nothing pops up over the intro.
//
// firstVisit({ member, guide, offerInstall, appWelcome })
//   member             the signed-in member id (GET /api/me), or "" when nobody is known yet (then nothing happens)
//   guide              createGuide(...) from guide.js
//   offerInstall(after) → true if it opened the install sheet (and will call after() when it closes), else false
//   appWelcome()       → true if it opened the installed app's own first sheet, else false
export function firstVisit({ member, guide, offerInstall = () => false, appWelcome = () => false, introDoneEvent = "intro:done" } = {}) {
  if (!member || !guide) return;
  const welcome = () => { if (!appWelcome()) guide.picked(member); };
  const askOnce = () => { if (!offerInstall(welcome)) welcome(); };
  if (document.documentElement.classList.contains("intro-on")) {
    window.addEventListener(introDoneEvent, () => setTimeout(askOnce, 400), { once: true });
  } else setTimeout(askOnce, 600);
}
