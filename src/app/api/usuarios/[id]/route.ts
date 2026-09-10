import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { armarActualizacion, conActor, contar } from '@/lib/bd/conexion';
import { cifrarClave } from '@/lib/bd/claves';
import { permisos, usuarioActual } from '@/lib/servidor/sesion';
import { esUuid } from '@/lib/esquema';

export const dynamic = 'force-dynamic';

const esquema = z.object({
  nombre: z.string().trim().max(160).nullable().optional(),
  rol: z.enum(['superadmin', 'organizador', 'cientifico_datos', 'lector']).optional(),
  activo: z.boolean().optional(),
  clave: z.string().min(10).max(200).optional(),
});

/** Cambia el rol, el nombre, el acceso o la contraseña de una cuenta. */
export async function PATCH(peticion: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  if (!esUuid(id)) {
    return NextResponse.json({ mensaje: 'Cuenta no encontrada.' }, { status: 404 });
  }

  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).gestionarUsuarios) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const analisis = esquema.safeParse(await peticion.json().catch(() => null));
  if (!analisis.success) {
    return NextResponse.json({ mensaje: 'Cambios no válidos.' }, { status: 422 });
  }

  const { clave, ...resto } = analisis.data;
  const cambios: Record<string, unknown> = { ...resto };
  if (clave) cambios.clave_hash = await cifrarClave(clave);

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ mensaje: 'No hay nada que cambiar.' }, { status: 422 });
  }

  // Quedarse sin ninguna cuenta de superadministrador deja el panel sin quien
  // pueda gestionar usuarios, y eso ya no se arregla desde la propia página.
  const sePierdeElMando =
    (cambios.rol !== undefined && cambios.rol !== 'superadmin') || cambios.activo === false;

  if (sePierdeElMando) {
    const otros = await contar(
      'usuarios_panel',
      `where rol = 'superadmin' and activo and id <> $1`,
      [id],
    );
    if (otros === 0) {
      return NextResponse.json(
        {
          mensaje:
            'Es la última cuenta de superadministrador activa. Dé de alta otra antes de cambiar ésta.',
        },
        { status: 409 },
      );
    }
  }

  const { asignaciones, valores } = armarActualizacion(cambios);

  try {
    await conActor(
      usuario.id,
      `update usuarios_panel set ${asignaciones} where id = $${valores.length + 1}`,
      [...valores, id],
    );
  } catch (error) {
    console.error('No se pudo actualizar la cuenta:', error);
    return NextResponse.json({ mensaje: 'No fue posible guardar los cambios.' }, { status: 500 });
  }

  return NextResponse.json({ guardado: true });
}
