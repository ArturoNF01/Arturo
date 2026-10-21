import type { Idioma } from '@/i18n';

/**
 * El programa general del Congreso, tal como lo publicó el comité.
 *
 * Vive aquí y no en la base por la misma razón que el calendario de fechas
 * importantes: es contenido acordado que cambia dos o tres veces en la vida
 * del sitio, no un dato que el comité ajuste desde el panel. El PDF sigue
 * siendo la versión de referencia —lo dice la nota al pie de la sección— y
 * esto es lo que se lee sin descargar nada.
 *
 * Las sesiones paralelas comparten horario a propósito: el jueves por la
 * tarde y todo el viernes hay dos salas a la vez, y esconderlo obligaría a
 * abrir el PDF justo a quien está decidiendo a cuál entrar.
 */

type Texto = Record<Idioma, string>;

const AUDITORIO: Texto = { es: 'Auditorio', en: 'Auditorium', pt: 'Auditório' };
const COMISIONES: Texto = {
  es: 'Sala de comisiones, planta baja',
  en: 'Committee room, ground floor',
  pt: 'Sala de comissões, térreo',
};
const SESIONES: Texto = {
  es: 'Sala de sesiones, planta baja',
  en: 'Session room, ground floor',
  pt: 'Sala de sessões, térreo',
};
const ENTRADA: Texto = { es: 'Entrada', en: 'Entrance', pt: 'Entrada' };

const REGISTRO: Texto = {
  es: 'Registro de participantes',
  en: 'Participant registration',
  pt: 'Credenciamento de participantes',
};
const ALMUERZO: Texto = { es: 'Almuerzo', en: 'Lunch', pt: 'Almoço' };

export interface SesionPrograma {
  /** El horario no se traduce: 09:00–10:30 se lee igual en los tres idiomas. */
  horario: string;
  actividad: Texto;
  sala?: Texto;
  /** Pausas y trámites: se pintan apagados porque no son sesiones. */
  menor?: boolean;
}

export interface DiaPrograma {
  iso: string;
  fecha: Texto;
  titulo: Texto;
  nota?: Texto;
  sesiones: SesionPrograma[];
}

