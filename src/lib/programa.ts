import type { Idioma } from '@/i18n';

/**
 * El programa general del Congreso, tal como lo publicó el comité.
 *
 * Vive aquí y no en la base por la misma razón que el calendario de fechas
 * importantes: es contenido acordado que cambia dos o tres veces en la vida
 * del sitio, no un dato que el comité ajuste desde el panel.
 *
 * Es una transcripción del PDF, y el PDF remite a esta página como la versión
 * vigente («consulte la versión vigente en el sitio del Congreso»): si el
 * comité corrige algo en uno, hay que corregirlo también en el otro. Por eso
 * hay una prueba que cruza los datos entre sí —cada mesa programada una vez,
 * ninguna sala ocupada por dos sesiones a la vez—: una errata de transcripción
 * casi siempre rompe alguna de esas cuentas.
 *
 * Los títulos de las ponencias y los nombres de sus autores van tal como
 * vienen en el programa, en el idioma en que se presentan: se traducen la
 * interfaz, las salas, los cargos y los títulos de las mesas, no los trabajos.
 */

type Texto = Record<Idioma, string>;

// ---------------------------------------------------------------------------
// Salas
// ---------------------------------------------------------------------------

export type ClaveSala = 'lobby' | 'auditorio' | 'comisiones' | 'sesiones';

export const SALAS: Record<ClaveSala, Texto> = {
  lobby: { es: 'Lobby del Auditorio', en: 'Auditorium lobby', pt: 'Lobby do Auditório' },
  auditorio: { es: 'Auditorio', en: 'Auditorium', pt: 'Auditório' },
  comisiones: {
    es: 'Sala de comisiones, planta baja',
    en: 'Committee room, ground floor',
    pt: 'Sala de comissões, térreo',
  },
  sesiones: {
    es: 'Sala de sesiones, planta baja',
    en: 'Session room, ground floor',
    pt: 'Sala de sessões, térreo',
  },
};

// ---------------------------------------------------------------------------
// Países de las ponencias
// ---------------------------------------------------------------------------

export type ClavePais =
  | 'mx' | 'co' | 'ar' | 'cl' | 'pe' | 'py' | 'bz' | 'cr' | 'br' | 'uy' | 'ec' | 'do';

export const PAISES: Record<ClavePais, Texto> = {
  mx: { es: 'México', en: 'Mexico', pt: 'México' },
  co: { es: 'Colombia', en: 'Colombia', pt: 'Colômbia' },
  ar: { es: 'Argentina', en: 'Argentina', pt: 'Argentina' },
  cl: { es: 'Chile', en: 'Chile', pt: 'Chile' },
  pe: { es: 'Perú', en: 'Peru', pt: 'Peru' },
  py: { es: 'Paraguay', en: 'Paraguay', pt: 'Paraguai' },
  bz: { es: 'Belice', en: 'Belize', pt: 'Belize' },
  cr: { es: 'Costa Rica', en: 'Costa Rica', pt: 'Costa Rica' },
  br: { es: 'Brasil', en: 'Brazil', pt: 'Brasil' },
  uy: { es: 'Uruguay', en: 'Uruguay', pt: 'Uruguai' },
  ec: { es: 'Ecuador', en: 'Ecuador', pt: 'Equador' },
  do: { es: 'República Dominicana', en: 'Dominican Republic', pt: 'República Dominicana' },
};

// ---------------------------------------------------------------------------
// Mesas temáticas y sus ponencias
// ---------------------------------------------------------------------------

export interface Ponencia {
  titulo: string;
  autores: string[];
  /** «y colaboradores»: va al final de la lista, no como un autor más. */
  colaboradores?: true;
  pais: ClavePais;
}

export interface Mesa {
  numero: number;
  titulo: Texto;
  ponencias: Ponencia[];
}

