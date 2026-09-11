import { IDIOMAS, type Idioma } from '@/i18n';
import { FAQS } from '@/i18n/faqs';
import { AVISO } from '@/i18n/aviso-privacidad';

/** Texto en los tres idiomas del congreso. */
export type Multilingue = Partial<Record<Idioma, string>>;
export type MultilingueLista = Partial<Record<Idioma, string[]>>;

export function traducir(texto: Multilingue | null | undefined, idioma: Idioma): string {
  if (!texto) return '';
  return texto[idioma] ?? texto.es ?? Object.values(texto).find(Boolean) ?? '';
}

export function traducirLista(lista: MultilingueLista | null | undefined, idioma: Idioma): string[] {
  if (!lista) return [];
  return lista[idioma] ?? lista.es ?? Object.values(lista).find(Boolean) ?? [];
}

export interface EjeTematico {
  clave: string;
  nombre: Multilingue;
  descripcion: Multilingue;
  orden: number;
  activo: boolean;
}

export interface Faq {
  clave: string;
  categoria: Multilingue;
  pregunta: Multilingue;
  respuesta: Multilingue;
  orden: number;
  activa: boolean;
  provisional: boolean;
}

export interface BloqueAvisoPrivacidad {
  clave: string;
  titulo: Multilingue;
  parrafos: MultilingueLista;
  orden: number;
  activo: boolean;
}

/**
 * Propuesta de ejes temáticos. Se usa cuando la tabla `ejes_tematicos` aún no
 * tiene filas, de modo que el formulario funcione desde el primer arranque.
 * El comité los sustituye desde Panel → Configuración.
 */
export const EJES_POR_DEFECTO: EjeTematico[] = [
  {
    clave: 'cobertura_informalidad',
    nombre: {
      es: 'Cobertura, informalidad y nuevas formas de trabajo',
      en: 'Coverage, informality and new forms of work',
      pt: 'Cobertura, informalidade e novas formas de trabalho',
    },
    descripcion: {
      es: 'Extensión de la cobertura a personas trabajadoras informales, independientes y de plataformas digitales.',
      en: 'Extending coverage to informal, self-employed and platform workers.',
      pt: 'Extensão da cobertura a trabalhadores informais, autônomos e de plataformas digitais.',
    },
    orden: 1, activo: true,
  },
  {
    clave: 'sostenibilidad_pensiones',
    nombre: {
      es: 'Sostenibilidad financiera y reformas de los sistemas de pensiones',
      en: 'Financial sustainability and pension system reform',
      pt: 'Sustentabilidade financeira e reformas dos sistemas de previdência',
    },
    descripcion: {
      es: 'Suficiencia de las prestaciones, equilibrio actuarial y economía política de las reformas.',
      en: 'Benefit adequacy, actuarial balance and the political economy of reform.',
      pt: 'Suficiência dos benefícios, equilíbrio atuarial e economia política das reformas.',
    },
    orden: 2, activo: true,
  },
  {
    clave: 'salud_cuidados_envejecimiento',
    nombre: {
      es: 'Salud, cuidados de largo plazo y envejecimiento',
      en: 'Health, long-term care and ageing',
      pt: 'Saúde, cuidados de longa duração e envelhecimento',
    },
    descripcion: {
      es: 'Transición demográfica, sistemas de cuidados y sostenibilidad de los servicios de salud.',
      en: 'Demographic transition, care systems and the sustainability of health services.',
      pt: 'Transição demográfica, sistemas de cuidados e sustentabilidade dos serviços de saúde.',
    },
    orden: 3, activo: true,
  },
  {
    clave: 'desigualdad_genero',
    nombre: {
      es: 'Protección social, desigualdad y género',
      en: 'Social protection, inequality and gender',
      pt: 'Proteção social, desigualdade e gênero',
    },
    descripcion: {
      es: 'Brechas de acceso, trabajo de cuidados no remunerado y diseño de prestaciones con perspectiva de género.',
      en: 'Access gaps, unpaid care work and gender-responsive benefit design.',
      pt: 'Lacunas de acesso, trabalho de cuidado não remunerado e desenho de benefícios com perspectiva de gênero.',
    },
    orden: 4, activo: true,
  },
  {
    clave: 'digitalizacion_gobernanza',
    nombre: {
      es: 'Transformación digital y gobernanza de las instituciones',
      en: 'Digital transformation and institutional governance',
      pt: 'Transformação digital e governança das instituições',
    },
    descripcion: {
      es: 'Datos, inteligencia artificial, transparencia y capacidad institucional de los organismos de seguridad social.',
      en: 'Data, artificial intelligence, transparency and institutional capacity of social security bodies.',
      pt: 'Dados, inteligência artificial, transparência e capacidade institucional dos organismos de seguridade social.',
    },
    orden: 5, activo: true,
  },
  {
    clave: 'migracion_portabilidad',
    nombre: {
      es: 'Migración, portabilidad de derechos y convenios internacionales',
      en: 'Migration, portability of rights and international agreements',
      pt: 'Migração, portabilidade de direitos e acordos internacionais',
    },
    descripcion: {
      es: 'Convenios multilaterales, totalización de periodos y protección de personas trabajadoras migrantes.',
      en: 'Multilateral agreements, totalisation of periods and protection of migrant workers.',
      pt: 'Acordos multilaterais, totalização de períodos e proteção de trabalhadores migrantes.',
    },
    orden: 6, activo: true,
  },
];

