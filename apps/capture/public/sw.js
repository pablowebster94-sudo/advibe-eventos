/* Service worker de AdVibe Capture.
 *
 * Su único trabajo serio es el Web Share Target: cuando el usuario comparte
 * fotos desde la galería de Android, Android hace un POST multipart a /share.
 * Ese POST no lo puede atender el servidor (la app puede estar sin red), así
 * que lo intercepta este worker, guarda los archivos en IndexedDB y redirige a
 * la pantalla principal, que se encarga de subirlos cuando haya red.
 *
 * La lógica de IndexedDB está duplicada aquí a propósito: un worker clásico no
 * comparte módulos con el bundle de Next, y meter un build aparte solo para
 * estas 30 líneas costaba más de lo que ahorraba. Si cambia el esquema, hay que
 * tocar este archivo y lib/queue.ts a la vez.
 */

const DB_NAME = "advibe-capture";
const DB_VERSION = 1;
const STORE_QUEUE = "queue";
const STORE_UPLOADS = "uploads";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const s = db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
        s.createIndex("status", "status");
      }
      if (!db.objectStoreNames.contains(STORE_UPLOADS)) {
        db.createObjectStore(STORE_UPLOADS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function addToQueue(db, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    tx.objectStore(STORE_QUEUE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === "POST" && url.pathname === "/share") {
    event.respondWith(handleShare(event.request));
    return;
  }
  // Todo lo demás va a la red tal cual. Esta PWA no cachea la app todavía:
  // lo que no se puede perder son las fotos, y esas viven en IndexedDB.
});

async function handleShare(request) {
  let queued = 0;

  try {
    const form = await request.formData();
    const files = form.getAll("photos").filter((f) => f && typeof f === "object" && "size" in f);
    const db = await openDb();

    for (const file of files) {
      if (!file.size) continue;
      await addToQueue(db, {
        // El id es también la idempotencyKey del ingest: se fija al ENCOLAR,
        // así que todos los reintentos de esta foto comparten clave y el
        // backend los deduplica en vez de crear copias.
        id: crypto.randomUUID(),
        blob: file,
        name: file.name || "shared.jpg",
        type: file.type || "image/jpeg",
        capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: Date.now(),
      });
      queued++;
    }

    // Despierta a la pantalla si ya estaba abierta, para que empiece a subir.
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type: "shared", queued });
  } catch (err) {
    return Response.redirect(`/?shareError=${encodeURIComponent(String(err))}`, 303);
  }

  return Response.redirect(`/?shared=${queued}`, 303);
}
