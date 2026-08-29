import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PUBLIC_BASE_URL } from "@/lib/paths";
import LiveGallery from "./LiveGallery";

export const dynamic = "force-dynamic";

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) notFound();

  const photos = await prisma.photo.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <LiveGallery
      slug={event.slug}
      name={event.name}
      qrUrl={`${PUBLIC_BASE_URL}/api/events/${event.slug}/qr`}
      initial={photos.map((p) => ({
        id: p.id,
        url: `/media/${p.filename}`,
        thumbUrl: `/media/${p.thumbFilename}`,
        width: p.width,
        height: p.height,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
