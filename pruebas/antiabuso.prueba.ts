import { describe, expect, it } from 'vitest';
import {
  LIMITE_POR_HUELLA, SEGUNDOS_MINIMOS, demasiadoRapido, dentroDelLimite, normalizarCorreo,
  normalizarLimite, revisarEnvio, senueloLleno,
} from '@/lib/antiabuso';

const ahora = 1_800_000_000_000;

describe('señuelo', () => {
  it('sólo delata cuando llega con contenido', () => {
    expect(senueloLleno('')).toBe(false);
    expect(senueloLleno('   ')).toBe(false);
    expect(senueloLleno(undefined)).toBe(false);
    expect(senueloLleno('http://spam.example')).toBe(true);
  });
});

describe('tiempo de llenado', () => {
  it('rechaza el envío instantáneo', () => {
    expect(demasiadoRapido(ahora - 500, ahora)).toBe(true);
  });

  it('acepta el llenado de una persona', () => {
    expect(demasiadoRapido(ahora - 90_000, ahora)).toBe(false);
    expect(demasiadoRapido(ahora - SEGUNDOS_MINIMOS * 1000, ahora)).toBe(false);
  });

  it('no castiga a quien tiene el reloj mal puesto ni a quien no manda el dato', () => {
    expect(demasiadoRapido(ahora + 60_000, ahora)).toBe(false);
    expect(demasiadoRapido(undefined, ahora)).toBe(false);
    expect(demasiadoRapido('hace rato', ahora)).toBe(false);
    expect(demasiadoRapido(Number.NaN, ahora)).toBe(false);
  });
});

describe('revisarEnvio', () => {
  const bueno = { senuelo: '', abiertoEn: ahora - 30_000, ahora };

  it('deja pasar un envío normal', () => {
    expect(revisarEnvio(bueno).aceptado).toBe(true);
  });

  it('rechaza el señuelo lleno sin decir por qué', () => {
    const veredicto = revisarEnvio({ ...bueno, senuelo: 'x' });
    expect(veredicto.aceptado).toBe(false);
    expect(veredicto.motivo).toBe('senuelo');
    expect(veredicto.codigo).toBe(422);
  });

  it('rechaza el envío instantáneo con 429', () => {
    const veredicto = revisarEnvio({ ...bueno, abiertoEn: ahora - 100 });
    expect(veredicto.aceptado).toBe(false);
    expect(veredicto.motivo).toBe('demasiado_rapido');
    expect(veredicto.codigo).toBe(429);
  });
});

describe('límite por huella', () => {
  it('deja registrar mientras no se alcance', () => {
    expect(dentroDelLimite(0, 20)).toBe(true);
    expect(dentroDelLimite(19, 20)).toBe(true);
    expect(dentroDelLimite(20, 20)).toBe(false);
    expect(dentroDelLimite(41, 20)).toBe(false);
  });

  it('un límite sin sentido no bloquea a nadie', () => {
    expect(dentroDelLimite(500, 0)).toBe(true);
    expect(dentroDelLimite(500, Number.NaN)).toBe(true);
  });

  it('normaliza lo que venga de la configuración', () => {
    expect(normalizarLimite(35)).toBe(35);
    expect(normalizarLimite('35')).toBe(35);
    expect(normalizarLimite(0)).toBe(LIMITE_POR_HUELLA);
    expect(normalizarLimite(-3)).toBe(LIMITE_POR_HUELLA);
    expect(normalizarLimite('muchos')).toBe(LIMITE_POR_HUELLA);
    expect(normalizarLimite(undefined)).toBe(LIMITE_POR_HUELLA);
  });
});

describe('normalizarCorreo', () => {
  it('compara sin distinguir mayúsculas ni espacios', () => {
    expect(normalizarCorreo('  Persona@CIESS.org ')).toBe('persona@ciess.org');
  });
});
