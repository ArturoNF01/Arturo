import { describe, expect, it } from 'vitest';
import {
  CONGRESO_POR_DEFECTO, EJES_POR_DEFECTO, avisoPorDefecto, faqsPorDefecto,
  traducir, traducirLista,
} from '@/lib/contenido';
import { IDIOMAS } from '@/i18n';

describe('traducción de contenido multilingüe', () => {
  it('devuelve el idioma pedido cuando existe', () => {
    expect(traducir({ es: 'Sede', en: 'Venue', pt: 'Sede' }, 'en')).toBe('Venue');
  });

  it('cae al español cuando falta la traducción', () => {
    expect(traducir({ es: 'Sede' }, 'pt')).toBe('Sede');
  });

  it('usa cualquier idioma disponible antes que quedarse en blanco', () => {
    expect(traducir({ pt: 'Sede' }, 'en')).toBe('Sede');
  });

  it('tolera contenido ausente', () => {
    expect(traducir(null, 'es')).toBe('');
    expect(traducir({}, 'es')).toBe('');
    expect(traducirLista(null, 'es')).toEqual([]);
  });

  it('aplica la misma regla de respaldo a las listas de párrafos', () => {
    expect(traducirLista({ es: ['uno', 'dos'] }, 'en')).toEqual(['uno', 'dos']);
  });
});

describe('propuestas por defecto', () => {
  it('los ejes traen los tres idiomas y claves únicas', () => {
    expect(EJES_POR_DEFECTO.length).toBeGreaterThanOrEqual(4);
    const claves = EJES_POR_DEFECTO.map((e) => e.clave);
    expect(new Set(claves).size).toBe(claves.length);
    for (const eje of EJES_POR_DEFECTO) {
      for (const idioma of IDIOMAS) {
        expect(eje.nombre[idioma], `${eje.clave}.${idioma}`).toBeTruthy();
      }
    }
  });

  it('las FAQs se combinan en registros con los tres idiomas', () => {
    const faqs = faqsPorDefecto();
    expect(faqs.length).toBeGreaterThan(10);
    for (const faq of faqs) {
      for (const idioma of IDIOMAS) {
        expect(faq.pregunta[idioma], `${faq.clave}.${idioma}`).toBeTruthy();
        expect(faq.respuesta[idioma], `${faq.clave}.${idioma}`).toBeTruthy();
      }
    }
  });

  it('cada FAQ conserva una clave única y un orden', () => {
    const faqs = faqsPorDefecto();
    const claves = faqs.map((f) => f.clave);
    expect(new Set(claves).size).toBe(claves.length);
    expect(faqs.every((f) => f.orden > 0)).toBe(true);
  });

  it('el aviso de privacidad conserva los párrafos de los tres idiomas', () => {
    const bloques = avisoPorDefecto();
    expect(bloques).toHaveLength(10);
    for (const bloque of bloques) {
      for (const idioma of IDIOMAS) {
        expect(bloque.titulo[idioma], `${bloque.clave}.${idioma}`).toBeTruthy();
        expect((bloque.parrafos[idioma] ?? []).length, `${bloque.clave}.${idioma}`).toBeGreaterThan(0);
      }
    }
  });

  it('los límites propuestos coinciden con los del formulario original', () => {
    expect(CONGRESO_POR_DEFECTO.limite_semblanza_palabras).toBe(60);
    expect(CONGRESO_POR_DEFECTO.limite_semblanza_caracteres).toBe(420);
    expect(CONGRESO_POR_DEFECTO.limite_resumen_caracteres).toBe(2000);
  });
});
