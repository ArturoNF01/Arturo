import { NextRequest, NextResponse } from 'next/server';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { esquemaPlantilla } from '@/lib/esquema';
import { aplicarPlantilla, envolverHtml } from '@/lib/servidor/correo';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { urlSitio } from '@/lib/config';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('plantillas_correo')
    .select('*')
    .order('clave')
    .order('idioma');

  if (error) return NextResponse.json({ mensaje: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PUT(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarPlantillas) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const analisis = esquemaPlantilla.safeParse(await peticion.json().catch(() => null));
  if (!analisis.success) {
    return NextResponse.json({ mensaje: 'Plantilla no válida.' }, { status: 422 });
  }

  // Se escribe con la sesión del usuario: RLS valida el rol y el disparador
  // de auditoría deja constancia de quién hizo el cambio.
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('plantillas_correo')
    .update({
      asunto: analisis.data.asunto,
      cuerpo_html: analisis.data.cuerpo_html,
      actualizado_por: usuario.id,
    })
    .eq('clave', analisis.data.clave)
    .eq('idioma', analisis.data.idioma);

  if (error) return NextResponse.json({ mensaje: error.message }, { status: 403 });
  return NextResponse.json({ guardado: true });
}

/** Envía un correo de prueba con datos ficticios al usuario del panel. */
export async function POST(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarPlantillas) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;
  if (!clave || !remitente) {
    return NextResponse.json({ mensaje: 'Resend no está configurado.' }, { status: 503 });
  }

  const cuerpo = await peticion.json().catch(() => null);
  const analisis = esquemaPlantilla.safeParse(cuerpo);
  if (!analisis.success) {
    return NextResponse.json({ mensaje: 'Plantilla no válida.' }, { status: 422 });
  }

  const configuracion = await leerConfiguracion();
  const variables: Record<string, string> = {
    folio: 'REG-00000000-DEMO',
    nombre: usuario.nombre ?? usuario.correo,
    perfil: 'Panelista',
    modalidad: 'Presencial',
    correo: usuario.correo,
    institucion: 'CIESS',
    rol: 'Ponencia en mesa temática',
    fecha: new Date().toLocaleDateString('es-MX'),
    fecha_limite: configuracion.fecha_limite_registro,
    url_edicion: `${urlSitio()}/confirmacion/demo?token=demo`,
    url_agenda: configuracion.url_agenda,
    correo_contacto: configuracion.correo_contacto,
  };

  const resend = new Resend(clave);
  const { error } = await resend.emails.send({
    from: remitente,
    to: usuario.correo,
    subject: `[prueba] ${aplicarPlantilla(analisis.data.asunto, variables)}`,
    html: envolverHtml(aplicarPlantilla(analisis.data.cuerpo_html, variables), 'Prueba de plantilla'),
  });

  if (error) return NextResponse.json({ mensaje: error.message }, { status: 502 });
  return NextResponse.json({ enviado: true });
}
