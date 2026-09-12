import type { Metadata } from 'next';
import { PaginaInstalaciones } from './pagina-instalaciones';

export const metadata: Metadata = {
  title: 'Instalaciones · 1er Congreso de Estudios Interamericanos de Seguridad Social',
  description: 'Fotografías del campus del CIESS en la Ciudad de México, sede del congreso.',
};

export default function Instalaciones() {
  return <PaginaInstalaciones />;
}
