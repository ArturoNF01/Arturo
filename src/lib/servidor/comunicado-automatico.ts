import 'server-only';
import { consultar, unaFila } from '@/lib/bd/conexion';
import { AUDIENCIA_AUTOMATICA, correspondeComunicadoAutomatico, idiomaDeEnvio } from '@/lib/comunicados';
import type { ConfiguracionPublica } from './configuracion';
import { enviarCorreoRegistro } from './correo';

/**
 * El comunicado «Acceso a las sesiones, asistencia y constancias» que sale solo, enseguida después del correo
 * de confirmación de cada registro nuevo.
 *
 * Tres cosas lo hacen seguro:
 *
 *  1. **Una sola vez por persona.** Antes de mandar se mira si esa dirección ya lo recibió —por un envío masivo
 *     o por éste— y, si no, se «reclama» su fila en la base: dos peticiones a la vez (un doble envío del
 *     formulario, un reintento de acuses) no pueden mandarlo dos veces. Un envío que falló queda como
 *     «error» y se puede reintentar; uno ya enviado, no.
 *  2. **Cuenta como recibido.** Cada envío queda en la campaña «automática» del comunicado, así que los
 *     envíos masivos («a quienes aún no lo han recibido») ya no mandan a nadie que lo recibió por aquí.
 *  3. **Se puede apagar.** Hay un interruptor en el panel; apagado, no se manda nada.
 *
 * No toca el registro ni su acuse: un fallo aquí se asienta y no afecta a nadie más.
 */

const CLAVE = 'comunicado';
/** Un reclamo que lleva tanto tiempo «enviando» se dio por muerto (el proceso cayó a mitad). */
const MINUTOS_PARA_REINTENTAR = 5;

export async function comunicadoAutomaticoActivo(): Promise<boolean> {
  try {
    const fila = await unaFila<{ valor: unknown }>('select valor from configuracion where clave = $1', ['comunicado_automatico']);
    return fila?.valor === true;
  } catch {
    // Sin poder leerlo no se manda nada: es mejor un comunicado que no sale solo —se manda en masa— que uno de más.
    return false;
  }
}

export async function fijarComunicadoAutomatico(activo: boolean, usuarioId: string): Promise<void> {
  await consultar(
    `insert into configuracion (clave, valor, descripcion, actualizado_por)
     values ('comunicado_automatico', $1::jsonb, 'Enviar el comunicado a cada registro nuevo, enseguida después de su correo de confirmación', $2)
     on conflict (clave) do update set valor = excluded.valor, actualizado_en = now(), actualizado_por = excluded.actualizado_por`,
    [JSON.stringify(activo), usuarioId],
  );
}

/** La campaña donde quedan los envíos automáticos; se crea la primera vez. */
async function campanaAutomatica(): Promise<string> {
  const ya = await unaFila<{ id: string }>(
    'select id from campanas_correo where clave = $1 and audiencia = $2',
    [CLAVE, AUDIENCIA_AUTOMATICA],
  );
  if (ya) return ya.id;
  // `terminada` desde el principio: no tiene nada «pendiente» que continuar ni debe frenar un envío masivo.
  await consultar(
    `insert into campanas_correo (clave, audiencia, plantilla, total, estado)
     values ($1, $2, '{}'::jsonb, 0, 'terminada')
     on conflict (clave) where audiencia = 'automatico' do nothing`,
    [CLAVE, AUDIENCIA_AUTOMATICA],
  );
  const creada = await unaFila<{ id: string }>(
    'select id from campanas_correo where clave = $1 and audiencia = $2',
    [CLAVE, AUDIENCIA_AUTOMATICA],
  );
  if (!creada) throw new Error('No se pudo crear la campaña automática.');
  return creada.id;
}

export interface EstadoDelComunicadoAutomatico {
  activo: boolean;
  enviados: number;
  errores: number;
}

/** Cómo va el envío automático: si está encendido y cuántos han salido y cuántos fallaron. */
export async function estadoDelComunicadoAutomatico(): Promise<EstadoDelComunicadoAutomatico> {
  const [activo, cuenta] = await Promise.all([
    comunicadoAutomaticoActivo(),
    unaFila<{ enviados: string; errores: string }>(
      `select count(*) filter (where e.estado = 'enviado')::text as enviados,
              count(*) filter (where e.estado = 'error')::text   as errores
         from campanas_correo c join envios_campana e on e.campana_id = c.id
        where c.clave = $1 and c.audiencia = $2`,
      [CLAVE, AUDIENCIA_AUTOMATICA],
    ),
  ]);
  return { activo, enviados: Number(cuenta?.enviados ?? 0), errores: Number(cuenta?.errores ?? 0) };
}

