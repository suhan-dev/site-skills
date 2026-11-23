// Every request passes through here first. This skeleton only adds the security headers and keeps the site out of
// search engines. Replace it with the gate from google-signin-team-gate (assets/functions/_middleware.js), which keeps
// these headers.
function secure(res) {
  const r = new Response(res.body, res);
  r.headers.set("X-Robots-Tag", "noindex, nofollow");
  r.headers.set("Referrer-Policy", "same-origin");
  r.headers.set("X-Content-Type-Options", "nosniff");
  r.headers.set("X-Frame-Options", "SAMEORIGIN");
  return r;
}

export async function onRequest(context) {
  return secure(await context.next());
}
