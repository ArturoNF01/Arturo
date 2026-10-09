import { describe, expect, it } from 'vitest';
import { HOJAS } from '@/lib/normalizacion';
import { cotejarCeldas, cotejarEncabezados, cotejarFolios } from '@/lib/cotejo';

describe('cotejar los encabezados', () => {
  it('no se queja cuando la hoja está al día', () => {
    const alDia = Object.fromEntries(Object.entries(HOJAS).map(([k, v]) => [k, [...v]]));
    expect(cotejarEncabezados(alDia)).toEqual([]);
  });

  it('dice qué columna falta y cuál sobra, no sólo que algo cambió', () => {
    // Es lo que pasa al desplegar una versión que cambió el libro sin
    // reescribirlo: saber el nombre de la columna es lo que convierte
    // «algo falla» en «falta Requiere hospedaje».
    const viejos = Object.fromEntries(Object.entries(HOJAS).map(([k, v]) => [k, [...v]]));
    viejos.REG_Respuestas = HOJAS.REG_Respuestas
      .filter((c) => c !== 'Requiere hospedaje')
      .concat('Régimen alimentario');

    const [desfase] = cotejarEncabezados(viejos);
    expect(desfase.pestana).toBe('REG_Respuestas');
    expect(desfase.faltan).toEqual(['Requiere hospedaje']);
    expect(desfase.sobran).toEqual(['Régimen alimentario']);
  });

  it('una pestaña vacía no cuenta como desfasada', () => {
    // Todavía no tiene encabezados; el sistema se los escribe la primera vez.
    const vacias = Object.fromEntries(Object.keys(HOJAS).map((k) => [k, []]));
    expect(cotejarEncabezados(vacias)).toEqual([]);
  });
});

describe('cotejar los folios', () => {
  it('encuentra los que están en la base y no llegaron a la hoja', () => {
    const r = cotejarFolios(['A1', 'A2', 'A3'], ['A1']);
    expect(r.faltanEnHoja).toEqual(['A2', 'A3']);
    expect(r.sobranEnHoja).toEqual([]);
  });

  it('y los que están en la hoja sin estar en la base', () => {
    // Pasa cuando alguien borra un registro desde el panel: la fila de la
    // hoja no se va con él.
    const r = cotejarFolios(['A1'], ['A1', 'A9']);
    expect(r.sobranEnHoja).toEqual(['A9']);
  });

  it('cuenta los repetidos, que es lo que deja un reenvío a medias', () => {
    const r = cotejarFolios(['A1'], ['A1', 'A1', 'A1']);
    expect(r.repetidosEnHoja).toEqual([{ folio: 'A1', veces: 3 }]);
    expect(r.faltanEnHoja).toEqual([]);
  });

  it('no se confunde con espacios ni con celdas vacías al final de la hoja', () => {
    const r = cotejarFolios(['A1'], [' A1 ', '', '   ']);
    expect(r).toEqual({ faltanEnHoja: [], sobranEnHoja: [], repetidosEnHoja: [] });
  });
});

describe('cotejar las celdas de una fila', () => {
  const fila = (cambios: Record<number, string> = {}) =>
    HOJAS.REG_Respuestas.map((_, i) => cambios[i] ?? `v${i}`);

  it('devuelve el nombre de la columna que no coincide', () => {
    const esperada = fila();
    const enLaHoja = fila({ 7: 'otra cosa' });
    expect(cotejarCeldas(esperada, enLaHoja)).toEqual([HOJAS.REG_Respuestas[7]]);
  });

  it('pasa por alto la marca temporal, que la hoja reescribe a su manera', () => {
    const i = HOJAS.REG_Respuestas.indexOf('Marca temporal');
    const esperada = fila({ [i]: '2026-10-09T15:00:00.000Z' });
    const enLaHoja = fila({ [i]: '09/10/2026 15:00:00' });
    expect(cotejarCeldas(esperada, enLaHoja)).toEqual([]);
  });

  it('y los enlaces de descarga, que vuelven leídos como su resultado', () => {
    const esperada = fila({ 3: '=HYPERLINK("https://drive.google.com/x";"Descargar")' });
    const enLaHoja = fila({ 3: 'Descargar' });
    expect(cotejarCeldas(esperada, enLaHoja)).toEqual([]);
  });

  it('una celda vacía en la hoja y vacía en el sistema no es diferencia', () => {
    const esperada = HOJAS.REG_Respuestas.map(() => '');
    expect(cotejarCeldas(esperada, [])).toEqual([]);
  });
});
