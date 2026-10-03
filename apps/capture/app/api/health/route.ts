export const dynamic = "force-dynamic";

/** Healthcheck de Railway: railway.json es compartido con el backend. */
export async function GET() {
  return Response.json({ ok: true, service: "advibe-capture", time: new Date().toISOString() });
}
