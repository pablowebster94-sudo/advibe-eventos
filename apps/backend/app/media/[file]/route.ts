import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { MEDIA_DIR } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sirve los JPG procesados desde DATA_DIR. No usamos public/ porque esos
 *  archivos se escriben en caliente durante el evento, no en el build. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  // El nombre viene de la URL: hay que impedir que se salga de MEDIA_DIR.
  const safe = path.basename(file);
  if (safe !== file || !/^[\w.-]+\.jpg$/i.test(safe)) {
    return new Response("bad request", { status: 400 });
  }

  const full = path.join(MEDIA_DIR, safe);
  try {
    const info = await stat(full);
    if (!info.isFile()) return new Response("not found", { status: 404 });

    const stream = Readable.toWeb(
      createReadStream(full),
    ) as unknown as ReadableStream;

    return new Response(stream, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
