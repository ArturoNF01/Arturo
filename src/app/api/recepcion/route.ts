import { NextRequest, NextResponse } from 'next/server';
import { leerSegundos } from '@/lib/recepcion';
import { armarParaPeticion } from '@/lib/servidor/recepcion-peticion';

export const dynamic = 'force-dynamic';

const SIN_CACHE = { 'Cache-Control': 'no-store' };

/**
 * Lo que la pantalla de recepción (`/qr`) vuelve a pedir cada minuto: los dos QR, la agenda del día, el aviso y la hora del
 * servidor. Es público, como la propia pantalla: sólo trae lo que está impreso en la sede y lo que ya es público en el sitio.
 *
 * La pantalla lo pide con `fetch` y no con `router.refresh()` a propósito: cuando una petición de Next falla, éste pasa
 * a una navegación completa, y en una pantalla sin nadie que la atienda eso deja la página de «sin conexión» del navegador.
 * Con `fetch` un fallo no cuesta nada: la pantalla se queda con lo último que tenía.
 */
export async function GET(peticion: NextRequest) {
  const consulta = peticion.nextUrl.searchParams;
  const datos = await armarParaPeticion({
    dia: consulta.get('dia') ?? undefined,
    hora: consulta.get('hora') ?? undefined,
    ligero: consulta.get('ligero') === '1',
    segundos: leerSegundos(consulta.get('segundos')),
  });
  if (!datos) return NextResponse.json({ mensaje: 'No disponible por ahora.' }, { status: 503, headers: SIN_CACHE });
  return NextResponse.json(datos, { headers: SIN_CACHE });
}
