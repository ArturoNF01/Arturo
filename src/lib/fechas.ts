/**
 * El «día» del Congreso es el de la Ciudad de México.
 *
 * `new Date().toISOString().slice(0, 10)` da el día en UTC, que cambia a las
 * 18:00 de México: desde esa hora todo lo «de hoy» (el contador del panel, el
 * cierre del registro) pasa a ser «de mañana» y el contador vuelve a cero con
 * el día todavía a medias.
 */
export const HUSO_CONGRESO = 'America/Mexico_City';

const formatoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: HUSO_CONGRESO, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** «2026-10-23» para el instante dado, contado en hora de México. '' si no es una fecha. */
export function diaEnMexico(instante: Date | string | number = new Date()): string {
  const fecha = instante instanceof Date ? instante : new Date(instante);
  return Number.isNaN(fecha.getTime()) ? '' : formatoDia.format(fecha);
}

/** ¿Sigue abierto el plazo? El último día cuenta entero, hasta las 23:59 de México. */
export function plazoVigente(fechaLimite: string, ahora: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaLimite)) return true;
  return diaEnMexico(ahora) <= fechaLimite;
}
