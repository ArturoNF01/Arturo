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
/**
 * La sede, en el mapa.
 *
 * Son dos direcciones distintas a propósito: la primera abre Google Maps en
 * una pestaña nueva —con la chincheta puesta en las coordenadas exactas, que
 * no dependen de cómo esté escrito el nombre del lugar—; la segunda es la que
 * admite el <iframe>, que no acepta una dirección normal de Maps.
 *
 * Si algún día cambia la sede, se cambian aquí las dos.
 */
export const SEDE_COORDENADAS = '19.3302527,-99.2185406';

export const SEDE_MAPA_ENLACE =
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SEDE_COORDENADAS)}`;

export const SEDE_MAPA_EMBED =
  'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1668.7261201983124!2d-99.21854063656188' +
  '!3d19.330252729551088!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85cdff8ae5a84c0f%3A0x91abb759b9f75bc3' +
  '!2sConferencia%20Interamericana%20de%20Seguridad%20Social%20CISS!5e1!3m2!1ses!2smx' +
  '!4v1789188134782!5m2!1ses!2smx';

/**
 * Las fotografías de las instalaciones.
 *
 * Están numeradas de la 001 a la 200 en el sitio del CISS y se nombran solas,
 * así que no hace falta listarlas una por una ni mantener un índice: se
 * construyen las direcciones. Si alguna no existe, la galería la descarta al
 * no poder cargarla, y nadie ve un hueco roto.
 */
export const GALERIA_BASE = 'https://ciss-bienestar.org/ciss2025/wp-content/uploads/2026/04';
export const GALERIA_TOTAL = 200;

export function fotoInstalaciones(numero: number): string {
  return `${GALERIA_BASE}/CISS-${String(numero).padStart(3, '0')}.jpg`;
}

/**
 * Una baraja de fotografías distinta en cada visita.
 *
 * Se reparte en el navegador, no al construir la página: si se hiciera en el
 * servidor, todo el mundo vería la misma «casualidad» hasta el siguiente
 * despliegue. Y se pide el sorteo desde un efecto, nunca al pintar, para que
 * lo que llega del servidor y lo que React pinta después coincidan.
 */
export function barajar<T>(lista: readonly T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Las direcciones de las 200, en orden. */
export const GALERIA: string[] = Array.from({ length: GALERIA_TOTAL }, (_, i) =>
  fotoInstalaciones(i + 1),
);

/**
 * El hotel con el que el CIESS tiene convenio.
 *
 * El hospedaje del propio CIESS no alcanza: otros eventos internacionales
 * caen en las mismas fechas. Lo que el comité pidió resaltar es el código
 * de promoción —no hay tarifas que publicar—, y es lo único que se copia.
 * Si el hotel o el código cambian, se cambian aquí.
 */
export const HOTEL = {
  nombre: 'Hotel Galería Plaza San Jerónimo',
  direccion: 'Avenida Contreras 300, Colonia San Jerónimo Lídice, Alcaldía Magdalena Contreras, 10200 CDMX, México',
  telefono: '+52 55 5377 6400',
  telefonoEnlace: 'tel:+525553776400',
  web: 'https://www.galeriaplazahotels.com.mx/es/san-jeronimo/',
  mapa: 'https://www.google.com/maps?ll=19.328198,-99.213928&z=14&t=m&hl=es&gl=MX&mapclient=embed&cid=12815805780581030290',
  codigo: 'Convenio CISS',
} as const;

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
      es: 'Publicación de la agenda completa',
      en: 'Full agenda published',
      pt: 'Publicação da agenda completa',
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
  programaTitulo: string;
  programaAyuda: string;
  programaNota: string;
  calendarioTitulo: string;
  calendarioAyuda: string;
  sedeTitulo: string;
  sedeAyuda: string;
  verEnMapa: string;
  galeriaTitulo: string;
  galeriaAyuda: string;
  galeriaVerTodas: string;
  galeriaCargando: string;
  galeriaCerrar: string;
  galeriaAnterior: string;
  galeriaSiguiente: string;
  galeriaFoto: (n: number) => string;
  galeriaVacia: string;
  hospedajeTitulo: string;
  hospedajeAyuda: string;
  hospedajeEtiqueta: string;
  hospedajeAtencion: string;
  hospedajeSitio: string;
  hospedajeLlamar: string;
  hospedajeComoLlegar: string;
  codigoEtiqueta: string;
  codigoAyuda: string;
  codigoCopiar: string;
  codigoCopiado: string;
  gratuita: string;
  participarTitulo: string;
  participarAyuda: string;
  registrarse: string;
  descargarAgenda: string;
  cumplido: string;
}

export const LANDING: Record<Idioma, TextosLanding> = {
  es: {
    entradilla:
      'Un encuentro continental para analizar, comparar y discutir el estado de la seguridad social en las Américas.',
    presentacionTitulo: 'Sobre el Congreso',
    presentacion: [
      'El 1er Congreso de Estudios Interamericanos de Seguridad Social se concibe como un espacio de encuentro y reflexión para el análisis, el intercambio de experiencias y la discusión de investigaciones vinculadas a la seguridad social en los países de América.',
      'Bajo el subtítulo «Desafíos de la seguridad social en las Américas en el primer cuarto del siglo XXI», el Congreso propone una reflexión crítica sobre las transformaciones recientes y los retos emergentes que enfrentan los sistemas de seguridad social: el envejecimiento poblacional, los cambios en los mercados de trabajo, la persistencia de la informalidad, las tensiones fiscales, la digitalización y el impacto de las crisis sanitarias, económicas y ambientales.',
      'Desde esa perspectiva se busca situar el debate en el contexto histórico actual, identificando continuidades, rupturas y oportunidades para avanzar hacia sistemas más inclusivos, sostenibles y resilientes.',
    ],
    ejesTitulo: 'Ejes temáticos',
    ejesAyuda: 'Los trabajos del Congreso se organizan en estas nueve líneas de discusión.',
    programaTitulo: 'Agenda',
    programaAyuda: 'Tres días de sesiones en la sede del CIESS. Elija un día y abra cada mesa para ver sus ponencias, con su autoría y país.',
    programaNota: 'Agenda sujeta a cambios; esta página muestra la versión vigente.',
    calendarioTitulo: 'Fechas importantes',
    calendarioAyuda: 'Del lanzamiento de la convocatoria a los tres días de sesiones.',
    sedeTitulo: 'Cómo llegar',
    sedeAyuda:
      'Las sesiones presenciales se celebran en la sede del CIESS, en la Ciudad de México. Quien participe en línea recibirá el enlace de conexión antes del Congreso.',
    verEnMapa: 'Abrir en Google Maps',
    galeriaTitulo: 'Nuestras instalaciones',
    galeriaAyuda: 'El campus del CIESS en la Ciudad de México: aulas, auditorios, biblioteca y áreas comunes.',
    galeriaVerTodas: 'Ver la galería',
    galeriaCargando: 'Cargando más fotografías…',
    galeriaCerrar: 'Cerrar',
    galeriaAnterior: 'Anterior',
    galeriaSiguiente: 'Siguiente',
    galeriaFoto: (n: number) => `Instalaciones del CIESS, fotografía ${n}`,
    galeriaVacia: 'Las fotografías no están disponibles en este momento.',
    hospedajeTitulo: 'Hospedaje',
    hospedajeAyuda:
      'El hospedaje del CIESS tiene disponibilidad limitada, porque varios eventos internacionales coinciden en las mismas fechas. Por eso contamos con un convenio con un hotel cercano.',
    hospedajeEtiqueta: 'Hotel con convenio',
    hospedajeAtencion: 'Atención las 24 horas, todos los días',
    hospedajeSitio: 'Sitio del hotel',
    hospedajeLlamar: 'Llamar',
    hospedajeComoLlegar: 'Cómo llegar',
    codigoEtiqueta: 'Código de promoción',
    codigoAyuda: 'Indíquelo al hacer su reservación.',
    codigoCopiar: 'Copiar código',
    codigoCopiado: 'Código copiado',
    gratuita: 'Actividad gratuita',
    participarTitulo: 'Participe en el Congreso',
    participarAyuda:
      'El registro está abierto para asistir, presencialmente en la Ciudad de México o en línea desde cualquier país.',
    registrarse: 'Registrarse',
    descargarAgenda: 'Descargar la agenda (PDF)',
    cumplido: 'Cumplido',
  },
  en: {
    entradilla:
      'A continental meeting to analyse, compare and debate the state of social security across the Americas.',
    presentacionTitulo: 'About the Congress',
    presentacion: [
      'The 1st Congress of Inter-American Social Security Studies is conceived as a space for encounter and reflection: for analysis, for the exchange of experience, and for discussing research on social security across the countries of the Americas.',
      'Under the subtitle “Challenges of social security in the Americas in the first quarter of the 21st century”, the Congress calls for a critical examination of the recent transformations and emerging pressures facing social security systems: population ageing, shifting labour markets, persistent informality, fiscal strain, digitalisation, and the impact of health, economic and environmental crises.',
      'The aim is to situate the debate in its present historical context, identifying continuities, ruptures and opportunities to move towards more inclusive, sustainable and resilient systems.',
    ],
    ejesTitulo: 'Thematic tracks',
    ejesAyuda: 'The Congress organises its sessions along these nine lines of discussion.',
    programaTitulo: 'Agenda',
    programaAyuda: 'Three days of sessions at the CIESS headquarters. Pick a day and open each panel to see its papers, with their authors and country.',
    programaNota: 'Agenda subject to change; this page shows the current version.',
    calendarioTitulo: 'Key dates',
    calendarioAyuda: 'From the opening of the call for papers to the three days of sessions.',
    sedeTitulo: 'Getting there',
    sedeAyuda:
      'In-person sessions are held at the CIESS headquarters in Mexico City. Online participants will receive the connection link before the Congress.',
    verEnMapa: 'Open in Google Maps',
    galeriaTitulo: 'Our campus',
    galeriaAyuda: 'The CIESS campus in Mexico City: lecture rooms, auditoriums, library and common areas.',
    galeriaVerTodas: 'View the gallery',
    galeriaCargando: 'Loading more photographs…',
    galeriaCerrar: 'Close',
    galeriaAnterior: 'Previous',
    galeriaSiguiente: 'Next',
    galeriaFoto: (n: number) => `CIESS campus, photograph ${n}`,
    galeriaVacia: 'The photographs are unavailable at the moment.',
    hospedajeTitulo: 'Accommodation',
    hospedajeAyuda:
      'Rooms at the CIESS are limited, because several international events fall on the same dates. That is why we have an agreement with a nearby hotel.',
    hospedajeEtiqueta: 'Partner hotel',
    hospedajeAtencion: 'Open 24 hours, every day',
    hospedajeSitio: 'Hotel website',
    hospedajeLlamar: 'Call',
    hospedajeComoLlegar: 'Get directions',
    codigoEtiqueta: 'Promotion code',
    codigoAyuda: 'Give it when you make your reservation.',
    codigoCopiar: 'Copy code',
    codigoCopiado: 'Code copied',
    gratuita: 'Free event',
    participarTitulo: 'Take part',
    participarAyuda:
      'Registration is open to attend, in person in Mexico City or online from anywhere.',
    registrarse: 'Register',
    descargarAgenda: 'Download the agenda (PDF)',
    cumplido: 'Completed',
  },
  pt: {
    entradilla:
      'Um encontro continental para analisar, comparar e debater a situação da seguridade social nas Américas.',
    presentacionTitulo: 'Sobre o Congresso',
    presentacion: [
      'O 1º Congresso de Estudos Interamericanos de Seguridade Social é concebido como um espaço de encontro e reflexão para a análise, o intercâmbio de experiências e a discussão de pesquisas ligadas à seguridade social nos países da América.',
      'Sob o subtítulo «Desafios da seguridade social nas Américas no primeiro quarto do século XXI», o Congresso propõe uma reflexão crítica sobre as transformações recentes e os desafios emergentes enfrentados pelos sistemas de seguridade social: o envelhecimento populacional, as mudanças nos mercados de trabalho, a persistência da informalidade, as tensões fiscais, a digitalização e o impacto das crises sanitárias, econômicas e ambientais.',
      'A partir dessa perspectiva, busca-se situar o debate no contexto histórico atual, identificando continuidades, rupturas e oportunidades para avançar rumo a sistemas mais inclusivos, sustentáveis e resilientes.',
    ],
    ejesTitulo: 'Eixos temáticos',
    ejesAyuda: 'Os trabalhos do Congresso organizam-se nestas nove linhas de discussão.',
    programaTitulo: 'Agenda',
    programaAyuda: 'Três dias de sessões na sede do CIESS. Escolha um dia e abra cada mesa para ver os seus trabalhos, com autoria e país.',
    programaNota: 'Agenda sujeita a alterações; esta página mostra a versão vigente.',
    calendarioTitulo: 'Datas importantes',
    calendarioAyuda: 'Do lançamento da convocatória aos três dias de sessões.',
    sedeTitulo: 'Como chegar',
    sedeAyuda:
      'As sessões presenciais acontecem na sede do CIESS, na Cidade do México. Quem participar on-line receberá o link de conexão antes do Congresso.',
    verEnMapa: 'Abrir no Google Maps',
    galeriaTitulo: 'Nossas instalações',
    galeriaAyuda: 'O campus do CIESS na Cidade do México: salas de aula, auditórios, biblioteca e áreas comuns.',
    galeriaVerTodas: 'Ver a galeria',
    galeriaCargando: 'Carregando mais fotografias…',
    galeriaCerrar: 'Fechar',
    galeriaAnterior: 'Anterior',
    galeriaSiguiente: 'Seguinte',
    galeriaFoto: (n: number) => `Instalações do CIESS, fotografia ${n}`,
    galeriaVacia: 'As fotografias não estão disponíveis no momento.',
    hospedajeTitulo: 'Hospedagem',
    hospedajeAyuda:
      'A hospedagem do CIESS tem disponibilidade limitada, porque vários eventos internacionais coincidem nas mesmas datas. Por isso temos um convênio com um hotel próximo.',
    hospedajeEtiqueta: 'Hotel conveniado',
    hospedajeAtencion: 'Atendimento 24 horas, todos os dias',
    hospedajeSitio: 'Site do hotel',
    hospedajeLlamar: 'Ligar',
    hospedajeComoLlegar: 'Como chegar',
    codigoEtiqueta: 'Código promocional',
    codigoAyuda: 'Informe-o ao fazer a sua reserva.',
    codigoCopiar: 'Copiar código',
    codigoCopiado: 'Código copiado',
    gratuita: 'Atividade gratuita',
    participarTitulo: 'Participe do Congresso',
    participarAyuda:
      'As inscrições estão abertas para participar presencialmente na Cidade do México ou online de qualquer país.',
    registrarse: 'Inscrever-se',
    descargarAgenda: 'Baixar a agenda (PDF)',
    cumplido: 'Concluído',
  },
};

