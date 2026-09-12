'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from './proveedores';
import { LANDING } from '@/lib/landing';

/**
 * Galería de las instalaciones.
 *
 * Dos decisiones que la sostienen:
 *
 * Doscientas fotografías a tamaño completo son varios cientos de megabytes.
 * No se pintan todas: se muestran por tandas y `loading="lazy"` deja que el
 * navegador sólo pida las que entran en pantalla.
 *
 * Y no hay manera de saber desde aquí cuáles de las doscientas existen. En
 * vez de fiarlo a una lista que habría que mantener a mano, cada fotografía
 * que no cargue se retira sola: la galería se queda con las que hay.
 */
export function Galeria({ fotos, porTanda = 24 }: { fotos: string[]; porTanda?: number }) {
  const { idioma } = useApp();
  const textos = LANDING[idioma];

  const [visibles, setVisibles] = useState(porTanda);
  const centinela = useRef<HTMLDivElement | null>(null);
  const [rotas, setRotas] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<number | null>(null);

  const buenas = fotos.filter((url) => !rotas.has(url));
  const mostradas = buenas.slice(0, visibles);
  const quedan = buenas.length - mostradas.length;

  // La ampliación recorre las fotografías buenas, todas, sin depender de
  // cuántas se hayan pintado en la rejilla: quien entre por la primera puede
  // llegar a la última con las flechas.
  const total = buenas.length;
  const mover = (paso: number) =>
    setAbierta((a) => (a === null ? null : Math.min(Math.max(a + paso, 0), total - 1)));

  // Trae la siguiente tanda cuando el pie de la lista se acerca a la
  // pantalla. El margen de 600 píxeles hace que las fotografías empiecen a
  // pedirse antes de llegar abajo, y así el desplazamiento no se detiene.
  useEffect(() => {
    const pie = centinela.current;
    if (!pie || typeof IntersectionObserver === 'undefined') return;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) setVisibles((v) => v + porTanda);
      },
      { rootMargin: '600px' },
    );
    observador.observe(pie);
    return () => observador.disconnect();
  }, [visibles, porTanda]);

  useEffect(() => {
    if (abierta === null) return;

    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(null);
      if (e.key === 'ArrowRight') setAbierta((a) => (a === null ? null : Math.min(a + 1, total - 1)));
      if (e.key === 'ArrowLeft') setAbierta((a) => (a === null ? null : Math.max(a - 1, 0)));
    };
    window.addEventListener('keydown', teclado);

    // Con la ampliación abierta, el fondo no debe moverse detrás.
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', teclado);
      document.body.style.overflow = desbordeAnterior;
    };
  }, [abierta, total]);

  if (buenas.length === 0) {
    return <p className="tenue text-sm">{textos.galeriaVacia}</p>;
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {mostradas.map((url, i) => (
          <li key={url}>
            <button
              type="button"
              onClick={() => setAbierta(i)}
              className="group block w-full overflow-hidden rounded-lg border"
              style={{ borderColor: 'var(--borde)' }}
            >
              <Miniatura
                url={url}
                alt={textos.galeriaFoto(i + 1)}
                alRomperse={() => setRotas((s) => new Set(s).add(url))}
              />
            </button>
          </li>
        ))}
      </ul>

      {/* El pie de la lista. Cuando asoma por la pantalla se trae la
          siguiente tanda: no hay que apretar nada para seguir bajando.
          Queda el texto por si el navegador no soporta el observador, y
          porque un lector de pantalla necesita que alguien le diga que la
          lista todavía crece. */}
      {quedan > 0 && (
        <div ref={centinela} className="mt-8 text-center text-sm tenue" aria-live="polite">
          {textos.galeriaCargando} ({quedan})
        </div>
      )}

      {abierta !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={textos.galeriaFoto(abierta + 1)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setAbierta(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={buenas[abierta]}
            alt={textos.galeriaFoto(abierta + 1)}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />

          <BotonVisor
            posicion="left-3"
            etiqueta={textos.galeriaAnterior}
            oculto={abierta === 0}
            onClick={() => mover(-1)}
            trazo="M15 18l-6-6 6-6"
          />
          <BotonVisor
            posicion="right-3"
            etiqueta={textos.galeriaSiguiente}
            oculto={abierta === total - 1}
            onClick={() => mover(1)}
            trazo="M9 6l6 6-6 6"
          />
          <button
            type="button"
            aria-label={textos.galeriaCerrar}
            onClick={() => setAbierta(null)}
            className="absolute right-3 top-3 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/25"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70">
            {abierta + 1} / {total}
          </p>
        </div>
      )}
    </>
  );
}

/**
 * Una miniatura que avisa cuando no se puede cargar.
 *
 * Con `onError` a secas no basta y costó verlo: la etiqueta llega ya escrita
 * desde el servidor, el navegador empieza a pedir la imagen antes de que
 * React tome el control de la página, y el fallo ocurre cuando todavía no hay
 * nadie escuchando. Por eso además se mira el elemento al montarlo: una
 * imagen terminada —`complete`— y sin ancho —`naturalWidth` a cero— es una
 * imagen que falló.
 */
function Miniatura({
  url, alt, alRomperse,
}: {
  url: string;
  alt: string;
  alRomperse: () => void;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(img) => {
        if (img && img.complete && img.naturalWidth === 0) alRomperse();
      }}
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={alRomperse}
      className="aspect-[4/3] w-full bg-black/5 object-cover transition duration-300 group-hover:scale-[1.03] dark:bg-white/5"
    />
  );
}

function BotonVisor({
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
