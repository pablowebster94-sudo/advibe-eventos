import { EventEmitter } from "node:events";

export type PhotoEvent = {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  createdAt: string;
};

/** Bus en memoria que conecta el ingest con las galerías abiertas por SSE.
 *  Es de un solo proceso: si algún día esto corre en varias instancias hay que
 *  cambiarlo por Redis pub/sub. Para un evento con un backend, sobra. */
const globalForBus = globalThis as unknown as { photoBus?: EventEmitter };

export const photoBus = globalForBus.photoBus ?? new EventEmitter();
photoBus.setMaxListeners(0); // una galería abierta = un listener; no hay techo útil

if (process.env.NODE_ENV !== "production") globalForBus.photoBus = photoBus;

export function publishPhoto(eventId: string, photo: PhotoEvent) {
  photoBus.emit(`event:${eventId}`, photo);
}
