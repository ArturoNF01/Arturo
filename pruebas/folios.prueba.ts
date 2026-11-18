import { describe, expect, it } from 'vitest';
import { asignarFolios, folioDe, PREFIJOS_DE_FOLIO, type FilaParaFolio } from '@/lib/folios';

/** Los folios de las constancias: CONG-EISS-RIUSS-A01… para público general y CONG-EISS-RIUSS-P01… para ponentes. */

const fila = (serie: FilaParaFolio['serie'], extra: Partial<FilaParaFolio> = {}): FilaParaFolio => ({ serie, conRegistro: true, folio: '', ...extra });

describe('cómo se escribe un folio', () => {
  it('las dos series, tal como se pidieron', () => {
    expect(PREFIJOS_DE_FOLIO).toEqual({ publico_general: 'CONG-EISS-RIUSS-A', ponente: 'CONG-EISS-RIUSS-P' });
    expect(folioDe('publico_general', 1)).toBe('CONG-EISS-RIUSS-A01');
    expect(folioDe('ponente', 1)).toBe('CONG-EISS-RIUSS-P01');
  });

  it('con dos cifras como mínimo, y más si hacen falta', () => {
    expect([9, 10, 99, 100, 412].map((n) => folioDe('publico_general', n))).toEqual([
      'CONG-EISS-RIUSS-A09', 'CONG-EISS-RIUSS-A10', 'CONG-EISS-RIUSS-A99', 'CONG-EISS-RIUSS-A100', 'CONG-EISS-RIUSS-A412',
    ]);
  });
});

describe('qué folio le toca a cada fila', () => {
  it('cada serie cuenta por su cuenta, de uno en uno y en el orden de las filas', () => {
    const plan = asignarFolios([fila('publico_general'), fila('ponente'), fila('publico_general'), fila('publico_general'), fila('ponente')]);
    expect(plan.asignaciones).toEqual([
      { indice: 0, folio: 'CONG-EISS-RIUSS-A01' },
      { indice: 1, folio: 'CONG-EISS-RIUSS-P01' },
      { indice: 2, folio: 'CONG-EISS-RIUSS-A02' },
      { indice: 3, folio: 'CONG-EISS-RIUSS-A03' },
      { indice: 4, folio: 'CONG-EISS-RIUSS-P02' },
    ]);
    expect(plan.porSerie.publico_general).toEqual({ yaTenian: 0, nuevos: 3, primero: 'CONG-EISS-RIUSS-A01', ultimo: 'CONG-EISS-RIUSS-A03' });
    expect(plan.porSerie.ponente).toEqual({ yaTenian: 0, nuevos: 2, primero: 'CONG-EISS-RIUSS-P01', ultimo: 'CONG-EISS-RIUSS-P02' });
  });

  it('sin registro vigente no hay constancia ni folio, y no gasta número', () => {
    const plan = asignarFolios([fila('publico_general'), fila('publico_general', { conRegistro: false }), fila('publico_general')]);
    expect(plan.asignaciones.map((a) => [a.indice, a.folio])).toEqual([[0, 'CONG-EISS-RIUSS-A01'], [2, 'CONG-EISS-RIUSS-A02']]);
    expect(plan.sinRegistro).toBe(1);
  });

  it('quien asistió sin registro (sin perfil) no recibe folio', () => {
    const plan = asignarFolios([fila(null, { conRegistro: false }), fila('ponente')]);
    expect(plan.asignaciones).toEqual([{ indice: 1, folio: 'CONG-EISS-RIUSS-P01' }]);
    expect(plan.sinSerie).toBe(1);
  });

  it('nunca pisa un folio que ya está: sólo llena lo vacío', () => {
    const plan = asignarFolios([fila('publico_general', { folio: 'CONG-EISS-RIUSS-A01' }), fila('publico_general'), fila('publico_general', { folio: 'CONG-EISS-RIUSS-A02' })]);
    expect(plan.asignaciones.map((a) => a.indice)).toEqual([1]);
    expect(plan.porSerie.publico_general.yaTenian).toBe(2);
  });

  it('sigue la serie desde el número más alto que ya haya, aunque haya huecos: un folio no se reutiliza', () => {
    const plan = asignarFolios([
      fila('publico_general', { folio: 'CONG-EISS-RIUSS-A05' }), fila('publico_general'), fila('ponente', { folio: 'CONG-EISS-RIUSS-P12' }), fila('ponente'),
    ]);
    expect(plan.asignaciones).toEqual([{ indice: 1, folio: 'CONG-EISS-RIUSS-A06' }, { indice: 3, folio: 'CONG-EISS-RIUSS-P13' }]);
  });

  it('el número más alto cuenta aunque esté en una fila que hoy no recibiría folio (un registro que se canceló después)', () => {
    const plan = asignarFolios([fila('publico_general', { conRegistro: false, folio: 'CONG-EISS-RIUSS-A07' }), fila('publico_general')]);
    expect(plan.asignaciones).toEqual([{ indice: 1, folio: 'CONG-EISS-RIUSS-A08' }]);
  });

  it('es estable: repetirlo con lo ya escrito no asigna nada', () => {
    const filas = [fila('publico_general'), fila('ponente'), fila('publico_general')];
    const primero = asignarFolios(filas);
    const escritas = filas.map((f, i) => ({ ...f, folio: primero.asignaciones.find((a) => a.indice === i)?.folio ?? '' }));
    expect(asignarFolios(escritas).asignaciones).toEqual([]);
  });

  it('una fila que se suma después recibe el siguiente, y las de antes no cambian', () => {
    const antes = [fila('publico_general', { folio: 'CONG-EISS-RIUSS-A01' }), fila('publico_general', { folio: 'CONG-EISS-RIUSS-A02' })];
    expect(asignarFolios([...antes, fila('publico_general')]).asignaciones).toEqual([{ indice: 2, folio: 'CONG-EISS-RIUSS-A03' }]);
  });

  it('avisa de un folio que está en más de una fila, y de uno de la otra serie, y los deja como están', () => {
    const plan = asignarFolios([
      fila('publico_general', { folio: 'CONG-EISS-RIUSS-A01' }), fila('publico_general', { folio: 'CONG-EISS-RIUSS-A01' }),
      fila('ponente', { folio: 'CONG-EISS-RIUSS-A09' }), fila('ponente'),
    ]);
    expect(plan.repetidos).toEqual(['CONG-EISS-RIUSS-A01']);
    expect(plan.incoherentes).toBe(1);
    expect(plan.asignaciones).toEqual([{ indice: 3, folio: 'CONG-EISS-RIUSS-P01' }]);
  });

  it('un folio con otro formato (puesto a mano) cuenta como ya puesto y no mueve las series', () => {
    const plan = asignarFolios([fila('publico_general', { folio: 'PENDIENTE' }), fila('publico_general')]);
    expect(plan.asignaciones).toEqual([{ indice: 1, folio: 'CONG-EISS-RIUSS-A01' }]);
    expect(plan.incoherentes).toBe(0);
  });

  it('una hoja sin filas no tiene nada que asignar', () => {
    expect(asignarFolios([]).asignaciones).toEqual([]);
  });
});
