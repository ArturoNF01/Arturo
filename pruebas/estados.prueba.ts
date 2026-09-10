import { describe, expect, it } from 'vitest';
import {
  ESTADOS, esEstadoValido, evaluarCambio, ocupaLugar, plantillaDeEstado,
  transicionPermitida, transicionesDesde, type EstadoRegistro,
} from '@/lib/estados';

const base = { modalidad: 'presencial' as const, lugaresLibres: 10 };

describe('ocupación de lugar', () => {
  it('la lista de espera y las cancelaciones no ocupan lugar', () => {
    expect(ocupaLugar('lista_espera')).toBe(false);
    expect(ocupaLugar('cancelado')).toBe(false);
  });

  it('en proceso y confirmado sí lo ocupan', () => {
    expect(ocupaLugar('en_proceso')).toBe(true);
    expect(ocupaLugar('confirmado')).toBe(true);
  });
});

describe('transiciones', () => {
  it('desde lista de espera se puede confirmar o cancelar', () => {
    expect(transicionesDesde('lista_espera')).toEqual(['confirmado', 'en_proceso', 'cancelado']);
  });

  it('un registro confirmado no vuelve a lista de espera sin pasar por en proceso', () => {
    expect(transicionPermitida('confirmado', 'lista_espera')).toBe(false);
    expect(transicionPermitida('confirmado', 'en_proceso')).toBe(true);
    expect(transicionPermitida('en_proceso', 'lista_espera')).toBe(true);
  });

  it('una cancelación se puede revertir', () => {
    expect(transicionPermitida('cancelado', 'en_proceso')).toBe(true);
    expect(transicionPermitida('cancelado', 'lista_espera')).toBe(true);
  });

  it('ningún estado se ofrece a sí mismo como destino', () => {
    for (const estado of ESTADOS) {
      expect(transicionesDesde(estado), estado).not.toContain(estado);
    }
  });

  it('reconoce los estados válidos y descarta el resto', () => {
    expect(esEstadoValido('confirmado')).toBe(true);
    expect(esEstadoValido('inventado')).toBe(false);
    expect(esEstadoValido(null)).toBe(false);
  });
});

describe('evaluarCambio', () => {
  it('rechaza quedarse en el mismo estado', () => {
    const r = evaluarCambio({ ...base, desde: 'confirmado', hasta: 'confirmado' });
    expect(r.permitido).toBe(false);
  });

  it('rechaza una transición sin sentido', () => {
    const r = evaluarCambio({ ...base, desde: 'confirmado', hasta: 'lista_espera' });
    expect(r.permitido).toBe(false);
  });

  it('confirmar desde lista de espera consume un lugar', () => {
    const r = evaluarCambio({ ...base, desde: 'lista_espera', hasta: 'confirmado' });
    expect(r).toMatchObject({ permitido: true, variacionCupo: 1 });
  });

  it('cancelar libera un lugar', () => {
    const r = evaluarCambio({ ...base, desde: 'confirmado', hasta: 'cancelado' });
    expect(r).toMatchObject({ permitido: true, variacionCupo: -1 });
  });

  it('pasar de en proceso a confirmado no mueve el cupo: ya lo ocupaba', () => {
    const r = evaluarCambio({ ...base, desde: 'en_proceso', hasta: 'confirmado' });
    expect(r).toMatchObject({ permitido: true, variacionCupo: 0 });
  });

  it('no confirma a nadie presencial si no quedan lugares', () => {
    const r = evaluarCambio({
      desde: 'lista_espera', hasta: 'confirmado', modalidad: 'presencial', lugaresLibres: 0,
    });
    expect(r.permitido).toBe(false);
    expect(r.motivo).toMatch(/lugares presenciales/i);
  });

  it('en línea no depende del cupo presencial', () => {
    const r = evaluarCambio({
      desde: 'lista_espera', hasta: 'confirmado', modalidad: 'en_linea', lugaresLibres: 0,
    });
    expect(r.permitido).toBe(true);
  });

  it('sin límite de cupo siempre se puede confirmar', () => {
    const r = evaluarCambio({
      desde: 'lista_espera', hasta: 'confirmado', modalidad: 'presencial', lugaresLibres: null,
    });
    expect(r.permitido).toBe(true);
  });

  it('cancelar sigue siendo posible con el aforo lleno', () => {
    const r = evaluarCambio({
      desde: 'confirmado', hasta: 'cancelado', modalidad: 'presencial', lugaresLibres: 0,
    });
    expect(r.permitido).toBe(true);
  });
});

describe('aviso por correo', () => {
  it('cada estado visible para el participante tiene plantilla', () => {
    expect(plantillaDeEstado('confirmado')).toBe('registro_confirmado');
    expect(plantillaDeEstado('cancelado')).toBe('registro_cancelado');
    expect(plantillaDeEstado('lista_espera')).toBe('lista_espera');
  });

  it('«en proceso» es interno del comité y no genera aviso', () => {
    expect(plantillaDeEstado('en_proceso')).toBeNull();
  });
});

describe('coherencia con las plantillas sembradas', () => {
  it('toda plantilla de estado está sembrada en el esquema, en los tres idiomas', async () => {
    const { readFileSync } = await import('node:fs');
    const sql = readFileSync('basedatos/esquema.sql', 'utf8');

    for (const estado of ESTADOS as readonly EstadoRegistro[]) {
      const clave = plantillaDeEstado(estado);
      if (!clave) continue;
      for (const idioma of ['es', 'en', 'pt']) {
        expect(sql, `${clave}/${idioma}`).toContain(`('${clave}', '${idioma}'`);
      }
    }
  });
});
