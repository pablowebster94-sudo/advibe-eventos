"use client";

import { useState } from "react";
import { slugify } from "@/lib/slug";

type Created = {
  slug: string;
  name: string;
  brandName: string | null;
  token: string;
  galleryUrl: string;
  qrUrl: string;
};

const ERRORS: Record<string, string> = {
  admin_not_configured:
    "El servidor no tiene ADMIN_TOKEN configurado, así que la creación de eventos está cerrada.",
  invalid_admin_token: "Clave de administración incorrecta.",
  malformed_json: "El servidor no pudo leer la petición.",
  missing_field: "Falta el nombre del evento.",
  invalid_slug:
    "Ese enlace no es válido: usa minúsculas, números y guiones (mínimo 2 caracteres).",
  slug_taken: "Ya existe un evento con ese enlace. Elige otro.",
};

export default function NuevoEventoPage() {
  const [adminToken, setAdminToken] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [brandName, setBrandName] = useState("AdVibe");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  // Lo que va a quedar en el QR, antes de enviar nada.
  const previewSlug = slugify(slug || name);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken.trim()}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          brandName: brandName.trim() || undefined,
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok || !body?.ok) {
        setError(ERRORS[body?.error] ?? `No se pudo crear el evento (${response.status}).`);
        return;
      }

      setCreated(body.event as Created);
      setName("");
      setSlug("");
    } catch {
      setError("No se pudo contactar con el servidor.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Shell>
        <p style={label}>EVENTO CREADO</p>
        <h1 style={{ fontSize: "1.6rem", margin: ".3rem 0 1.5rem" }}>{created.name}</h1>

        <section style={card}>
          <p style={label}>TOKEN PARA LA PWA DE CAPTURA</p>
          <p
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "1.5rem",
              letterSpacing: ".04em",
              margin: ".4rem 0 .75rem",
              wordBreak: "break-all",
            }}
          >
            {created.token}
          </p>
          <button
            type="button"
            style={button}
            onClick={() => navigator.clipboard?.writeText(created.token)}
          >
            Copiar token
          </button>
          <p style={{ ...hint, marginBottom: 0 }}>
            Se muestra una sola vez. Anótalo antes de cerrar esta pantalla: es el
            credencial que el operador escribe en la PWA para subir fotos.
          </p>
        </section>

        <section style={card}>
          <p style={label}>GALERÍA PÚBLICA</p>
          <p style={{ margin: ".4rem 0 .9rem" }}>
            <a href={`/g/${created.slug}`} style={{ color: "#7cc4ff" }}>
              /g/{created.slug}
            </a>
          </p>
          {/* El endpoint del QR devuelve SVG: escala sin pixelarse al proyectarlo. */}
          <img
            src={`/api/events/${created.slug}/qr`}
            alt={`QR de la galería de ${created.name}`}
            width={200}
            height={200}
            style={{ background: "#fff", padding: ".5rem", borderRadius: ".5rem" }}
          />
        </section>

        <button type="button" style={button} onClick={() => setCreated(null)}>
          Crear otro evento
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <p style={label}>ADVIBE EVENTOS</p>
      <h1 style={{ fontSize: "1.6rem", margin: ".3rem 0 1.5rem" }}>Nuevo evento</h1>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1.1rem" }}>
        <label style={{ display: "grid", gap: ".35rem" }}>
          <span style={label}>CLAVE DE ADMINISTRACIÓN</span>
          <input
            type="password"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            placeholder="ADMIN_TOKEN"
            autoComplete="off"
            spellCheck={false}
            style={input}
          />
        </label>

        <label style={{ display: "grid", gap: ".35rem" }}>
          <span style={label}>NOMBRE DEL EVENTO</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Boda Ana y Luis"
            style={input}
          />
        </label>

        <label style={{ display: "grid", gap: ".35rem" }}>
          <span style={label}>ENLACE DE LA GALERÍA (OPCIONAL)</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={previewSlug || "boda-ana-luis"}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            style={input}
          />
          <span style={hint}>
            {previewSlug
              ? `La galería quedará en /g/${previewSlug}`
              : "Si lo dejas vacío se genera a partir del nombre."}
          </span>
        </label>

        <label style={{ display: "grid", gap: ".35rem" }}>
          <span style={label}>MARCA EN LAS FOTOS (OPCIONAL)</span>
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="AdVibe"
            style={input}
          />
        </label>

        <button
          type="submit"
          disabled={busy || !adminToken.trim() || !name.trim()}
          style={{
            ...button,
            background: busy ? "#26262b" : "#f4f4f5",
            color: busy ? "var(--muted)" : "#0b0b0d",
            fontWeight: 600,
          }}
        >
          {busy ? "Creando…" : "Crear evento"}
        </button>

        {error && <p style={{ color: "#ff8686", fontSize: ".9rem", margin: 0 }}>{error}</p>}
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: 520, margin: "0 auto" }}>
      {children}
    </main>
  );
}

const label: React.CSSProperties = {
  fontSize: ".72rem",
  letterSpacing: ".08em",
  color: "var(--muted)",
  margin: 0,
};

const hint: React.CSSProperties = {
  fontSize: ".8rem",
  color: "var(--muted)",
  lineHeight: 1.5,
  marginTop: ".6rem",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: ".7rem .8rem",
  borderRadius: ".6rem",
  border: "1px solid var(--line)",
  background: "#131317",
  color: "var(--fg)",
  fontSize: "1rem",
};

const card: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: ".8rem",
  padding: "1.1rem",
  marginBottom: "1.1rem",
};

const button: React.CSSProperties = {
  padding: ".7rem 1rem",
  borderRadius: ".6rem",
  border: "1px solid var(--line)",
  background: "#131317",
  color: "var(--fg)",
  fontSize: ".95rem",
  cursor: "pointer",
};
