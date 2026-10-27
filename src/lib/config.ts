/**
 * Constantes que no cambian desde el panel. El nombre, la sede, las fechas,
 * los ejes temáticos, los límites del formulario, los cupos y los textos de
 * las páginas públicas viven en la base y se editan en
 * Panel → Cupos y configuración y Panel → Contenido del sitio.
 */
export const CONFIG = {
  fechaLimiteRegistro: '2026-05-15', // respaldo; el valor vigente vive en la base

  /** Respaldo del límite de semblanza para la réplica en Sheets. */
  limiteSemblanzaPalabras: 60,

  /** Margen entre la hora programada y la presentación del vehículo, en minutos. */
  margenes: {
    llegadaAereaInternacional: 40,
    llegadaAereaNacional: 20,
    llegadaTerrestre: 10,
    salidaAereaInternacional: 180,
    salidaAereaNacional: 120,
    salidaTerrestre: 60,
  },

  urlVideoLogin:
    'https://home.ciess.org/wp-content/uploads/2026/03/1er-Congreso-de-Estudios-Interamericanos-de-Seguridad-Social-B.mp4',
  /* El programa general, ya publicado. Sustituyó a la convocatoria: lo que
     la gente busca en el sitio una vez abierto el registro es a qué hora y
     en qué sala es cada mesa, no la invitación a mandar trabajos. */
  urlAgenda:
    'https://home.ciess.org/wp-content/uploads/2026/10/Agenda_Congreso_RIUSS_2026.pdf',
  /* La misma agenda en portugués: la ve quien tiene el sitio en ese idioma y
     la recibe quien se registra en él. */
  urlAgendaPt:
    'https://home.ciess.org/wp-content/uploads/2026/10/Programa_Congreso_RIUSS_2026_PT.pdf',

  zonaHoraria: 'America/Mexico_City',
  versionAvisoPrivacidad: '1.2',
} as const;

export const CORREO_CONTACTO = process.env.CORREO_CONTACTO ?? 'congreso@ciess.org';

/** Dominio definitivo del congreso. */
export const DOMINIO = 'congreso-dss.ciess.org';

/**
 * Dirección pública del sitio, para los enlaces que viajan en los correos.
 *
 * Manda la variable de entorno: en App Platform apunta al dominio definitivo
 * y en las revisiones previas a la dirección temporal que asigna la
 * plataforma. Sin ella se usa el dominio del congreso, salvo en desarrollo.
 */
export function urlSitio(): string {
  if (process.env.NEXT_PUBLIC_URL_SITIO) return process.env.NEXT_PUBLIC_URL_SITIO;
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
  return `https://${DOMINIO}`;
}
