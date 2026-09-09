import { exigirUsuario } from '@/lib/servidor/sesion';
import { ConsolaSql } from '@/componentes/panel/consola-sql';

export const dynamic = 'force-dynamic';

export default async function PaginaSql() {
  await exigirUsuario('cientifico_datos');
  return <ConsolaSql />;
}
