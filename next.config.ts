import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'home.ciess.org' }] },

  // Dónde se deja lo compilado. El despliegue compila aparte y sólo cambia la
  // carpeta buena cuando la nueva salió entera: compilar encima de la que el
  // sitio está sirviendo lo tumba en cuanto algo falla a media compilación.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
