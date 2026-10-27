import { NextRequest, NextResponse } from 'next/server';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { urlAgendaSegunIdioma } from '@/lib/agenda';

export const dynamic = 'force-dynamic';

/**
 * Enlace estable a la agenda del congreso. El destino se cambia desde el
 * panel sin tocar el código ni los enlaces ya repartidos.
 *
 * Va a la versión en portugués si el visitante tiene el sitio en ese idioma,
 * que es lo que dice la cookie que deja el selector de idioma.
 */
export async function GET(peticion: NextRequest) {
  const { url_agenda, url_agenda_pt } = await leerConfiguracion();
  const idioma = peticion.cookies.get('congreso.idioma')?.value ?? 'es';
  const destino = urlAgendaSegunIdioma({ general: url_agenda, pt: url_agenda_pt }, idioma);
  return NextResponse.redirect(destino, { status: 307 });
}
