import { NextRequest, NextResponse } from 'next/server';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { esquemaPlantilla } from '@/lib/esquema';
import { correoDeMuestra } from '@/lib/servidor/muestra-correo';

export const dynamic = 'force-dynamic';

/**
 * El correo tal como llegará —con su envoltura, sus bloques y datos de muestra—,
 * sin enviar nada. Es lo que el comité mira para aprobar el diseño: se arma con la
 * misma función que el envío y que la prueba, así que no puede diferir de ellos.
 */
export async function POST(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarPlantillas) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const analisis = esquemaPlantilla.safeParse(await peticion.json().catch(() => null));
  if (!analisis.success) {
    return NextResponse.json({ mensaje: 'Plantilla no válida.' }, { status: 422 });
  }

  try {
    const correo = await correoDeMuestra({
      clave: analisis.data.clave,
      idioma: analisis.data.idioma,
      plantilla: analisis.data,
      usuario,
    });
    return NextResponse.json(correo);
  } catch (error) {
    console.error('No se pudo armar la vista previa:', error);
    return NextResponse.json({ mensaje: 'No fue posible armar la vista previa.' }, { status: 500 });
  }
}
