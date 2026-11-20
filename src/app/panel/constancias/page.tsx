import { exigirUsuario } from '@/lib/servidor/sesion';
import { EnvioConstancias } from '@/componentes/panel/envio-constancias';

export const dynamic = 'force-dynamic';

/** El envío de constancias: a quien organiza (el mismo permiso que los comunicados). */
export default async function PaginaConstancias() {
  await exigirUsuario('organizador');
  return <EnvioConstancias />;
}
