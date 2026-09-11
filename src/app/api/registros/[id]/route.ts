import { NextRequest, NextResponse } from 'next/server';
import { armarActualizacion, consultar, conActor, unaFila } from '@/lib/bd/conexion';
import { permisos, usuarioActual } from '@/lib/servidor/sesion';
import { crearEsquemaRegistro, esUuid } from '@/lib/esquema';
import { perfilPorClave } from '@/lib/perfiles';
import { dentroDelPlazo, leerConfiguracion } from '@/lib/servidor/configuracion';
import { leerDatosCongreso } from '@/lib/servidor/contenido';
import { resincronizarRegistro } from '@/lib/servidor/sheets';
import { enviarCorreoRegistro } from '@/lib/servidor/correo';

export const dynamic = 'force-dynamic';

interface FilaRegistro extends Record<string, unknown> {
  id: string;
  folio: string;
  token_edicion: string;
}

/** Devuelve el registro si el token de edición coincide o si hay sesión de panel. */
async function autorizar(id: string, token: string | null) {
  if (!esUuid(id)) return { registro: null, autorizado: false as const, usuario: null };

  const registro = await unaFila<FilaRegistro>('select * from registros where id = $1', [id]);
  if (!registro) return { registro: null, autorizado: false as const, usuario: null };

  if (token && token === registro.token_edicion) {
    return { registro, autorizado: true as const, usuario: null };
  }

  const usuario = await usuarioActual();
  return {
    registro,
    autorizado: Boolean(usuario && permisos(usuario.rol).editarRegistros),
    usuario,
  };
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
  const { registro: previo, autorizado, usuario } = await autorizar(id, token);
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

  const { asignaciones, valores } = armarActualizacion(datos);
  let registro: FilaRegistro | undefined;
  try {
    // Se escribe dentro de una transacción con el actor puesto, para que la
    // auditoría sepa si el cambio lo hizo el panel o la propia persona con
    // su enlace de edición.
    const filas = await conActor<FilaRegistro>(
      usuario?.id ?? null,
      `update registros set ${asignaciones} where id = $${valores.length + 1} returning *`,
      [...valores, id],
    );
    registro = filas[0];
  } catch (error) {
    console.error('Edición de registro fallida:', error);
  }

  if (!registro) {
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

  await consultar(
    sheets.status === 'fulfilled'
      ? `update registros set sheets_sincronizado_en = now(), sheets_error = null where id = $1`
      : `update registros set sheets_error = $2 where id = $1`,
    sheets.status === 'fulfilled'
      ? [id]
      : [id, String(sheets.reason?.message ?? sheets.reason)],
  );

  return NextResponse.json({ id: registro.id, folio: registro.folio, token_edicion: registro.token_edicion });
}

export async function DELETE(_peticion: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  if (!esUuid(id)) {
    return NextResponse.json({ mensaje: 'Registro no encontrado.' }, { status: 404 });
  }

  // Dar de baja un registro es la operación más destructiva del panel, así
  // que la reserva el rol más alto. Antes lo decidía una política en la base;
  // ahora se comprueba aquí, que es donde vive la regla de permisos.
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).eliminarRegistros) {
    return NextResponse.json({ mensaje: 'Su perfil no permite esta acción.' }, { status: 403 });
  }

  // Con el actor puesto, la auditoría asienta quién ejecutó la baja.
  await conActor(usuario.id, 'delete from registros where id = $1', [id]);
  return NextResponse.json({ eliminado: true });
}
