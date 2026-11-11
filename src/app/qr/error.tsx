'use client';

import { useEffect } from 'react';

/**
 * Si la pantalla de recepción se rompe en el navegador —un archivo que ya no existe tras un despliegue, un error
 * inesperado—, no se queda en una página de error frente al público: dice «Reconectando…» y, en cuanto el servidor
 * contesta, se recarga sola.
 *
 * No recarga a ciegas: si el servidor estuviera caído, el navegador cambiaría esta página por la suya de «no se puede
 * conectar», que no se recupera sola. Primero pregunta; esta página, que ya está cargada, sigue viva mientras tanto.
 */
export default function ErrorDeRecepcion() {
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const respuesta = await fetch('/qr', { method: 'HEAD', cache: 'no-store' });
        if (respuesta.ok) window.location.reload();
      } catch {
        /* sin red: se vuelve a intentar */
      }
    }, 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <main
      style={{
        minHeight: '100dvh', display: 'grid', placeItems: 'center', textAlign: 'center', color: '#fff',
        background: 'linear-gradient(180deg, #0b2570, #001b57)', fontFamily: "'Work Sans', system-ui, sans-serif",
      }}
    >
      <p style={{ fontSize: 'min(5vw, 2.8vh)', fontWeight: 600 }}>Reconectando… · Reconnecting… · Reconectando…</p>
    </main>
  );
}
