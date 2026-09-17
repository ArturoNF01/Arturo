import { NextRequest, NextResponse } from 'next/server';
import { consultar } from '@/lib/bd/conexion';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { resincronizarRegistro, sincronizarRegistro } from '@/lib/servidor/sheets';
import { googleConfigurado } from '@/lib/servidor/google';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LOTE_MAXIMO = 100;

/**
 * Lo que el comité debe saber al entrar, en una sola consulta: los registros
 * que no llegaron a la hoja, los acuses que no salieron, y si los lugares
 * presenciales se agotaron.
 *
 * Van juntos porque se avisan en el mismo sitio y porque los tres comparten
 * el mismo defecto de origen: eran cosas que sólo se sabían mirando la base.
 */
export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarConfiguracion) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  try {
    const [pendientes, sinAcuse, cupos] = await Promise.all([
      consultar<Record<string, unknown>>(
        `select id, folio, creado_en, sheets_error, sheets_sincronizado_en
           from registros
          where sheets_sincronizado_en is null
          order by creado_en
          limit $1`,
        [LOTE_MAXIMO],
      ),
      consultar<Record<string, unknown>>(
        `select folio, correo, correo_error
           from registros
          where correo_enviado_en is null and correo_error is not null
          order by creado_en desc
          limit $1`,
        [LOTE_MAXIMO],
      ),
      consultar<{
        cupo_presencial: number | null;
        ocupado_presencial: number;
        en_lista_espera: number;
      }>('select cupo_presencial, ocupado_presencial, en_lista_espera from cupos_estado'),
    ]);

    const c = cupos[0];
    const libres = c?.cupo_presencial === null || c?.cupo_presencial === undefined
      ? null
      : Number(c.cupo_presencial) - Number(c.ocupado_presencial);

    return NextResponse.json({
      configurado: googleConfigurado() && Boolean(process.env.GOOGLE_SHEETS_ID),
      pendientes,
      sinAcuse,
      correoConfigurado: Boolean(process.env.RESEND_API_KEY && process.env.CORREO_REMITENTE),
      presencial: {
        libres,
        agotado: libres !== null && libres <= 0,
        enListaEspera: Number(c?.en_lista_espera ?? 0),
      },
    });
  } catch (error) {
    console.error('No se pudo leer el estado del registro:', error);
    return NextResponse.json({ mensaje: 'No fue posible leer el estado.' }, { status: 500 });
  }
}

/**
 * Reintenta la réplica en Google Sheets. Sin `id` procesa todos los registros
 * pendientes; con `id` fuerza la resincronización de uno solo, que además
 * limpia sus filas anteriores para no duplicarlas.
 */
export async function POST(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarConfiguracion) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  if (!googleConfigurado() || !process.env.GOOGLE_SHEETS_ID) {
    return NextResponse.json({ mensaje: 'Google Sheets no está configurado.' }, { status: 503 });
  }

  const cuerpo = (await peticion.json().catch(() => ({}))) as { id?: string };

  let registros: (Record<string, unknown> & { id: string; folio: string })[];
  try {
    registros = cuerpo.id
      ? await consultar('select * from registros where id = $1 limit 1', [cuerpo.id])
      : await consultar(
          `select * from registros
            where sheets_sincronizado_en is null
            order by creado_en
            limit $1`,
          [LOTE_MAXIMO],
        );
  } catch (error) {
    console.error('No se pudieron leer los registros a replicar:', error);
    return NextResponse.json({ mensaje: 'No fue posible leer los registros.' }, { status: 500 });
  }

  let sincronizados = 0;
  const fallidos: { folio: string; error: string }[] = [];

  for (const registro of registros) {
    try {
      // Un reintento puntual resincroniza para no duplicar filas ya escritas;
      // el proceso por lotes sólo toca registros que nunca llegaron a la hoja.
      if (cuerpo.id) await resincronizarRegistro(registro);
      else await sincronizarRegistro(registro);

      await consultar(
        `update registros set sheets_sincronizado_en = now(), sheets_error = null where id = $1`,
        [registro.id],
      );
      sincronizados += 1;
    } catch (fallo) {
      const mensaje = fallo instanceof Error ? fallo.message : String(fallo);
      await consultar('update registros set sheets_error = $2 where id = $1', [
        registro.id,
        mensaje,
      ]);
      fallidos.push({ folio: registro.folio, error: mensaje });
    }
  }

  return NextResponse.json({ sincronizados, fallidos });
}
