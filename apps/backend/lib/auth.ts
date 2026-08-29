import { prisma } from "./db";

/** El token del evento es el mismo credencial que iba a usar el bridge de portátil.
 *  Viaja como `Authorization: Bearer <token>`. Un token identifica un evento entero,
 *  no un dispositivo: varios celulares pueden subir al mismo evento con el mismo token. */
export async function eventFromRequest(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;

  const token = match[1].trim();
  if (!token) return null;

  return prisma.event.findUnique({ where: { token } });
}
