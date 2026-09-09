import { exigirUsuario, permisos } from '@/lib/servidor/sesion';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { Dashboard } from '@/componentes/panel/dashboard';

export const dynamic = 'force-dynamic';

export default async function PaginaPanel() {
  const usuario = await exigirUsuario();
  const configuracion = await leerConfiguracion();
  return <Dashboard configuracion={configuracion} permisos={permisos(usuario.rol)} />;
}
