import { NextRequest, NextResponse } from 'next/server';
import { conActor, consultar } from '@/lib/bd/conexion';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { esquemaPlantilla } from '@/lib/esquema';
import { MAXIMO_DESTINATARIOS_DE_PRUEBA, destinatariosDePrueba } from '@/lib/plantillas';
import { correoDeMuestra } from '@/lib/servidor/muestra-correo';
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

/**
 * Envía un correo de prueba con datos ficticios.
 *
 * Por omisión va al propio usuario del panel; con `destinatarios` —direcciones
 * separadas por coma o espacio— va a quienes tengan que revisarlo, hasta diez: así
 * el comité puede ver el correo en su bandeja antes de aprobarlo. Sale una copia
 * por dirección, con el asunto exacto que tendrá el envío real —sin ninguna marca—, para que el
 * comité lo vea como lo verá la gente, y nunca a nadie de la base de registros.
 */
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

  const cuerpo = (await peticion.json().catch(() => null)) as Record<string, unknown> | null;
  const analisis = esquemaPlantilla.safeParse(cuerpo);
  if (!analisis.success) {
    return NextResponse.json({ mensaje: 'Plantilla no válida.' }, { status: 422 });
  }

  let destinos = [usuario.correo];
  const pedidos = typeof cuerpo?.destinatarios === 'string' ? cuerpo.destinatarios.trim() : '';
  if (pedidos) {
    const { validos, invalidos, excede } = destinatariosDePrueba(pedidos);
    if (invalidos.length > 0) {
      return NextResponse.json({ mensaje: `Dirección no válida: ${invalidos.join(', ')}` }, { status: 422 });
    }
    if (excede) {
      return NextResponse.json(
        { mensaje: `Como máximo ${MAXIMO_DESTINATARIOS_DE_PRUEBA} direcciones por prueba.` },
        { status: 422 },
      );
    }
    destinos = validos;
  }

  const correo = await correoDeMuestra({
    clave: analisis.data.clave,
    idioma: analisis.data.idioma,
    plantilla: analisis.data,
    usuario,
  });

  const resend = new Resend(clave);
  const { error } = await resend.batch.send(
    destinos.map((para) => ({
      from: remitente,
      to: para,
      subject: correo.asunto,
      html: correo.html,
    })),
  );

  if (error) return NextResponse.json({ mensaje: error.message }, { status: 502 });
  return NextResponse.json({ enviado: true, destinatarios: destinos.length });
}