export const PROGRAMA: DiaPrograma[] = [
  {
    iso: '2026-11-11',
    fecha: { es: 'Miércoles 11 de noviembre', en: 'Wednesday 11 November', pt: 'Quarta-feira, 11 de novembro' },
    titulo: { es: 'Jornada de la RIUSS', en: 'RIUSS working day', pt: 'Jornada da RIUSS' },
    nota: {
      es: 'Sesiones de trabajo de las instituciones integrantes de la RIUSS. Se admite la asistencia del público, con cupo limitado según la capacidad de la sala.',
      en: 'Working sessions of the RIUSS member institutions. Open to the public, with limited seating subject to room capacity.',
      pt: 'Sessões de trabalho das instituições integrantes da RIUSS. É admitida a presença do público, com vagas limitadas conforme a capacidade da sala.',
    },
    sesiones: [
      { horario: '08:30–09:00', actividad: REGISTRO, sala: COMISIONES, menor: true },
      {
        horario: '09:00–10:30',
        actividad: { es: 'Mesa de Trabajo RIUSS · Salud', en: 'RIUSS working group · Health', pt: 'Mesa de Trabalho RIUSS · Saúde' },
        sala: COMISIONES,
      },
      {
        horario: '10:30–12:00',
        actividad: { es: 'Mesa de Trabajo RIUSS · Pensiones', en: 'RIUSS working group · Pensions', pt: 'Mesa de Trabalho RIUSS · Pensões' },
        sala: COMISIONES,
      },
      { horario: '12:00–13:00', actividad: ALMUERZO, menor: true },
      {
        horario: '13:00–14:30',
        actividad: {
          es: 'Mesa de Trabajo RIUSS · Riesgos Laborales',
          en: 'RIUSS working group · Occupational risks',
          pt: 'Mesa de Trabalho RIUSS · Riscos do Trabalho',
        },
        sala: COMISIONES,
      },
      {
        horario: '14:30–16:00',
        actividad: { es: 'Mesa de Trabajo RIUSS · Cuidados', en: 'RIUSS working group · Care', pt: 'Mesa de Trabalho RIUSS · Cuidados' },
        sala: COMISIONES,
      },
      {
        horario: '16:00–17:00',
        actividad: { es: 'Reunión General de la RIUSS', en: 'RIUSS General Meeting', pt: 'Reunião Geral da RIUSS' },
        sala: COMISIONES,
      },
    ],
  },
  {
    iso: '2026-11-12',
    fecha: { es: 'Jueves 12 de noviembre', en: 'Thursday 12 November', pt: 'Quinta-feira, 12 de novembro' },
    titulo: {
      es: 'Inauguración y mesas temáticas 1 a 4',
      en: 'Opening and thematic panels 1 to 4',
      pt: 'Abertura e mesas temáticas 1 a 4',
    },
    sesiones: [
      { horario: '08:30–09:00', actividad: REGISTRO, sala: ENTRADA, menor: true },
      {
        horario: '09:00–09:30',
        actividad: { es: 'Sesión de apertura', en: 'Opening session', pt: 'Sessão de abertura' },
        sala: AUDITORIO,
      },
      {
        horario: '09:30–10:30',
        actividad: {
          es: 'Conferencia magistral · La seguridad social en las Américas en el primer cuarto del siglo XXI: avances, transformaciones y desafíos persistentes',
          en: 'Keynote lecture · Social security in the Americas in the first quarter of the 21st century: progress, transformations and persistent challenges',
          pt: 'Conferência magistral · A seguridade social nas Américas no primeiro quarto do século XXI: avanços, transformações e desafios persistentes',
        },
        sala: AUDITORIO,
      },
      {
        horario: '10:30–12:30',
        actividad: {
          es: 'Mesa temática 1 · Transformaciones del mercado laboral, migración y extensión de la seguridad social',
          en: 'Thematic panel 1 · Labour market transformations, migration and the extension of social security',
          pt: 'Mesa temática 1 · Transformações do mercado de trabalho, migração e extensão da seguridade social',
        },
        sala: AUDITORIO,
      },
      {
        horario: '12:30–14:30',
        actividad: {
          es: 'Mesa temática 2 · Reformas previsionales, cobertura y sostenibilidad en América Latina',
          en: 'Thematic panel 2 · Pension reforms, coverage and sustainability in Latin America',
          pt: 'Mesa temática 2 · Reformas previdenciárias, cobertura e sustentabilidade na América Latina',
        },
        sala: AUDITORIO,
      },
      { horario: '14:30–15:30', actividad: ALMUERZO, menor: true },
      {
        horario: '15:30–17:30',
        actividad: {
          es: 'Mesa temática 3 · Pensiones y desigualdades de género: cuidados, derechos e igualdad',
          en: 'Thematic panel 3 · Pensions and gender inequalities: care, rights and equality',
          pt: 'Mesa temática 3 · Pensões e desigualdades de gênero: cuidados, direitos e igualdade',
        },
        sala: AUDITORIO,
      },
      {
        horario: '15:30–17:30',
        actividad: {
          es: 'Mesa temática 4 · Envejecimiento, dependencia y cuidados: nuevos desafíos de la protección social',
          en: 'Thematic panel 4 · Ageing, dependency and care: new challenges for social protection',
          pt: 'Mesa temática 4 · Envelhecimento, dependência e cuidados: novos desafios da proteção social',
        },
        sala: SESIONES,
      },
    ],
  },
  {
    iso: '2026-11-13',
    fecha: { es: 'Viernes 13 de noviembre', en: 'Friday 13 November', pt: 'Sexta-feira, 13 de novembro' },
    titulo: {
      es: 'Mesas temáticas 5 a 11 y clausura',
      en: 'Thematic panels 5 to 11 and closing',
      pt: 'Mesas temáticas 5 a 11 e encerramento',
    },
    sesiones: [
      {
        horario: '09:00–10:30',
        actividad: {
          es: 'Mesa temática 5 · Derechos previsionales, fragmentación institucional y desigualdades de protección',
          en: 'Thematic panel 5 · Pension rights, institutional fragmentation and inequalities in protection',
          pt: 'Mesa temática 5 · Direitos previdenciários, fragmentação institucional e desigualdades de proteção',
        },
        sala: AUDITORIO,
      },
      {
        horario: '09:00–10:30',
        actividad: {
          es: 'Mesa temática 6 · Financiamiento, inversiones y gestión de recursos de la seguridad social',
          en: 'Thematic panel 6 · Financing, investment and resource management in social security',
          pt: 'Mesa temática 6 · Financiamento, investimentos e gestão de recursos da seguridade social',
        },
        sala: COMISIONES,
      },
      {
        horario: '10:30–12:00',
        actividad: {
          es: 'Mesa temática 7 · Trabajo, justicia restaurativa y seguridad social en contextos de vulnerabilidad',
          en: 'Thematic panel 7 · Work, restorative justice and social security in contexts of vulnerability',
          pt: 'Mesa temática 7 · Trabalho, justiça restaurativa e seguridade social em contextos de vulnerabilidade',
        },
        sala: AUDITORIO,
      },
      {
        horario: '10:30–12:00',
        actividad: {
          es: 'Mesa temática 8 · Seguridad y salud en el trabajo: riesgos, género y nuevas formas de empleo',
          en: 'Thematic panel 8 · Occupational safety and health: risks, gender and new forms of employment',
          pt: 'Mesa temática 8 · Segurança e saúde no trabalho: riscos, gênero e novas formas de emprego',
        },
        sala: COMISIONES,
      },
      { horario: '12:00–13:00', actividad: ALMUERZO, menor: true },
      {
        horario: '13:00–15:00',
        actividad: {
          es: 'Mesa temática 9 · Salud ocupacional, enfermedades crónicas y bienestar de los trabajadores',
          en: 'Thematic panel 9 · Occupational health, chronic disease and worker well-being',
          pt: 'Mesa temática 9 · Saúde ocupacional, doenças crônicas e bem-estar dos trabalhadores',
        },
        sala: AUDITORIO,
      },
      {
        horario: '13:00–15:00',
        actividad: {
          es: 'Mesa temática 10 · Inteligencia artificial, gobernanza digital e innovación en la protección social',
          en: 'Thematic panel 10 · Artificial intelligence, digital governance and innovation in social protection',
          pt: 'Mesa temática 10 · Inteligência artificial, governança digital e inovação na proteção social',
        },
        sala: COMISIONES,
      },
      {
        horario: '15:00–16:50',
        actividad: {
          es: 'Mesa temática 11 · Equidad, financiamiento y gestión de los sistemas de salud',
          en: 'Thematic panel 11 · Equity, financing and management of health systems',
          pt: 'Mesa temática 11 · Equidade, financiamento e gestão dos sistemas de saúde',
        },
        sala: AUDITORIO,
      },
      {
        horario: '16:50–17:30',
        actividad: { es: 'Clausura del Congreso', en: 'Closing of the Congress', pt: 'Encerramento do Congresso' },
        sala: AUDITORIO,
      },
    ],
  },
];

/** Cuántas sesiones de verdad hay: las pausas y los trámites no cuentan. */
export const SESIONES_TOTALES = PROGRAMA.reduce(
  (suma, dia) => suma + dia.sesiones.filter((s) => !s.menor).length,
  0,
);
