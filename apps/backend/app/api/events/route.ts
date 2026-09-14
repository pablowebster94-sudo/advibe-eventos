import { randomBytes } from "node:crypto";
import cuid from "cuid";
import { checkAdmin } from "@/lib/admin";
import { json, preflight } from "@/lib/cors";
import { prisma } from "@/lib/db";
import { PUBLIC_BASE_URL } from "@/lib/paths";
import { isValidSlug, slugify } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * CONTRATO DE CREACIÓN DE EVENTO — v1
 *
 *   POST /api/events
 *   Authorization: Bearer <ADMIN_TOKEN>
 *   Content-Type: application/json
 *
 *   name       string  requerido  nombre visible del evento
 *   slug       string  opcional   si falta, se deriva del nombre
 *   brandName  string  opcional   sello de marca sobre las fotos
 *
 *   201 { ok:true, event:{ id, slug, name, brandName, token, galleryUrl, qrUrl } }
 *   400 { ok:false, error:"malformed_json" }
 *   401 { ok:false, error:"invalid_admin_token" }
 *   409 { ok:false, error:"slug_taken", slug:string }
 *   422 { ok:false, error:"missing_field"|"invalid_slug", field?:string }
 *   503 { ok:false, error:"admin_not_configured" }
 *
 * El `token` del evento se devuelve UNA sola vez, al crearlo: es el credencial
 * que el operador escribe en la PWA de captura. No hay endpoint que lo liste
 * después, igual que no lo lista `prisma/seed.ts`.
 */
export async function POST(request: Request) {
  const admin = checkAdmin(request);
  if (admin === "not_configured")
    return json(request, { ok: false, error: "admin_not_configured" }, 503);
  if (admin === "invalid")
    return json(request, { ok: false, error: "invalid_admin_token" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(request, { ok: false, error: "malformed_json" }, 400);
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const name = String(input.name ?? "").trim();
  const brandName = String(input.brandName ?? "").trim();
  const slugInput = String(input.slug ?? "").trim();

  if (!name)
    return json(request, { ok: false, error: "missing_field", field: "name" }, 422);

  // El operador puede fijar el slug (va impreso en el QR) o dejar que salga del
  // nombre. Un nombre solo de símbolos no produce slug: eso se pide explícito.
  const slug = slugInput ? slugify(slugInput) : slugify(name);
  if (!isValidSlug(slug))
    return json(request, { ok: false, error: "invalid_slug", field: "slug" }, 422);

  if (await prisma.event.findUnique({ where: { slug } }))
    return json(request, { ok: false, error: "slug_taken", slug }, 409);

  const event = await createEvent({
    slug,
    name,
    brandName: brandName || null,
  }).catch((error: unknown) => {
    // Dos operadores creando el mismo slug a la vez: gana quien insertó primero.
    if (isUniqueViolation(error)) return null;
    throw error;
  });

  if (!event) return json(request, { ok: false, error: "slug_taken", slug }, 409);

  return json(
    request,
    {
      ok: true,
      event: {
        id: event.id,
        slug: event.slug,
        name: event.name,
        brandName: event.brandName,
        token: event.token,
        galleryUrl: `${PUBLIC_BASE_URL}/g/${event.slug}`,
        qrUrl: `${PUBLIC_BASE_URL}/api/events/${event.slug}/qr`,
      },
    },
    201,
  );
}

async function createEvent(data: {
  slug: string;
  name: string;
  brandName: string | null;
}) {
  return prisma.event.create({
    data: {
      id: cuid(),
      slug: data.slug,
      name: data.name,
      brandName: data.brandName,
      // Mismo formato que `prisma/seed.ts`: corto porque el operador lo teclea
      // en el celular, y aleatorio porque es el credencial de subida.
      token: randomBytes(9).toString("base64url"),
    },
  });
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    String((error as { code?: unknown }).code ?? "").startsWith("SQLITE_CONSTRAINT")
  );
}
