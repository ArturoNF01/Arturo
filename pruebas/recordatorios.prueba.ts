import { describe, expect, it } from 'vitest';
import {
  RECORDATORIOS_POR_DEFECTO, debeRecibirRecordatorio, diasHasta, normalizarRecordatorios,
  recordatorioDeHoy,
} from '@/lib/recordatorios';

const inicio = '2026-06-03';
const dia = (iso: string) => new Date(`${iso}T09:00:00Z`);

describe('diasHasta', () => {
  it('cuenta los días completos que faltan', () => {
    expect(diasHasta(inicio, dia('2026-06-03'))).toBe(0);
    expect(diasHasta(inicio, dia('2026-06-02'))).toBe(1);
    expect(diasHasta(inicio, dia('2026-05-04'))).toBe(30);
  });

  it('es negativo una vez empezado el congreso', () => {
    expect(diasHasta(inicio, dia('2026-06-05'))).toBe(-2);
  });

  it('devuelve null si la fecha no es una fecha', () => {
    expect(diasHasta('mañana', dia('2026-06-01'))).toBeNull();
  });
});

describe('recordatorioDeHoy', () => {
  it('envía el que corresponde a la antelación exacta', () => {
    expect(recordatorioDeHoy(RECORDATORIOS_POR_DEFECTO, inicio, dia('2026-05-04'))?.clave)
      .toBe('t_30');
    expect(recordatorioDeHoy(RECORDATORIOS_POR_DEFECTO, inicio, dia('2026-05-27'))?.clave)
      .toBe('t_7');
    expect(recordatorioDeHoy(RECORDATORIOS_POR_DEFECTO, inicio, dia('2026-06-02'))?.clave)
      .toBe('t_1');
  });

  it('admite un día de retraso para que un cron caído no pierda la ventana', () => {
    // 29 días antes: la ventana de t_30 sigue abierta.
    expect(recordatorioDeHoy(RECORDATORIOS_POR_DEFECTO, inicio, dia('2026-05-05'))?.clave)
      .toBe('t_30');
  });

  it('nunca se adelanta', () => {
    expect(recordatorioDeHoy(RECORDATORIOS_POR_DEFECTO, inicio, dia('2026-05-03'))).toBeNull();
  });

  it('no envía nada fuera de las ventanas ni después del congreso', () => {
    expect(recordatorioDeHoy(RECORDATORIOS_POR_DEFECTO, inicio, dia('2026-05-15'))).toBeNull();
    expect(recordatorioDeHoy(RECORDATORIOS_POR_DEFECTO, inicio, dia('2026-06-04'))).toBeNull();
  });

  it('ignora los recordatorios desactivados', () => {
    const apagado = RECORDATORIOS_POR_DEFECTO.map((r) =>
      r.clave === 't_7' ? { ...r, activo: false } : r,
    );
    expect(recordatorioDeHoy(apagado, inicio, dia('2026-05-27'))).toBeNull();
  });

  it('si dos ventanas se solapan gana la más cercana al congreso', () => {
    const solapados = [
      { clave: 'lejano', dias_antes: 8, activo: true },
      { clave: 'cercano', dias_antes: 7, activo: true },
    ];
    // A 7 días, 'lejano' está en su día de gracia y 'cercano' en su día exacto.
    expect(recordatorioDeHoy(solapados, inicio, dia('2026-05-27'))?.clave).toBe('cercano');
  });
});

describe('debeRecibirRecordatorio', () => {
  it('escribe a quien tiene el registro vigente, no a bajas ni a la lista de espera', () => {
    expect(debeRecibirRecordatorio('confirmado')).toBe(true);
    expect(debeRecibirRecordatorio('en_proceso')).toBe(true);
    expect(debeRecibirRecordatorio('cancelado')).toBe(false);
    expect(debeRecibirRecordatorio('lista_espera')).toBe(false);
  });
});

describe('normalizarRecordatorios', () => {
  it('cae al valor por defecto cuando la configuración no sirve', () => {
    expect(normalizarRecordatorios(null)).toEqual(RECORDATORIOS_POR_DEFECTO);
    expect(normalizarRecordatorios('t_30')).toEqual(RECORDATORIOS_POR_DEFECTO);
    expect(normalizarRecordatorios([])).toEqual(RECORDATORIOS_POR_DEFECTO);
    expect(normalizarRecordatorios([{ clave: '', dias_antes: 3 }])).toEqual(
      RECORDATORIOS_POR_DEFECTO,
    );
  });

  it('descarta las filas rotas y conserva las buenas', () => {
    const filas = normalizarRecordatorios([
      { clave: 't_10', dias_antes: 10 },
      { clave: 'malo', dias_antes: 'pronto' },
      { clave: 'negativo', dias_antes: -3, activo: true },
      { clave: 't_2', dias_antes: 2, activo: false },
    ]);
    expect(filas).toEqual([
      { clave: 't_10', dias_antes: 10, activo: true },
      { clave: 't_2', dias_antes: 2, activo: false },
    ]);
  });
});
