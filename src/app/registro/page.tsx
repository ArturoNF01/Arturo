import type { Metadata } from 'next';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { PaginaRegistro } from './pagina-registro';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Registro · 1er Congreso de Estudios Interamericanos de Seguridad Social',
};

export default async function Registro() {
  const configuracion = await leerConfiguracion();
  return <PaginaRegistro configuracion={configuracion} />;
}
