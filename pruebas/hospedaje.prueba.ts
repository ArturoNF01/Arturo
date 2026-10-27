import { describe, expect, it } from 'vitest';
import { HOTEL, LANDING } from '@/lib/landing';

describe('el hotel con convenio', () => {
  it('el código es exactamente el que dio el hotel', () => {
    expect(HOTEL.codigo).toBe('Convenio CISS');
  });

  it('el enlace para llamar marca el mismo número que se enseña', () => {
    expect(HOTEL.telefonoEnlace).toBe(`tel:${HOTEL.telefono.replace(/\D/g, '').replace(/^/, '+')}`);
  });

  it('los enlaces son https y el del mapa trae la coordenada del hotel', () => {
    expect(HOTEL.web.startsWith('https://')).toBe(true);
    expect(HOTEL.mapa.startsWith('https://www.google.com/maps')).toBe(true);
    expect(HOTEL.mapa).toContain('19.328198,-99.213928');
  });

  it('los textos del hospedaje existen, sin huecos, en los tres idiomas', () => {
    const claves = Object.keys(LANDING.es).sort();
    for (const idioma of ['en', 'pt'] as const) {
      expect(Object.keys(LANDING[idioma]).sort(), idioma).toEqual(claves);
    }
    for (const idioma of ['es', 'en', 'pt'] as const) {
      for (const clave of [
        'hospedajeTitulo', 'hospedajeAyuda', 'hospedajeEtiqueta', 'hospedajeAtencion',
        'hospedajeSitio', 'hospedajeLlamar', 'hospedajeComoLlegar', 'codigoEtiqueta',
        'codigoAyuda', 'codigoCopiar', 'codigoCopiado',
      ] as const) {
        expect(LANDING[idioma][clave].trim().length, `${idioma}.${clave}`).toBeGreaterThan(0);
      }
    }
  });
});
