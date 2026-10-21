import type { Metadata } from 'next';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { leerFaqs } from '@/lib/servidor/contenido';
import { PaginaFaqs } from './pagina-faqs';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Preguntas frecuentes · 1er Congreso de Estudios Interamericanos de Seguridad Social',
};

export default async function Faqs() {
  const [configuracion, { filas: faqs }] = await Promise.all([leerConfiguracion(), leerFaqs()]);

  // La pregunta sobre dónde consultar el programa se aparta aquí, en el
  // servidor, y no al pintar: filtrándola en el navegador la respuesta viaja
  // igual dentro de los datos de la página, y lo que no debe verse todavía no
  // tiene por qué estar en el código fuente de nadie.
  const visibles = configuracion.programa_publicado
    ? faqs
    : faqs.filter((f) => f.clave !== 'agenda');
  return (
    <PaginaFaqs
      urlAgenda={configuracion.programa_publicado ? configuracion.url_agenda : ''}
      programaPublicado={configuracion.programa_publicado}
      faqs={visibles}
    />
  );
}
