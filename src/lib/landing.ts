import type { Idioma } from '@/i18n';

/**
 * Textos de la página de presentación, en los tres idiomas del congreso.
 *
 * Están aquí y no en la base porque describen a este congreso en concreto y
 * se redactan una vez. Lo que sí cambia con frecuencia —fechas, sede, ejes,
 * cupos— se lee de la configuración, que se edita desde el panel: así una
 * corrección de última hora no pasa por un despliegue.
 *
 * El contenido viene de la convocatoria oficial.
 */
export interface HitoCalendario {
  fecha: Record<Idioma, string>;
  hecho: Record<Idioma, string>;
  /** Los hitos ya cumplidos se muestran apagados. */
  iso: string;
}

export const CALENDARIO: HitoCalendario[] = [
  {
    iso: '2026-02-27',
    fecha: { es: '27 de febrero de 2026', en: '27 February 2026', pt: '27 de fevereiro de 2026' },
    hecho: { es: 'Lanzamiento de la convocatoria', en: 'Call for papers opens', pt: 'Lançamento da convocatória' },
  },
  {
    iso: '2026-07-06',
    fecha: { es: '6 de julio de 2026', en: '6 July 2026', pt: '6 de julho de 2026' },
    hecho: {
      es: 'Cierre de recepción de borradores y resúmenes',
      en: 'Deadline for drafts and abstracts',
      pt: 'Encerramento do recebimento de rascunhos e resumos',
    },
  },
  {
    iso: '2026-08-26',
    fecha: { es: 'Del 18 al 26 de agosto de 2026', en: '18–26 August 2026', pt: 'De 18 a 26 de agosto de 2026' },
    hecho: {
      es: 'Notificación de trabajos aceptados',
      en: 'Notification of accepted papers',
      pt: 'Notificação dos trabalhos aprovados',
    },
  },
  {
    iso: '2026-10-16',
    fecha: { es: '16 de octubre de 2026', en: '16 October 2026', pt: '16 de outubro de 2026' },
    hecho: {
      es: 'Fecha límite para los trabajos finales',
      en: 'Deadline for final papers',
      pt: 'Prazo final para os trabalhos definitivos',
    },
  },
  {
    iso: '2026-10-23',
    fecha: { es: '23 de octubre de 2026', en: '23 October 2026', pt: '23 de outubro de 2026' },
    hecho: {
      es: 'Publicación de la programación completa',
      en: 'Full programme published',
      pt: 'Publicação da programação completa',
    },
  },
  {
    iso: '2026-11-11',
    fecha: { es: '11, 12 y 13 de noviembre de 2026', en: '11–13 November 2026', pt: '11, 12 e 13 de novembro de 2026' },
    hecho: { es: 'Congreso', en: 'Congress', pt: 'Congresso' },
  },
];

export interface TextosLanding {
  entradilla: string;
  presentacionTitulo: string;
  presentacion: string[];
  ejesTitulo: string;
  ejesAyuda: string;
  calendarioTitulo: string;
  calendarioAyuda: string;
  participarTitulo: string;
  participarAyuda: string;
  registrarse: string;
  verConvocatoria: string;
  dudasTitulo: string;
  dudasRegistro: string;
  dudasTrabajos: string;
  cierreTitulo: string;
  cierreTexto: string;
  cumplido: string;
}

