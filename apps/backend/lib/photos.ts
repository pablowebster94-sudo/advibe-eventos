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
  opts: { brandName?: string | null },
): Promise<Processed> {
  const base = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const filename = `${base}.jpg`;
  const thumbFilename = `${base}.thumb.jpg`;

  await mkdir(MEDIA_DIR, { recursive: true });

  // rotate() sin argumentos aplica la orientación EXIF y la descarta. Sin esto
  // las verticales del celular salen tumbadas en la galería.
  const pipeline = await autoEdit(sharp(input, { failOn: "none" }).rotate());

  const resized = await pipeline
    .clone()
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  const full = await sharp(resized.data)
    .composite(await brandOverlay(opts.brandName, resized.info.width))
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

/** Sello de marca: usa el logo PNG del evento si existe, si no cae al texto. */
async function brandOverlay(
  brandName: string | null | undefined,
  photoWidth: number,
): Promise<sharp.OverlayOptions[]> {
  // El logo ocupa ~28% del ancho de la foto, abajo a la derecha.
  const logoPath = path.join(process.cwd(), "brand", "logo-opt.png");
  try {
    const raw = await readFile(logoPath);
    const target = Math.round(photoWidth * 0.28);
    const logo = await sharp(raw)
      .resize({ width: target })
      .composite([{
        input: Buffer.from([255, 255, 255, Math.round(255 * 0.9)]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: "dest-in",
      }])
      .png()
      .toBuffer();

    return [{ input: logo, gravity: "southeast" }];
  } catch {
    // Sin logo: sello de texto como antes.
    if (!brandName) return [];
    const text = escapeXml(brandName);
    const width = Math.max(180, text.length * 15 + 48);
    const svg = `<svg width="${width}" height="64" xmlns="http://www.w3.org/2000/svg">
      <text x="${width - 24}" y="40" text-anchor="end"
            font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="600"
            fill="#ffffff" fill-opacity="0.92"
            style="paint-order:stroke;stroke:#000000;stroke-opacity:0.35;stroke-width:3px">${text}</text>
    </svg>`;
    return [{ input: Buffer.from(svg), gravity: "southeast" }];
  }
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!,
  );
}
