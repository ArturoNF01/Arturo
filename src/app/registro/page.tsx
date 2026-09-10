import type { Metadata } from 'next';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { leerDatosCongreso, leerEjes } from '@/lib/servidor/contenido';
import { PaginaRegistro } from './pagina-registro';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Registro · 1er Congreso de Estudios Interamericanos de Seguridad Social',
};

export default async function Registro() {
  const [configuracion, congreso, { filas: ejes }] = await Promise.all([
    leerConfiguracion(),
    leerDatosCongreso(),
    leerEjes(),
  ]);

  return <PaginaRegistro configuracion={configuracion} congreso={congreso} ejes={ejes} />;
}
