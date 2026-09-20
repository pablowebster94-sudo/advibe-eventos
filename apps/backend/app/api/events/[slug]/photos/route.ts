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


import { unlink } from "node:fs/promises";
import path from "node:path";
import { checkAdmin } from "@/lib/admin";
import { MEDIA_DIR } from "@/lib/paths";

/**
 * DELETE /api/events/:slug/photos
 * Authorization: Bearer <ADMIN_TOKEN>
 *
 * Borra todas las fotos de un evento, incluyendo sus archivos y miniaturas.
 * El evento, su slug, QR y token permanecen intactos.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = checkAdmin(request);
  if (admin === "not_configured")
    return json(request, { ok: false, error: "admin_not_configured" }, 503);
  if (admin === "invalid")
    return json(request, { ok: false, error: "invalid_admin_token" }, 401);

  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) return json(request, { ok: false, error: "not_found" }, 404);

  const photos = await prisma.photo.findMany({
    where: { eventId: event.id },
    select: { filename: true, thumbFilename: true },
  });

  await prisma.photo.deleteMany({ where: { eventId: event.id } });

  let filesDeleted = 0;
  for (const photo of photos) {
    for (const filename of [photo.filename, photo.thumbFilename]) {
      try {
        await unlink(path.join(MEDIA_DIR, filename));
        filesDeleted++;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") console.error("reset photo file error:", filename, error);
      }
    }
  }

  return json(request, {
    ok: true,
    event: { slug: event.slug, name: event.name },
    photosDeleted: photos.length,
    filesDeleted,
  });
}
