"use client";

import { useEffect, useState } from "react";

/** QR del evento a pantalla completa, para enseñárselo al cliente en la mano.
 *  Es el mismo QR toda la noche: apunta a la galería del evento, no a una foto. */
export default function QrOverlay({
  qrUrl,
  galleryUrl,
  onClose,
}: {
  qrUrl: string;
  galleryUrl: string;
  onClose: () => void;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(qrUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => !cancelled && setSvg(text))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

  // El QR se enseña con el brazo estirado: la pantalla no debe apagarse ni
  // atenuarse a media conversación. Wake Lock no está en todos lados; si no
  // existe, simplemente no se pide.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> };
    };
    nav.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="QR del evento"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        padding: "1.5rem",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: "min(78vw, 78vh)",
          aspectRatio: "1",
          display: "grid",
          placeItems: "center",
        }}
      >
        {svg ? (
          <div
            style={{ width: "100%", height: "100%" }}
            // El SVG viene de nuestro propio backend, generado por qrcode.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : failed ? (
          <p style={{ color: "#b00", textAlign: "center" }}>
            No se pudo cargar el QR. ¿Hay conexión con el servidor?
          </p>
        ) : (
          <p style={{ color: "#888" }}>Generando…</p>
        )}
      </div>

      <p
        style={{
          color: "#111",
          fontSize: "1rem",
          textAlign: "center",
          margin: 0,
          wordBreak: "break-all",
        }}
      >
        {galleryUrl}
      </p>
      <p style={{ color: "#888", fontSize: ".85rem", margin: 0 }}>
        Toca para cerrar
      </p>
    </div>
  );
}
