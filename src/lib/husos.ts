import type { Diccionario } from '@/i18n';

/**
 * Husos horarios de las Américas, más los de quienes siguen el congreso
 * desde Europa.
 *
 * Se ofrece una lista corta y reconocible en vez de las cientos de zonas
 * IANA: quien se registra busca su ciudad, no «America/Argentina/Salta».
 * El identificador que se guarda sí es el de IANA, para poder calcular la
 * hora local de cada aviso sin volver a interpretar nada.
 */
export const ZONAS_HORARIAS = [
  { valor: 'America/Mexico_City',   etiqueta: 'Ciudad de México (GMT-6)' },
  { valor: 'America/Tijuana',       etiqueta: 'Tijuana · Los Ángeles (GMT-8)' },
  { valor: 'America/Denver',        etiqueta: 'Denver · Chihuahua (GMT-7)' },
  { valor: 'America/Guatemala',     etiqueta: 'Guatemala · San Salvador · Tegucigalpa (GMT-6)' },
  { valor: 'America/Bogota',        etiqueta: 'Bogotá · Lima · Quito · Panamá (GMT-5)' },
  { valor: 'America/New_York',      etiqueta: 'Nueva York · Toronto (GMT-5)' },
  { valor: 'America/Caracas',       etiqueta: 'Caracas (GMT-4)' },
  { valor: 'America/La_Paz',        etiqueta: 'La Paz · Asunción (GMT-4)' },
  { valor: 'America/Santiago',      etiqueta: 'Santiago de Chile (GMT-4)' },
  { valor: 'America/Santo_Domingo', etiqueta: 'Santo Domingo · San Juan (GMT-4)' },
  { valor: 'America/Havana',        etiqueta: 'La Habana (GMT-5)' },
  { valor: 'America/Halifax',       etiqueta: 'Halifax (GMT-4)' },
  { valor: 'America/Sao_Paulo',     etiqueta: 'São Paulo · Brasilia · Montevideo (GMT-3)' },
  { valor: 'America/Argentina/Buenos_Aires', etiqueta: 'Buenos Aires (GMT-3)' },
  { valor: 'Europe/Madrid',         etiqueta: 'Madrid · París · Ginebra (GMT+1)' },
  { valor: 'Europe/Lisbon',         etiqueta: 'Lisboa · Londres (GMT+0)' },
] as const;

/**
 * Los días del congreso, para preguntar disponibilidad a quien coordina o
 * modera. Salen de la configuración y no de una lista fija, porque las
 * fechas se ajustan desde el panel.
 */
export function diasDelCongreso(
  t: Diccionario,
  inicio = '2026-11-11',
  fin = '2026-11-13',
): { valor: string; etiqueta: string }[] {
  const dias: { valor: string; etiqueta: string }[] = [];
  const desde = new Date(`${inicio}T12:00:00Z`);
  const hasta = new Date(`${fin}T12:00:00Z`);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return dias;

  const formato = new Intl.DateTimeFormat(t.meta.codigo, {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
  // Un congreso de tres días no justifica un bucle sin tope, pero una fecha
  // mal capturada desde el panel sí podría dejarlo girando: se acota.
  for (let d = new Date(desde); d <= hasta && dias.length < 14; d.setUTCDate(d.getUTCDate() + 1)) {
    dias.push({ valor: d.toISOString().slice(0, 10), etiqueta: formato.format(d) });
  }
  return dias;
}
