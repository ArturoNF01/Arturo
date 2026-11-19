import 'server-only';
import { consultar, enTransaccion } from '@/lib/bd/conexion';
import { googleConfigurado } from './google';
import { resincronizarRegistro } from './sheets';

/**
 * Juntar dos registros de una misma persona (`@/lib/duplicados` decide cuál queda): los días de asistencia del que sobra pasan al
 * que queda y el que sobra se cancela. Todo en una transacción: o se hace entero o no se hace.
 *
 * Se cancela **en silencio**: a diferencia del panel, no manda el correo «su registro fue cancelado», que a quien se registró dos
 * veces sólo lo confundiría. La auditoría lo asienta como del sistema, con el estado de antes. Nada se borra de `registros`.
 */

export interface RegistrosFusionados {
  /** Si no se hizo, por qué (alguno ya no era vigente). */
  omitido?: string;
  /** Cuántas asistencias pasaron al registro que queda, y cuántas se descartaron por repetir un día que ya tenía. */
  movidas: number;
  descartadas: number;
  /** Qué pasó con la copia del registro cancelado en la hoja de Google. */
  hoja: 'al_dia' | 'fallo' | 'sin_google' | 'no_aplica';
  errorDeLaHoja?: string;
}

export async function fusionarRegistros(mantenerId: string, cancelarId: string): Promise<RegistrosFusionados> {
  const hecho = await enTransaccion(async (c) => {
    // Los dos se bloquean para que nadie los cambie a medias.
    const queda = await c.query<{ id: string; nombres: string; apellidos: string; correo: string }>(
      `select id, nombres, apellidos, correo from registros where id = $1 and estado <> 'cancelado' for update`, [mantenerId]);
    const sobra = await c.query<{ id: string }>(`select id from registros where id = $1 and estado <> 'cancelado' for update`, [cancelarId]);
    if (!queda.rows[0] || !sobra.rows[0]) return null;
    // Los días que el que queda no tenía pasan a él; los que ya tenía (la misma sesión) se descartan: era el mismo día.
    const movidas = await c.query(
      `update asistencias a
          set registro_id = $1, identificado_por = 'conciliada', nombre = $3, correo = $4
        where a.registro_id = $2
          and not exists (select 1 from asistencias b where b.sesion = a.sesion and b.registro_id = $1)
        returning a.id`,
      [mantenerId, cancelarId, `${queda.rows[0].nombres} ${queda.rows[0].apellidos}`.trim(), queda.rows[0].correo.toLowerCase()],
    );
    const descartadas = await c.query('delete from asistencias where registro_id = $1 returning id', [cancelarId]);
    const cancelado = await c.query<Record<string, unknown> & { id: string }>(
      `update registros set estado = 'cancelado' where id = $1 returning *`, [cancelarId]);
    return { movidas: movidas.rowCount ?? 0, descartadas: descartadas.rowCount ?? 0, registro: cancelado.rows[0] };
  }, null);

  if (!hecho) return { omitido: 'alguno de los dos ya no es un registro vigente: no se tocó nada', movidas: 0, descartadas: 0, hoja: 'no_aplica' };
  const base = { movidas: hecho.movidas, descartadas: hecho.descartadas };
  if (!googleConfigurado() || !process.env.GOOGLE_SHEETS_ID) return { ...base, hoja: 'sin_google' };
  try {
    await resincronizarRegistro(hecho.registro as Parameters<typeof resincronizarRegistro>[0]);
    await consultar('update registros set sheets_sincronizado_en = now(), sheets_error = null where id = $1', [cancelarId]);
    return { ...base, hoja: 'al_dia' };
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    await consultar('update registros set sheets_error = $2 where id = $1', [cancelarId, motivo]);
    return { ...base, hoja: 'fallo', errorDeLaHoja: motivo };
  }
}
