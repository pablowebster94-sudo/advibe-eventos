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
  const limit = Math.min(
    Number(new URL(request.url).searchParams.get("limit") ?? 200) || 200,
    500,
  );

  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) return json(request, { ok: false, error: "not_found" }, 404);

  const photos = await prisma.photo.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
    take: limit,
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
