import { NextResponse } from 'next/server';
import { bdConfigurada, unaFila } from '@/lib/bd/conexion';

export const dynamic = 'force-dynamic';

/**
 * Señal de vida para el servidor y para quien vigile el sitio desde fuera.
 *
 * Responde 200 sólo si además de estar en pie puede hablar con la base:
 * una aplicación que arrancó pero perdió la base no está sana, y el guion
 * de despliegue tiene que darse cuenta para deshacer la actualización.
 * No revela nada: ni versiones, ni cadenas de conexión, ni conteos.
 */
export async function GET() {
  if (!bdConfigurada()) {
    return NextResponse.json({ estado: 'sin-base' }, { status: 503 });
  }
  try {
    await unaFila('select 1 as uno');
    return NextResponse.json({ estado: 'bien' }, { status: 200 });
  } catch {
    return NextResponse.json({ estado: 'base-inalcanzable' }, { status: 503 });
  }
}
