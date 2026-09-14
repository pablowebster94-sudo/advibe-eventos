export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, service: "advibe-backend", time: new Date().toISOString(), version: "1.0.1" });
}

