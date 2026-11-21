import { NextRequest, NextResponse } from 'next/server';
import { consultar } from '@/lib/bd/conexion';
import { GRUPOS_DE_CONSTANCIA, MAXIMO_DE_LA_LISTA, correosDeUnTexto, type AlcanceDeConstancias, type GrupoDeConstancia } from '@/lib/constancias';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { listarCampanas } from '@/lib/servidor/comunicados';
import { CLAVE_DE_CONSTANCIA, calcularPorGrupo, crearCampanaDeConstancias } from '@/lib/servidor/constancias';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Cuántas personas sin constancia se enseñan en la lista de cada grupo, y cuántas de muestra con su enlace. */
const MAXIMO_DE_FALTANTES = 40;
const MUESTRA = 5;

/**
 * Cómo está el envío de constancias: lo que dice la hoja ahora, por grupo (público general y ponentes: a quiénes les toca, a quiénes
 * no y por qué) y los envíos anteriores, con a quién salió cada uno. Sólo lee: no escribe nada ni manda nada. Los correos no viajan
 * al navegador (salvo los de quienes faltan, para ubicar su fila): bastan los nombres y las cifras.
 */
export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).enviarComunicados) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const campanas = await listarCampanas(CLAVE_DE_CONSTANCIA).catch(() => []);
  // A quién salió cada envío (el grupo, la lista): está en los datos de cada fila del envío.
  const alcances = campanas.length === 0
    ? []
    : await consultar<{ campana_id: string; alcance: string | null }>(
        `select campana_id, min(datos->>'alcance') as alcance from envios_campana where campana_id = any($1::uuid[]) group by campana_id`,
        [campanas.map((c) => c.id)],
      ).catch(() => []);
  const conAlcance = campanas.map((c) => ({ ...c, alcance: alcances.find((a) => a.campana_id === c.id)?.alcance ?? null }));

  try {
    const e = await calcularPorGrupo();
    const grupos = Object.fromEntries(GRUPOS_DE_CONSTANCIA.map((g) => {
      const x = e.grupos[g];
      return [g, {
        conRegistro: x.conRegistro,
        perfiles: x.perfiles,
        porEnviar: x.destinatarios.length,
        enlaceNuevo: x.enlaceNuevo,
        porIdioma: x.porIdioma,
        excluidos: x.excluidos,
        faltan: x.faltan.slice(0, MAXIMO_DE_FALTANTES),
        faltanTotal: x.faltan.length,
        sinRegistroFilas: x.sinRegistroFilas.slice(0, MAXIMO_DE_FALTANTES),
        sinRegistroTotal: x.sinRegistroFilas.length,
        muestra: x.destinatarios.slice(0, MUESTRA).map((d) => ({ numero: d.datos.numero, nombre: d.datos.nombre, enlace: d.datos.enlace })),
      }];
    }));
    return NextResponse.json({
      hoja: { ok: true, filas: e.filas, conRegistro: e.conRegistro, sinPerfil: e.sinPerfil, sinPerfilDetalle: e.sinPerfilDetalle, grupos },
      campanas: conAlcance,
    });
  } catch (error) {
    // Si la hoja no se puede leer (Google caído, la columna cambió de título), se dice por qué: el historial sigue a la vista.
    return NextResponse.json({ hoja: { ok: false, mensaje: error instanceof Error ? error.message : String(error) }, campanas: conAlcance });
  }
}

/**
 * Crea el envío de constancias: congela la plantilla y deja a cada persona pendiente con su enlace. No manda ningún correo: eso
 * ocurre tanda a tanda en `/api/comunicados/[id]/enviar`, después de esta confirmación. El envío es de un grupo (público general o
 * ponentes) o de una lista de correos; no hay uno «a todos» desde aquí.
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
  let alcance: AlcanceDeConstancias;
  if (cuerpo?.alcance === 'lista') {
    const correos = correosDeUnTexto(typeof cuerpo.texto === 'string' ? cuerpo.texto : '');
    if (correos.length === 0 || correos.length > MAXIMO_DE_LA_LISTA) {
      return NextResponse.json({ mensaje: `La lista debe llevar de 1 a ${MAXIMO_DE_LA_LISTA} correos.` }, { status: 422 });
    }
    alcance = { tipo: 'lista', correos, reenviar: cuerpo.reenviar === true };
  } else if (GRUPOS_DE_CONSTANCIA.includes(cuerpo?.alcance as GrupoDeConstancia)) {
    alcance = { tipo: 'grupo', grupo: cuerpo?.alcance as GrupoDeConstancia };
  } else {
    return NextResponse.json({ mensaje: 'Falta decir a quién se envía: público general, ponentes o una lista.' }, { status: 422 });
  }

  try {
    const resultado = await crearCampanaDeConstancias({ confirmacion: cuerpo?.confirmacion, usuarioId: usuario.id, alcance });
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
