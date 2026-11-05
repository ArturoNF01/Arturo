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

/** ¿Hay una fecha límite puesta? Vacía —o ilegible— quiere decir que el registro no tiene plazo. */
export function hayFechaLimite(fechaLimite: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fechaLimite) && !Number.isNaN(new Date(`${fechaLimite}T12:00:00Z`).getTime());
}

const LENGUA_DEL_PLAZO = { es: 'es-MX', en: 'en-US', pt: 'pt-BR' } as const;

/**
 * El plazo ya escrito en la frase del correo, en el idioma de quien lo recibe.
 *
 * Con fecha: «hasta el 2 de noviembre de 2026» / «antes del 2 de noviembre de 2026».
 * Sin fecha límite —el registro se mantiene abierto—: «en cualquier momento» / «a la
 * brevedad». Las plantillas llevan `{{plazo_edicion}}` y `{{plazo_reenvio}}` y no la fecha
 * pelada, para que un correo no diga «hasta el .» el día que no haya plazo.
 */
export function plazosEnPalabras(
  fechaLimite: string,
  idioma: string,
): { edicion: string; reenvio: string } {
  const lengua: 'es' | 'en' | 'pt' = idioma === 'en' || idioma === 'pt' ? idioma : 'es';
  if (!hayFechaLimite(fechaLimite)) {
    return {
      es: { edicion: 'en cualquier momento', reenvio: 'a la brevedad' },
      en: { edicion: 'at any time', reenvio: 'as soon as possible' },
      pt: { edicion: 'a qualquer momento', reenvio: 'o quanto antes' },
    }[lengua];
  }
  const fecha = new Intl.DateTimeFormat(LENGUA_DEL_PLAZO[lengua], {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${fechaLimite}T12:00:00Z`));
  return {
    es: { edicion: `hasta el ${fecha}`, reenvio: `antes del ${fecha}` },
    en: { edicion: `until ${fecha}`, reenvio: `before ${fecha}` },
    pt: { edicion: `até ${fecha}`, reenvio: `até ${fecha}` },
  }[lengua];
}
