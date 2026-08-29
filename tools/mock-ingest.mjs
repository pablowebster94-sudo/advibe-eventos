#!/usr/bin/env node
/**
 * Sube fotos al ingest sin necesidad de celular ni cámara.
 *
 * Hace el papel que hacía el bridge de portátil para las pruebas: habla el mismo
 * contrato que la PWA, así que sirve para verificar el backend por separado.
 *
 *   node tools/mock-ingest.mjs --token <TOKEN> [--file foto.jpg] [--count 3]
 *
 * Sin --file genera una imagen sintética, así que funciona en una máquina limpia.
 */
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const base = args.base ?? "http://localhost:3300";
const token = args.token;
const count = Number(args.count ?? 1);
const clientId = args.clientId ?? `mock-${randomUUID().slice(0, 8)}`;

if (!token) {
  console.error("falta --token <TOKEN del evento>");
  process.exit(1);
}

async function bodyFor(i) {
  if (args.file) return new Uint8Array(await readFile(args.file));
  const sharp = (await import("sharp")).default;
  const hue = (i * 47) % 360;
  return new Uint8Array(
    await sharp({
      create: {
        width: 1600,
        height: 1067,
        channels: 3,
        background: { r: 20, g: 20, b: 30 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="1600" height="1067" xmlns="http://www.w3.org/2000/svg">
               <rect width="1600" height="1067" fill="hsl(${hue},55%,32%)"/>
               <text x="800" y="560" text-anchor="middle" font-size="130"
                     font-family="Helvetica" fill="#fff">mock ${i + 1}</text>
             </svg>`,
          ),
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer(),
  );
}

for (let i = 0; i < count; i++) {
  const form = new FormData();
  form.set("photo", new Blob([await bodyFor(i)], { type: "image/jpeg" }), `mock-${i + 1}.jpg`);
  form.set("idempotencyKey", args.idem ?? randomUUID());
  form.set("clientId", clientId);
  form.set("capturedAt", new Date().toISOString());

  const res = await fetch(`${base}/api/ingest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  console.log(res.status, JSON.stringify(json));
}
