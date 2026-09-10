import { exigirUsuario } from '@/lib/servidor/sesion';
import { consultar } from '@/lib/bd/conexion';
import { GestionUsuarios, type UsuarioFila } from '@/componentes/panel/gestion-usuarios';

export const dynamic = 'force-dynamic';

export default async function PaginaUsuarios() {
  await exigirUsuario('superadmin');

  const usuarios = await consultar<UsuarioFila>(
    `select id, correo, nombre, rol, activo, creado_en, ultimo_acceso,
            clave_hash is not null as tiene_clave
       from usuarios_panel
      order by creado_en`,
  ).catch(() => []);

  return <GestionUsuarios usuarios={usuarios} />;
}
