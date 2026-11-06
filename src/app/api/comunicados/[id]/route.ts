import { NextRequest, NextResponse } from 'next/server';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { erroresDeCampana, repositorioPg } from '@/lib/servidor/comunicados';
import { faltaPorEnviar } from '@/lib/comunicados';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El avance de un envío y las direcciones a las que no se pudo escribir. */
export async function GET(_peticion: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).enviarComunicados) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }
  const { id } = await contexto.params;
  if (!UUID.test(id)) return NextResponse.json({ mensaje: 'Envío no encontrado.' }, { status: 404 });

  const progreso = await repositorioPg.progreso(id);
  if (progreso.total === 0) return NextResponse.json({ mensaje: 'Envío no encontrado.' }, { status: 404 });
  return NextResponse.json({
    progreso,
    faltaPorEnviar: faltaPorEnviar(progreso),
    errores: await erroresDeCampana(id),
  });
}
