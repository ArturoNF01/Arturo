import { esSesionDePrueba, type FilaDeAsistencia } from '@/lib/asistencia';
import { aAltasYBajas, esTodoMayusculas } from '@/lib/nombres';
import type { FilaRepetida, RevisionDeRepetidos } from '@/lib/repetidos';

/**
 * La limpieza de «Asistencia por persona»: juntar las asistencias sueltas que repiten a alguien registrado, y pasar a «altas y bajas»
 * los nombres escritos todo en mayúsculas. Aquí sólo se decide qué hacer; el cómo (la base y la hoja) está en el servidor.
 */

// ---------------------------------------------------------------------------
// Asistencias sueltas que repiten a alguien registrado
// ---------------------------------------------------------------------------

export interface FusionPlanificada {
  /** El caso de la revisión de repetidos del que sale. */
  caso: number;
  /** La fila con registro vigente a la que se ligan. */
  destino: FilaRepetida;
  /** Las filas «sin registro» que repiten a esa persona, con las asistencias que lleva cada una (una por día y sesión). */
  sueltas: { fila: FilaRepetida; asistencias: string[] }[];
}

export interface FusionOmitida {
  caso: number;
  motivo: string;
  filas: FilaRepetida[];
}

export interface PlanDeFusiones {
  fusiones: FusionPlanificada[];
  omitidas: FusionOmitida[];
}

/**
 * Qué asistencias sueltas se pueden ligar sin dudar: las de un caso de repetidos con **un solo** registro vigente. Ligarlas es lo
 * que hace el panel con «Ligar a un registro»: la asistencia pasa a ser de ese registro (sus días se suman a los de la persona) y,
 * si esa persona ya tenía asistencia en la misma sesión, la suelta se descarta por duplicada. No se pierde ningún día de nadie.
 *
 * Un caso con dos o más registros vigentes (no se sabe a cuál) o con ninguno (no hay a quién ligar) se deja como está.
 */
export function planearFusiones(revision: RevisionDeRepetidos, asistencias: readonly FilaDeAsistencia[]): PlanDeFusiones {
  const fusiones: FusionPlanificada[] = [];
  const omitidas: FusionOmitida[] = [];
  for (const caso of revision.casos) {
    const sueltas = caso.filas.filter((f) => !f.ligada);
    if (sueltas.length === 0) continue;
    const vigentes = caso.filas.filter((f) => f.conRegistro);
    if (vigentes.length === 1 && vigentes[0].registroId) {
      fusiones.push({
        caso: caso.numero,
        destino: vigentes[0],
        sueltas: sueltas.map((fila) => ({
          fila,
          asistencias: asistencias
            .filter((a) => a.registro_id === null && !esSesionDePrueba(a.sesion) && a.correo.toLowerCase() === fila.correo.toLowerCase())
            .map((a) => a.id),
        })),
      });
    } else {
      omitidas.push({
        caso: caso.numero,
        filas: sueltas,
        motivo: vigentes.length === 0
          ? 'ninguna de las filas tiene un registro vigente al que ligar'
          : 'hay dos o más registros vigentes: no se sabe a cuál ligar, que lo decida una persona',
      });
    }
  }
  return { fusiones, omitidas };
}

// ---------------------------------------------------------------------------
// Nombres todo en mayúsculas
// ---------------------------------------------------------------------------

export interface RegistroConNombre { id: string; folio: string; nombres: string; apellidos: string }
export interface CambioDeRegistro {
  id: string;
  folio: string;
  antes: { nombres: string; apellidos: string };
  despues: { nombres: string; apellidos: string };
}
export interface AsistenciaSueltaConNombre { id: string; nombre: string; correo: string }
export interface CambioDeAsistencia { id: string; correo: string; antes: string; despues: string }

/**
 * De los registros, a los que tienen el nombre o los apellidos todo en mayúsculas: se pasa a altas y bajas el campo que lo está (el
 * otro se deja, aunque esté bien o mal escrito).
 */
export function planearNombresDeRegistros(registros: readonly RegistroConNombre[]): CambioDeRegistro[] {
  const arreglar = (texto: string) => (esTodoMayusculas(texto) ? aAltasYBajas(texto) : texto);
  return registros.flatMap((r) => {
    const despues = { nombres: arreglar(r.nombres), apellidos: arreglar(r.apellidos) };
    return despues.nombres === r.nombres && despues.apellidos === r.apellidos
      ? []
      : [{ id: r.id, folio: r.folio, antes: { nombres: r.nombres, apellidos: r.apellidos }, despues }];
  });
}

/** Lo mismo para las asistencias que quedaron «sin registro» (su nombre es lo que la persona escribió). */
export function planearNombresDeSueltas(sueltas: readonly AsistenciaSueltaConNombre[]): CambioDeAsistencia[] {
  return sueltas
    .filter((a) => esTodoMayusculas(a.nombre))
    .map((a) => ({ id: a.id, correo: a.correo, antes: a.nombre, despues: aAltasYBajas(a.nombre) }))
    .filter((c) => c.despues !== c.antes);
}

// ---------------------------------------------------------------------------
// Lo que quien hace las constancias ya escribió a la derecha
// ---------------------------------------------------------------------------

/**
 * Qué filas de datos (desde 0) de la pestaña tienen algo escrito a la derecha de las columnas del sistema, desde `desdeFila`: al
 * juntar filas, las de detrás se recorren, y lo que está a la derecha no se mueve con ellas, así que quedaría en otra persona.
 * Una casilla sin marcar («FALSE») no cuenta: no hay nada escrito.
 */
export function filasConDatosPropios(
  datos: readonly (readonly unknown[])[],
  columnasDelSistema: number,
  desdeFila: number,
): number[] {
  const escrito = (celda: unknown) => {
    const texto = String(celda ?? '').trim();
    return texto !== '' && texto.toUpperCase() !== 'FALSE';
  };
  return datos.flatMap((fila, i) => (i >= desdeFila && fila.slice(columnasDelSistema).some(escrito) ? [i] : []));
}
