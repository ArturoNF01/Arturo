import type { Metadata } from 'next';
import { leerAvisoPrivacidad } from '@/lib/servidor/contenido';
import { PaginaAviso } from './pagina-aviso';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Aviso de privacidad · 1er Congreso de Estudios Interamericanos de Seguridad Social',
};

export default async function AvisoPrivacidad() {
  const { filas } = await leerAvisoPrivacidad();
  return <PaginaAviso bloques={filas} />;
}
