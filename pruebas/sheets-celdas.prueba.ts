import { describe, it, expect } from 'vitest';
import { blindar } from '../src/lib/servidor/sheets';
import { enlaceDescarga } from '../src/lib/normalizacion';

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

describe('el enlace «Descargar» de Drive', () => {
  it('llega a la hoja como fórmula, para que salga azul y subrayado', () => {
    const enlace = enlaceDescarga('https://drive.google.com/file/d/abc123/view');
    expect(enlace).toBe('=HYPERLINK("https://drive.google.com/file/d/abc123/view";"Descargar")');
    expect(blindar(enlace)).toBe(enlace);
  });

  it('una celda vacía si no hay archivo', () => {
    for (const v of [null, undefined, '', '   ', 'no es una url']) {
      expect(enlaceDescarga(v)).toBe('');
    }
  });

  it('una fórmula imitada a mano sigue siendo texto', () => {
    // El paso franco es para la forma exacta que genera el código, no para
    // cualquier cosa que empiece por «=HYPERLINK».
    const imitacion = '=HYPERLINK("https://malo";"Descargar")&IMPORTDATA("https://fuga")';
    expect(blindar(imitacion)).toBe(`'${imitacion}`);
    expect(blindar('=HYPERLINK("http://sin-tls";"Descargar")')).toBe(
      '\'=HYPERLINK("http://sin-tls";"Descargar")',
    );
  });

  it('no deja pasar una dirección que no sea https', () => {
    expect(enlaceDescarga('javascript:alert(1)')).toBe('');
    expect(enlaceDescarga('http://drive.google.com/x')).toBe('');
  });
});
