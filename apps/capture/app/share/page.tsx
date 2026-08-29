export const dynamic = "force-static";

export default function SharePage() {
  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.2rem" }}>Recibiendo fotos…</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
        Si te quedaste en esta pantalla, el service worker todavía no estaba
        activo cuando compartiste. Abre la app una vez y vuelve a compartir.
      </p>
      <a href="/" style={{ color: "var(--accent)" }}>
        Ir a AdVibe Capture
      </a>
    </main>
  );
}
