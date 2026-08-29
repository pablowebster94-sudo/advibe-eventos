"use client";

import { useEffect, useState } from "react";

type Photo = {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  createdAt: string;
};

export default function LiveGallery({
  slug,
  name,
  initial,
}: {
  slug: string;
  name: string;
  qrUrl: string;
  initial: Photo[];
}) {
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const source = new EventSource(`/api/events/${slug}/stream`);

    source.addEventListener("ready", () => setLive(true));
    source.addEventListener("photo", (e) => {
      const photo = JSON.parse((e as MessageEvent).data) as Photo;
      // El ingest deduplica, pero el SSE puede reenviar tras un reconnect.
      setPhotos((prev) =>
        prev.some((p) => p.id === photo.id) ? prev : [photo, ...prev],
      );
    });
    source.onerror = () => setLive(false);

    return () => source.close();
  }, [slug]);

  return (
    <main style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>{name}</h1>
        <span style={{ fontSize: ".8rem", color: "var(--muted)" }}>
          {live ? "● en vivo" : "○ reconectando"} · {photos.length} fotos
        </span>
      </header>

      {photos.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          Todavía no hay fotos. Aparecerán aquí solas, sin recargar.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: ".6rem",
          }}
        >
          {photos.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.thumbUrl}
                alt=""
                loading="lazy"
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  objectFit: "cover",
                  borderRadius: 10,
                  display: "block",
                  background: "#17171b",
                }}
              />
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
