import { timingSafeEqual } from "node:crypto";

/**
 * Crear un evento es lo único que no puede depender del token del propio evento:
 * todavía no existe. Va detrás de `ADMIN_TOKEN`, un credencial aparte que solo
 * conoce quien monta el evento.
 *
 * Si `ADMIN_TOKEN` no está configurado la creación queda CERRADA, no abierta:
 * este backend se despliega en una URL pública, y un despliegue sin configurar
 * no debe convertirse en un formulario donde cualquiera crea eventos.
 */
export type AdminCheck = "ok" | "not_configured" | "invalid";

export function checkAdmin(request: Request): AdminCheck {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) return "not_configured";

  const match = /^Bearer\s+(.+)$/i.exec(
    (request.headers.get("authorization") ?? "").trim(),
  );
  const provided = match?.[1].trim();
  if (!provided) return "invalid";

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual exige longitudes iguales; comparar antes no filtra el token,
  // solo su longitud.
  if (a.length !== b.length) return "invalid";

  return timingSafeEqual(a, b) ? "ok" : "invalid";
}
