"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearSession,
  fetchSession,
  getToken,
  setToken as persistToken,
  uploadItem,
  type EventInfo,
} from "./api";
import {
  bumpAttempt,
  enqueueFiles,
  listQueue,
  listUploads,
  markFailed,
  recordUpload,
  removeFromQueue,
  retryFailed,
  type QueueItem,
  type UploadRecord,
} from "./queue";

const MAX_ATTEMPTS = 8;

/** Espera creciente entre reintentos, con techo de 30 s: en un evento el Wi-Fi
 *  vuelve en segundos o en minutos, y no queremos quemar batería reintentando. */
function backoffMs(attempts: number) {
  return Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useCapture() {
  const [token, setToken] = useState<string | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [online, setOnline] = useState(true);
  const [pumping, setPumping] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const pumpingRef = useRef(false);
  const tokenRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const [q, u] = await Promise.all([listQueue(), listUploads()]);
    setQueue(q);
    setUploads(u);
  }, []);

  /** Vacía la cola de a una foto. Es deliberadamente secuencial: subir en
   *  paralelo desde un celular con Wi-Fi malo empeora las cosas. */
  const pump = useCallback(async () => {
    if (pumpingRef.current) return;
    const activeToken = tokenRef.current;
    if (!activeToken) return;

    pumpingRef.current = true;
    setPumping(true);

    try {
      for (;;) {
        if (typeof navigator !== "undefined" && !navigator.onLine) break;

        const pending = (await listQueue())
          .filter((i) => i.status === "pending" && i.attempts < MAX_ATTEMPTS)
          .sort((a, b) => a.createdAt - b.createdAt);

        if (!pending.length) break;
        const item = pending[0];

        try {
          const result = await uploadItem(item, activeToken);
          await recordUpload({
            id: item.id,
            photoId: result.photoId,
            url: result.url,
            thumbUrl: result.thumbUrl,
            uploadedAt: Date.now(),
          });
          // Solo aquí se borra el Blob: ya está confirmado en el servidor.
          await removeFromQueue(item.id);
        } catch (err) {
          const e = err as Error & { permanent?: boolean };
          if (e.permanent) {
            await markFailed(item, e.message);
          } else {
            const next = await bumpAttempt(item, e.message);
            await refresh();
            if (next.attempts >= MAX_ATTEMPTS) break;
            await sleep(backoffMs(next.attempts));
            continue;
          }
        }

        await refresh();
      }
    } finally {
      pumpingRef.current = false;
      setPumping(false);
      await refresh();
    }
  }, [refresh]);

  /** Revalida la sesión contra el backend. Si la app arrancó sin red, `event`
   *  queda vacío y con él se cae el QR; hay que reintentarlo cuando vuelva la
   *  conexión, no solo una vez al arrancar. */
  const refreshSession = useCallback(async () => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;
    try {
      setEvent(await fetchSession(activeToken));
    } catch {
      // Sigue sin red: se reintenta en el siguiente ciclo.
    }
  }, []);

  const login = useCallback(
    async (candidate: string) => {
      const info = await fetchSession(candidate);
      persistToken(candidate);
      tokenRef.current = candidate;
      setToken(candidate);
      setEvent(info);
      void pump();
      return info;
    },
    [pump],
  );

  const logout = useCallback(() => {
    clearSession();
    tokenRef.current = null;
    setToken(null);
    setEvent(null);
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      const n = await enqueueFiles(files);
      await refresh();
      if (n) setNotice(`${n} foto${n === 1 ? "" : "s"} en cola`);
      void pump();
      return n;
    },
    [pump, refresh],
  );

  const retryAll = useCallback(async () => {
    await retryFailed();
    await refresh();
    void pump();
  }, [pump, refresh]);

  // Arranque: recupera sesión, escucha red y al service worker.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setOnline(navigator.onLine);
      await refresh();

      const saved = getToken();
      if (saved) {
        tokenRef.current = saved;
        setToken(saved);
        try {
          const info = await fetchSession(saved);
          if (!cancelled) setEvent(info);
        } catch {
          // Sin red no se puede validar, pero la cola sigue siendo válida:
          // se mantiene la sesión y se reintenta al reconectar.
        }
      }
      if (!cancelled) setReady(true);
      void pump();
    })();

    const goOnline = () => {
      setOnline(true);
      void refreshSession();
      void pump();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // El worker avisa cuando Android compartió fotos mientras la app estaba abierta.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "shared") {
        setNotice(`${e.data.queued} foto${e.data.queued === 1 ? "" : "s"} recibida${e.data.queued === 1 ? "" : "s"}`);
        void refresh().then(() => pump());
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    // Red intermitente: además de los eventos del navegador, que mienten con
    // cierta frecuencia en móvil, se reintenta en segundo plano cada 15 s.
    const timer = setInterval(() => {
      if (!navigator.onLine) return;
      void pump();
      // Sin esto, un arranque sin red deja la pantalla sin nombre de evento y
      // sin QR para el resto de la noche.
      setEvent((current) => {
        if (!current) void refreshSession();
        return current;
      });
    }, 15_000);

    return () => {
      cancelled = true;
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      clearInterval(timer);
    };
  }, [pump, refresh, refreshSession]);

  const pending = queue.filter((i) => i.status === "pending").length;
  const failed = queue.filter((i) => i.status === "failed").length;

  return {
    ready,
    token,
    event,
    online,
    pumping,
    queue,
    uploads,
    pending,
    failed,
    notice,
    setNotice,
    login,
    logout,
    addFiles,
    retryAll,
    refresh,
    refreshSession,
  };
}