type Registro = Record<string, unknown>;
type Enviar = typeof enviarCorreoRegistro;

export type ResultadoAutomatico = 'enviado' | 'omitido' | 'error';

/**
 * Manda el comunicado a un registro recién confirmado, si corresponde. Devuelve qué pasó:
 * `enviado`, `omitido` (apagado, no le toca o ya lo había recibido) o `error` (Resend lo rechazó; queda asentado
 * y el envío masivo «a quienes aún no lo han recibido» lo recoge).
 *
 * `enviar` se puede cambiar para probarlo sin mandar un correo de verdad; entonces no se exige que Resend
 * esté configurado.
 */
export async function enviarComunicadoTrasConfirmacion(
  registro: Registro,
  configuracion: ConfiguracionPublica,
  { enviar = enviarCorreoRegistro }: { enviar?: Enviar } = {},
): Promise<ResultadoAutomatico> {
  if (enviar === enviarCorreoRegistro && !(process.env.RESEND_API_KEY && process.env.CORREO_REMITENTE)) return 'omitido';
  if (!(await comunicadoAutomaticoActivo())) return 'omitido';

  const correo = String(registro.correo ?? '').trim().toLowerCase();
  if (!correspondeComunicadoAutomatico(String(registro.estado ?? ''), correo)) return 'omitido';

  // ¿Ya lo recibió, por el envío masivo o por éste?
  const recibido = await unaFila(
    `select 1 from envios_campana e join campanas_correo c on c.id = e.campana_id
      where c.clave = $1 and e.correo = $2 and e.estado = 'enviado' limit 1`,
    [CLAVE, correo],
  );
  if (recibido) return 'omitido';

  const campana = await campanaAutomatica();
  const idioma = idiomaDeEnvio(String(registro.idioma ?? 'es'));

  // Reclamar la fila: sólo una petición se la queda. Si ya hay una «enviando» reciente o «enviada», se sale.
  const reclamada = await consultar<{ correo: string }>(
    `insert into envios_campana (campana_id, correo, registro_id, idioma, estado, reclamado_en)
     values ($1, $2, $3, $4, 'enviando', now())
     on conflict (campana_id, correo) do update
        set estado = 'enviando', reclamado_en = now(), error = null, registro_id = excluded.registro_id, idioma = excluded.idioma
      where envios_campana.estado = 'error'
         or (envios_campana.estado = 'enviando' and envios_campana.reclamado_en < now() - make_interval(mins => $5))
     returning correo`,
    [campana, correo, registro.id ?? null, idioma, MINUTOS_PARA_REINTENTAR],
  );
  if (reclamada.length === 0) return 'omitido';

  let resultado: { enviado: boolean; error?: string };
  try {
    resultado = await enviar({
      clave: 'comunicado',
      registro,
      correoContacto: configuracion.correo_contacto,
      fechaLimite: configuracion.fecha_limite_registro,
      urlAgenda: configuracion.url_agenda,
      urlAgendaPt: configuracion.url_agenda_pt,
      urlAgendaEn: configuracion.url_agenda_en,
      programaPublicado: configuracion.programa_publicado,
      urlSesionZoom: configuracion.url_sesion_zoom,
    });
  } catch (fallo) {
    resultado = { enviado: false, error: fallo instanceof Error ? fallo.message : String(fallo) };
  }

  await consultar(
    `update envios_campana
        set estado = $3, error = $4, enviado_en = case when $3 = 'enviado' then now() else null end
      where campana_id = $1 and correo = $2`,
    [campana, correo, resultado.enviado ? 'enviado' : 'error', resultado.enviado ? null : (resultado.error ?? 'Error de envío.').slice(0, 500)],
  );
  await consultar(
    'update campanas_correo set total = (select count(*) from envios_campana where campana_id = $1) where id = $1',
    [campana],
  );
  return resultado.enviado ? 'enviado' : 'error';
}
