import { NextRequest, NextResponse } from 'next/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { crearEsquemaRegistro } from '@/lib/esquema';
import { perfilPorClave } from '@/lib/perfiles';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { sincronizarRegistro } from '@/lib/servidor/sheets';
import { enviarCorreoRegistro } from '@/lib/servidor/correo';
import { CONFIG } from '@/lib/config';
import { leerDatosCongreso } from '@/lib/servidor/contenido';

export const dynamic = 'force-dynamic';

export async function POST(peticion: NextRequest) {
  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ mensaje: 'Cuerpo de la petición no válido.' }, { status: 400 });
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
  const configuracion = await leerConfiguracion();

  if (!configuracion.registro_abierto) {
    return NextResponse.json({ mensaje: 'El periodo de registro está cerrado.' }, { status: 409 });
  }

  const perfil = perfilPorClave(datos.perfil);
  if (!perfil) {
    return NextResponse.json({ mensaje: 'Perfil de participación no válido.' }, { status: 422 });
  }

  // Cupos: si la modalidad presencial está llena, el registro pasa a lista de espera.
  let estado: 'en_proceso' | 'lista_espera' = 'en_proceso';
  if (
    datos.modalidad === 'presencial' &&
    configuracion.cupos_presenciales !== null &&
    configuracion.ocupado_presencial >= configuracion.cupos_presenciales
  ) {
    estado = 'lista_espera';
  }

  const supabase = crearClienteAdmin();
  const { data: registro, error } = await supabase
    .from('registros')
    .insert({
      ...datos,
      grupo: perfil.grupo,
      estado,
      consentimiento_fecha: new Date().toISOString(),
      consentimiento_version: CONFIG.versionAvisoPrivacidad,
    })
    .select()
    .single();

  if (error || !registro) {
    console.error('Alta de registro fallida:', error);
    return NextResponse.json({ mensaje: 'No fue posible guardar el registro.' }, { status: 500 });
  }

  // Sincronización con Sheets y acuse por correo: no bloquean la respuesta al
  // participante, pero sí se asientan en la fila para poder reintentarlos.
  const [sheets, correo] = await Promise.allSettled([
    sincronizarRegistro(registro),
    enviarCorreoRegistro({
      clave: estado === 'lista_espera' ? 'lista_espera' : 'confirmacion_registro',
      registro,
      correoContacto: configuracion.correo_contacto,
      fechaLimite: configuracion.fecha_limite_registro,
      urlAgenda: configuracion.url_agenda,
    }),
  ]);

  const parcheo: Record<string, unknown> = {};
  if (sheets.status === 'fulfilled') {
    parcheo.sheets_sincronizado_en = new Date().toISOString();
    parcheo.sheets_error = null;
  } else {
    parcheo.sheets_error = String(sheets.reason?.message ?? sheets.reason);
    console.error('Sincronización con Sheets fallida:', sheets.reason);
  }
  if (correo.status === 'fulfilled' && correo.value.enviado) {
    parcheo.correo_enviado_en = new Date().toISOString();
  } else if (correo.status === 'fulfilled') {
    console.error('Envío de acuse fallido:', correo.value.error);
  }

  await supabase.from('registros').update(parcheo).eq('id', registro.id);

  return NextResponse.json(
    {
      id: registro.id,
      folio: registro.folio,
      token_edicion: registro.token_edicion,
      estado,
    },
    { status: 201 },
  );
}
