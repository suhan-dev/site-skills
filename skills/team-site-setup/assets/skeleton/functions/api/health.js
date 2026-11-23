// GET /api/health → which settings this deployment has (names only, never values). Handy after "Retry deployment".
export async function onRequestGet({ env }) {
  const has = (k) => Boolean(env[k]);
  return Response.json({
    ok: true,
    vars: {
      GOOGLE_CLIENT_ID: has("GOOGLE_CLIENT_ID"),
      ALLOWED_EMAILS: has("ALLOWED_EMAILS"),
      GOOGLE_CALENDAR_ID: has("GOOGLE_CALENDAR_ID"),
      GOOGLE_SA_JSON: has("GOOGLE_SA_JSON"),
    },
    bindings: { DB: Boolean(env.DB) },
  }, { headers: { "Cache-Control": "no-store" } });
}
