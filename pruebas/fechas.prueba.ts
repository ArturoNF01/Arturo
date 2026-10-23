import { describe, expect, it } from 'vitest';
import { diaEnMexico, plazoVigente } from '@/lib/fechas';

/**
 * México va a UTC−6 sin horario de verano. El día UTC cambia a las 18:00
 * hora de México, y ahí es donde el contador «Registros hoy» perdía el dato.
 */
describe('el día en México', () => {
  it('a las 17:59 de México sigue siendo el mismo día que a las 00:00', () => {
    expect(diaEnMexico('2026-10-23T06:00:00Z')).toBe('2026-10-23'); // 00:00 en México
    expect(diaEnMexico('2026-10-23T23:59:00Z')).toBe('2026-10-23'); // 17:59
  });

  it('a las 18:00 de México (medianoche UTC) el día no cambia: ahí fallaba el contador', () => {
    expect(diaEnMexico('2026-10-24T00:00:00Z')).toBe('2026-10-23');
    expect(diaEnMexico('2026-10-24T05:59:59Z')).toBe('2026-10-23'); // 23:59:59
  });

  it('el día cambia a la medianoche de México, no a la de UTC', () => {
    expect(diaEnMexico('2026-10-24T06:00:00Z')).toBe('2026-10-24');
  });

  it('acepta Date, texto de la base de datos y milisegundos', () => {
    const instante = '2026-10-23T20:30:00.000Z';
    expect(diaEnMexico(new Date(instante))).toBe('2026-10-23');
    expect(diaEnMexico(Date.parse(instante))).toBe('2026-10-23');
  });

  it('una fecha ilegible da cadena vacía, no una excepción', () => {
    expect(diaEnMexico('no es fecha')).toBe('');
  });
});

describe('el cierre del registro', () => {
  it('el último día cuenta entero, hasta las 23:59 de México', () => {
    expect(plazoVigente('2026-10-30', new Date('2026-10-30T06:00:00Z'))).toBe(true);
    expect(plazoVigente('2026-10-30', new Date('2026-10-31T00:30:00Z'))).toBe(true); // 18:30 en México
    expect(plazoVigente('2026-10-30', new Date('2026-10-31T05:59:00Z'))).toBe(true); // 23:59
  });

  it('cierra a la medianoche de México', () => {
    expect(plazoVigente('2026-10-30', new Date('2026-10-31T06:00:00Z'))).toBe(false);
  });

  it('una fecha límite ilegible no cierra el registro', () => {
    expect(plazoVigente('', new Date())).toBe(true);
    expect(plazoVigente('pronto', new Date())).toBe(true);
  });
});
