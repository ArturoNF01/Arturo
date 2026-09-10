import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  abrirSesion, cerrarSesion, crearEnlaceAcceso, verificarClave,
} from '@/lib/servidor/sesion';
import { enviarCorreoSimple } from '@/lib/servidor/correo';
import { urlSitio } from '@/lib/config';

export const dynamic = 'force-dynamic';

const esquema = z.discriminatedUnion('modo', [
  z.object({
    modo: z.literal('clave'),
    correo: z.string().trim().email(),
    clave: z.string().min(1).max(200),
  }),
  z.object({
    modo: z.literal('enlace'),
    correo: z.string().trim().email(),
  }),
]);

/**
 * Acceso al panel: por contraseña o por enlace enviado al correo.
 *
 * Ninguna de las dos respuestas dice si el correo existe. Con contraseña se
 * responde siempre lo mismo; con enlace se responde «revise su correo»
 * aunque no se haya enviado nada.
 */
export async function POST(peticion: NextRequest) {
  const analisis = esquema.safeParse(await peticion.json().catch(() => null));
  if (!analisis.success) {
    return NextResponse.json({ mensaje: 'Datos de acceso no válidos.' }, { status: 422 });
  }

  const datos = analisis.data;

  if (datos.modo === 'clave') {
    const usuario = await verificarClave(datos.correo, datos.clave);
    if (!usuario) {
      return NextResponse.json(
        { mensaje: 'Correo o contraseña incorrectos.' },
        { status: 401 },
      );
    }
    await abrirSesion(usuario.id, peticion.headers.get('user-agent'));
    return NextResponse.json({ entrada: true, rol: usuario.rol });
  }

  const token = await crearEnlaceAcceso(datos.correo);
  if (token) {
    const enlace = `${urlSitio().replace(/\/$/, '')}/acceso/${token}`;
    await enviarCorreoSimple({
      para: datos.correo,
      asunto: 'Acceso al panel · 1er Congreso',
      html: `<p>Para entrar al panel de control del 1er Congreso, abra este enlace:</p>
<p><a href="${enlace}">${enlace}</a></p>
<p>El enlace caduca en 30 minutos y sólo sirve una vez. Si no lo pidió usted,
puede ignorar este mensaje: sin abrirlo no ocurre nada.</p>`,
    });
  }

  // Misma respuesta exista o no la cuenta.
  return NextResponse.json({ enviado: true });
}

/** Cierra la sesión. */
export async function DELETE() {
  await cerrarSesion();
  return NextResponse.json({ salida: true });
}
