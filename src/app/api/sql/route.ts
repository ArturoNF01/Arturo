import { NextRequest, NextResponse } from 'next/server';
import { enSoloLectura } from '@/lib/bd/conexion';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { esquemaConsultaSql } from '@/lib/esquema';

export const dynamic = 'force-dynamic';

/**
 * Ejecuta una consulta del perfil de ciencia de datos.
 *
 * La garantía de que no escribe la da el motor, no un filtro de palabras: la
 * consulta corre dentro de una transacción `read only`, donde cualquier
 * escritura falla aunque venga escondida en una función o en un CTE. El
 * tiempo y el número de filas también los limita el propio servidor.
 */
export async function POST(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).consultarSql) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const analisis = esquemaConsultaSql.safeParse(await peticion.json().catch(() => null));
  if (!analisis.success) {
    return NextResponse.json({ mensaje: 'Consulta no válida.' }, { status: 422 });
  }

  const inicio = Date.now();

  let filas: Record<string, unknown>[];
  try {
    filas = await enSoloLectura(async (cliente) => {
      const { rows } = await cliente.query(
        `select * from (${analisis.data.consulta}) as consulta_del_panel limit $1`,
        [analisis.data.limite],
      );
      return rows as Record<string, unknown>[];
    });
  } catch (error) {
    // El mensaje de PostgreSQL es justo lo que necesita quien escribe la
    // consulta: dónde está el error de sintaxis o qué columna no existe.
    return NextResponse.json(
      { mensaje: error instanceof Error ? error.message : 'La consulta falló.' },
      { status: 400 },
    );
  }
  return NextResponse.json({
    filas,
    columnas: filas.length > 0 ? Object.keys(filas[0]) : [],
    milisegundos: Date.now() - inicio,
  });
}
