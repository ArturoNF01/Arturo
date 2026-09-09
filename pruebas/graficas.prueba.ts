import { describe, expect, it } from 'vitest';
import { contarPor, pasoSecuencial, colorSerie, regresionLineal, MAX_SERIES } from '@/lib/graficas';

describe('contarPor', () => {
  const filas = [
    { pais: 'México' }, { pais: 'México' }, { pais: 'Brasil' }, { pais: null }, { pais: '  ' },
  ];

  it('ordena de mayor a menor', () => {
    const conteo = contarPor(filas, (f) => f.pais, (v) => v);
    expect(conteo[0]).toMatchObject({ nombre: 'México', total: 2 });
  });

  it('agrupa los valores vacíos bajo una sola etiqueta', () => {
    const conteo = contarPor(filas, (f) => f.pais, (v) => v, { etiquetaVacio: 'Sin especificar' });
    expect(conteo.find((c) => c.nombre === 'Sin especificar')?.total).toBe(2);
  });

  it('pliega la cola en «Otros» para no salirse de los ocho tonos', () => {
    const muchos = Array.from({ length: 12 }, (_, i) => ({ pais: `País ${i}` }));
    const conteo = contarPor(muchos, (f) => f.pais, (v) => v, { etiquetaOtros: 'Otros' });
    expect(conteo).toHaveLength(MAX_SERIES + 1);
    expect(conteo.at(-1)).toMatchObject({ nombre: 'Otros', total: 4 });
  });

  it('no añade «Otros» cuando todo cabe', () => {
    const conteo = contarPor(filas, (f) => f.pais, (v) => v);
    expect(conteo.some((c) => c.clave === '__otros__')).toBe(false);
  });

  it('conserva el total de la muestra', () => {
    const muchos = Array.from({ length: 30 }, (_, i) => ({ pais: `País ${i % 11}` }));
    const conteo = contarPor(muchos, (f) => f.pais, (v) => v);
    expect(conteo.reduce((s, c) => s + c.total, 0)).toBe(30);
  });
});

describe('paleta', () => {
  it('nunca recicla tonos: pasado el octavo se queda en el último', () => {
    expect(colorSerie(0)).toBe('var(--serie-1)');
    expect(colorSerie(7)).toBe('var(--serie-8)');
    expect(colorSerie(20)).toBe('var(--serie-8)');
  });

  it('el cero de la rampa secuencial usa el color de rejilla, no un tono de datos', () => {
    expect(pasoSecuencial(0)).toBe('var(--rejilla)');
    expect(pasoSecuencial(-1)).toBe('var(--rejilla)');
    expect(pasoSecuencial(Number.NaN)).toBe('var(--rejilla)');
  });

  it('el máximo cae en el paso más oscuro disponible', () => {
    expect(pasoSecuencial(1)).toBe('var(--sec-7)');
    expect(pasoSecuencial(0.99)).toBe('var(--sec-7)');
  });
});

describe('regresionLineal', () => {
  it('recupera exactamente una recta sin ruido', () => {
    const modelo = regresionLineal([
      { x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 30 }, { x: 3, y: 40 },
    ]);
    expect(modelo?.pendiente).toBeCloseTo(10);
    expect(modelo?.interseccion).toBeCloseTo(10);
    expect(modelo?.r2).toBeCloseTo(1);
    expect(modelo?.error).toBeCloseTo(0);
  });

  it('devuelve un R² bajo cuando la serie no tiene tendencia', () => {
    const modelo = regresionLineal([
      { x: 0, y: 5 }, { x: 1, y: 1 }, { x: 2, y: 6 }, { x: 3, y: 2 }, { x: 4, y: 5 },
    ]);
    expect(modelo!.r2).toBeLessThan(0.3);
  });

  it('no proyecta con menos de tres puntos', () => {
    expect(regresionLineal([{ x: 0, y: 1 }, { x: 1, y: 2 }])).toBeNull();
  });

  it('no proyecta cuando todos los puntos comparten la misma abscisa', () => {
    expect(regresionLineal([{ x: 2, y: 1 }, { x: 2, y: 5 }, { x: 2, y: 9 }])).toBeNull();
  });
});
