import { exigirUsuario, permisos } from '@/lib/servidor/sesion';
import { AnaliticaAvanzada } from '@/componentes/panel/analitica-avanzada';

export const dynamic = 'force-dynamic';

export default async function PaginaAnalitica() {
  const usuario = await exigirUsuario();
  return <AnaliticaAvanzada permisos={permisos(usuario.rol)} />;
}
