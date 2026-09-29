import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { consultar, unaFila } from '@/lib/bd/conexion';
import { cifrarClave, claveCoincide, huellaToken } from '@/lib/bd/claves';
import { GALLETA_SESION, usuarioActual } from '@/lib/servidor/sesion';

export const dynamic = 'force-dynamic';

const esquema = z.object({
  clave_actual: z.string().max(200).optional(),
  clave_nueva: z.string().min(10, 'La contraseña nueva va de 10 caracteres en adelante').max(200),
});

/**
 * Cambiar la propia contraseña.
 *
 * Cualquiera que tenga cuenta en el panel puede hacerlo, sin pedírselo a un
 * superadministrador. Hasta ahora sólo quien gestionaba usuarios podía tocar
 * contraseñas, incluida la suya: una persona que sospechara que la suya se vio
 * en una pantalla compartida no tenía manera de cambiarla por su cuenta, y eso
 * es justo cuando más prisa corre.
 *
 * Se exige la contraseña de ahora. La sesión abierta no basta: un equipo sin
 * bloquear, un navegador prestado, y quien pase por ahí se queda con la cuenta
 * cambiando la clave. Quien entra por enlace de correo y todavía no tiene
 * ninguna sí puede ponerse la primera sin más.
 */
export async function PUT(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const analisis = esquema.safeParse(await peticion.json().catch(() => null));
  if (!analisis.success) {
    return NextResponse.json(
      { mensaje: analisis.error.issues[0]?.message ?? 'Cambios no válidos.' },
      { status: 422 },
    );
  }

  const { clave_actual: actual, clave_nueva: nueva } = analisis.data;

  const fila = await unaFila<{ clave_hash: string | null }>(
    'select clave_hash from usuarios_panel where id = $1 and activo',
    [usuario.id],
  );
  if (!fila) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  if (fila.clave_hash) {
    if (!actual || !(await claveCoincide(actual, fila.clave_hash))) {
      return NextResponse.json({ mensaje: 'La contraseña actual no coincide.' }, { status: 422 });
    }
    if (actual === nueva) {
      return NextResponse.json(
        { mensaje: 'La contraseña nueva tiene que ser distinta de la actual.' },
        { status: 422 },
      );
    }
  }

  await consultar('update usuarios_panel set clave_hash = $2 where id = $1', [
    usuario.id,
    await cifrarClave(nueva),
  ]);

  // Las demás sesiones se caen: si la contraseña se cambia porque alguien más
  // la sabía, dejar sus sesiones abiertas no arregla nada. La de quien lo pide
  // sobrevive, para no echarlo de la pantalla en la que está.
  const galleta = peticion.cookies.get(GALLETA_SESION)?.value;
  const huella = galleta ? huellaToken(galleta) : '';
  const cerradas = await consultar<{ id: string }>(
    'delete from sesiones where usuario_id = $1 and token_hash <> $2 returning id',
    [usuario.id, huella],
  );

  return NextResponse.json({ guardado: true, sesionesCerradas: cerradas.length });
}
