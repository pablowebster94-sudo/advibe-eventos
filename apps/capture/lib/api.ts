/** Cliente del backend. Habla el contrato de ingest v1 y no lo cambia. */

import type { QueueItem } from "./queue";

const FALLBACK =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3300";

/** El servidor es configurable en caliente porque desde el celular "localhost"
 *  no existe: hay que apuntar a la IP LAN del Mac o al túnel. Guardarlo en el
 *  navegador evita tener que reconstruir la app para cada prueba. */
export function backendUrl(): string {
  if (typeof window === "undefined") return FALLBACK;
  return localStorage.getItem("advibe.backend") || FALLBACK;
}

export function setBackendUrl(url: string) {
  localStorage.setItem("advibe.backend", url.replace(/\/+$/, ""));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("advibe.token");
}

export function setToken(token: string) {
  localStorage.setItem("advibe.token", token);
}

export function clearSession() {
  localStorage.removeItem("advibe.token");
}

/** Identifica este celular. Sobrevive a recargas; no identifica a la persona. */
export function clientId(): string {
  let id = localStorage.getItem("advibe.clientId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("advibe.clientId", id);
  }
  return id;
}

export type EventInfo = {
  slug: string;
  name: string;
  brandName: string | null;
  galleryUrl: string;
  qrUrl: string;
  uploaded: number;
};

export async function fetchSession(token: string): Promise<EventInfo> {
  const res = await fetch(`${backendUrl()}/api/session`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) throw new Error("Token no válido para ningún evento.");
  if (!res.ok) throw new Error(`El servidor respondió ${res.status}.`);

  const json = await res.json();
  return json.event as EventInfo;
}

export type UploadResult = {
  photoId: string;
  url: string;
  thumbUrl: string;
  duplicate: boolean;
};

/** Sube un elemento de la cola. Lanza si hay que reintentar; los errores
 *  definitivos (token malo, archivo inaceptable) se marcan como permanentes. */
export async function uploadItem(
  item: QueueItem,
  token: string,
): Promise<UploadResult> {
  const form = new FormData();
  form.set("photo", item.blob, item.name);
  form.set("idempotencyKey", item.id);
  form.set("clientId", clientId());
  form.set("capturedAt", item.capturedAt);

  const res = await fetch(`${backendUrl()}/api/ingest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(json?.error ?? `http_${res.status}`) as Error & {
      permanent?: boolean;
    };
    // 4xx que no van a mejorar reintentando: no tiene sentido gastar batería.
    err.permanent = [400, 401, 413, 415, 422].includes(res.status);
    throw err;
  }

  return {
    photoId: json.photo.id,
    url: `${backendUrl()}${json.photo.url}`,
    thumbUrl: `${backendUrl()}${json.photo.thumbUrl}`,
    duplicate: Boolean(json.duplicate),
  };
}
