// Cloudflare Pages Functions: the reader's address.
// /theory/<sub-tab>/<chapter> (no dot in the last part) has no file behind it. Answer a GET or HEAD for it with
// reader.html, which reads the chapter from the address. A path with a dot in its last part (an image, a script, the
// .md source) is a real file and passes through. Figures copied under /repo/theory/… never match.
//
// It lives in lib/, not functions/: every file under functions/ that exports onRequest becomes a route of its own.
// Use it on its own as functions/_middleware.js:
//     export { onRequest } from "../lib/reader-route.js";
// or, behind a sign-in gate (google-signin-team-gate), call readerRewrite() for a signed-in request only, so a signed-out
// visitor gets the sign-in page first and comes back to the chapter after signing in.

export const READER = /^\/theory\/[^/]+\/[^/.]+\/?$/;

/** The reader page for a reader address, or null for any other request. */
export async function readerRewrite({ request, env }) {
  const url = new URL(request.url);
  if (!READER.test(url.pathname) || !(request.method === "GET" || request.method === "HEAD")) return null;
  // "/reader", not "/reader.html": Pages answers *.html with a redirect to the address without it
  return env.ASSETS.fetch(new Request(new URL("/reader", url), request));
}

export async function onRequest(ctx) {
  return (await readerRewrite(ctx)) || ctx.next();
}
