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
  urlConvocatoria:
    'https://home.ciess.org/wp-content/uploads/2026/03/Convocatoria-congreso.pdf',

  zonaHoraria: 'America/Mexico_City',
  versionAvisoPrivacidad: '1.2',
} as const;

export const CORREO_CONTACTO = process.env.CORREO_CONTACTO ?? 'congreso@ciess.org';

export function urlSitio(): string {
  return (
    process.env.NEXT_PUBLIC_URL_SITIO ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}
