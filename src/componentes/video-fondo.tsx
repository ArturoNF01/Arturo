'use client';

import { useEffect, useState } from 'react';

/**
 * Video institucional del congreso como fondo, al 15 % de opacidad.
 *
 * Sobre el video va un velo ligero tomado del color de fondo del tema: da
 * margen de contraste al texto que no vive dentro de una tarjeta —títulos,
 * ayudas— sin llegar a ocultar el video. El login usa un viñeteado más
 * cerrado porque ahí el video es el protagonista y el formulario de acceso
 * necesita destacar sobre él.
 *
 * Quien haya pedido menos movimiento en su sistema no recibe el video: se
 * queda el velo, que ya da el fondo. Por eso el elemento sólo se monta después
 * de comprobar la preferencia, y nunca se descarga el archivo en ese caso.
 */
/** Tipo MIME a partir de la extensión, para no atarse al mp4. */
function tipoDeVideo(url: string): string {
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'webm') return 'video/webm';
  if (extension === 'ogv' || extension === 'ogg') return 'video/ogg';
  if (extension === 'mov') return 'video/quicktime';
  return 'video/mp4';
}

export function VideoFondo({
  url,
  opacidad = 0.15,
  variante = 'claro-oscuro',
}: {
  url: string;
  opacidad?: number;
  /** 'oscuro' fija el velo oscuro del login; 'claro-oscuro' lo toma del tema. */
  variante?: 'oscuro' | 'claro-oscuro';
}) {
  const [conMovimiento, setConMovimiento] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    const aplicar = () => setConMovimiento(!consulta.matches);
    aplicar();
    consulta.addEventListener('change', aplicar);
    return () => consulta.removeEventListener('change', aplicar);
  }, []);

  const velo =
    variante === 'oscuro'
      ? 'radial-gradient(ellipse at center, rgba(8,15,24,0.35), rgba(8,15,24,0.9))'
      : 'color-mix(in srgb, var(--fondo) 30%, transparent)';

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden sin-impresion" aria-hidden>
      {url && conMovimiento && (
        <video
          className="h-full w-full object-cover"
          style={{ opacity: opacidad }}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        >
          <source src={url} type={tipoDeVideo(url)} />
        </video>
      )}
      <div className="absolute inset-0" style={{ background: velo }} />
    </div>
  );
}
