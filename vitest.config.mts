import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['pruebas/**/*.prueba.ts'],
    // La prueba de integración contra PostgreSQL no es una prueba unitaria:
    // necesita una base y se ejecuta aparte con `npm run prueba-bd`.
    exclude: ['pruebas/integracion/**'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Las pruebas cubren módulos de servidor; `server-only` sólo sirve para
      // impedir que acaben en el navegador, así que aquí sobra.
      'server-only': fileURLToPath(new URL('./pruebas/sin-server-only.ts', import.meta.url)),
    },
  },
});
