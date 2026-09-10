import { NextRequest, NextResponse } from 'next/server';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { esquemaConsultaSql } from '@/lib/esquema';

export const dynamic = 'force-dynamic';

/**
 * Ejecuta una consulta de sólo lectura a través de la función
 * `ejecutar_sql_lectura`, que corre con los permisos del propio usuario:
 * las políticas RLS siguen aplicando y sólo admite SELECT o WITH.
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
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('ejecutar_sql_lectura', {
    consulta: analisis.data.consulta,
    limite: analisis.data.limite,
  });

  if (error) {
    return NextResponse.json({ mensaje: error.message }, { status: 400 });
  }

  const filas = (data ?? []) as Record<string, unknown>[];
  return NextResponse.json({
    filas,
    columnas: filas.length > 0 ? Object.keys(filas[0]) : [],
    milisegundos: Date.now() - inicio,
  });
}
