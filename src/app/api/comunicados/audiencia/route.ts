import { NextRequest, NextResponse } from 'next/server';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { AUDIENCIAS, esPlantillaMasiva, idiomaDeEnvio, type Audiencia } from '@/lib/comunicados';
import { calcularAudiencia } from '@/lib/servidor/comunicados';

export const dynamic = 'force-dynamic';

/**
 * A cuántas personas llegaría un envío, y a quiénes se deja fuera y por qué. Sólo cuenta: no escribe
 * nada ni manda nada. Es lo que se le enseña a quien va a confirmar.
 */
export async function POST(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).enviarComunicados) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const cuerpo = (await peticion.json().catch(() => null)) as Record<string, unknown> | null;
  const clave = String(cuerpo?.clave ?? 'comunicado');
  const audiencia = String(cuerpo?.audiencia ?? '') as Audiencia;
  if (!esPlantillaMasiva(clave) || !AUDIENCIAS.includes(audiencia)) {
    return NextResponse.json({ mensaje: 'Petición no válida.' }, { status: 422 });
  }

  try {
    const r = await calcularAudiencia({
      clave,
      audiencia,
      lista: typeof cuerpo?.lista === 'string' ? cuerpo.lista : '',
      incluirListaEspera: cuerpo?.incluirListaEspera === true,
      idioma: idiomaDeEnvio(String(cuerpo?.idioma ?? 'es')),
    });
    if (!r.ok) return NextResponse.json({ mensaje: r.mensaje }, { status: 422 });
    // Las direcciones no viajan al navegador: basta con las cifras.
    return NextResponse.json({
      total: r.total,
      porIdioma: r.porIdioma,
      excluidos: r.excluidos,
      repetidosEnLista: r.repetidosEnLista,
    });
  } catch (error) {
    console.error('No se pudo calcular la audiencia:', error);
    return NextResponse.json({ mensaje: 'No fue posible calcular la audiencia.' }, { status: 500 });
  }
}
