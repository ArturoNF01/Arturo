import { exigirUsuario } from '@/lib/servidor/sesion';
import { leerPonencias } from '@/lib/servidor/ponencias';
import { DictamenPonencias } from '@/componentes/panel/dictamen-ponencias';

export const dynamic = 'force-dynamic';

export default async function PaginaDictamen() {
  await exigirUsuario('organizador');
  const ponencias = await leerPonencias();
  return <DictamenPonencias ponencias={ponencias} />;
}
