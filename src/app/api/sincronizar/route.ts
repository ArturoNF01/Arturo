import { NextRequest, NextResponse } from 'next/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
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

  const admin = crearClienteAdmin();
  const { data, error } = await admin
    .from('registros')
    .select('id, folio, creado_en, sheets_error, sheets_sincronizado_en')
    .is('sheets_sincronizado_en', null)
    .order('creado_en', { ascending: true })
    .limit(LOTE_MAXIMO);

  if (error) return NextResponse.json({ mensaje: error.message }, { status: 500 });

  return NextResponse.json({
    configurado: googleConfigurado() && Boolean(process.env.GOOGLE_SHEETS_ID),
    pendientes: data ?? [],
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
  const admin = crearClienteAdmin();

  const consulta = admin.from('registros').select('*');
  const { data: registros, error } = cuerpo.id
    ? await consulta.eq('id', cuerpo.id).limit(1)
    : await consulta.is('sheets_sincronizado_en', null).order('creado_en').limit(LOTE_MAXIMO);

  if (error) return NextResponse.json({ mensaje: error.message }, { status: 500 });

  let sincronizados = 0;
  const fallidos: { folio: string; error: string }[] = [];

  for (const registro of registros ?? []) {
    try {
      // Un reintento puntual resincroniza para no duplicar filas ya escritas;
      // el proceso por lotes sólo toca registros que nunca llegaron a la hoja.
      if (cuerpo.id) await resincronizarRegistro(registro);
      else await sincronizarRegistro(registro);

      await admin
        .from('registros')
        .update({ sheets_sincronizado_en: new Date().toISOString(), sheets_error: null })
        .eq('id', registro.id);
      sincronizados += 1;
    } catch (fallo) {
      const mensaje = fallo instanceof Error ? fallo.message : String(fallo);
      await admin.from('registros').update({ sheets_error: mensaje }).eq('id', registro.id);
      fallidos.push({ folio: registro.folio, error: mensaje });
    }
  }

  return NextResponse.json({ sincronizados, fallidos });
}
