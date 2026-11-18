/**
 * Nombres escritos todo en mayúsculas («CARLOS CHAVERA BIANCHI») que hay que pasar a «altas y bajas» («Carlos Chavera Bianchi»),
 * que es como se imprime en una constancia.
 */

/** Palabras que en un nombre van en minúscula cuando no abren el campo: «María del Carmen», «Ana de la Cruz». */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'das', 'do', 'dos', 'di', 'van', 'von', 'der', 'du']);

/**
 * Está escrito todo en mayúsculas: tiene al menos tres letras y ninguna es minúscula. Con menos letras («LI», «J.», una inicial) no se
 * puede saber si es una sigla o un nombre corto, y se deja como está.
 */
export function esTodoMayusculas(texto: string): boolean {
  const letras = texto.match(/\p{L}/gu) ?? [];
  return letras.length >= 3 && texto === texto.toLocaleUpperCase('es') && texto !== texto.toLocaleLowerCase('es');
}

/**
 * «altas y bajas»: la inicial de cada palabra en mayúscula y el resto en minúscula, también tras un guion, un apóstrofo o un
 * punto («Ana-Lucía», «O'Brien», «J.M.»), con las partículas («de», «del», «la», «y»…) en minúscula si no abren el campo. Se
 * conservan los acentos y la ñ. No adivina casos como «MCDONALD» (queda «Mcdonald»): para eso está el panel.
 */
export function aAltasYBajas(texto: string): string {
  const bajas = texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
  const conIniciales = bajas.replace(/(^|[\s\-'’.])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toLocaleUpperCase('es'));
  return conIniciales
    .split(' ')
    .map((palabra, i) => (i > 0 && PARTICULAS.has(palabra.toLocaleLowerCase('es')) ? palabra.toLocaleLowerCase('es') : palabra))
    .join(' ');
}
