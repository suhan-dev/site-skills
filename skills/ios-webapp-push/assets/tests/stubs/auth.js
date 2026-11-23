// Test stand-in for lib/auth.js (the real one is in the google-signin-team-gate skill): only allowedMembers, with the
// same rule — null (prune nobody) unless the sign-in gate is on (GOOGLE_CLIENT_ID and the DB binding), else the
// members named in ALLOWED_EMAILS ("address=member", comma or new line).
export function allowedMembers(env) {
  if (!(env && env.GOOGLE_CLIENT_ID && env.DB)) return null;
  const out = new Set();
  for (const raw of String(env.ALLOWED_EMAILS || "").split(/[,;\n]/)) {
    const s = raw.trim(), i = Math.max(s.lastIndexOf("="), s.lastIndexOf(":"));
    if (i > 0 && s.slice(0, i).includes("@") && /^[a-z0-9_-]{1,32}$/.test(s.slice(i + 1).trim())) out.add(s.slice(i + 1).trim());
  }
  return out;
}
