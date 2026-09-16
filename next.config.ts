import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite mover el directorio de build cuando `.next` no es escribible.
  // Sin la variable definida se comporta exactamente igual que antes.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
