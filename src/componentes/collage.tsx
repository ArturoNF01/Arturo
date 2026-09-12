'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from './proveedores';
import { LANDING, barajar } from '@/lib/landing';

/**
 * El adelanto de la galería en la portada: un mosaico irregular que cambia
 * en cada visita.
 *
 * Tres decisiones sostienen el efecto:
 *
 * Las piezas no son todas iguales. Una rejilla fija de cuatro cuadrados
 * iguales se lee como un catálogo; aquí unas ocupan dos columnas, otras dos
 * filas, y el ojo recorre el bloque en vez de barrerlo. El patrón está
 * escrito a mano y no sorteado: al azar salen huecos y torres de una
 * columna, y eso no es vivo, es descuidado.
 *
 * El reparto de qué foto va en qué hueco sí es al azar, y ocurre en el
 * navegador. Si se sorteara en el servidor, todos verían la misma
 * «casualidad» hasta el siguiente despliegue.
 *
 * Y cada pieza entra con un pequeño retraso, en cascada, para que el bloque
 * se arme a la vista en lugar de aparecer de golpe.
 */

/** Cómo ocupa la rejilla cada una de las nueve piezas. */
const PIEZAS = [
  'col-span-2 row-span-2', // la grande, arriba a la izquierda
  'col-span-2 row-span-1', // apaisada
  'col-span-1 row-span-1',
  'col-span-1 row-span-2', // vertical
  'col-span-2 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-2 row-span-1',
  'col-span-1 row-span-1',
];

export function Collage({ fotos }: { fotos: string[] }) {
  const { idioma } = useApp();
  const textos = LANDING[idioma];

  // Arranca con las primeras, que es lo que se pinta en el servidor, y se
  // baraja ya en el navegador: así lo que llega y lo que React pinta después
  // coinciden y no hay parpadeo de hidratación.
  const [elegidas, setElegidas] = useState(() => fotos.slice(0, PIEZAS.length));
  const [rotas, setRotas] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Se baraja después del primer pintado, no durante: así el navegador
    // dibuja antes lo que ya venía del servidor y el sorteo no encadena un
    // repintado dentro del mismo fotograma.
    const id = requestAnimationFrame(() => setElegidas(barajar(fotos).slice(0, PIEZAS.length)));
    return () => cancelAnimationFrame(id);
  }, [fotos]);

  // Las que no cargan se reemplazan por otras en lugar de dejar el hueco: el
  // mosaico depende de que las nueve piezas estén.
  const buenas = elegidas.filter((url) => !rotas.has(url));
  const repuestos = fotos.filter((url) => !rotas.has(url) && !buenas.includes(url));
  const piezas = [...buenas, ...repuestos].slice(0, PIEZAS.length);

  return (
    <>
      <ul className="grid auto-rows-[88px] grid-cols-4 gap-2 sm:auto-rows-[120px] sm:gap-3">
        {piezas.map((url, i) => (
          <li
            key={url}
            className={`${PIEZAS[i]} overflow-hidden rounded-lg border animate-collage`}
            style={{
              borderColor: 'var(--borde)',
              animationDelay: `${i * 70}ms`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={(img) => {
                // El `onError` solo no basta: la etiqueta llega escrita desde
                // el servidor y el navegador empieza a pedir la imagen antes
                // de que React tome el control de la página.
                if (img && img.complete && img.naturalWidth === 0) {
                  setRotas((s) => new Set(s).add(url));
                }
              }}
              src={url}
              alt={textos.galeriaFoto(i + 1)}
              loading="lazy"
              decoding="async"
              onError={() => setRotas((s) => new Set(s).add(url))}
              className="h-full w-full bg-black/5 object-cover transition-transform duration-500 hover:scale-105 dark:bg-white/5"
            />
          </li>
        ))}
      </ul>

      <div className="mt-8 text-center">
        <Link href="/instalaciones" className="boton-secundario inline-flex px-6 py-2.5">
          {textos.galeriaVerTodas}
        </Link>
      </div>
    </>
  );
}
