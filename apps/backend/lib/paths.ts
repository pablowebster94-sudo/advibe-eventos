import path from "node:path";

/** Carpeta donde viven los JPG procesados. Fuera de public/ a propósito:
 *  se sirven por route handler, no como estáticos del build. */
export const MEDIA_DIR = path.resolve(
  process.cwd(),
  process.env.DATA_DIR ?? "../../data/media",
);

export const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ?? "http://localhost:3300";
