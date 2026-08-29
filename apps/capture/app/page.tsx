"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { backendUrl, setBackendUrl } from "@/lib/api";
import { useCapture } from "@/lib/useCapture";
import QrOverlay from "./QrOverlay";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Capture />
    </Suspense>
  );
}

function Capture() {
  const c = useCapture();
  const params = useSearchParams();
  const fileInput = useRef<HTMLInputElement>(null);
  const [showQr, setShowQr] = useState(false);

  // Registro del service worker: sin esto no hay Web Share Target.
  const [swState, setSwState] = useState<"pending" | "ok" | "unsupported" | "error">(
    "pending",
  );
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setSwState("unsupported");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => setSwState("ok"))
      .catch(() => setSwState("error"));
  }, []);

  // Android redirige aquí tras compartir; el worker ya encoló las fotos.
  useEffect(() => {
    const shared = params.get("shared");
    if (shared) {
      c.setNotice(`${shared} foto${shared === "1" ? "" : "s"} recibida${shared === "1" ? "" : "s"} de la galería`);
      void c.refresh();
      window.history.replaceState({}, "", "/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  if (!c.ready) {
    return <Shell><p style={{ color: "var(--muted)" }}>Cargando…</p></Shell>;
  }

  if (!c.token) return <Login onLogin={c.login} />;

  return (
    <Shell>
      <header style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontSize: ".78rem", color: "var(--muted)", letterSpacing: ".08em" }}>
          ADVIBE CAPTURE
        </div>
        <h1 style={{ fontSize: "1.35rem", margin: ".2rem 0 0" }}>
          {c.event?.name ?? "Evento"}
        </h1>
      </header>

      <Status
        online={c.online}
        pumping={c.pumping}
        pending={c.pending}
        failed={c.failed}
        swState={swState}
      />

      <div className="card" style={{ marginTop: "1rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", fontWeight: 700, lineHeight: 1 }}>
          {c.uploads.length}
        </div>
        <div style={{ color: "var(--muted)", marginTop: ".35rem" }}>
          fotos subidas desde este celular
        </div>
      </div>

      <Recent uploads={c.uploads.slice(0, 5)} />

      {c.failed > 0 && (
        <button className="btn" style={{ marginTop: ".75rem" }} onClick={c.retryAll}>
          Reintentar {c.failed} fallida{c.failed === 1 ? "" : "s"}
        </button>
      )}

      <div style={{ display: "grid", gap: ".6rem", marginTop: "1.25rem" }}>
        <button className="btn btn-primary" onClick={() => fileInput.current?.click()}>
          Añadir fotos de la galería
        </button>
        <button
          className="btn"
          disabled={!c.event}
          onClick={() => setShowQr(true)}
          title={c.event ? undefined : "Hace falta contacto con el servidor"}
        >
          {c.event ? "Mostrar QR del evento" : "QR no disponible sin conexión"}
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) await c.addFiles(files);
        }}
      />

      <button
        onClick={c.logout}
        style={{
          background: "none",
          border: "none",
          color: "var(--muted)",
          marginTop: "2rem",
          padding: 0,
          fontSize: ".85rem",
        }}
      >
        Salir del evento
      </button>

      {c.notice && <Toast text={c.notice} onDone={() => c.setNotice(null)} />}

      {showQr && c.event && (
        <QrOverlay
          qrUrl={c.event.qrUrl}
          galleryUrl={c.event.galleryUrl}
          onClose={() => setShowQr(false)}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        padding: "1.5rem 1.15rem 3rem",
        maxWidth: 520,
        margin: "0 auto",
        minHeight: "100dvh",
      }}
    >
      {children}
    </main>
  );
}

function Status({
  online,
  pumping,
  pending,
  failed,
  swState,
}: {
  online: boolean;
  pumping: boolean;
  pending: number;
  failed: number;
  swState: string;
}) {
  const color = !online ? "var(--warn)" : failed ? "var(--bad)" : "var(--ok)";
  const label = !online
    ? pending
      ? `Sin red · ${pending} en cola, se subirán solas`
      : "Sin red · nada pendiente"
    : pumping
      ? `Subiendo… ${pending} en cola`
      : pending
        ? `${pending} en cola`
        : "Conectado · todo subido";

  return (
    <div className="card" style={{ display: "grid", gap: ".5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".55rem" }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600 }}>{label}</span>
      </div>
      {failed > 0 && (
        <div style={{ color: "var(--bad)", fontSize: ".85rem" }}>
          {failed} no se pudo subir. Siguen guardadas, no se perdieron.
        </div>
      )}
      {swState === "error" && (
        <div style={{ color: "var(--warn)", fontSize: ".85rem" }}>
          El service worker no se registró: “compartir” desde la galería no
          funcionará. Requiere HTTPS o localhost.
        </div>
      )}
      {swState === "unsupported" && (
        <div style={{ color: "var(--warn)", fontSize: ".85rem" }}>
          Este navegador no soporta service workers. Usa el botón de añadir fotos.
        </div>
      )}
    </div>
  );
}

function Recent({ uploads }: { uploads: { id: string; thumbUrl: string }[] }) {
  if (!uploads.length) return null;
  return (
    <div style={{ marginTop: "1rem" }}>
      <div style={{ color: "var(--muted)", fontSize: ".8rem", marginBottom: ".5rem" }}>
        Últimas subidas
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: ".4rem" }}>
        {uploads.map((u) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={u.id}
            src={u.thumbUrl}
            alt=""
            style={{
              width: "100%",
              aspectRatio: "1",
              objectFit: "cover",
              borderRadius: 9,
              background: "var(--card)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [text, onDone]);

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "1.5rem",
        transform: "translateX(-50%)",
        background: "#22222a",
        border: "1px solid var(--line)",
        padding: ".7rem 1.1rem",
        borderRadius: 999,
        fontSize: ".9rem",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (t: string) => Promise<unknown> }) {
  const [token, setTokenValue] = useState("");
  const [server, setServer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setServer(backendUrl()), []);

  return (
    <Shell>
      <div style={{ marginTop: "12vh" }}>
        <div style={{ fontSize: ".78rem", color: "var(--muted)", letterSpacing: ".08em" }}>
          ADVIBE CAPTURE
        </div>
        <h1 style={{ fontSize: "1.5rem", margin: ".3rem 0 1.5rem" }}>
          Entra al evento
        </h1>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              if (server.trim()) setBackendUrl(server.trim());
              await onLogin(token.trim());
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          style={{ display: "grid", gap: ".7rem" }}
        >
          <input
            className="input"
            placeholder="Token del evento"
            value={token}
            onChange={(e) => setTokenValue(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <details>
            <summary style={{ color: "var(--muted)", fontSize: ".85rem", cursor: "pointer" }}>
              Servidor
            </summary>
            <input
              className="input"
              style={{ marginTop: ".5rem" }}
              placeholder="http://192.168.1.7:3300"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <p style={{ color: "var(--muted)", fontSize: ".78rem", lineHeight: 1.5 }}>
              Desde el celular, “localhost” es el propio celular. Pon aquí la IP
              del Mac en la red del evento.
            </p>
          </details>

          <button className="btn btn-primary" disabled={busy || !token.trim()}>
            {busy ? "Comprobando…" : "Entrar"}
          </button>
          {error && <p style={{ color: "var(--bad)", fontSize: ".88rem" }}>{error}</p>}
        </form>
      </div>
    </Shell>
  );
}
