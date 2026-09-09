/**
 * Configuración del congreso. Los valores marcados como PENDIENTE deben
 * confirmarse con el comité organizador; los que viven en la tabla
 * `configuracion` de Supabase se pueden editar desde el panel.
 */
export const CONFIG = {
  sede: 'CIESS · Ciudad de México, México', // PENDIENTE confirmar sede exacta
  fechas: 'Por confirmar',                  // PENDIENTE
  fechaLimiteRegistro: '2026-05-15',        // editable desde el panel

  ejesTematicos: [
    // PENDIENTE: sustituir por los ejes definitivos de la convocatoria.
    'Eje 1 · Cobertura y suficiencia de la protección social',
    'Eje 2 · Sostenibilidad financiera de los sistemas de pensiones',
    'Eje 3 · Salud, cuidados y envejecimiento',
    'Eje 4 · Trabajo, informalidad y nuevas formas de empleo',
  ],

  limiteSemblanzaPalabras: 60,
  limiteSemblanzaCaracteres: 420,
  limiteResumenCaracteres: 2000,
  fotoMegabytesMaximo: 10,

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
  versionAvisoPrivacidad: '1.0',
} as const;

export const CORREO_CONTACTO = process.env.CORREO_CONTACTO ?? 'congreso@ciess.org';

export function urlSitio(): string {
  return (
    process.env.NEXT_PUBLIC_URL_SITIO ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}
