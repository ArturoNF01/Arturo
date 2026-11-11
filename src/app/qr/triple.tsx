'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { TODOS_LOS_IDIOMAS, type Texto } from '@/lib/recepcion';

/** Cuánto se queda cada idioma en pantalla. El ciclo completo son tres veces esto (`--ciclo` en los estilos). */
export const SEGUNDOS_POR_IDIOMA = 4.5;

/**
 * Un texto que va pasando por los tres idiomas, uno tras otro. Los tres ocupan el mismo lugar —el más largo manda—,
 * así que ni la altura ni el ancho brincan al cambiar. Si el texto es igual en los tres (un aviso que sólo se escribió
 * en español, «CDMX») se queda quieto: no tiene caso apagarlo y encenderlo para decir lo mismo.
 *
 * Con `lineas`, cada idioma se corta en ese número de renglones: la altura máxima de un título largo es conocida y la
 * pantalla, que no tiene scroll, sabe de antemano cuánto lugar le toca.
 */
export function Triple({ textos, className = '', lineas }: { textos: Texto; className?: string; lineas?: number }) {
  const estilo = lineas ? ({ ['--lineas' as string]: lineas } as CSSProperties) : undefined;
  const clase = `${lineas ? 'rq-corta ' : ''}${className}`;

  if (TODOS_LOS_IDIOMAS.every((idioma) => textos[idioma] === textos.es)) {
    return <span className={`rq-fijo ${clase}`} style={estilo}>{textos.es}</span>;
  }
  return (
    <span className={`rq-triple ${clase}`} style={estilo}>
      {TODOS_LOS_IDIOMAS.map((idioma, n) => (
        <span key={idioma} lang={idioma} style={{ animationDelay: `${n * SEGUNDOS_POR_IDIOMA}s` }}>
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
