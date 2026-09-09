import { NextResponse } from 'next/server';
import { leerConfiguracion } from '@/lib/servidor/configuracion';

export const dynamic = 'force-dynamic';

/**
 * Enlace estable a la agenda del congreso. Mientras no exista la agenda
 * definitiva apunta al PDF de la convocatoria; el destino se cambia desde
 * el panel sin tocar el código ni los enlaces ya repartidos.
 */
export async function GET() {
  const { url_agenda } = await leerConfiguracion();
  return NextResponse.redirect(url_agenda, { status: 307 });
}
