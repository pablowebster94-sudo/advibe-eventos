import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { PUBLIC_BASE_URL } from "@/lib/paths";
import { corsHeaders } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** QR del EVENTO, no de cada foto: apunta a la galería completa.
 *  Se devuelve como SVG para que escale a pantalla completa sin pixelarse. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) return new Response("not found", { status: 404 });

  const target = `${PUBLIC_BASE_URL}/g/${event.slug}`;
  const svg = await QRCode.toString(target, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return new Response(svg, {
    headers: {
      ...corsHeaders(request.headers.get("origin")),
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
