import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp es binario nativo: no debe pasar por el bundler del server.
  serverExternalPackages: ["sharp", "@prisma/client"],
};

export default nextConfig;
