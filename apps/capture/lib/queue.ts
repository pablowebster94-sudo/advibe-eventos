/** Cola de subida en IndexedDB.
 *
 *  El Wi-Fi de un evento se cae. La regla es que una foto que entró en la cola
 *  no se pierde: se guarda el Blob completo en disco del navegador y solo se
 *  borra cuando el backend confirmó que la tiene.
 *
 *  El esquema está duplicado en public/sw.js (ver la nota de ese archivo).
 */

const DB_NAME = "advibe-capture";
const DB_VERSION = 1;
const STORE_QUEUE = "queue";
const STORE_UPLOADS = "uploads";

export type QueueItem = {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  capturedAt: string;
  status: "pending" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: number;
};

export type UploadRecord = {
  id: string;
  photoId: string;
  thumbUrl: string;
  url: string;
  uploadedAt: number;
};

function openDb(): Promise<IDBDatabase> {
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

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

/** Encola archivos elegidos a mano (el selector de la pantalla principal).
 *  El camino de Web Share Target encola desde el service worker. */
export async function enqueueFiles(files: File[]): Promise<number> {
  let n = 0;
  for (const file of files) {
    if (!file.size) continue;
    const item: QueueItem = {
      id: crypto.randomUUID(),
      blob: file,
      name: file.name || "foto.jpg",
      type: file.type || "image/jpeg",
      capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
      status: "pending",
      attempts: 0,
      lastError: null,
      createdAt: Date.now(),
    };
    await tx(STORE_QUEUE, "readwrite", (s) => s.put(item));
    n++;
  }
  return n;
}

export function listQueue(): Promise<QueueItem[]> {
  return tx<QueueItem[]>(STORE_QUEUE, "readonly", (s) => s.getAll()).then((all) =>
    all.sort((a, b) => a.createdAt - b.createdAt),
  );
}

export function removeFromQueue(id: string) {
  return tx(STORE_QUEUE, "readwrite", (s) => s.delete(id));
}

/** Fallo transitorio (red caída, 5xx): sigue pendiente, solo cuenta el intento. */
export async function bumpAttempt(item: QueueItem, error: string) {
  const next: QueueItem = {
    ...item,
    status: "pending",
    attempts: item.attempts + 1,
    lastError: error,
  };
  await tx(STORE_QUEUE, "readwrite", (s) => s.put(next));
  return next;
}

/** Fallo definitivo (token malo, archivo rechazado): deja de reintentar solo.
 *  No se borra: la foto sigue guardada y el operador puede reintentarla. */
export async function markFailed(item: QueueItem, error: string) {
  const next: QueueItem = {
    ...item,
    status: "failed",
    attempts: item.attempts + 1,
    lastError: error,
  };
  await tx(STORE_QUEUE, "readwrite", (s) => s.put(next));
  return next;
}

/** Vuelve a marcar como pendiente lo que falló, para reintentar a mano. */
export async function retryFailed() {
  const all = await listQueue();
  for (const item of all.filter((i) => i.status === "failed")) {
    await tx(STORE_QUEUE, "readwrite", (s) =>
      s.put({ ...item, status: "pending", lastError: null }),
    );
  }
}

export function recordUpload(rec: UploadRecord) {
  return tx(STORE_UPLOADS, "readwrite", (s) => s.put(rec));
}

export function listUploads(): Promise<UploadRecord[]> {
  return tx<UploadRecord[]>(STORE_UPLOADS, "readonly", (s) => s.getAll()).then(
    (all) => all.sort((a, b) => b.uploadedAt - a.uploadedAt),
  );
}
