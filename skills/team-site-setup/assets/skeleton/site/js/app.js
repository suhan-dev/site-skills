import { initTheme, lockPhoneZoom } from "./theme.js";
initTheme({ button: document.getElementById("theme-btn") });
lockPhoneZoom();
// show which settings this deployment has (names only)
fetch("/api/health").then((r) => r.json()).then((h) => {
  const on = Object.entries({ ...h.vars, ...h.bindings }).map(([k, v]) => `${k} ${v ? "✓" : "–"}`).join(" · ");
  document.getElementById("health").textContent = on;
}).catch(() => {});
