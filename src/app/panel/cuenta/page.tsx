import { exigirUsuario } from '@/lib/servidor/sesion';
import { unaFila } from '@/lib/bd/conexion';
import { MiCuenta } from '@/componentes/panel/mi-cuenta';

export const dynamic = 'force-dynamic';

/** Sin rol mínimo: cualquiera que tenga cuenta puede cambiar su contraseña. */
export default async function PaginaCuenta() {
  const yo = await exigirUsuario();

  const fila = await unaFila<{ tiene_clave: boolean }>(
    'select clave_hash is not null as tiene_clave from usuarios_panel where id = $1',
    [yo.id],
  ).catch(() => null);

  return (
    <MiCuenta
      correo={yo.correo}
      nombre={yo.nombre}
      rol={yo.rol}
      tieneClave={Boolean(fila?.tiene_clave)}
    />
  );
}
