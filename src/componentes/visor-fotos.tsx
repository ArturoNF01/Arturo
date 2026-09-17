'use client';

import { useEffect } from 'react';
import { useApp } from './proveedores';
import { LANDING } from '@/lib/landing';

/**
 * La fotografía a pantalla completa, con flechas y teclado.
 *
 * Lo usan la galería y el mosaico de la portada. En los dos casos recorre
 * *todas* las fotografías, no sólo las que estén pintadas detrás: quien entra
 * por la tercera de la portada puede llegar a la doscientos sin salir.
 */
export function VisorFotos({
  fotos, indice, onCambiar, onCerrar,
}: {
  fotos: string[];
  indice: number;
  onCambiar: (nuevo: number) => void;
  onCerrar: () => void;
}) {
  const { idioma } = useApp();
  const textos = LANDING[idioma];
  const total = fotos.length;

  useEffect(() => {
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
      if (e.key === 'ArrowRight') onCambiar(Math.min(indice + 1, total - 1));
      if (e.key === 'ArrowLeft') onCambiar(Math.max(indice - 1, 0));
    };
    window.addEventListener('keydown', teclado);

    // Con la ampliación abierta, el fondo no debe moverse detrás.
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', teclado);
      document.body.style.overflow = desbordeAnterior;
    };
  }, [indice, total, onCambiar, onCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={textos.galeriaFoto(indice + 1)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onCerrar}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fotos[indice]}
        alt={textos.galeriaFoto(indice + 1)}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />

      <Flecha
        posicion="left-3"
        etiqueta={textos.galeriaAnterior}
        oculto={indice === 0}
        onClick={() => onCambiar(indice - 1)}
        trazo="M15 18l-6-6 6-6"
      />
      <Flecha
        posicion="right-3"
        etiqueta={textos.galeriaSiguiente}
        oculto={indice === total - 1}
        onClick={() => onCambiar(indice + 1)}
        trazo="M9 6l6 6-6 6"
      />

      <button
        type="button"
        aria-label={textos.galeriaCerrar}
        onClick={onCerrar}
        className="absolute right-3 top-3 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/25"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70">
        {indice + 1} / {total}
      </p>
    </div>
  );
}

function Flecha({
  posicion, etiqueta, oculto, onClick, trazo,
}: {
  posicion: string;
  etiqueta: string;
  oculto: boolean;
  onClick: () => void;
  trazo: string;
}) {
  if (oculto) return null;
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute ${posicion} top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/25`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={trazo} />
      </svg>
    </button>
  );
}
