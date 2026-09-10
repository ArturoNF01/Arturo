import { NextRequest, NextResponse } from 'next/server';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { esquemaConfiguracion } from '@/lib/esquema';

export const dynamic = 'force-dynamic';

/** Actualiza los valores editables desde el panel (cupos, fechas, enlaces). */
export async function PUT(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarConfiguracion) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const analisis = esquemaConfiguracion.safeParse(await peticion.json().catch(() => null));
  if (!analisis.success) {
    return NextResponse.json({ mensaje: 'Configuración no válida.' }, { status: 422 });
  }

  const supabase = await crearClienteServidor();
  for (const [clave, valor] of Object.entries(analisis.data)) {
    if (valor === undefined) continue;
    const { error } = await supabase
      .from('configuracion')
      .update({ valor, actualizado_por: usuario.id })
      .eq('clave', clave);
    if (error) return NextResponse.json({ mensaje: error.message }, { status: 403 });
  }

  return NextResponse.json({ guardado: true });
}
