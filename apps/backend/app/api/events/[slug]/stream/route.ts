import { photoBus, type PhotoEvent } from "@/lib/bus";
import { corsHeaders } from "@/lib/cors";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SSE: la galería pública se entera de cada foto nueva sin hacer polling. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) return new Response("not found", { status: 404 });

  const channel = `event:${event.id}`;
  const encoder = new TextEncoder();

  let onPhoto: ((p: PhotoEvent) => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // El cliente ya cerró; el cleanup de cancel() se encarga.
        }
      };

      send(`retry: 3000\n\n`);
      send(`event: ready\ndata: ${JSON.stringify({ slug })}\n\n`);

      onPhoto = (photo) => send(`event: photo\ndata: ${JSON.stringify(photo)}\n\n`);
      photoBus.on(channel, onPhoto);

      // Proxies y móviles cortan conexiones ociosas; un comentario cada 25 s las sostiene.
      heartbeat = setInterval(() => send(`: keep-alive\n\n`), 25_000);

      request.signal.addEventListener("abort", () => {
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      });
    },
    cancel() {
      if (onPhoto) photoBus.off(channel, onPhoto);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders(request.headers.get("origin")),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
