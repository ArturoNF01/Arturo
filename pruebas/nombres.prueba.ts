import { describe, expect, it } from 'vitest';
import { aAltasYBajas, esTodoMayusculas } from '@/lib/nombres';

describe('qué se considera todo en mayúsculas', () => {
  it('sí: nombres y apellidos escritos con todas las letras en mayúscula, con acentos y ñ', () => {
    for (const t of ['CARLOS CHAVERA BIANCHI', 'MARÍA DEL CARMEN', 'NÚÑEZ', 'JOSÉ-LUIS', "O'BRIEN"]) expect(esTodoMayusculas(t), t).toBe(true);
  });

  it('no: lo que ya tiene minúsculas, aunque sea una sola', () => {
    for (const t of ['Carlos Chavera', 'CARLOS chavera', 'carlos', 'McDonald']) expect(esTodoMayusculas(t), t).toBe(false);
  });

  it('no: con menos de tres letras no se sabe si es una sigla o un nombre corto', () => {
    for (const t of ['LI', 'J.', 'A', '', '123']) expect(esTodoMayusculas(t), t).toBe(false);
  });
});

describe('«altas y bajas»', () => {
  it('la inicial de cada palabra en mayúscula y el resto en minúscula', () => {
    expect(aAltasYBajas('CARLOS CHAVERA BIANCHI')).toBe('Carlos Chavera Bianchi');
  });

  it('conserva acentos y ñ', () => {
    expect(aAltasYBajas('MARÍA JOSÉ NÚÑEZ PEÑA')).toBe('María José Núñez Peña');
  });

  it('las partículas van en minúscula si no abren el campo', () => {
    expect(aAltasYBajas('MARÍA DEL CARMEN')).toBe('María del Carmen');
    expect(aAltasYBajas('DE LA CRUZ Y MORA')).toBe('De la Cruz y Mora');
    expect(aAltasYBajas('ANA DE LOS ÁNGELES')).toBe('Ana de los Ángeles');
  });

  it('también tras un guion, un apóstrofo o un punto', () => {
    expect(aAltasYBajas('ANA-LUCÍA')).toBe('Ana-Lucía');
    expect(aAltasYBajas("O'BRIEN")).toBe("O'Brien");
    expect(aAltasYBajas('J.M. LÓPEZ')).toBe('J.M. López');
  });

  it('junta los espacios de más', () => {
    expect(aAltasYBajas('  CARLOS   CHAVERA ')).toBe('Carlos Chavera');
  });

  it('lo que ya está bien no cambia', () => {
    expect(aAltasYBajas('Carlos Chavera Bianchi')).toBe('Carlos Chavera Bianchi');
  });
});
