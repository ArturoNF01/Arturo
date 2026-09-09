import { exigirUsuario, permisos } from '@/lib/servidor/sesion';
import { TablaRegistros } from '@/componentes/panel/tabla-registros';

export const dynamic = 'force-dynamic';

export default async function PaginaRegistros() {
  const usuario = await exigirUsuario();
  return <TablaRegistros permisos={permisos(usuario.rol)} />;
}
