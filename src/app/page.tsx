import type { Metadata } from 'next';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { leerDatosCongreso, leerEjes } from '@/lib/servidor/contenido';
import { PaginaInicio } from './inicio/pagina-inicio';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '1er Congreso de Estudios Interamericanos de Seguridad Social',
  description:
    'Desafíos de la seguridad social en las Américas en el primer cuarto del siglo XXI. Ciudad de México, 11 al 13 de noviembre de 2026. Convoca el CIESS.',
};

export default async function Portada() {
  const [configuracion, congreso, { filas: ejes }] = await Promise.all([
    leerConfiguracion(),
    leerDatosCongreso(),
    leerEjes(),
  ]);

  return <PaginaInicio configuracion={configuracion} congreso={congreso} ejes={ejes} />;
}
