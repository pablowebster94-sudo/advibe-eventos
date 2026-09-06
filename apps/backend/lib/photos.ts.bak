import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { MEDIA_DIR } from "./paths";

export const MAX_BYTES = 25 * 1024 * 1024;

const ACCEPTED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function isAccepted(type: string) {
  return ACCEPTED.has(type.toLowerCase());
}

export type Processed = {
  filename: string;
  thumbFilename: string;
  width: number;
  height: number;
  bytes: number;
};

/**
 * Normaliza lo que salga de la galería del celular a un JPG de galería y una
 * miniatura. Imaging Edge Mobile entrega el JPG de cámara ya revelado, así que
 * aquí no se revela nada: se redimensiona, se aplica el sello de marca y se
 * recomprime.
 */
export async function processPhoto(
  input: Buffer,
  opts: { brandName?: string | null },
): Promise<Processed> {
  const base = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const filename = `${base}.jpg`;
  const thumbFilename = `${base}.thumb.jpg`;

  await mkdir(MEDIA_DIR, { recursive: true });

  // rotate() sin argumentos aplica la orientación EXIF y la descarta. Sin esto
  // las verticales del celular salen tumbadas en la galería.
  const pipeline = sharp(input, { failOn: "none" }).rotate();

  const full = await pipeline
    .clone()
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .composite(brandOverlay(opts.brandName))
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  // La miniatura sale de la imagen YA sellada, no del original: así la marca
  // se ve también en la parrilla de la galería, que es lo único que mira el
  // cliente, y de paso escala sola en vez de necesitar su propio tamaño de letra.
  const thumb = await sharp(full.data)
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();

  await writeFile(path.join(MEDIA_DIR, filename), full.data);
  await writeFile(path.join(MEDIA_DIR, thumbFilename), thumb);

  return {
    filename,
    thumbFilename,
    width: full.info.width,
    height: full.info.height,
    bytes: full.data.byteLength,
  };
}

/** Sello de marca discreto abajo a la derecha. Vacío si el evento no define marca. */
function brandOverlay(brandName?: string | null): sharp.OverlayOptions[] {
  if (!brandName) return [];

  const text = escapeXml(brandName);
  const width = Math.max(180, text.length * 15 + 48);
  const svg = `<svg width="${width}" height="64" xmlns="http://www.w3.org/2000/svg">
    <text x="${width - 24}" y="40" text-anchor="end"
          font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="600"
          fill="#ffffff" fill-opacity="0.92"
          style="paint-order:stroke;stroke:#000000;stroke-opacity:0.35;stroke-width:3px">${text}</text>
  </svg>`;

  return [
    {
      input: Buffer.from(svg),
      gravity: "southeast",
    },
  ];
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!,
  );
}
