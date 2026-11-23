// Service worker for the installed app: notifications only. It caches nothing and has no fetch handler, so every
// page and API request goes to the network as usual (the sign-in gate, the calendar, everything stays live).
// Messages come from lib/push.js: { title, body, url, tag }.
// Serve it at /sw.js with scope "/" and keep it public (the sign-in gate lists it in PUBLIC), or the browser cannot
// fetch it for updates.

const TITLE = "{{SITE_NAME}}";
const HOME = "/#calendar"; // where a notification without its own url opens

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : "" }; }
  // iOS stops sending to a site whose push shows nothing (a "silent push"), so every push shows a notification
  event.waitUntil(self.registration.showNotification(d.title || TITLE, {
    body: d.body || "",
    tag: d.tag || undefined,           // the same tag replaces an older notification instead of stacking
    icon: "/icons/app-192.png",        // iPhone shows the app icon by itself; Android and desktops use this
    data: { url: typeof d.url === "string" ? d.url : HOME },
  }));
});

// A tap: an open window gets the address through a message (no reload, it jumps to the day and opens the event);
// otherwise the app opens at that address. Only same-origin addresses are followed.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || HOME, self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const win = wins.find((w) => new URL(w.url).pathname === "/") || null;
    if (win) {
      try {
        await win.focus();
        win.postMessage({ type: "app:open", url: url.pathname + url.search + url.hash });
        return;
      } catch (e) { /* the window went away: open a new one */ }
    }
    await self.clients.openWindow(url.href);
  })());
});
