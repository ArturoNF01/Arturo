'use client';

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { TODOS_LOS_IDIOMAS, type Texto } from '@/lib/recepcion';

/**
 * El idioma que toca ahora, para toda la pantalla a la vez: 0 español, 1 inglés, 2 portugués.
 *
 * Es uno solo, y no uno por cada texto, a propósito. Si cada texto llevara su propia cuenta, el que se monta más tarde (la
 * sesión que acaba de empezar, un aviso recién publicado) quedaría en otro idioma que el resto hasta que el ciclo lo
 * alcanzara; con el reloj compartido, toda la pantalla cambia junta y siempre se lee en un solo idioma.
 */
const IdiomaActivo = createContext(0);

/**
 * El reloj de idioma. Cada idioma se queda `segundos` y pasa al siguiente. Si cambia lo que hay que leer y `segundos`
 * cambia con ello, la cuenta del idioma que está a la vista empieza de nuevo: lo nuevo se lee completo, y no se corta a la
 * mitad porque el turno ya iba a acabar.
 *
 * Quien pidió menos movimiento se queda en español: ahí no hay reloj.
 */
export function ProveedorDeIdioma({ segundos, children }: { segundos: number; children: ReactNode }) {
  const [indice, setIndice] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setIndice((i) => (i + 1) % TODOS_LOS_IDIOMAS.length), segundos * 1000);
    return () => clearInterval(id);
  }, [segundos]);
  return <IdiomaActivo value={indice}>{children}</IdiomaActivo>;
}

/**
 * Un texto en los tres idiomas, de los que se ve uno a la vez (el que marca `ProveedorDeIdioma`). Los tres ocupan el mismo
 * lugar —el más largo manda—, así que ni la altura ni el ancho brincan al cambiar de idioma. Si el texto es igual en los tres
 * (un aviso que sólo se escribió en español, «CDMX») se queda quieto: no tiene caso apagarlo y encenderlo para decir lo mismo.
 *
 * Cada idioma sabe dónde está respecto al que toca: el que está a la vista (`rq-i-0`), el que sigue, esperando abajo
 * (`rq-i-1`), y el que acaba de salir, arriba (`rq-i-2`). El cambio de uno a otro lo hace una transición de CSS.
 *
 * Con `lineas`, cada idioma se corta en ese número de renglones: la altura máxima de un título largo es conocida y la
 * pantalla, que no tiene scroll, sabe de antemano cuánto lugar le toca.
 */
export function Triple({ textos, className = '', lineas }: { textos: Texto; className?: string; lineas?: number }) {
  const activo = useContext(IdiomaActivo);
  const estilo = lineas ? ({ ['--lineas' as string]: lineas } as CSSProperties) : undefined;
  const clase = `${lineas ? 'rq-corta ' : ''}${className}`;

  if (TODOS_LOS_IDIOMAS.every((idioma) => textos[idioma] === textos.es)) {
    return <span className={`rq-fijo ${clase}`} style={estilo}>{textos.es}</span>;
  }
  const total = TODOS_LOS_IDIOMAS.length;
  return (
    <span className={`rq-triple ${clase}`} style={estilo}>
      {TODOS_LOS_IDIOMAS.map((idioma, n) => (
        <span key={idioma} lang={idioma} className={`rq-i-${(n - activo + total) % total}`}>
          {textos[idioma]}
        </span>
      ))}
    </span>
  );
}

/**
 * La hora de ahora según el servidor: se toma el desfase entre su reloj y el del monitor y se corrige con él. Si alguien
 * deja el monitor con la hora mal, la pantalla no dice «cerrado» con el registro abierto ni «en vivo» a otra hora.
 *
 * Arranca en la hora que trajo el servidor, y no en nada: así lo que se pinta en el servidor y lo que se pinta al
 * hidratar es lo mismo, y no hay un cuadro vacío mientras el reloj arranca.
 */
export function useAhora(servidor: string, cada: number): number {
  const [ahora, setAhora] = useState(() => Date.parse(servidor));
  useEffect(() => {
    const desfase = Date.parse(servidor) - Date.now();
    const marcar = () => setAhora(Date.now() + desfase);
    const primero = setTimeout(marcar, 0);
    const id = setInterval(marcar, cada);
    return () => {
      clearTimeout(primero);
      clearInterval(id);
    };
  }, [servidor, cada]);
  return ahora;
}
