import { describe, expect, it } from 'vitest';
import { codigoPais, nombrePais } from '@/lib/paises';

describe('normalización de países escritos a mano', () => {
  it('reconoce el nombre con y sin acentos', () => {
    expect(codigoPais('México')).toBe('484');
    expect(codigoPais('mexico')).toBe('484');
    expect(codigoPais('  MÉXICO  ')).toBe('484');
  });

  it('reconoce el mismo país en los tres idiomas del formulario', () => {
    expect(codigoPais('Brasil')).toBe('076');
    expect(codigoPais('Brazil')).toBe('076');
    expect(codigoPais('España')).toBe('724');
    expect(codigoPais('Spain')).toBe('724');
  });

  it('acepta abreviaturas frecuentes', () => {
    expect(codigoPais('EEUU')).toBe('840');
    expect(codigoPais('USA')).toBe('840');
    expect(codigoPais('United States')).toBe('840');
  });

  it('tolera texto alrededor del nombre del país', () => {
    expect(codigoPais('Ciudad de México, México')).toBe('484');
    expect(codigoPais('Brasil (São Paulo)')).toBe('076');
  });

  it('devuelve null cuando no reconoce el país, para no contarlo mal en el mapa', () => {
    expect(codigoPais('Wakanda')).toBeNull();
    expect(codigoPais('')).toBeNull();
    expect(codigoPais(null)).toBeNull();
  });

  it('traduce el código de vuelta a un nombre legible', () => {
    expect(nombrePais('604')).toBe('Perú');
    expect(nombrePais('999')).toBe('999');
  });
});
