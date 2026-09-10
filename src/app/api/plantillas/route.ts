import { NextRequest, NextResponse } from 'next/server';
import { conActor, consultar } from '@/lib/bd/conexion';
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

  try {
    const filas = await consultar('select * from plantillas_correo order by clave, idioma');
    return NextResponse.json(filas);
  } catch (error) {
    console.error('No se pudieron leer las plantillas:', error);
    return NextResponse.json({ mensaje: 'No fue posible leer las plantillas.' }, { status: 500 });
  }
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

  // La escritura lleva el actor puesto: el disparador de auditoría deja
  // constancia de quién cambió la plantilla.
  try {
    await conActor(
      usuario.id,
      `update plantillas_correo
          set asunto = $1, cuerpo_html = $2, actualizado_por = $3
        where clave = $4 and idioma = $5`,
      [
        analisis.data.asunto,
        analisis.data.cuerpo_html,
        usuario.id,
        analisis.data.clave,
        analisis.data.idioma,
      ],
    );
  } catch (error) {
    console.error('No se pudo guardar la plantilla:', error);
    return NextResponse.json({ mensaje: 'No fue posible guardar la plantilla.' }, { status: 500 });
  }

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
