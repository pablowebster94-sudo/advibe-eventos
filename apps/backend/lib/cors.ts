/** La PWA vive en otro origen (otro puerto en dev, otro subdominio en producción),
 *  así que el ingest necesita CORS explícito. Next 16 renombró middleware a proxy;
 *  aquí se resuelve por handler, que además deja el contrato visible en un solo sitio. */

const ALLOWED = (process.env.ALLOWED_ORIGINS ?? "*")
  .split(",")
  .map((s) => s.trim());

export function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    ALLOWED.includes("*") || (origin && ALLOWED.includes(origin))
      ? (origin ?? "*")
      : ALLOWED[0];

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function preflight(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export function json(
  request: Request,
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders(request.headers.get("origin")), ...extra },
  });
}
