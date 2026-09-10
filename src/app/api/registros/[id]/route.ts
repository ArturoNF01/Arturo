import { NextRequest, NextResponse } from 'next/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { crearEsquemaRegistro } from '@/lib/esquema';
import { perfilPorClave } from '@/lib/perfiles';
import { dentroDelPlazo, leerConfiguracion } from '@/lib/servidor/configuracion';
import { leerDatosCongreso } from '@/lib/servidor/contenido';
import { resincronizarRegistro } from '@/lib/servidor/sheets';
import { enviarCorreoRegistro } from '@/lib/servidor/correo';

export const dynamic = 'force-dynamic';

/** Devuelve el registro si el token de edición coincide o si hay sesión de panel. */
async function autorizar(id: string, token: string | null) {
  const admin = crearClienteAdmin();
  const { data: registro } = await admin.from('registros').select('*').eq('id', id).maybeSingle();
  if (!registro) return { registro: null, autorizado: false as const };

  if (token && token === registro.token_edicion) return { registro, autorizado: true as const };

  const supabase = await crearClienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { registro, autorizado: false as const };

  const { data: usuario } = await admin
    .from('usuarios_panel')
    .select('rol, activo')
    .eq('id', sesion.user.id)
    .maybeSingle();

  const puedeEditar = Boolean(usuario?.activo) && ['superadmin', 'organizador'].includes(usuario?.rol ?? '');
  return { registro, autorizado: puedeEditar };
}

export async function GET(peticion: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  const token = peticion.nextUrl.searchParams.get('token');
  const { registro, autorizado } = await autorizar(id, token);

  if (!registro) return NextResponse.json({ mensaje: 'Registro no encontrado.' }, { status: 404 });
  if (!autorizado) return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });

  return NextResponse.json(registro, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(peticion: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await peticion.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ mensaje: 'Cuerpo de la petición no válido.' }, { status: 400 });
  }

  const token = (cuerpo.token as string) ?? peticion.nextUrl.searchParams.get('token');
  const { registro: previo, autorizado } = await autorizar(id, token);
  if (!previo) return NextResponse.json({ mensaje: 'Registro no encontrado.' }, { status: 404 });
  if (!autorizado) return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });

  const configuracion = await leerConfiguracion();
  const esPanel = !token || token !== previo.token_edicion;
  if (!esPanel && !dentroDelPlazo(configuracion.fecha_limite_registro)) {
    return NextResponse.json(
      { mensaje: 'El periodo de edición está cerrado.' },
      { status: 409 },
    );
  }

  const congreso = await leerDatosCongreso();
  const analisis = crearEsquemaRegistro({
    semblanzaCaracteres: congreso.limite_semblanza_caracteres,
    resumenCaracteres: congreso.limite_resumen_caracteres,
  }).safeParse(cuerpo);
  if (!analisis.success) {
    const errores: Record<string, string> = {};
    for (const problema of analisis.error.issues) {
      const campo = String(problema.path[0] ?? '_');
      errores[campo] ??= problema.message;
    }
    return NextResponse.json({ mensaje: 'Revise los campos marcados.', errores }, { status: 422 });
  }

  const datos = analisis.data;
  const perfil = perfilPorClave(datos.perfil);
  if (!perfil) return NextResponse.json({ mensaje: 'Perfil no válido.' }, { status: 422 });

  const admin = crearClienteAdmin();
  const { data: registro, error } = await admin
    .from('registros')
    .update({ ...datos, grupo: perfil.grupo })
    .eq('id', id)
    .select()
    .single();

  if (error || !registro) {
    console.error('Edición de registro fallida:', error);
    return NextResponse.json({ mensaje: 'No fue posible guardar los cambios.' }, { status: 500 });
  }

  const [sheets] = await Promise.allSettled([
    resincronizarRegistro(registro),
    enviarCorreoRegistro({
      clave: 'edicion_registro',
      registro,
      correoContacto: configuracion.correo_contacto,
      fechaLimite: configuracion.fecha_limite_registro,
      urlAgenda: configuracion.url_agenda,
    }),
  ]);

  await admin
    .from('registros')
    .update(
      sheets.status === 'fulfilled'
        ? { sheets_sincronizado_en: new Date().toISOString(), sheets_error: null }
        : { sheets_error: String(sheets.reason?.message ?? sheets.reason) },
    )
    .eq('id', id);

  return NextResponse.json({ id: registro.id, folio: registro.folio, token_edicion: registro.token_edicion });
}

export async function DELETE(peticion: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  const supabase = await crearClienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });

  // La baja se hace con la sesión del usuario para que RLS aplique la regla de
  // rol y el disparador de auditoría registre quién la ejecutó.
  const { error } = await supabase.from('registros').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ mensaje: 'Su perfil no permite esta acción.' }, { status: 403 });
  }
  return NextResponse.json({ eliminado: true });
}
