import { huellaDeNombre } from '@/lib/asistencia';
import type { FilaRepetida, RevisionDeRepetidos } from '@/lib/repetidos';

/**
 * Los registros duplicados de una misma persona: de cada caso de la revisión de repetidos con dos o más registros vigentes (dos
 * constancias), cuál queda y cuáles sobran. Aquí sólo se decide; pasar los días y cancelar es del servidor.
 *
 * Se decide por lo que dicen los datos, y lo que no alcanzan a decir lo decide una persona:
 *  1. el que se haya pedido conservar (`mantener`, por su correo);
 *  2. si no, el ponente (un registro de ponente dice más: lleva la ponencia y el tipo de constancia);
 *  3. si no, el de más días de asistencia.
 * Con eso aún empatados (los dos ponentes sin asistencia, por ejemplo) no se escoge al azar: se dice y se espera a que se pida.
 */

export interface CasoResuelto {
  caso: number;
  /** El nombre de la persona, como lo lleva el registro que queda. */
  nombre: string;
  queda: FilaRepetida;
  /** Por qué queda ése. */
  razon: string;
  /** Los registros vigentes que sobran: se cancelan, y sus días de asistencia pasan al que queda. */
  cancelar: FilaRepetida[];
}

export interface CasoSinResolver {
  caso: number;
  filas: FilaRepetida[];
  razon: string;
}

export interface PlanDeDuplicados {
  resueltos: CasoResuelto[];
  sinResolver: CasoSinResolver[];
}

const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

export function planearDuplicados(revision: RevisionDeRepetidos, mantener: readonly string[] = []): PlanDeDuplicados {
  const pedidos = new Set(mantener.map((c) => c.trim().toLowerCase()));
  const resueltos: CasoResuelto[] = [];
  const sinResolver: CasoSinResolver[] = [];

  for (const caso of revision.casos) {
    if (caso.riesgo !== 'dos_constancias') continue;
    const vigentes = caso.filas.filter((f) => f.conRegistro && f.registroId);
    const sin = (razon: string) => sinResolver.push({ caso: caso.numero, filas: vigentes, razon });

    // Con otro nombre puede ser otra persona: el parecido por correo no alcanza.
    if (new Set(vigentes.map((f) => huellaDeNombre(f.nombre))).size > 1) {
      sin('los registros vigentes no se llaman igual: podrían ser personas distintas, que lo decida una persona');
      continue;
    }

    const pedidosAqui = vigentes.filter((f) => pedidos.has(f.correo.toLowerCase()));
    if (pedidosAqui.length > 1) { sin('se pidió conservar más de uno de estos registros'); continue; }

    let queda: FilaRepetida;
    let razon: string;
    if (pedidosAqui.length === 1) {
      queda = pedidosAqui[0];
      razon = 'se pidió conservarlo';
    } else {
      // De mejor a peor: ponente y, a igualdad, más días. Si los dos primeros no se distinguen, no se escoge.
      const clave = (f: FilaRepetida) => [f.perfil === 'ponente' ? 1 : 0, f.total] as const;
      const ordenados = [...vigentes].sort((a, b) => clave(b)[0] - clave(a)[0] || clave(b)[1] - clave(a)[1] || a.numero - b.numero);
      const [primero, segundo] = ordenados;
      const [ponenteA, diasA] = clave(primero);
      const [ponenteB, diasB] = clave(segundo);
      if (ponenteA === ponenteB && diasA === diasB) {
        sin(`no hay con qué escoger (${ponenteA ? 'los dos son ponentes' : 'ninguno es ponente'}, y llevan ${dias(diasA)} cada uno): diga cuál queda con --mantener correo`);
        continue;
      }
      queda = primero;
      razon = ponenteA !== ponenteB ? 'es ponente y los demás no' : `tiene más días de asistencia (${dias(diasA)}, contra ${dias(diasB)})`;
    }

    const cancelar = vigentes.filter((f) => f !== queda);
    // Cancelar a un ponente en favor de quien no lo es quitaría la ponencia: eso se hace en el panel, a conciencia.
    if (queda.perfil !== 'ponente' && cancelar.some((f) => f.perfil === 'ponente')) {
      sin('cancelaría un registro de ponente en favor de uno que no lo es: si es lo que se quiere, hágalo en el panel');
      continue;
    }
    resueltos.push({ caso: caso.numero, nombre: queda.nombre, queda, razon, cancelar });
  }
  return { resueltos, sinResolver };
}
