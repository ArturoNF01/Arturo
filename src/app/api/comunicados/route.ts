import { NextRequest, NextResponse } from 'next/server';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { AUDIENCIAS, esPlantillaMasiva, type Audiencia, type IdiomaEnvio, idiomaDeEnvio } from '@/lib/comunicados';
import { crearCampana, listarCampanas } from '@/lib/servidor/comunicados';

export const dynamic = 'force-dynamic';

/** Los envíos de un comunicado, del más reciente al más antiguo, con su avance. */
export async function GET(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).enviarComunicados) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }
  const clave = peticion.nextUrl.searchParams.get('clave') ?? 'comunicado';
  if (!esPlantillaMasiva(clave)) return NextResponse.json({ mensaje: 'Plantilla no válida.' }, { status: 422 });

  try {
    return NextResponse.json({ campanas: await listarCampanas(clave) });
  } catch (error) {
    console.error('No se pudieron leer los envíos:', error);
    return NextResponse.json({ mensaje: 'No fue posible leer los envíos.' }, { status: 500 });
  }
}

/**
 * Crea un envío: congela la plantilla y deja a cada persona pendiente. No manda ningún correo:
 * eso ocurre tanda a tanda en `/api/comunicados/[id]/enviar`, después de esta confirmación.
 */
export async function POST(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).enviarComunicados) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.CORREO_REMITENTE) {
    return NextResponse.json({ mensaje: 'Resend no está configurado.' }, { status: 503 });
  }

  const cuerpo = (await peticion.json().catch(() => null)) as Record<string, unknown> | null;
  const clave = String(cuerpo?.clave ?? 'comunicado');
  const audiencia = String(cuerpo?.audiencia ?? '') as Audiencia;
  if (!esPlantillaMasiva(clave) || !AUDIENCIAS.includes(audiencia)) {
    return NextResponse.json({ mensaje: 'Petición no válida.' }, { status: 422 });
  }

  try {
    const resultado = await crearCampana({
      clave,
      audiencia,
      lista: typeof cuerpo?.lista === 'string' ? cuerpo.lista : '',
      incluirListaEspera: cuerpo?.incluirListaEspera === true,
      idioma: idiomaDeEnvio(String(cuerpo?.idioma ?? 'es')) as IdiomaEnvio,
      confirmacion: cuerpo?.confirmacion,
      usuarioId: usuario.id,
    });
    if (!resultado.ok) {
      return NextResponse.json(
        { mensaje: resultado.mensaje, codigo: resultado.codigo, campanaEnCurso: resultado.campanaEnCurso },
        { status: resultado.codigo === 'invalido' || resultado.codigo === 'sin_plantilla' ? 422 : 409 },
      );
    }
    return NextResponse.json({ id: resultado.id, total: resultado.total });
  } catch (error) {
    console.error('No se pudo crear el envío:', error);
    return NextResponse.json({ mensaje: 'No fue posible crear el envío.' }, { status: 500 });
  }
}
