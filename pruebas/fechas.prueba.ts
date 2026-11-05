import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { diaEnMexico, hayFechaLimite, plazoVigente, plazosEnPalabras } from '@/lib/fechas';
import { esquemaConfiguracion } from '@/lib/esquema';

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

describe('los filtros por fecha del panel', () => {
  const registro = (creado_en: string) => ({ creado_en, estado: 'confirmado' }) as never;

  it('«hasta hoy» incluye los registros de la tarde-noche de México', async () => {
    const { aplicarFiltros, FILTROS_VACIOS } = await import('@/componentes/panel/usar-registros');
    const registros = [
      registro('2026-10-27T15:00:00Z'), // 09:00 en México
      registro('2026-10-28T02:30:00Z'), // 20:30 en México, mismo día
      registro('2026-10-28T06:30:00Z'), // 00:30 del 28
    ];
    const hastaHoy = aplicarFiltros(registros, { ...FILTROS_VACIOS, desde: '2026-10-27', hasta: '2026-10-27' });
    expect(hastaHoy).toHaveLength(2);
  });
});

describe('sin fecha límite: el registro se mantiene abierto', () => {
  it('vacía o ilegible quiere decir «sin plazo», y con fecha, «hay plazo»', () => {
    expect(hayFechaLimite('')).toBe(false);
    expect(hayFechaLimite('pronto')).toBe(false);
    expect(hayFechaLimite('2026-13-45')).toBe(false);
    expect(hayFechaLimite('2026-11-02')).toBe(true);
  });

  it('sin plazo no se cierra nunca: ni la edición de quien ya se registró ni el registro', () => {
    for (const ahora of ['2026-11-03T12:00:00Z', '2027-01-01T00:00:00Z', '2030-06-01T00:00:00Z']) {
      expect(plazoVigente('', new Date(ahora)), ahora).toBe(true);
    }
  });

  it('los correos dicen «en cualquier momento» y no «hasta el .»', () => {
    expect(plazosEnPalabras('', 'es')).toEqual({ edicion: 'en cualquier momento', reenvio: 'a la brevedad' });
    expect(plazosEnPalabras('', 'en')).toEqual({ edicion: 'at any time', reenvio: 'as soon as possible' });
    expect(plazosEnPalabras('', 'pt')).toEqual({ edicion: 'a qualquer momento', reenvio: 'o quanto antes' });
  });

  it('con fecha, la frase es la de siempre pero con la fecha legible', () => {
    expect(plazosEnPalabras('2026-11-02', 'es')).toEqual({
      edicion: 'hasta el 2 de noviembre de 2026', reenvio: 'antes del 2 de noviembre de 2026',
    });
    expect(plazosEnPalabras('2026-11-02', 'en').edicion).toBe('until November 2, 2026');
    expect(plazosEnPalabras('2026-11-02', 'pt').edicion).toBe('até 2 de novembro de 2026');
  });

  it('el panel acepta dejar la fecha vacía, y sigue rechazando una fecha mal escrita', () => {
    expect(esquemaConfiguracion.safeParse({ fecha_limite_registro: '' }).success).toBe(true);
    expect(esquemaConfiguracion.safeParse({ fecha_limite_registro: '2026-11-02' }).success).toBe(true);
    expect(esquemaConfiguracion.safeParse({ fecha_limite_registro: '2 de noviembre' }).success).toBe(false);
  });

  it('las plantillas sembradas no llevan la fecha pelada: usan el plazo ya dicho', () => {
    const sql = readFileSync('basedatos/esquema.sql', 'utf8');
    // Sólo puede salir en el comentario que lista las variables y en la semilla de la clave.
    const lineas = sql.split('\n').filter((l) => l.includes('{{fecha_limite}}') && !l.trimStart().startsWith('--'));
    expect(lineas, lineas.join('\n')).toEqual([]);
    expect(sql.match(/\{\{plazo_edicion\}\}/g)).toHaveLength(6 + 1); // 6 en las plantillas + 1 en el comentario
    expect(sql.match(/\{\{plazo_reenvio\}\}/g)).toHaveLength(3 + 1);
  });
});
