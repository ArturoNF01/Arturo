import { describe, expect, it } from 'vitest';
import { PASO_DE_CAMPO, PERFILES, pasosVisibles } from '@/lib/perfiles';
import { esquemaRegistro } from '@/lib/esquema';

/**
 * El mapa de campo a paso es lo que permite llevar a quien se registra hasta
 * donde está el problema. Un campo que falte ahí vuelve a producir el fallo
 * de origen: «revise los campos marcados» en el último paso, con los campos
 * marcados siete pantallas atrás y sin manera de llegar a ellos.
 */
describe('a qué paso pertenece cada campo', () => {
  const auxiliares = new Set([
    // Campos de la interfaz que no se guardan, y datos que el formulario
    // rellena solo: no hay una casilla que enfocar para ninguno.
    'idioma', 'token', 'sitio_web', 'abierto_en', 'estado', 'grupo',
    'modalidad_participacion', 'semblanza_drive_id', 'foto_drive_id',
    'boleto_drive_id', 'correo_alterno', 'disponibilidad_dias',
  ]);

  it('todo campo que el servidor puede rechazar sabe en qué paso está', () => {
    // El esquema lleva un superRefine encima, así que el objeto con los
    // campos está una capa más adentro.
    type ConForma = { _def: { schema?: ConForma }; shape?: Record<string, unknown> };
    let nodo = esquemaRegistro as unknown as ConForma;
    while (!nodo.shape && nodo._def?.schema) nodo = nodo._def.schema;

    const claves = Object.keys(nodo.shape ?? {});
    expect(claves.length, 'no se pudo leer la forma del esquema').toBeGreaterThan(20);

    const huerfanos = claves.filter((c) => !auxiliares.has(c) && !PASO_DE_CAMPO[c]);
    expect(huerfanos, `sin paso asignado: ${huerfanos.join(', ')}`).toEqual([]);
  });

  it('cada paso al que apunta el mapa existe de verdad para algún perfil', () => {
    const reales = new Set(
      PERFILES.flatMap((p) => [
        ...pasosVisibles(p, 'presencial'),
        ...pasosVisibles(p, 'en_linea'),
      ]),
    );
    for (const [campo, paso] of Object.entries(PASO_DE_CAMPO)) {
      expect(reales.has(paso), `${campo} → ${paso}`).toBe(true);
    }
  });
});
