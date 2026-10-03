#!/usr/bin/env node
/**
 * Descarga todas las fotos de un evento a una carpeta local.
 *
 * Pensado para sacar las fotos del servidor antes de apagarlo: usa solo el
 * listado público de la galería, así que no hace falta ningún token.
 *
 *   node tools/descargar-fotos.mjs --base https://TU-BACKEND.up.railway.app \
 *     [--slug circuito-gualaceo] [--out fotos-circuito-gualaceo]
 *
 * Se puede relanzar: las fotos que ya están en la carpeta no se vuelven a bajar.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const base = (args.base ?? "http://localhost:3300").replace(/\/+$/, "");
const slug = args.slug ?? "circuito-gualaceo";
const out = args.out ?? `fotos-${slug}`;
const PAGE = 500;

await mkdir(out, { recursive: true });

const photos = [];
for (let offset = 0; ; offset += PAGE) {
  const res = await fetch(`${base}/api/events/${slug}/photos?limit=${PAGE}&offset=${offset}`);
  if (!res.ok) {
    console.error(`no se pudo leer la galería /g/${slug}: HTTP ${res.status}`);
    process.exit(1);
  }
  const page = (await res.json()).photos;
  photos.push(...page);
  if (page.length < PAGE) break;
}

console.log(`${photos.length} fotos en /g/${slug} → ${out}/`);

let done = 0;
let failed = 0;
for (const photo of photos) {
  const file = path.join(out, path.basename(photo.url));
  if (await stat(file).catch(() => null)) {
    done++;
    continue;
  }
  try {
    const res = await fetch(base + photo.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    done++;
  } catch (error) {
    failed++;
    console.error(`  falló ${photo.url}: ${error.message}`);
  }
  process.stdout.write(`\r  ${done}/${photos.length}`);
}

console.log(failed ? `\n${failed} fallaron: vuelve a lanzarlo para reintentarlas.` : "\nlisto.");
process.exitCode = failed ? 1 : 0;
