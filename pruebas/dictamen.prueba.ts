import { describe, expect, it } from 'vitest';
import {
  ESTADOS_PONENCIA, calcularAvance, comentariosObligatorios, dictamenResuelto,
  esEstadoPonenciaValido, evaluarDictamen, plantillaDeDictamen, type EstadoPonencia,
} from '@/lib/dictamen';

const conPonencia = { comentarios: 'Ajustar el marco teórico.', tienePonencia: true };

describe('estados del dictamen', () => {
  it('reconoce los estados válidos y rechaza los inventados', () => {
    for (const estado of ESTADOS_PONENCIA) expect(esEstadoPonenciaValido(estado)).toBe(true);
    expect(esEstadoPonenciaValido('aprobada')).toBe(false);
    expect(esEstadoPonenciaValido(null)).toBe(false);
  });

  it('sólo cuenta como resuelto lo que ya tiene veredicto', () => {
    expect(dictamenResuelto('sin_dictamen')).toBe(false);
    expect(dictamenResuelto('en_revision')).toBe(false);
    expect(dictamenResuelto('aceptada')).toBe(true);
    expect(dictamenResuelto('aceptada_con_cambios')).toBe(true);
    expect(dictamenResuelto('rechazada')).toBe(true);
  });

  it('no avisa por correo los estados en trámite', () => {
    expect(plantillaDeDictamen('sin_dictamen')).toBeNull();
    expect(plantillaDeDictamen('en_revision')).toBeNull();
    expect(plantillaDeDictamen('aceptada')).toBe('ponencia_aceptada');
    expect(plantillaDeDictamen('aceptada_con_cambios')).toBe('ponencia_aceptada_con_cambios');
    expect(plantillaDeDictamen('rechazada')).toBe('ponencia_rechazada');
  });
});

describe('evaluarDictamen', () => {
  it('exige comentarios al pedir cambios o al no aceptar', () => {
    expect(comentariosObligatorios('aceptada_con_cambios')).toBe(true);
    expect(comentariosObligatorios('rechazada')).toBe(true);
    expect(comentariosObligatorios('aceptada')).toBe(false);

    for (const estado of ['aceptada_con_cambios', 'rechazada'] as EstadoPonencia[]) {
      const vacio = evaluarDictamen({ estado, comentarios: '   ', tienePonencia: true });
      expect(vacio.permitido).toBe(false);
      expect(vacio.motivo).toBeTruthy();
      expect(evaluarDictamen({ estado, ...conPonencia }).permitido).toBe(true);
    }
  });

  it('acepta sin comentarios cuando el dictamen es favorable', () => {
    expect(
      evaluarDictamen({ estado: 'aceptada', comentarios: '', tienePonencia: true }).permitido,
    ).toBe(true);
  });

  it('no deja dictaminar un registro que no trae ponencia', () => {
    const resultado = evaluarDictamen({
      estado: 'aceptada',
      comentarios: '',
      tienePonencia: false,
    });
    expect(resultado.permitido).toBe(false);
    expect(resultado.motivo).toBeTruthy();
  });
});

describe('calcularAvance', () => {
  it('separa pendientes de resueltas y cuenta por estado', () => {
    const avance = calcularAvance([
      'sin_dictamen', 'sin_dictamen', 'en_revision', 'aceptada', 'rechazada',
    ]);
    expect(avance.total).toBe(5);
    expect(avance.pendientes).toBe(3);
    expect(avance.resueltas).toBe(2);
    expect(avance.porEstado.sin_dictamen).toBe(2);
    expect(avance.porEstado.aceptada_con_cambios).toBe(0);
  });

  it('con lista vacía devuelve ceros en todos los estados', () => {
    const avance = calcularAvance([]);
    expect(avance.total).toBe(0);
    for (const estado of ESTADOS_PONENCIA) expect(avance.porEstado[estado]).toBe(0);
  });
});
