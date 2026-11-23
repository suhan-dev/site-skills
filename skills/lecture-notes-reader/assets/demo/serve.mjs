// A small static server for the demo, with the same rewrite as lib/reader-route.js:
// /theory/<part>/<chapter> (no dot in the last part) → the reader page. No dependencies.
//   node assets/demo/serve.mjs [port]          → http://localhost:8123/  (Theory tab)
//                                                http://localhost:8123/theory/heat/h1-heat-flow-in-a-rod  (reader)
// It serves this folder, the skill's site files (/js/, /css/, /reader) and the design system's tokens, components,
// theme.js and i18n.js (as /ds/…).
// Run `bash assets/fetch-vendor.sh` once first (marked and KaTeX into demo/vendor/).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, "..", "site");
const DS = path.join(HERE, "..", "..", "..", "team-site-design-system", "assets");
const FILL = { "{{SITE_NAME}}": "Example Lab" }; // the demo's placeholder values
const READER = /^\/theory\/[^/]+\/[^/.]+\/?$/;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".md": "text/markdown; charset=utf-8",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".png": "image/png" };

function fileFor(p) {
  if (p === "/" || p === "/index.html") return path.join(HERE, "index.html");
  if (p === "/reader" || READER.test(p)) return path.join(SITE, "reader.html");
  if (p === "/css/tokens.css" || p === "/css/components.css") return path.join(DS, p.slice(5));
  if (p === "/ds/theme.js" || p === "/ds/i18n.js") return path.join(DS, p.slice(4)); // the header's theme and language buttons
  if (p.startsWith("/js/") || p.startsWith("/css/")) return path.join(SITE, p);
  return path.join(HERE, p);
}

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch (e) { p = "/"; }
  const f = path.normalize(fileFor(p));
  const okRoot = [HERE, SITE, DS].some((r) => f.startsWith(path.normalize(r) + path.sep));
  if (!okRoot || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("not found");
  }
  const ext = path.extname(f);
  let body = fs.readFileSync(f);
  if (ext === ".html") body = Object.entries(FILL).reduce((s, [k, v]) => s.split(k).join(v), body.toString("utf8"));
  res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(req.method === "HEAD" ? undefined : body);
});
const port = +(process.argv[2] || 8123);
server.listen(port, () => console.log(`demo on http://localhost:${port}/`));
export default server;
