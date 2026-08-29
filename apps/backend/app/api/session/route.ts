import { eventFromRequest } from "@/lib/auth";
import { json, preflight } from "@/lib/cors";
import { PUBLIC_BASE_URL } from "@/lib/paths";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

/** Valida el token del evento y devuelve lo que la PWA necesita para pintar
 *  su pantalla: nombre, contador ya subido y la URL pública que va en el QR. */
export async function GET(request: Request) {
  const event = await eventFromRequest(request);
  if (!event) return json(request, { ok: false, error: "invalid_token" }, 401);

  const uploaded = await prisma.photo.count({ where: { eventId: event.id } });

  return json(request, {
    ok: true,
    event: {
      slug: event.slug,
      name: event.name,
      brandName: event.brandName,
      galleryUrl: `${PUBLIC_BASE_URL}/g/${event.slug}`,
      qrUrl: `${PUBLIC_BASE_URL}/api/events/${event.slug}/qr`,
      uploaded,
    },
  });
}
