import { json, preflight } from "@/lib/cors";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

/** Listado público de la galería. Sin token: el QR se le enseña a cualquiera. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const search = new URL(request.url).searchParams;
  const limit = Math.min(Number(search.get("limit") ?? 200) || 200, 500);
  // Para recorrer eventos de más de 500 fotos (p. ej. tools/descargar-fotos.mjs).
  const offset = Math.max(Math.floor(Number(search.get("offset") ?? 0)) || 0, 0);

  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) return json(request, { ok: false, error: "not_found" }, 404);

  const photos = await prisma.photo.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  return json(request, {
    ok: true,
    event: { slug: event.slug, name: event.name },
    photos: photos.map((p: any) => ({
      id: p.id,
      url: `/media/${p.filename}`,
      thumbUrl: `/media/${p.thumbFilename}`,
      width: p.width,
      height: p.height,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
