import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  opts: { brandName?: string | null; eventSlug?: string | null },
): Promise<Processed> {
  const base = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const filename = `${base}.jpg`;
  const thumbFilename = `${base}.thumb.jpg`;

  await mkdir(MEDIA_DIR, { recursive: true });

  // rotate() sin argumentos aplica la orientación EXIF y la descarta. Sin esto
  // las verticales del celular salen tumbadas en la galería.
  let pipeline = await autoEdit(sharp(input, { failOn: "none" }).rotate());

  if (opts.eventSlug === "ruta-iglesias") {
    try {
      const logo = await readFile(
        path.join(process.cwd(), "apps/backend/public/ruta-iglesias-logo.webp"),
      );
      const meta = await pipeline.metadata();
      const width = meta.width ?? 2048;
      const logoWidth = Math.max(300, Math.min(520, Math.round(width * 0.22)));
      const logoBuffer = await sharp(logo)
        .resize({ width: logoWidth, withoutEnlargement: true })
        .toBuffer();
      pipeline = pipeline.composite([
        { input: logoBuffer, gravity: "southeast" },
      ]);
    } catch (error) {
      console.error("Ruta de las Iglesias logo error:", error);
    }
  }

  const resized = await pipeline
    .clone()
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  const full = await sharp(resized.data)
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

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


/**
 * Auto-edicion adaptativa: analiza la foto y corrige exposicion, balance y
 * contraste segun lo que necesite. Pensado para eventos con luz irregular.
 */
async function autoEdit(img: sharp.Sharp): Promise<sharp.Sharp> {
  const stats = await img.clone().stats();

  // Luminancia media aproximada (0-255) ponderando los canales RGB
  const [r, g, b] = stats.channels;
  const luma = 0.299 * r.mean + 0.587 * g.mean + 0.114 * b.mean;

  // Brillo: sube las oscuras, baja las quemadas. Objetivo ~118.
  let brightness = 1.0;
  if (luma < 100) brightness = Math.min(1.35, 118 / Math.max(luma, 40));
  else if (luma > 165) brightness = Math.max(0.85, 150 / luma);

  // Saturacion: si la foto ya viene saturada no la empujamos mas.
  const spread = Math.max(r.mean, g.mean, b.mean) - Math.min(r.mean, g.mean, b.mean);
  const saturation = spread > 28 ? 1.0 : 1.12;

  // Sin normalise(): estira cada canal por separado y mete tinte de color.
  let out = img.modulate({ brightness, saturation });

  // Curva de contraste suave en S, y nitidez ligera para compensar el resize.
  out = out
    .linear(1.06, -8)
    .sharpen({ sigma: 0.6, m1: 0.5, m2: 0.7 });

  return out;
}

