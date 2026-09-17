'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from './proveedores';
import { LANDING, barajar } from '@/lib/landing';
import { VisorFotos } from './visor-fotos';

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
 *
 * El mosaico es irregular y el orden se sortea en el navegador, como en la
 * portada: doscientos cuadrados idénticos en el mismo orden de siempre se
 * leen como un inventario, no como un lugar.
 */

/**
 * Cómo ocupa la rejilla cada pieza; el patrón se repite cada doce.
 *
 * Está escrito a mano y no sorteado: al azar salen huecos y torres de una
 * columna, que no es vivo, es descuidado. Doce piezas cubren tres bloques de
 * cuatro columnas sin dejar hueco, así que la tanda de veinticuatro cierra
 * siempre en un borde recto.
 */
const FORMAS = [
  'col-span-2 row-span-2', 'col-span-2 row-span-1',
  'col-span-1 row-span-1', 'col-span-1 row-span-1',
  'col-span-2 row-span-1', 'col-span-1 row-span-2',
  'col-span-1 row-span-1', 'col-span-2 row-span-1',
  'col-span-1 row-span-1', 'col-span-1 row-span-1',
  'col-span-2 row-span-2', 'col-span-2 row-span-1',
];
export function Galeria({ fotos, porTanda = 24 }: { fotos: string[]; porTanda?: number }) {
  const { idioma } = useApp();
  const textos = LANDING[idioma];

  const [visibles, setVisibles] = useState(porTanda);
  const centinela = useRef<HTMLDivElement | null>(null);
  const [rotas, setRotas] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<number | null>(null);

  // Arranca con el orden que viene del servidor y se baraja después del
  // primer pintado: así lo que llega y lo que React pinta coinciden, y el
  // sorteo no encadena un repintado dentro del mismo fotograma.
  const [orden, setOrden] = useState(fotos);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOrden(barajar(fotos)));
    return () => cancelAnimationFrame(id);
  }, [fotos]);

  const buenas = orden.filter((url) => !rotas.has(url));
  const mostradas = buenas.slice(0, visibles);
  const quedan = buenas.length - mostradas.length;

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

  if (buenas.length === 0) {
    return <p className="tenue text-sm">{textos.galeriaVacia}</p>;
  }

  return (
    <>
      <ul className="grid grid-flow-row-dense auto-rows-[96px] grid-cols-4 gap-2 sm:auto-rows-[150px] sm:gap-3">
        {mostradas.map((url, i) => (
          <li key={url} className={FORMAS[i % FORMAS.length]}>
            <button
              type="button"
              onClick={() => setAbierta(i)}
              className="group block h-full w-full overflow-hidden rounded-lg border"
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
        <VisorFotos
          fotos={buenas}
          indice={abierta}
          onCambiar={setAbierta}
          onCerrar={() => setAbierta(null)}
        />
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
      className="h-full w-full bg-black/5 object-cover transition duration-300 group-hover:scale-[1.03] dark:bg-white/5"
    />
  );
}
