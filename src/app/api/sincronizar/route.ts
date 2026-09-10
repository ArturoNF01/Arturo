import { NextRequest, NextResponse } from 'next/server';
import { consultar } from '@/lib/bd/conexion';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { resincronizarRegistro, sincronizarRegistro } from '@/lib/servidor/sheets';
import { googleConfigurado } from '@/lib/servidor/google';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LOTE_MAXIMO = 100;

/** Registros cuya réplica en Google Sheets quedó pendiente o falló. */
export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarConfiguracion) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  let pendientes: Record<string, unknown>[];
  try {
    pendientes = await consultar(
      `select id, folio, creado_en, sheets_error, sheets_sincronizado_en
         from registros
        where sheets_sincronizado_en is null
        order by creado_en
        limit $1`,
      [LOTE_MAXIMO],
    );
  } catch (error) {
    console.error('No se pudo leer el estado de la réplica:', error);
    return NextResponse.json({ mensaje: 'No fue posible leer el estado.' }, { status: 500 });
  }

  return NextResponse.json({
    configurado: googleConfigurado() && Boolean(process.env.GOOGLE_SHEETS_ID),
    pendientes,
  });
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