export const MESAS: Mesa[] = [
  {
    numero: 1,
    titulo: {
      es: 'Transformaciones del mercado laboral, migración y extensión de la seguridad social',
      en: 'Labour market transformations, migration and the extension of social security',
      pt: 'Transformações do mercado de trabalho, migração e extensão da seguridade social',
    },
    ponencias: [
      {
        titulo: 'Reducción de jornada laboral y seguridad social en México ¿qué nos dice la evidencia antes de que empiece la cuenta regresiva?',
        autores: ['Luis Felipe Pérez Gómez'], pais: 'mx',
      },
      {
        titulo: 'Voluntariedad previsional y acceso al aseguramiento de trabajadores independientes en Hispanoamérica.',
        autores: ['Ángel Edoardo Ruiz Buenrostro'], pais: 'mx',
      },
      {
        titulo: 'Migración Laboral: retos y oportunidades para la protección social.',
        autores: ['José Gabriel Martínez'], pais: 'mx',
      },
      {
        titulo: 'Modelado markoviano de aportes previsionales con estados enriquecidos.',
        autores: ['Sebastian Grillo'], pais: 'py',
      },
    ],
  },
  {
    numero: 2,
    titulo: {
      es: 'Reformas previsionales, cobertura y sostenibilidad en América Latina',
      en: 'Pension reforms, coverage and sustainability in Latin America',
      pt: 'Reformas previdenciárias, cobertura e sustentabilidade na América Latina',
    },
    ponencias: [
      {
        titulo: '¿Es la PGU chilena un modelo exportable o un caso excepcional? Lecciones para el diseño de pensiones no contributivas en América Latina.',
        autores: ['Soledad Hormazábal', 'Pedro Pizarro'], pais: 'cl',
      },
      {
        titulo: 'Reformas pensionales subsidiarias del sistema de capitalización individual.',
        autores: ['María Ascensión Morales Ramírez'], pais: 'mx',
      },
      {
        titulo: 'Cobertura y financiamiento en la política previsional reciente. Los casos de Argentina, Chile y Colombia.',
        autores: ['Nelson Cardozo', 'Sergio Carpenter'], pais: 'ar',
      },
      {
        titulo: 'Los desafíos de la seguridad social en América Latina: restricciones estructurales para la garantía sostenible de los derechos sociales. Evidencia a partir del sistema pensional colombiano.',
        autores: ['Flor Esther Salazar Guatibonza'], pais: 'co',
      },
      {
        titulo: 'Salario Mínimo, reglas contributivas y segmentación pensional en Colombia.',
        autores: ['Jorge Armando Rodríguez'], pais: 'co',
      },
    ],
  },
  {
    numero: 3,
    titulo: {
      es: 'Pensiones y desigualdades de género: cuidados, derechos e igualdad',
      en: 'Pensions and gender inequalities: care, rights and equality',
      pt: 'Pensões e desigualdades de gênero: cuidados, direitos e igualdade',
    },
    ponencias: [
      {
        titulo: 'Políticas Previsionales y desigualdades de género en Argentina. Reconocimiento de Aportes por Tareas de Cuidados.',
        autores: ['Sandra Montiel', 'Camila Machado'], pais: 'ar',
      },
      {
        titulo: 'Desigualdades de género en el acceso a las pensiones en México.',
        autores: ['Isalia Nava Bolaños'], pais: 'mx',
      },
      {
        titulo: 'Tutela constitucional del viudo, diferenciación por razón de género y acceso a la pensión en la jurisprudencia del Tribunal Constitucional del Perú.',
        autores: ['L. Alberto Huamán Ordoñez', 'Javier H. Espinoza Escobar'], pais: 'pe',
      },
      {
        titulo: 'El rol histórico de la prestación de pensión por fallecimiento en la Argentina. Su comparación con los países del Cono Sur. El impacto ante posibles reformas. El reto de la sostenibilidad, atención a las nuevas dinámicas laborales y las brechas de género.',
        autores: ['Nuria Ape', 'Bruno Bagnarelli'], pais: 'ar',
      },
      {
        titulo: 'The ‘Transnational Turn’ in Social Protection Policy: A case study of Belizean women as caregivers in the United States.',
        autores: ['Melanie C. Smith'], pais: 'bz',
      },
    ],
  },
  {
    numero: 4,
    titulo: {
      es: 'Envejecimiento, dependencia y cuidados: nuevos desafíos de la protección social',
      en: 'Ageing, dependency and care: new challenges for social protection',
      pt: 'Envelhecimento, dependência e cuidados: novos desafios da proteção social',
    },
    ponencias: [
      {
        titulo: 'Del abordaje fragmentado al ecosistema colaborativo: Innovación pública y gobernanza colaborativa para el envejecimiento saludable y la seguridad social en Costa Rica.',
        autores: ['Lourdes Arce Espinoza', 'Lizette Brenes Bonilla', 'Daniela Jiménez Obando'], pais: 'cr',
      },
      {
        titulo: 'Saúde, proteção social e dependência nas Américas: desafios comparados de Brasil, Argentina, Colômbia e México.',
        autores: ['Paulo Borges Mathias Costa', 'Paulo Henrique de Almeida Rodriguez'], pais: 'br',
      },
      {
        titulo: 'Esperanza de vida y esperanza de vida libre de discapacidad en México según condición de seguridad social.',
        autores: ['Héctor García-Hernández', 'Hortensia Reyes-Morales', 'Guillermo Salinas-Escudero', 'Marcela Agudelo-Botero'],
        pais: 'mx',
      },
      {
        titulo: 'Del tratamiento de la enfermedad a la protección de la capacidad funcional: el cuidado como nuevo riesgo social en México.',
        autores: ['María Luisa Mussot López'], pais: 'mx',
      },
    ],
  },
  {
    numero: 5,
    titulo: {
      es: 'Derechos previsionales, fragmentación institucional y desigualdades de protección',
      en: 'Pension rights, institutional fragmentation and inequalities in protection',
      pt: 'Direitos previdenciários, fragmentação institucional e desigualdades de proteção',
    },
    ponencias: [
      {
        titulo: 'Portabilidad pensionaria y fiscalidad internacional: derechos de seguridad social de mexicanos en el extranjero bajo el régimen de pensión Ley 73 del Seguro Social mexicano.',
        autores: ['Laura Gabriela Sánchez Hernández'], pais: 'mx',
      },
      {
        titulo: 'Cajas profesionales y precariedad previsional en Argentina: una respuesta federal y sectorial frente a la insuficiencia del régimen nacional.',
        autores: ['Julia Tamara Toyos'], pais: 'ar',
      },
      {
        titulo: 'Emergencia económica, vulneración de derechos previsionales y justicia para personas mayores: hacia un modelo multinivel de tutela efectiva frente a la litigiosidad y la demora judicial.',
        autores: ['Julia Tamara Toyos'], pais: 'ar',
      },
      {
        titulo: 'La fragmentación del derecho a la seguridad social en México: Un análisis de descomposición de la desigualdad del ingreso, 2024.',
        autores: ['Marco Antonio Pérez Méndez', 'Jocabed Sánchez Martínez'], pais: 'mx',
      },
    ],
  },
  {
    numero: 6,
    titulo: {
      es: 'Financiamiento, inversiones y gestión de recursos de la seguridad social',
      en: 'Financing, investment and resource management in social security',
      pt: 'Financiamento, investimentos e gestão de recursos da seguridade social',
    },
    ponencias: [
      {
        titulo: 'Reconfigurar el Contrato Social: Innovaciones en el Financiamiento de la Seguridad Social en América Latina y el Caribe.',
        autores: ['Ann Sibelle Rodriguez Mininni'], pais: 'uy',
      },
      {
        titulo: 'El Banco del Instituto Ecuatoriano de Seguridad Social, BIESS, y su incidencia en la economía ecuatoriana.',
        autores: ['Marco Patricio Naranjo Chiriboga', 'Alejandro David Muñoz Briceño'], pais: 'ec',
      },
      {
        titulo: 'Situación actual del ahorro voluntario e inversiones en infraestructura con recursos de las Afores.',
        autores: ['Juana Isabel Vera López'], pais: 'mx',
      },
      {
        titulo: 'Cofinanciamiento de la seguridad social: el FONSAP y la sostenibilidad de los medicamentos de VIH y tuberculosis en República Dominicana.',
        autores: ['Claudia Valdez', 'Leticia Martínez Martiñón'], pais: 'do',
      },
    ],
  },
  {
    numero: 7,
    titulo: {
      es: 'Trabajo, justicia restaurativa y seguridad social en contextos de vulnerabilidad',
      en: 'Work, restorative justice and social security in contexts of vulnerability',
      pt: 'Trabalho, justiça restaurativa e seguridade social em contextos de vulnerabilidade',
    },
    ponencias: [
      {
        titulo: 'Invisibilidad y segregación de género en el modelo de cárceles productivas.',
        autores: ['Alejandra Arias Vergara', 'Valentina Giraldo'], pais: 'co',
      },
      {
        titulo: '¿Servicio Social o precarización? Seguridad social en penas comunitarias en Colombia, México y Estados Unidos.',
        autores: ['Sergio Ramírez García', 'María Camila Ocampo'], pais: 'co',
      },
      {
        titulo: 'Soberanía Identitaria en el mundo del trabajo: De la crítica teórica a la justicia restaurativa laboral.',
        autores: ['Juan Camilo Ospina Botero'], pais: 'co',
      },
    ],
  },
  {
    numero: 8,
    titulo: {
      es: 'Seguridad y salud en el trabajo: riesgos, género y nuevas formas de empleo',
      en: 'Occupational safety and health: risks, gender and new forms of employment',
      pt: 'Segurança e saúde no trabalho: riscos, gênero e novas formas de emprego',
    },
    ponencias: [
      {
        titulo: '¿El derecho a un entorno de trabajo seguro y saludable es un nuevo piso civilizatorio?',
        autores: ['Claudio San Juan'], pais: 'ar',
      },
      {
        titulo: 'Seguridad y Salud en el Trabajo de Plataformas: Estudio comparado entre Argentina y Brasil.',
        autores: ['Nuria Ape', 'Bruno Bagnarelli'], pais: 'ar',
      },
      {
        titulo: 'Enfoque de género y riesgos laborales en Colombia, Ecuador y Perú: análisis comparativo en el primer cuarto del siglo XXI.',
        autores: ['Diana Marcela Roa Baquero'], pais: 'co',
      },
      {
        titulo: 'Factores de riesgo laborales, problemas de salud y acceso a la seguridad social en trabajadores del comercio informal: una revisión sistemática.',
        autores: ['Valeria I. Torrijos-García', 'María F. Núñez-Velázquez', 'Anakaren Varela-Pérez'],
        colaboradores: true, pais: 'mx',
      },
    ],
  },
  {
    numero: 9,
    titulo: {
      es: 'Salud ocupacional, enfermedades crónicas y bienestar de los trabajadores',
      en: 'Occupational health, chronic disease and worker well-being',
      pt: 'Saúde ocupacional, doenças crônicas e bem-estar dos trabalhadores',
    },
    ponencias: [
      {
        titulo: 'Indicadores de dictaminación en un hospital de la Cd. de México.',
        autores: ['Mitzi Daniela Durán Sánchez', 'Gladys Martínez Santiago'], pais: 'mx',
      },
      {
        titulo: 'Prevalencia de diabetes mellitus y obesidad en trabajadores con enfermedades músculo esqueléticas de origen laboral y no laboral.',
        autores: ['Elida Edith Fuentes Zamarrón', 'Yascara Hernández Hernández'], pais: 'mx',
      },
      {
        titulo: 'Relación del estrés laboral y riesgo de ideación suicida en médicos residentes en un hospital de segundo nivel en Puebla.',
        autores: [
          'Witney Arlette Águila Corona', 'Elizabeth Cuevas Soria',
          'Francisco Roberto Céspedes Castillo', 'Itzel Gutiérrez Gabriel',
        ],
        pais: 'mx',
      },
      {
        titulo: 'Post-diagnosis trajectories in treatment, adiposity, glycaemic control, and dietary behaviour among adults with type 2 diabetes in Mexico.',
        autores: ['Ernesto del Castillo'], pais: 'mx',
      },
    ],
  },
  {
    numero: 10,
    titulo: {
      es: 'Inteligencia artificial, gobernanza digital e innovación en la protección social',
      en: 'Artificial intelligence, digital governance and innovation in social protection',
      pt: 'Inteligência artificial, governança digital e inovação na proteção social',
    },
    ponencias: [
      {
        titulo: 'Gobernanza Digital de los Sistemas de Pensiones en las Américas: Hacia un Modelo Interamericano para la Universalización del Derecho a la Seguridad Social.',
        autores: ['Ángel Luis Delgado De La Matta'], pais: 'pe',
      },
      {
        titulo: 'Entre innovación y resistencia: aceptación de inteligencia artificial en la atención de enfermería.',
        autores: ['Lourdes Arce Espinoza', 'Greibin Villegas Barahona', 'Gioconda Vargas Morúa'], pais: 'cr',
      },
      {
        titulo: 'Seguridad social y centralidad de la persona humana en la era de la inteligencia artificial: suficiencia de ingresos y sostenibilidad social.',
        autores: ['María Alejandra Austerlitz'], pais: 'ar',
      },
      {
        titulo: 'Gobernanza territorial y optimización de la toma de decisiones en la administración pública indígena: un modelo basado en datos para la sostenibilidad y la inclusión social en un resguardo indígena de Colombia.',
        autores: ['Jonathan Alberto Cervantes Barraza', 'Anibal Mendoza Daza', 'María del Pilar Sánchez'], pais: 'co',
      },
      {
        titulo: 'La alfabetización en seguridad social como una nueva dimensión de análisis de los sistemas de protección social: fundamentos conceptuales y propuesta metodológica para su medición.',
        autores: ['Miriam Concepción García Canseco'], pais: 'mx',
      },
    ],
  },
  {
    numero: 11,
    titulo: {
      es: 'Equidad, financiamiento y gestión de los sistemas de salud',
      en: 'Equity, financing and management of health systems',
      pt: 'Equidade, financiamento e gestão dos sistemas de saúde',
    },
    ponencias: [
      {
        titulo: 'El acceso a salud no asegura la equidad en México.',
        autores: ['Abraham Granados Martínez'], pais: 'mx',
      },
      {
        titulo: 'Gasto de bolsillo en salud en personas mayores mexicanas según su condición de seguridad social.',
        autores: ['Héctor García-Hernández', 'Hortensia Reyes-Morales', 'Guillermo Salinas-Escudero', 'Marcela Agudelo-Botero'],
        pais: 'mx',
      },
      {
        titulo: 'Impacto del Gasto Público en Salud en el Crecimiento Económico Mexicano.',
        autores: ['Willis Ruiz Marín', 'Alejandro Moreno Jiménez', 'Jesús Antonio López Cabrera'], pais: 'mx',
      },
      {
        titulo: 'Per cápita diferenciado por riesgo en el seguro familiar de salud. Diseño, implementación y evaluación de una metodología actuarial para la equidad y sostenibilidad en el régimen Contributivo de la República Dominicana.',
        autores: ['Leticia Martínez Martiñón'], pais: 'do',
      },
      {
        titulo: 'Dados Públicos, vazios assistenciais e seguridade social em saúde: o observatório SUS-ES e a rede de urgência e emergência no Espírito Santo.',
        autores: ['Paulo Borges Mathias Costa', 'Paulo Henrique de Almeida Rodriguez'], pais: 'br',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Los tres días
// ---------------------------------------------------------------------------

export type TipoSesion =
  | 'registro'     // trámite: se pinta como una línea, no como una tarjeta
  | 'pausa'        // almuerzo
  | 'trabajo'      // las mesas de trabajo de la RIUSS del miércoles
  | 'apertura'
  | 'conferencia'
  | 'mesa'
  | 'clausura';

export interface Participante {
  nombre: string;
  cargo: Texto;
}

export interface Sesion {
  /** El horario no se traduce: 09:00–10:30 se lee igual en los tres idiomas. */
  horario: string;
  tipo: TipoSesion;
  sala?: ClaveSala;
  /** Todas menos las mesas, que se nombran por su número. */
  actividad?: Texto;
  mesa?: number;
  /** Quiénes abren el Congreso, con su cargo. Sólo la sesión de apertura. */
  participantes?: Participante[];
}

export interface DiaPrograma {
  iso: string;
  fecha: Texto;
  titulo: Texto;
  nota?: Texto;
  /** La frase de la nota que va en negrita: lo que más importa, aparte del resto. */
  notaDestacada?: Texto;
  sesiones: Sesion[];
}

const REGISTRO: Texto = {
  es: 'Registro de participantes',
  en: 'Participant registration',
  pt: 'Credenciamento de participantes',
};
const ALMUERZO: Texto = { es: 'Almuerzo', en: 'Lunch', pt: 'Almoço' };

/** El cargo de quien coordina una mesa de trabajo de la RIUSS. */
function coordina(
  mesa: { es: string; en: string; pt: string },
  genero: 'a' | 'o',
): Texto {
  return {
    es: `Coordinador${genero === 'a' ? 'a' : ''} de la Mesa de ${mesa.es} (RIUSS)`,
    en: `Coordinator of the ${mesa.en} Working Group (RIUSS)`,
    pt: `Coordenador${genero === 'a' ? 'a' : ''} da Mesa de ${mesa.pt} (RIUSS)`,
  };
}

export const PROGRAMA: DiaPrograma[] = [
  {
    iso: '2026-11-11',
    fecha: { es: 'Miércoles 11 de noviembre', en: 'Wednesday 11 November', pt: 'Quarta-feira, 11 de novembro' },
    titulo: { es: 'Sesiones internas de trabajo', en: 'Internal working sessions', pt: 'Sessões internas de trabalho' },
    nota: {
      es: 'La participación está abierta a investigadores, académicos y profesionales interesados en conocer las actividades de la RIUSS y explorar la posibilidad de integrarse a la Red. ¡Les invitamos a acompañarnos!',
      en: 'Participation is open to researchers, academics and professionals interested in learning about the activities of RIUSS and exploring the possibility of joining the Network. We invite you to join us!',
      pt: 'A participação está aberta a pesquisadores, acadêmicos e profissionais interessados em conhecer as atividades da RIUSS e explorar a possibilidade de integrar a Rede. Convidamos você a nos acompanhar!',
    },
    // En el PDF va en negrita: es la condición que más importa a quien decide ir.
    notaDestacada: {
      es: 'Cupo limitado a la capacidad de la sala.',
      en: 'Seating is limited to the capacity of the room.',
      pt: 'Vagas limitadas à capacidade da sala.',
    },
    sesiones: [
      { horario: '08:30–09:00', tipo: 'registro', sala: 'comisiones', actividad: REGISTRO },
      {
        horario: '09:00–10:30', tipo: 'trabajo', sala: 'comisiones',
        actividad: { es: 'Mesa de Trabajo RIUSS – Salud', en: 'RIUSS Working Group – Health', pt: 'Mesa de Trabalho RIUSS – Saúde' },
      },
      {
        horario: '10:30–12:00', tipo: 'trabajo', sala: 'comisiones',
        actividad: { es: 'Mesa de Trabajo RIUSS – Pensiones', en: 'RIUSS Working Group – Pensions', pt: 'Mesa de Trabalho RIUSS – Pensões' },
      },
      { horario: '12:00–13:00', tipo: 'pausa', actividad: ALMUERZO },
      {
        horario: '13:00–14:30', tipo: 'trabajo', sala: 'comisiones',
        actividad: {
          es: 'Mesa de Trabajo RIUSS – Riesgos Laborales',
          en: 'RIUSS Working Group – Occupational Risks',
          pt: 'Mesa de Trabalho RIUSS – Riscos do Trabalho',
        },
      },
      {
        horario: '14:30–16:00', tipo: 'trabajo', sala: 'comisiones',
        actividad: { es: 'Mesa de Trabajo RIUSS – Cuidados', en: 'RIUSS Working Group – Care', pt: 'Mesa de Trabalho RIUSS – Cuidados' },
      },
      {
        horario: '16:00–17:00', tipo: 'trabajo', sala: 'comisiones',
        actividad: { es: 'Reunión General de la RIUSS', en: 'RIUSS General Meeting', pt: 'Reunião Geral da RIUSS' },
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
      { horario: '08:30–09:00', tipo: 'registro', sala: 'lobby', actividad: REGISTRO },
      {
        horario: '09:00–09:30', tipo: 'apertura', sala: 'auditorio',
        actividad: { es: 'Sesión de apertura', en: 'Opening session', pt: 'Sessão de abertura' },
        participantes: [
          {
            nombre: 'Zoé Robledo',
            cargo: {
              es: 'Presidente de la Conferencia Interamericana de Seguridad Social (CISS)',
              en: 'President of the Inter-American Conference on Social Security (CISS)',
              pt: 'Presidente da Conferência Interamericana de Seguridade Social (CISS)',
            },
          },
          {
            nombre: 'Pedro Kumamoto',
            cargo: {
              es: 'Secretario General de la Conferencia Interamericana de Seguridad Social (CISS)',
              en: 'Secretary General of the Inter-American Conference on Social Security (CISS)',
              pt: 'Secretário-Geral da Conferência Interamericana de Seguridade Social (CISS)',
            },
          },
          {
            nombre: 'Emanuel de Araújo Dantas',
            cargo: {
              es: 'Director del Centro Interamericano de Estudios de Seguridad Social (CIESS)',
              en: 'Director of the Inter-American Center for Social Security Studies (CIESS)',
              pt: 'Diretor do Centro Interamericano de Estudos de Seguridade Social (CIESS)',
            },
          },
          {
            nombre: 'Marcela Agudelo Botero',
            cargo: coordina({ es: 'Salud', en: 'Health', pt: 'Saúde' }, 'a'),
          },
          {
            nombre: 'Ann Sibelle Rodríguez Mininni',
            cargo: coordina({ es: 'Pensiones', en: 'Pensions', pt: 'Pensões' }, 'a'),
          },
          {
            nombre: 'Luiz Carlos Lumbreras Rocha',
            cargo: coordina({ es: 'Riesgos Laborales', en: 'Occupational Risks', pt: 'Riscos do Trabalho' }, 'o'),
          },
          {
            nombre: 'Gabriela Mendizábal',
            cargo: coordina({ es: 'Cuidados', en: 'Care', pt: 'Cuidados' }, 'a'),
          },
        ],
      },
      {
        horario: '09:30–10:30', tipo: 'conferencia', sala: 'auditorio',
        actividad: {
          es: 'La seguridad social en las Américas en el primer cuarto del siglo XXI: avances, transformaciones y desafíos persistentes',
          en: 'Social security in the Americas in the first quarter of the 21st century: progress, transformations and persistent challenges',
          pt: 'A seguridade social nas Américas no primeiro quarto do século XXI: avanços, transformações e desafios persistentes',
        },
      },
      { horario: '10:30–12:30', tipo: 'mesa', mesa: 1, sala: 'auditorio' },
      { horario: '12:30–14:30', tipo: 'mesa', mesa: 2, sala: 'auditorio' },
      { horario: '14:30–15:30', tipo: 'pausa', actividad: ALMUERZO },
      { horario: '15:30–17:30', tipo: 'mesa', mesa: 3, sala: 'auditorio' },
      { horario: '15:30–17:30', tipo: 'mesa', mesa: 4, sala: 'sesiones' },
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
      { horario: '09:00–10:30', tipo: 'mesa', mesa: 5, sala: 'auditorio' },
      { horario: '09:00–10:30', tipo: 'mesa', mesa: 6, sala: 'comisiones' },
      { horario: '10:30–12:00', tipo: 'mesa', mesa: 7, sala: 'auditorio' },
      { horario: '10:30–12:00', tipo: 'mesa', mesa: 8, sala: 'comisiones' },
      { horario: '12:00–13:00', tipo: 'pausa', actividad: ALMUERZO },
      { horario: '13:00–15:00', tipo: 'mesa', mesa: 9, sala: 'auditorio' },
      { horario: '13:00–15:00', tipo: 'mesa', mesa: 10, sala: 'comisiones' },
      { horario: '15:00–16:50', tipo: 'mesa', mesa: 11, sala: 'auditorio' },
      {
        horario: '16:50–17:30', tipo: 'clausura', sala: 'auditorio',
        actividad: { es: 'Clausura del Congreso', en: 'Closing of the Congress', pt: 'Encerramento do Congresso' },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Lo que la página necesita saber de los datos
// ---------------------------------------------------------------------------

/** Sesiones que comparten horario: se pintan lado a lado, no una debajo de otra. */
export interface Bloque {
  horario: string;
  sesiones: Sesion[];
}

/**
 * Junta las sesiones consecutivas que tienen el mismo horario.
 *
 * El jueves por la tarde y casi todo el viernes hay dos salas a la vez. En el
 * PDF son dos filas seguidas con la misma hora y hay que darse cuenta; aquí se
 * ven una junto a la otra, que es lo que necesita quien decide a cuál entrar.
 */
export function agruparPorHorario(sesiones: Sesion[]): Bloque[] {
  const bloques: Bloque[] = [];
  for (const sesion of sesiones) {
    const ultimo = bloques.at(-1);
    if (ultimo && ultimo.horario === sesion.horario) ultimo.sesiones.push(sesion);
    else bloques.push({ horario: sesion.horario, sesiones: [sesion] });
  }
  return bloques;
}

const COLABORADORES: Texto = { es: 'colaboradores', en: 'collaborators', pt: 'colaboradores' };

/**
 * «A, B y C» en el idioma de la interfaz.
 *
 * Con `Intl.ListFormat` y no a mano: el español cambia «y» por «e» delante de
 * un nombre que empieza por «i» («… Castillo e Itzel Gutiérrez») y el inglés
 * pide la coma de serie. El programa impreso lo hace bien en español; un
 * «y» fijo lo habría hecho mal en los otros dos idiomas.
 */
export function unirAutores(ponencia: Ponencia, idioma: Idioma): string {
  const lista = ponencia.colaboradores
    ? [...ponencia.autores, COLABORADORES[idioma]]
    : ponencia.autores;
  return new Intl.ListFormat(idioma, { style: 'long', type: 'conjunction' }).format(lista);
}

/** Las mesas por número, para resolver «mesa 3» desde la sesión que la programa. */
export const MESA_POR_NUMERO: Map<number, Mesa> = new Map(MESAS.map((m) => [m.numero, m]));

/** Las cuentas que se enseñan arriba del programa. Salen de los datos, no se escriben a mano. */
export const RESUMEN = {
  dias: PROGRAMA.length,
  mesas: MESAS.length,
  ponencias: MESAS.reduce((suma, m) => suma + m.ponencias.length, 0),
  paises: new Set(MESAS.flatMap((m) => m.ponencias.map((p) => p.pais))).size,
};

// ---------------------------------------------------------------------------
// Textos de la propia sección
// ---------------------------------------------------------------------------

export interface TextosPrograma {
  selector: string;
  leyenda: string;
  paralelo: string;
  desplegar: string;
  contraer: string;
  mesa: string;
  conferencia: string;
  participan: string;
  ponencias: string;
  resumen: { dias: string; mesas: string; ponencias: string; paises: string };
}

export const TEXTOS_PROGRAMA: Record<Idioma, TextosPrograma> = {
  es: {
    selector: 'Día de la agenda',
    leyenda: 'El color indica la sala',
    paralelo: 'Al mismo tiempo',
    desplegar: 'Desplegar todo',
    contraer: 'Contraer todo',
    mesa: 'Mesa temática',
    conferencia: 'Conferencia magistral',
    participan: 'participantes',
    ponencias: 'ponencias',
    resumen: { dias: 'días', mesas: 'mesas temáticas', ponencias: 'ponencias', paises: 'países' },
  },
  en: {
    selector: 'Day of the agenda',
    leyenda: 'Colour shows the room',
    paralelo: 'At the same time',
    desplegar: 'Expand all',
    contraer: 'Collapse all',
    mesa: 'Thematic panel',
    conferencia: 'Keynote lecture',
    participan: 'participants',
    ponencias: 'papers',
    resumen: { dias: 'days', mesas: 'thematic panels', ponencias: 'papers', paises: 'countries' },
  },
  pt: {
    selector: 'Dia da agenda',
    leyenda: 'A cor indica a sala',
    paralelo: 'Ao mesmo tempo',
    desplegar: 'Expandir tudo',
    contraer: 'Recolher tudo',
    mesa: 'Mesa temática',
    conferencia: 'Conferência magistral',
    participan: 'participantes',
    ponencias: 'trabalhos',
    resumen: { dias: 'dias', mesas: 'mesas temáticas', ponencias: 'trabalhos', paises: 'países' },
  },
};
