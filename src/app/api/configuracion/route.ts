import { NextResponse } from 'next/server';
import { leerConfiguracion } from '@/lib/servidor/configuracion';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configuracion = await leerConfiguracion();
  return NextResponse.json(configuracion, { headers: { 'Cache-Control': 'no-store' } });
}
