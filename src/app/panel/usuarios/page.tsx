import { exigirUsuario } from '@/lib/servidor/sesion';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { GestionUsuarios, type UsuarioFila } from '@/componentes/panel/gestion-usuarios';

export const dynamic = 'force-dynamic';

export default async function PaginaUsuarios() {
  await exigirUsuario('superadmin');

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from('usuarios_panel')
    .select('id, correo, nombre, rol, activo, creado_en, ultimo_acceso')
    .order('creado_en');

  return <GestionUsuarios usuarios={(data ?? []) as UsuarioFila[]} />;
}
