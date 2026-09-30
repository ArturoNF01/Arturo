import { describe, expect, it } from 'vitest';

/**
 * El folio se genera en la base, así que esta prueba no lo ejecuta: fija por
 * escrito el cálculo que llevó a cambiarlo, que es lo que se olvida.
 *
 * El espacio es por día, porque la fecha va dentro del propio folio.
 */

/** Probabilidad de que, entre N folios sorteados a ciegas, dos coincidan. */
function dosCoinciden(altas: number, caracteres: number): number {
  return 1 - Math.exp(-(altas ** 2) / (2 * 16 ** caracteres));
}

/** Probabilidad de que un sorteo caiga sobre uno de los folios ya dados. */
function chocaConUnoExistente(existentes: number, caracteres: number): number {
  return existentes / 16 ** caracteres;
}

describe('el espacio de folios frente a una convocatoria masiva', () => {
  it('con cuatro caracteres, doscientas altas ya chocan una de cada cuatro veces', () => {
    // Es lo que apareció en la prueba de carga: 200 altas, un folio repetido
    // y un alta perdida con el mensaje equivocado.
    expect(dosCoinciden(200, 4)).toBeGreaterThan(0.2);
  });

  it('con cuatro caracteres, mil altas chocan casi seguro', () => {
    expect(dosCoinciden(1000, 4)).toBeGreaterThan(0.99);
  });

  it('seis caracteres, por sí solos, tampoco bastan para diez mil altas', () => {
    // Conviene dejarlo escrito para no confiarse: ampliar el folio reduce los
    // choques, no los elimina. Lo que los elimina es comprobar antes de
    // devolverlo, y por eso la función sortea dentro de un bucle.
    expect(dosCoinciden(10_000, 6)).toBeGreaterThan(0.9);
  });

  it('comprobando antes, diez sorteos seguidos fallidos son imposibles en la práctica', () => {
    // Con cinco mil folios ya dados ese día, cada sorteo cae sobre uno
    // existente tres veces de cada diez mil. Que eso ocurra diez veces
    // seguidas —lo que haría fallar el alta— tiene una probabilidad que no
    // cabe en la vida del congreso.
    const porSorteo = chocaConUnoExistente(5_000, 6);
    expect(porSorteo).toBeLessThan(0.001);
    expect(porSorteo ** 10).toBeLessThan(1e-30);
  });
});
