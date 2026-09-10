import { NextRequest, NextResponse } from 'next/server';
import { conActor } from '@/lib/bd/conexion';
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

  try {
    for (const [clave, valor] of Object.entries(analisis.data)) {
      if (valor === undefined) continue;
      await conActor(
        usuario.id,
        `update configuracion
            set valor = $1::jsonb, actualizado_por = $2, actualizado_en = now()
          where clave = $3`,
        [JSON.stringify(valor), usuario.id, clave],
      );
    }
  } catch (error) {
    console.error('No se pudo guardar la configuración:', error);
    return NextResponse.json({ mensaje: 'No fue posible guardar los cambios.' }, { status: 500 });
  }

  return NextResponse.json({ guardado: true });
}
