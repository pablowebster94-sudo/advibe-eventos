import { randomBytes } from "node:crypto";
import cuid from "cuid";
import { getDb } from "./database";
import { PUBLIC_BASE_URL } from "./paths";

/** El evento que se está cubriendo. Se puede cambiar sin tocar código con
 *  CURRENT_EVENT_SLUG / CURRENT_EVENT_NAME en las variables del servicio. */
const SLUG = process.env.CURRENT_EVENT_SLUG ?? "circuito-gualaceo";
const NAME = process.env.CURRENT_EVENT_NAME ?? "Circuito Gualaceo";

type Row = { id: string; slug: string; name: string; token: string };

/**
 * Deja listo el evento en curso al arrancar el servidor, sin pasar por /nuevo:
 *
 *  - si ya existe con ese slug, no toca nada;
 *  - si no, reutiliza el último evento creado y solo le cambia enlace y nombre,
 *    así el token que ya está metido en la PWA del celular sigue valiendo;
 *  - si no hay ningún evento, lo crea.
 *
 * Imprime el token en los logs porque en producción no hay otra forma de
 * recuperarlo: es el que el operador escribe en la PWA.
 */
export function ensureCurrentEvent() {
  const db = getDb();

  let event = db.prepare("SELECT * FROM Event WHERE slug = ?").get(SLUG) as Row | undefined;
  let action = "listo";

  if (!event) {
    const latest = db
      .prepare("SELECT * FROM Event ORDER BY createdAt DESC, id DESC LIMIT 1")
      .get() as Row | undefined;

    if (latest) {
      db.prepare("UPDATE Event SET slug = ?, name = ? WHERE id = ?").run(SLUG, NAME, latest.id);
      action = `reutilizado (antes /g/${latest.slug})`;
      event = { ...latest, slug: SLUG, name: NAME };
    } else {
      event = { id: cuid(), slug: SLUG, name: NAME, token: randomBytes(9).toString("base64url") };
      db.prepare(
        "INSERT INTO Event (id, slug, name, token, brandName, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
      ).run(event.id, event.slug, event.name, event.token, "AdVibe");
      action = "creado";
    }
  }

  console.log(
    [
      "",
      `  evento ${action}: ${event.name}`,
      `  galería: ${PUBLIC_BASE_URL}/g/${event.slug}`,
      `  QR     : ${PUBLIC_BASE_URL}/api/events/${event.slug}/qr`,
      `  TOKEN  : ${event.token}`,
      "",
    ].join("\n"),
  );
}
