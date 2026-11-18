import 'server-only';
import {
  ENCABEZADOS_DE_REPETIDOS, filasDeRepetidosParaLaHoja, revisarRepetidos, type RevisionDeRepetidos,
} from '@/lib/repetidos';
import { nombreDePerfil } from '@/lib/normalizacion';
import { ponenciasParaLaHoja } from '@/lib/ponentes';
import { ponentesRegistrados, todasLasAsistencias } from './asistencia';
import { escribirPestanaDeRevision } from './pestana-de-revision';

/**
 * La revisión de los repetidos de «Asistencia por persona», del lado del servidor: leer lo que lee la pasada de la hoja y dejar el
 * resultado en una pestaña para revisarlo. Las reglas están en `@/lib/repetidos`; esto sólo toca la base y la hoja, y no cambia
 * ningún registro ni ninguna asistencia.
 */

export const HOJA_REPETIDOS = 'Repetidos por revisar';

/** Los repetidos de ahora: con las mismas filas, y el mismo N.º, que la pestaña «Asistencia por persona». */
export async function leerRevisionDeRepetidos(): Promise<RevisionDeRepetidos> {
  const [asistencias, ponentes] = await Promise.all([todasLasAsistencias(), ponentesRegistrados()]);
  return revisarRepetidos(asistencias, ponentes, ponenciasParaLaHoja);
}

/** Anchos de las columnas de la pestaña, en píxeles. */
const ANCHOS = [55, 160, 130, 55, 280, 250, 120, 100, 55, 380, 120, 420, 560];

/**
 * Escribe los repetidos en la pestaña «Repetidos por revisar»: la crea al final si no existe y la vuelve a escribir entera cada
 * vez que se corre la revisión (si ya no queda ninguno, queda sólo con los títulos).
 */
export async function escribirRepetidosEnLaHoja(revision: RevisionDeRepetidos): Promise<{ filas: number }> {
  return escribirPestanaDeRevision({
    titulo: HOJA_REPETIDOS,
    encabezados: ENCABEZADOS_DE_REPETIDOS,
    filas: filasDeRepetidosParaLaHoja(revision, nombreDePerfil),
    anchos: ANCHOS,
  });
}
