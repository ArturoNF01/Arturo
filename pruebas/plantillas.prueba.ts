import { describe, expect, it } from 'vitest';
import { aplicarPlantilla, envolverHtml } from '@/lib/plantillas';

describe('aplicarPlantilla', () => {
  const variables = {
    folio: 'REG-20260401-AB12',
    nombre: 'Ana Ruiz',
    correo_contacto: 'congreso@ciess.org',
  };

  it('sustituye las variables presentes', () => {
    expect(aplicarPlantilla('Folio {{folio}} de {{nombre}}', variables))
      .toBe('Folio REG-20260401-AB12 de Ana Ruiz');
  });

  it('tolera espacios dentro de las llaves', () => {
    expect(aplicarPlantilla('{{ folio }}', variables)).toBe('REG-20260401-AB12');
  });

  it('sustituye todas las apariciones de la misma variable', () => {
    expect(aplicarPlantilla('{{nombre}} y {{nombre}}', variables)).toBe('Ana Ruiz y Ana Ruiz');
  });

  it('deja intacta una variable que no existe, para que el error sea visible al editar', () => {
    expect(aplicarPlantilla('Hola {{inexistente}}', variables)).toBe('Hola {{inexistente}}');
  });

  it('no toca el texto cuando no hay variables', () => {
    expect(aplicarPlantilla('Sin variables', variables)).toBe('Sin variables');
  });
});

describe('envolverHtml', () => {
  it('produce un documento completo con el contenido dentro', () => {
    const html = envolverHtml('<p>Hola</p>', 'Congreso');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<p>Hola</p>');
    expect(html).toContain('Congreso');
  });

  it('declara la codificación y el ancho, que es lo que necesitan los clientes de correo', () => {
    const html = envolverHtml('', 'x');
    expect(html).toContain('charset="utf-8"');
    expect(html).toContain('width=device-width');
  });
});
