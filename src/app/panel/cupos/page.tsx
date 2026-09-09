import { exigirUsuario } from '@/lib/servidor/sesion';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { PanelCupos } from '@/componentes/panel/panel-cupos';

export const dynamic = 'force-dynamic';

export default async function PaginaCupos() {
  await exigirUsuario('organizador');
  const configuracion = await leerConfiguracion();
  return <PanelCupos configuracion={configuracion} />;
}
