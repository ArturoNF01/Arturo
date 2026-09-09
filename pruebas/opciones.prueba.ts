import { describe, expect, it } from 'vitest';
import { OPCIONES, etiquetaDe, etiquetaEs, etiquetasEs, opciones, type GrupoOpciones } from '@/lib/opciones';
import { IDIOMAS, diccionarios } from '@/i18n';

const GRUPOS = Object.keys(OPCIONES) as GrupoOpciones[];

describe('opciones canónicas', () => {
  it('los tres idiomas tienen una etiqueta por cada valor canónico', () => {
    for (const idioma of IDIOMAS) {
      const t = diccionarios[idioma];
      for (const grupo of GRUPOS) {
        const etiquetas = t.formulario.opciones[grupo] as string[];
        expect(etiquetas, `${idioma}.${grupo}`).toHaveLength(OPCIONES[grupo].length);
        expect(etiquetas.every((e) => e.trim().length > 0), `${idioma}.${grupo}`).toBe(true);
      }
    }
  });

  it('no repite valores canónicos dentro de un grupo', () => {
    for (const grupo of GRUPOS) {
      const valores = OPCIONES[grupo] as readonly string[];
      expect(new Set(valores).size, grupo).toBe(valores.length);
    }
  });

  it('empareja cada valor con su etiqueta traducida', () => {
    const pares = opciones('regimen', diccionarios.pt);
    expect(pares[0]).toEqual({ valor: 'sin_restriccion', etiqueta: 'Sem restrição' });
  });

  it('traduce un valor canónico al idioma pedido', () => {
    expect(etiquetaDe('traslado', 'solo_llegada', diccionarios.en)).toBe('Arrival only');
    expect(etiquetaDe('traslado', 'solo_llegada', diccionarios.pt)).toBe('Somente chegada');
  });

  it('devuelve el español para el libro de seguimiento', () => {
    expect(etiquetaEs('medioArribo', 'vehiculo_propio')).toBe('Vehículo propio');
    expect(etiquetasEs('tecnicos', ['proyeccion', 'audio'])).toBe('Proyección de diapositivas; Reproducción de audio');
  });

  it('deja pasar sin cambios un valor que no está en el catálogo', () => {
    expect(etiquetaDe('roles', 'valor_desconocido', diccionarios.es)).toBe('valor_desconocido');
    expect(etiquetaDe('roles', '', diccionarios.es)).toBe('');
    expect(etiquetasEs('tecnicos', null)).toBe('');
  });
});
