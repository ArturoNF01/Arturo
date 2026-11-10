import { NextRequest, NextResponse } from 'next/server';
import { estadoDelComunicadoAutomatico, fijarComunicadoAutomatico } from '@/lib/servidor/comunicado-automatico';
import { permisos, usuarioActual } from '@/lib/servidor/sesion';

export const dynamic = 'force-dynamic';

/**
 * El envío automático del comunicado, tras el correo de confirmación de cada registro nuevo: cómo va y el
 * interruptor. Lo maneja quien puede mandar comunicados.
 */
export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).enviarComunicados) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }
  try {
    return NextResponse.json(await estadoDelComunicadoAutomatico());
  } catch (error) {
    console.error('No se pudo leer el envío automático:', error);
    return NextResponse.json({ mensaje: 'No fue posible leer el estado.' }, { status: 500 });
  }
}

export async function POST(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).enviarComunicados) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }
  const cuerpo = (await peticion.json().catch(() => null)) as { activo?: unknown } | null;
  if (typeof cuerpo?.activo !== 'boolean') {
    return NextResponse.json({ mensaje: 'Petición no válida.' }, { status: 422 });
  }
  try {
    await fijarComunicadoAutomatico(cuerpo.activo, usuario.id);
    return NextResponse.json(await estadoDelComunicadoAutomatico());
  } catch (error) {
    console.error('No se pudo cambiar el envío automático:', error);
    return NextResponse.json({ mensaje: 'No fue posible guardar el cambio.' }, { status: 500 });
  }
}