export const LANDING: Record<Idioma, TextosLanding> = {
  es: {
    entradilla:
      'Un encuentro continental para analizar, comparar y discutir el estado de la seguridad social en las Américas.',
    presentacionTitulo: 'Sobre el congreso',
    presentacion: [
      'El 1er Congreso de Estudios Interamericanos de Seguridad Social se concibe como un espacio de encuentro y reflexión para el análisis, el intercambio de experiencias y la discusión de investigaciones vinculadas a la seguridad social en los países de América.',
      'Bajo el subtítulo «Desafíos de la seguridad social en las Américas en el primer cuarto del siglo XXI», el congreso propone una reflexión crítica sobre las transformaciones recientes y los retos emergentes que enfrentan los sistemas de seguridad social: el envejecimiento poblacional, los cambios en los mercados de trabajo, la persistencia de la informalidad, las tensiones fiscales, la digitalización y el impacto de las crisis sanitarias, económicas y ambientales.',
      'Desde esa perspectiva se busca situar el debate en el contexto histórico actual, identificando continuidades, rupturas y oportunidades para avanzar hacia sistemas más inclusivos, sostenibles y resilientes.',
    ],
    ejesTitulo: 'Ejes temáticos',
    ejesAyuda: 'Los trabajos del congreso se organizan en estas nueve líneas de discusión.',
    calendarioTitulo: 'Fechas importantes',
    calendarioAyuda: 'Del lanzamiento de la convocatoria a los tres días de sesiones.',
    participarTitulo: 'Participe en el congreso',
    participarAyuda:
      'El registro está abierto para asistir, presencialmente en la Ciudad de México o en línea desde cualquier país. El formulario se adapta a su perfil: sólo verá las preguntas que le correspondan.',
    registrarse: 'Registrarse',
    verConvocatoria: 'Ver la convocatoria',
    dudasTitulo: 'Contacto',
    dudasRegistro: 'Dudas sobre el registro',
    dudasTrabajos: 'Envío de trabajos',
    cierreTitulo: 'Convoca',
    cierreTexto:
      'Centro Interamericano de Estudios de Seguridad Social, órgano de docencia, capacitación e investigación de la Conferencia Interamericana de Seguridad Social.',
    cumplido: 'Cumplido',
  },
  en: {
    entradilla:
      'A continental meeting to analyse, compare and debate the state of social security across the Americas.',
    presentacionTitulo: 'About the congress',
    presentacion: [
      'The 1st Congress of Inter-American Social Security Studies is conceived as a space for encounter and reflection: for analysis, for the exchange of experience, and for discussing research on social security across the countries of the Americas.',
      'Under the subtitle “Challenges of social security in the Americas in the first quarter of the 21st century”, the congress calls for a critical examination of the recent transformations and emerging pressures facing social security systems: population ageing, shifting labour markets, persistent informality, fiscal strain, digitalisation, and the impact of health, economic and environmental crises.',
      'The aim is to situate the debate in its present historical context, identifying continuities, ruptures and opportunities to move towards more inclusive, sustainable and resilient systems.',
    ],
    ejesTitulo: 'Thematic tracks',
    ejesAyuda: 'The congress organises its sessions along these nine lines of discussion.',
    calendarioTitulo: 'Key dates',
    calendarioAyuda: 'From the opening of the call for papers to the three days of sessions.',
    participarTitulo: 'Take part',
    participarAyuda:
      'Registration is open to attend, in person in Mexico City or online from anywhere. The form adapts to your profile: you will only see the questions that apply to you.',
    registrarse: 'Register',
    verConvocatoria: 'Read the call for papers',
    dudasTitulo: 'Contact',
    dudasRegistro: 'Registration enquiries',
    dudasTrabajos: 'Paper submissions',
    cierreTitulo: 'Convened by',
    cierreTexto:
      'The Inter-American Center for Social Security Studies, the teaching, training and research body of the Inter-American Conference on Social Security.',
    cumplido: 'Completed',
  },
  pt: {
    entradilla:
      'Um encontro continental para analisar, comparar e debater a situação da seguridade social nas Américas.',
    presentacionTitulo: 'Sobre o congresso',
    presentacion: [
      'O 1º Congresso de Estudos Interamericanos de Seguridade Social é concebido como um espaço de encontro e reflexão para a análise, o intercâmbio de experiências e a discussão de pesquisas ligadas à seguridade social nos países da América.',
      'Sob o subtítulo «Desafios da seguridade social nas Américas no primeiro quarto do século XXI», o congresso propõe uma reflexão crítica sobre as transformações recentes e os desafios emergentes enfrentados pelos sistemas de seguridade social: o envelhecimento populacional, as mudanças nos mercados de trabalho, a persistência da informalidade, as tensões fiscais, a digitalização e o impacto das crises sanitárias, econômicas e ambientais.',
      'A partir dessa perspectiva, busca-se situar o debate no contexto histórico atual, identificando continuidades, rupturas e oportunidades para avançar rumo a sistemas mais inclusivos, sustentáveis e resilientes.',
    ],
    ejesTitulo: 'Eixos temáticos',
    ejesAyuda: 'Os trabalhos do congresso organizam-se nestas nove linhas de discussão.',
    calendarioTitulo: 'Datas importantes',
    calendarioAyuda: 'Do lançamento da convocatória aos três dias de sessões.',
    participarTitulo: 'Participe do congresso',
    participarAyuda:
      'As inscrições estão abertas para participar presencialmente na Cidade do México ou online de qualquer país. O formulário se adapta ao seu perfil: você verá apenas as perguntas que lhe dizem respeito.',
    registrarse: 'Inscrever-se',
    verConvocatoria: 'Ver a convocatória',
    dudasTitulo: 'Contato',
    dudasRegistro: 'Dúvidas sobre a inscrição',
    dudasTrabajos: 'Envio de trabalhos',
    cierreTitulo: 'Convoca',
    cierreTexto:
      'Centro Interamericano de Estudos de Seguridade Social, órgão de ensino, capacitação e pesquisa da Conferência Interamericana de Seguridade Social.',
    cumplido: 'Concluído',
  },
};

/** Correo al que se envían los trabajos, según la convocatoria. */
export const CORREO_TRABAJOS = 'monicarodriguez@ciss-bienestar.org';
