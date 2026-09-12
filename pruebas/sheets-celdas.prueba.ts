import { describe, it, expect } from 'vitest';
import { blindar } from '../src/lib/servidor/sheets';

describe('celdas que Sheets no debe interpretar', () => {
  it('el teléfono deja de salir como #ERROR!', () => {
    expect(blindar('+52 55 1234 5678')).toBe("'+52 55 1234 5678");
  });

  it('protege los otros tres signos que abren una fórmula', () => {
    // No es cosmético: son datos escritos por cualquiera desde el formulario
    // público, y una celda que empieza por «=» se ejecuta al abrir la hoja.
    expect(blindar('=HYPERLINK("http://malo","ver")')).toBe('\'=HYPERLINK("http://malo","ver")');
    expect(blindar('-1+1')).toBe("'-1+1");
    expect(blindar('@import')).toBe("'@import");
  });

  it('deja en paz lo que no empieza por uno de esos signos', () => {
    for (const valor of ['Ana Ruiz', 'REG-DEMO-0001', '2026-11-11', 'a@b.org', '']) {
      expect(blindar(valor)).toBe(valor);
    }
  });

  it('los números siguen siendo números, para poder sumarlos', () => {
    expect(blindar(150)).toBe(150);
    expect(blindar(-3)).toBe(-3);
  });
});
