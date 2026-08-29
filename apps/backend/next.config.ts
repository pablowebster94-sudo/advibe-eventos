import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp y better-sqlite3 son binarios nativos: no deben pasar por el bundler del server.
  serverExternalPackages: ["sharp", "better-sqlite3"],
};

export default nextConfig;
