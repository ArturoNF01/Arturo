import { esSesionDePrueba, personasDeLaHoja, type FilaDeAsistencia, type RegistroDePonente } from '@/lib/asistencia';

/**
 * Las filas «sin registro» de «Asistencia por persona»: quien escaneó sin que se hallara su registro (sin perfil y con «Con registro»
 * sin marcar). No reciben constancia. Aquí sólo se dice cuáles son y qué asistencias lleva cada una; borrarlas es del servidor.
 *
 * No son «sin registro» las filas con un registro cancelado (tienen registro, aunque ya no valga) ni los ponentes sin asistencia:
 * de esas no se borra nada, porque borrarlas sería borrar un registro.
 */

export interface FilaSinRegistro {
  /** El N.º de la fila en la pestaña. */
  numero: number;
  nombre: string;
  correo: string;
  /** Días de asistencia que lleva. */
  total: number;
  /** Las asistencias de esa persona (una por sesión): lo que se borra. */
  asistencias: string[];
}

export interface FilasSinRegistro {
  /** Las filas sin registro, por N.º. */
  filas: FilaSinRegistro[];
  /** Cuántas filas tiene la pestaña en total, y cuántas son de un registro cancelado (que no se tocan). */
  total: number;
  conRegistroCancelado: number;
}

export function filasSinRegistro(asistentes: readonly FilaDeAsistencia[], ponentes: readonly RegistroDePonente[]): FilasSinRegistro {
  const personas = personasDeLaHoja(asistentes, ponentes);
  const filas: FilaSinRegistro[] = [];
  personas.forEach((p, i) => {
    if (!p.sinRegistro) return;
    filas.push({
      numero: i + 1,
      nombre: p.nombre,
      correo: p.correo,
      total: p.total,
      // La fila junta por correo (sin mayúsculas) las asistencias sueltas de una persona: las mismas se borran.
      asistencias: asistentes
        .filter((a) => a.registro_id === null && !esSesionDePrueba(a.sesion) && a.correo.toLowerCase() === p.correo.toLowerCase())
        .map((a) => a.id),
    });
  });
  return {
    filas,
    total: personas.length,
    conRegistroCancelado: personas.filter((p) => !p.sinRegistro && p.estadoDelRegistro === 'cancelado').length,
  };
}
