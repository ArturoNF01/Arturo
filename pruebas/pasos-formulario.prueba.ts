import { describe, expect, it } from 'vitest';
import { pasosVisibles, perfilPorClave } from '@/lib/perfiles';

/**
 * Réplica de la regla del botón principal del formulario: mientras no haya
 * perfil elegido sólo existe un paso, y el botón debe invitar a continuar,
 * no a enviar.
 */
function muestraEnviar(pasos: string[], indice: number): boolean {
  return pasos.length > 1 && indice >= pasos.length - 1;
}

describe('botón principal del formulario', () => {
  it('no ofrece enviar mientras no se elige perfil', () => {
    const pasos = pasosVisibles(undefined, 'presencial');
    expect(pasos).toHaveLength(1);
    expect(muestraEnviar(pasos, 0)).toBe(false);
  });

  it('ofrece enviar sólo en el último paso de un recorrido real', () => {
    const pasos = pasosVisibles(perfilPorClave('espectador_linea'), 'en_linea');
    expect(muestraEnviar(pasos, 0)).toBe(false);
    expect(muestraEnviar(pasos, pasos.length - 2)).toBe(false);
    expect(muestraEnviar(pasos, pasos.length - 1)).toBe(true);
  });

  it('el último paso siempre es el de protección de datos', () => {
    for (const clave of ['espectador_linea', 'funcionario_ciess', 'conferencista'] as const) {
      const pasos = pasosVisibles(perfilPorClave(clave), 'presencial');
      expect(pasos.at(-1), clave).toBe('privacidad');
    }
  });
});
