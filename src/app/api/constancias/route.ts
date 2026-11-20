import { NextRequest, NextResponse } from 'next/server';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { listarCampanas } from '@/lib/servidor/comunicados';
import { CLAVE_DE_CONSTANCIA, calcularConstancias, crearCampanaDeConstancias } from '@/lib/servidor/constancias';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Cuántas personas sin constancia se enseñan en la lista, y cuántas de muestra con su enlace. */
const MAXIMO_DE_FALTANTES = 40;
const MUESTRA = 5;

/**
 * Cómo está el envío de constancias: lo que dice la hoja ahora (a quiénes les toca, a quiénes no y por qué) y los envíos anteriores.
 * Sólo lee: no escribe nada ni manda nada. Los correos no viajan al navegador: bastan los nombres y las cifras.
 */
export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).enviarComunicados) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const campanas = await listarCampanas(CLAVE_DE_CONSTANCIA).catch(() => []);
  try {
    const e = await calcularConstancias();
    return NextResponse.json({
      hoja: {
        ok: true,
        filas: e.filas,
        conRegistro: e.conRegistro,
        porEnviar: e.destinatarios.length,
        enlaceNuevo: e.enlaceNuevo,
        porIdioma: e.porIdioma,
        excluidos: e.excluidos,
        faltan: e.faltan.slice(0, MAXIMO_DE_FALTANTES),
        faltanTotal: e.faltan.length,
        muestra: e.destinatarios.slice(0, MUESTRA).map((d) => ({ numero: d.datos.numero, nombre: d.datos.nombre, enlace: d.datos.enlace })),
      },
      campanas,
    });
  } catch (error) {
    // Si la hoja no se puede leer (Google caído, la columna cambió de título), se dice por qué: el historial sigue a la vista.
    return NextResponse.json({ hoja: { ok: false, mensaje: error instanceof Error ? error.message : String(error) }, campanas });
  }
}

/**
 * Crea el envío de constancias: congela la plantilla y deja a cada persona pendiente con su enlace. No manda ningún correo: eso
 * ocurre tanda a tanda en `/api/comunicados/[id]/enviar`, después de esta confirmación.
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
  try {
    const resultado = await crearCampanaDeConstancias({ confirmacion: cuerpo?.confirmacion, usuarioId: usuario.id });
    if (!resultado.ok) {
      return NextResponse.json(
        { mensaje: resultado.mensaje, codigo: resultado.codigo, campanaEnCurso: resultado.campanaEnCurso },
        { status: resultado.codigo === 'invalido' || resultado.codigo === 'sin_plantilla' ? 422 : 409 },
      );
    }
    return NextResponse.json({ id: resultado.id, total: resultado.total });
  } catch (error) {
    console.error('No se pudo crear el envío de constancias:', error);
    return NextResponse.json({ mensaje: error instanceof Error ? error.message : 'No fue posible crear el envío.' }, { status: 500 });
  }
}
