import { NextRequest, NextResponse } from 'next/server';
import { MAXIMO_DE_LA_LISTA, correosDeUnTexto } from '@/lib/constancias';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { verificarListaDeConstancias } from '@/lib/servidor/constancias';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Comprueba una lista de correos contra la hoja: de cada uno, si le toca su constancia o por qué no (no está en la hoja, no tiene
 * «Con registro», no tiene enlace, ya la recibió…). Sólo lee: no crea ningún envío. Lo que sale de aquí es lo que se enseña antes
 * de confirmar; el envío vuelve a comprobarlo contra la hoja.
 */
export async function POST(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).enviarComunicados) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const cuerpo = (await peticion.json().catch(() => null)) as Record<string, unknown> | null;
  const correos = correosDeUnTexto(typeof cuerpo?.texto === 'string' ? cuerpo.texto : '');
  if (correos.length === 0) return NextResponse.json({ mensaje: 'Escriba al menos un correo.' }, { status: 422 });
  if (correos.length > MAXIMO_DE_LA_LISTA) {
    return NextResponse.json({ mensaje: `La lista tiene ${correos.length} correos y el máximo es ${MAXIMO_DE_LA_LISTA}: para más, use un grupo.` }, { status: 422 });
  }

  try {
    const r = await verificarListaDeConstancias({ correos, reenviar: cuerpo?.reenviar === true });
    return NextResponse.json({
      verificacion: r.verificacion,
      porEnviar: r.destinatarios.length,
      reenvios: r.reenvios,
      enlaceNuevo: r.enlaceNuevo,
      porIdioma: r.porIdioma,
    });
  } catch (error) {
    return NextResponse.json({ mensaje: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
