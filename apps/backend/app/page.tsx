export default function Home() {
  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: ".5rem" }}>
        AdVibe Eventos — backend
      </h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
        La galería pública de cada evento vive en <code>/g/&lt;slug&gt;</code>. La
        PWA de captura corre aparte, en el puerto 3301.
      </p>
      <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
        Para montar un evento nuevo —y obtener su token y su QR— entra en{" "}
        <a href="/nuevo" style={{ color: "#7cc4ff" }}>
          /nuevo
        </a>
        .
      </p>
    </main>
  );
}
