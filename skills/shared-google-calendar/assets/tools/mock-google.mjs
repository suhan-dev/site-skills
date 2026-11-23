// A fake Google for local tests: the token endpoint and the parts of Calendar API v3 the site uses. Nothing real is called.
//   node tools/mock-google.mjs 8790 .dev.vars        writes the variables for `wrangler pages dev` into .dev.vars
// On start it makes a fresh RSA key, writes a fake service-account JSON with it, and checks every token request's JWT
// signature against that key, so the real signing code in lib/gcal.js is exercised.
// Calendar ids: "mock-calendar" works; "forbidden-calendar" answers 403; any other id answers 404 (to see the error texts).
// Times: a dateTime without an offset is read in its own timeZone field (as Google does); lists answer in the
// timeZone query parameter.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";

const port = +(process.argv[2] || 8790);
const out = process.argv[3] || ".dev.vars";
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const sa = {
  type: "service_account",
  project_id: "mock-project",
  private_key_id: "mock-key",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
  client_email: "calendar-site@example.test",
};
fs.writeFileSync(out, [
  `GOOGLE_SA_JSON='${JSON.stringify(sa)}'`,
  `GOOGLE_CALENDAR_ID=mock-calendar`,
  `GOOGLE_TOKEN_URL=http://127.0.0.1:${port}/token`,
  `GOOGLE_API_BASE=http://127.0.0.1:${port}/calendar/v3`,
].join("\n") + "\n");

/* ---------- time zones ---------- */
const fmts = new Map();
function parts(tz, ms) {
  if (!fmts.has(tz)) fmts.set(tz, new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  const p = Object.fromEntries(fmts.get(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}
const offsetAt = (tz, ms) => { const p = parts(tz, ms); return Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000) / 60000); };
const hasOffset = (s) => /[+-]\d\d:\d\d$|Z$/.test(s);
// a naive local time in tz → epoch ms
function naive(s, tz) {
  const [d, t = "00:00:00"] = s.split("T");
  const [y, mo, dd] = d.split("-").map(Number), [h, mi, se = 0] = t.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, dd, h, mi, se);
  return guess - offsetAt(tz, guess - offsetAt(tz, guess) * 60000) * 60000;
}
// epoch ms → "YYYY-MM-DDTHH:MM:SS+HH:MM" in tz
function inZone(ms, tz) {
  const p = parts(tz, ms), z = (n) => String(n).padStart(2, "0"), o = offsetAt(tz, ms), a = Math.abs(o);
  return `${p.y}-${z(p.mo)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}:${z(p.s)}${o < 0 ? "-" : "+"}${z(Math.floor(a / 60))}:${z(a % 60)}`;
}
const CAL_TZ = process.env.MOCK_TZ || "UTC";
const instant = (x) => (x.dateTime ? (hasOffset(x.dateTime) ? Date.parse(x.dateTime) : naive(x.dateTime, x.timeZone || CAL_TZ)) : naive(x.date, x.timeZone || CAL_TZ));
const outEv = (e, tz) => {
  const fix = (x) => (x.dateTime ? { ...x, dateTime: inZone(instant(x), tz || x.timeZone || CAL_TZ) } : x);
  return { ...e, start: fix(e.start), end: fix(e.end), htmlLink: "https://calendar.google.com/calendar/event?eid=" + e.id };
};

const events = new Map();
let n = 0;
const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(obj == null ? "" : JSON.stringify(obj)); };
function merge(a, b) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v === null) delete o[k];
    else if (typeof v === "object" && !Array.isArray(v) && typeof o[k] === "object") o[k] = merge(o[k], v);
    else o[k] = v;
  }
  return o;
}

http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/token") {
      const jwt = new URLSearchParams(body).get("assertion") || "";
      const [h, c, s] = jwt.split(".");
      const okSig = crypto.verify("RSA-SHA256", Buffer.from(h + "." + c), publicKey, Buffer.from(s || "", "base64url"));
      const claim = JSON.parse(Buffer.from(c || "", "base64url").toString() || "{}");
      if (!okSig || claim.iss !== sa.client_email) return send(res, 400, { error: "invalid_grant", error_description: "bad signature" });
      return send(res, 200, { access_token: "mock-access-" + (++n), expires_in: 3600, token_type: "Bearer" });
    }
    if (req.headers.authorization?.startsWith("Bearer mock-access-") !== true) return send(res, 401, { error: { message: "no auth" } });
    const m = u.pathname.match(/^\/calendar\/v3\/calendars\/([^/]+)(\/events(?:\/([^/]+))?)?$/);
    if (!m) return send(res, 404, { error: { message: "Not Found" } });
    const [, cal, evs, id] = m;
    const calId = decodeURIComponent(cal);
    if (calId === "forbidden-calendar") return send(res, 403, { error: { message: "Forbidden" } });
    if (calId !== "mock-calendar") return send(res, 404, { error: { message: "Not Found" } });
    if (!evs) return send(res, 200, { summary: "Example Lab (mock)", timeZone: CAL_TZ });
    if (!id && req.method === "GET") {
      const t0 = Date.parse(u.searchParams.get("timeMin")), t1 = Date.parse(u.searchParams.get("timeMax"));
      const tz = u.searchParams.get("timeZone") || CAL_TZ;
      const items = [...events.values()].filter((e) => e.status !== "cancelled" && instant(e.end) > t0 && instant(e.start) < t1)
        .sort((a, b) => instant(a.start) - instant(b.start)).map((e) => outEv(e, tz));
      return send(res, 200, { items });
    }
    if (!id && req.method === "POST") {
      const e = JSON.parse(body);
      e.id = e.id || "ev" + Date.now().toString(32) + (++n);
      if (events.has(e.id)) return send(res, 409, { error: { message: "The requested identifier already exists." } });
      e.status = "confirmed"; e.updated = new Date().toISOString();
      events.set(e.id, e);
      return send(res, 200, outEv(e));
    }
    const e = events.get(decodeURIComponent(id || ""));
    if (!e) return send(res, 404, { error: { message: "Not Found" } });
    if (req.method === "GET") return send(res, 200, outEv(e));
    if (req.method === "PATCH") {
      const ne = merge(e, JSON.parse(body));
      if ((ne.start.date && ne.start.dateTime) || (ne.end.date && ne.end.dateTime)) return send(res, 400, { error: { message: "Invalid start time." } });
      ne.updated = new Date().toISOString();
      events.set(e.id, ne);
      return send(res, 200, outEv(ne));
    }
    if (req.method === "DELETE") {
      if (e.status === "cancelled") return send(res, 410, { error: { message: "Resource has been deleted" } });
      e.status = "cancelled";
      return send(res, 204, null);
    }
    send(res, 405, { error: { message: "method" } });
  });
}).listen(port, "127.0.0.1", () => console.log(`mock google on :${port}, vars → ${out}`));
