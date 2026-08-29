import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdVibe Eventos",
  description: "Galería en vivo del evento",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
