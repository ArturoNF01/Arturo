import { NextRequest, NextResponse } from 'next/server';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { enviarSiguienteTanda, repositorioPg } from '@/lib/servidor/comunicados';
import { faltaPorEnviar } from '@/lib/comunicados';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Manda la siguiente tanda de un envío ya confirmado. El panel la llama una y otra vez hasta que no
 * falta nadie; si se interrumpe, basta volver a llamarla: sigue donde iba y no repite a nadie.
 */
export async function POST(_peticion: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).enviarComunicados) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }
  const { id } = await contexto.params;
  if (!UUID.test(id)) return NextResponse.json({ mensaje: 'Envío no encontrado.' }, { status: 404 });

  try {
    const antes = await repositorioPg.progreso(id);
    if (antes.total === 0) return NextResponse.json({ mensaje: 'Envío no encontrado.' }, { status: 404 });

    const r = await enviarSiguienteTanda(id);
    return NextResponse.json({ ...r, faltaPorEnviar: faltaPorEnviar(r.progreso) });
  } catch (error) {
    console.error('No se pudo enviar la tanda:', error);
    return NextResponse.json({ mensaje: 'No fue posible enviar esta tanda. Puede reintentar: no se repite a nadie.' }, { status: 500 });
  }
}