/** Une las tres versiones de las FAQs del código en registros multilingües. */
export function faqsPorDefecto(): Faq[] {
  return FAQS.es.map((pregunta, indice) => {
    const construir = (campo: 'categoria' | 'pregunta' | 'respuesta'): Multilingue => {
      const valores: Multilingue = {};
      for (const idioma of IDIOMAS) {
        const equivalente =
          FAQS[idioma].find((p) => p.id === pregunta.id) ?? FAQS[idioma][indice];
        if (equivalente) valores[idioma] = equivalente[campo];
      }
      return valores;
    };

    return {
      clave: pregunta.id,
      categoria: construir('categoria'),
      pregunta: construir('pregunta'),
      respuesta: construir('respuesta'),
      orden: indice + 1,
      activa: true,
      provisional: Boolean(pregunta.provisional),
    };
  });
}

/** Une las tres versiones del aviso de privacidad en bloques multilingües. */
export function avisoPorDefecto(): BloqueAvisoPrivacidad[] {
  return AVISO.es.bloques.map((bloque, indice) => {
    const titulo: Multilingue = {};
    const parrafos: MultilingueLista = {};
    for (const idioma of IDIOMAS) {
      const equivalente = AVISO[idioma].bloques[indice];
      if (!equivalente) continue;
      titulo[idioma] = equivalente.titulo;
      parrafos[idioma] = equivalente.parrafos;
    }
    return {
      clave: `bloque_${String(indice + 1).padStart(2, '0')}`,
      titulo,
      parrafos,
      orden: indice + 1,
      activo: true,
    };
  });
}

/** Datos del congreso que el panel puede editar, con la propuesta inicial. */
export interface DatosCongreso {
  nombre: Multilingue;
  nombre_corto: Multilingue;
  sede: Multilingue;
  fechas: Multilingue;
  fecha_inicio: string;
  fecha_fin: string;
  limite_semblanza_palabras: number;
  limite_semblanza_caracteres: number;
  limite_resumen_caracteres: number;
  foto_megabytes_maximo: number;
}

export const CONGRESO_POR_DEFECTO: DatosCongreso = {
  nombre: {
    es: '1er Congreso de Estudios Interamericanos de Seguridad Social',
    en: '1st Congress of Inter-American Social Security Studies',
    pt: '1º Congresso de Estudos Interamericanos de Seguridade Social',
  },
  nombre_corto: {
    es: '1er Congreso de Estudios Interamericanos de Seguridad Social',
    en: '1st Congress of Inter-American Social Security Studies',
    pt: '1º Congresso de Estudos Interamericanos de Seguridade Social',
  },
  sede: {
    es: 'CIESS · Ciudad de México, México',
    en: 'CIESS · Mexico City, Mexico',
    pt: 'CIESS · Cidade do México, México',
  },
  fechas: {
    es: '11, 12 y 13 de noviembre de 2026',
    en: '11-13 November 2026',
    pt: '11, 12 e 13 de novembro de 2026',
  },
  fecha_inicio: '2026-11-11',
  fecha_fin: '2026-11-13',
  limite_semblanza_palabras: 60,
  limite_semblanza_caracteres: 420,
  limite_resumen_caracteres: 2000,
  foto_megabytes_maximo: 10,
};
