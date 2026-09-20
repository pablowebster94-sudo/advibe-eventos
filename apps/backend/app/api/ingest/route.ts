import cuid from "cuid";
import { eventFromRequest } from "@/lib/auth";
import { publishPhoto } from "@/lib/bus";
import { json, preflight } from "@/lib/cors";
import { prisma } from "@/lib/db";
import { MAX_BYTES, isAccepted, processPhoto } from "@/lib/photos";

export const runtime = "nodejs";
// Sharp y el filesystem no sobreviven al prerender: esta ruta es siempre dinámica.
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * CONTRATO DE INGEST — v1
 *
 *   POST /api/ingest
 *   Authorization: Bearer <token del evento>
 *   Content-Type: multipart/form-data
 *
 *   photo           File    requerido  jpeg | png | webp | heic, <= 25 MB
 *   idempotencyKey  string  requerido  uuid generado al ENCOLAR, no al enviar
 *   clientId        string  requerido  uuid estable por dispositivo
 *   capturedAt      string  opcional   ISO-8601
 *
 *   200 { ok:true, duplicate:boolean, photo:{...} }
 *   401 { ok:false, error:"invalid_token" }
 *   413 { ok:false, error:"too_large" }
 *   415 { ok:false, error:"unsupported_type" }
 *   422 { ok:false, error:"missing_field", field:string }
 *
 * `idempotencyKey` es lo que permite reintentar sin duplicar. Se genera cuando la
 * foto entra en la cola y no cambia entre reintentos, así que si una respuesta se
 * pierde por red y el cliente reenvía, el servidor devuelve la foto original con
 * duplicate:true en vez de crear otra.
 */
export async function POST(request: Request) {
  const event = await eventFromRequest(request);
  if (!event) return json(request, { ok: false, error: "invalid_token" }, 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(request, { ok: false, error: "malformed_multipart" }, 400);
  }

  const photo = form.get("photo");
  const idempotencyKey = String(form.get("idempotencyKey") ?? "").trim();
  const clientId = String(form.get("clientId") ?? "").trim();
  const capturedAtRaw = String(form.get("capturedAt") ?? "").trim();

  if (!(photo instanceof File))
    return json(request, { ok: false, error: "missing_field", field: "photo" }, 422);
  if (!idempotencyKey)
    return json(request, { ok: false, error: "missing_field", field: "idempotencyKey" }, 422);
  if (!clientId)
    return json(request, { ok: false, error: "missing_field", field: "clientId" }, 422);

  if (photo.size > MAX_BYTES)
    return json(request, { ok: false, error: "too_large", max: MAX_BYTES }, 413);
  if (photo.type && !isAccepted(photo.type))
    return json(request, { ok: false, error: "unsupported_type", got: photo.type }, 415);

  // Reintento de algo que ya entró: devolver la original y no volver a procesar.
  const existing = await prisma.photo.findUnique({
    where: { eventId_idempotencyKey: { eventId: event.id, idempotencyKey } },
  });
  if (existing) {
    return json(request, { ok: true, duplicate: true, photo: serialize(existing) });
  }

  const buffer = Buffer.from(await photo.arrayBuffer());

  let processed;
  try {
    processed = await processPhoto(buffer, { brandName: event.brandName, eventSlug: event.slug });
  } catch {
    return json(request, { ok: false, error: "unreadable_image" }, 415);
  }

  const capturedAt = capturedAtRaw ? new Date(capturedAtRaw) : null;

  let created;
  try {
    created = await prisma.photo.create({
      data: {
        id: cuid(),
        eventId: event.id,
        idempotencyKey,
        clientId,
        filename: processed.filename,
        thumbFilename: processed.thumbFilename,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
        capturedAt:
          capturedAt && !Number.isNaN(capturedAt.valueOf()) ? capturedAt : null,
      },
    });
  } catch (e) {
    console.error('Ingest error:', e);
    // Dos reintentos en paralelo pueden cruzarse aquí; gana el que insertó primero.
    const raced = await prisma.photo.findUnique({
      where: { eventId_idempotencyKey: { eventId: event.id, idempotencyKey } },
    });
    if (!raced) throw new Error("ingest: insert failed without a racing row");
    return json(request, { ok: true, duplicate: true, photo: serialize(raced) });
  }

  const payload = serialize(created);
  publishPhoto(event.id, payload);

  return json(request, { ok: true, duplicate: false, photo: payload });
}

function serialize(p: {
  id: string;
  filename: string;
  thumbFilename: string;
  width: number;
  height: number;
  createdAt: Date;
}) {
  return {
    id: p.id,
    url: `/media/${p.filename}`,
    thumbUrl: `/media/${p.thumbFilename}`,
    width: p.width,
    height: p.height,
    createdAt: p.createdAt.toISOString(),
  };
}
