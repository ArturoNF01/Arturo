import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { conActor } from '@/lib/bd/conexion';
import { cifrarClave } from '@/lib/bd/claves';
import { crearEnlaceAcceso, permisos, usuarioActual } from '@/lib/servidor/sesion';
import { enviarCorreoSimple } from '@/lib/servidor/correo';
import { urlSitio } from '@/lib/config';

export const dynamic = 'force-dynamic';

const esquema = z.object({
  correo: z.string().trim().email(),
  nombre: z.string().trim().max(160).optional(),
  rol: z.enum(['superadmin', 'organizador', 'cientifico_datos', 'lector']),
  // Sin contraseña, la persona entra por el enlace que recibe en su correo.
  clave: z.string().min(10).max(200).optional(),
});

/**
 * Alta de una cuenta del panel.
 *
 * Quien la crea decide si pone contraseña o deja que la persona entre con el
 * enlace de acceso que se le envía al correo.
 */
export async function POST(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).gestionarUsuarios) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const analisis = esquema.safeParse(await peticion.json().catch(() => null));
  if (!analisis.success) {
    return NextResponse.json(
      { mensaje: 'Revise el correo y el rol. La contraseña, si se pone, va de 10 caracteres en adelante.' },
      { status: 422 },
    );
  }

  const { correo, nombre, rol, clave } = analisis.data;
  const claveHash = clave ? await cifrarClave(clave) : null;

  try {
    await conActor(
      usuario.id,
      `insert into usuarios_panel (correo, nombre, rol, clave_hash)
       values ($1, $2, $3, $4)`,
      [correo, nombre ?? null, rol, claveHash],
    );
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ mensaje: 'Ya existe una cuenta con ese correo.' }, { status: 409 });
    }
    console.error('Alta de usuario del panel fallida:', error);
    return NextResponse.json({ mensaje: 'No fue posible crear la cuenta.' }, { status: 500 });
  }

  // Sin contraseña, la única forma de entrar es el enlace: se envía solo.
  let enlaceEnviado = false;
  if (!clave) {
    const token = await crearEnlaceAcceso(correo);
    if (token) {
      const enlace = `${urlSitio().replace(/\/$/, '')}/acceso/${token}`;
      const resultado = await enviarCorreoSimple({
        para: correo,
        asunto: 'Acceso al panel · 1er Congreso',
        html: `<p>Se le dio de alta en el panel de control del 1er Congreso.</p>
<p>Para entrar, abra este enlace:</p>
<p><a href="${enlace}">${enlace}</a></p>
<p>El enlace caduca en 30 minutos y sólo sirve una vez. Después podrá pedir
otro desde la propia página de acceso.</p>`,
      });
      enlaceEnviado = resultado.enviado;
    }
  }

  return NextResponse.json({ creado: true, enlaceEnviado });
}
