import type { Metadata } from 'next';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { PaginaFaqs } from './pagina-faqs';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Preguntas frecuentes · 1er Congreso de Estudios Interamericanos de Seguridad Social',
};

export default async function Faqs() {
  const configuracion = await leerConfiguracion();
  return <PaginaFaqs urlAgenda={configuracion.url_agenda} />;
}
