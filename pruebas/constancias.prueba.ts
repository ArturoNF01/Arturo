import { describe, expect, it, vi } from 'vitest';
import {
  COLUMNA_DE_CONSTANCIA, elegirDestinatariosDeConstancias, enlaceDeDescarga, enlaceHttps, escaparAtributo, filasDeConstancias,
  type CeldaDeLaHoja, type FilaDeConstancia,
} from '@/lib/constancias';

// `correo.ts` habla con la base para traducir el eje temático; aquí sólo se mira cómo arma el botón de la constancia.
vi.mock('@/lib/bd/conexion', () => ({ unaFila: async () => null, consultar: async () => [] }));
vi.mock('@/lib/servidor/contenido', () => ({ leerEjes: async () => ({ filas: [] }) }));
const { armarCorreoConPlantilla, variablesDeRegistro } = await import('@/lib/servidor/correo');

/** El envío de constancias: a quién le toca el correo, con qué enlace y cómo se ve el botón. */

describe('qué es un enlace que se puede mandar', () => {
  it('sólo https, sin espacios y con un dominio', () => {
    expect(enlaceHttps('https://drive.google.com/file/d/ABC/view')).toBe('https://drive.google.com/file/d/ABC/view');
    expect(enlaceHttps('  https://ciess.org/constancias/ana.pdf  ')).toBe('https://ciess.org/constancias/ana.pdf');
    for (const malo of ['http://ciess.org/a.pdf', 'javascript:alert(1)', 'ftp://x.org/a', 'constancia.pdf', '', '   ', 'https://localhost/a', 'https://x.org/a b']) {
      expect(enlaceHttps(malo), malo).toBeNull();
    }
    expect(enlaceHttps(null)).toBeNull();
    expect(enlaceHttps(undefined)).toBeNull();
  });
});

describe('el enlace de descarga', () => {
  it('un archivo de Drive pasa de «ver» a «descargar», con el mismo identificador', () => {
    expect(enlaceDeDescarga('https://drive.google.com/file/d/1AbC-dEf_9/view?usp=sharing')).toBe('https://drive.google.com/uc?export=download&id=1AbC-dEf_9');
    expect(enlaceDeDescarga('https://drive.google.com/open?id=1AbC-dEf_9')).toBe('https://drive.google.com/uc?export=download&id=1AbC-dEf_9');
    expect(enlaceDeDescarga('https://drive.google.com/uc?id=1AbC-dEf_9')).toBe('https://drive.google.com/uc?export=download&id=1AbC-dEf_9');
  });

  it('un documento de Google pasa a su exportación en PDF', () => {
    expect(enlaceDeDescarga('https://docs.google.com/document/d/DOC123/edit?usp=sharing')).toBe('https://docs.google.com/document/d/DOC123/export?format=pdf');
    expect(enlaceDeDescarga('https://docs.google.com/presentation/d/PRES1/edit')).toBe('https://docs.google.com/presentation/d/PRES1/export/pdf');
  });

  it('cualquier otro enlace se deja como está', () => {
    expect(enlaceDeDescarga('https://ciess.org/constancias/ana.pdf')).toBe('https://ciess.org/constancias/ana.pdf');
    expect(enlaceDeDescarga('https://drive.google.com/drive/folders/XYZ')).toBe('https://drive.google.com/drive/folders/XYZ');
  });

  it('un enlace que no es válido vuelve tal cual: no se inventa uno', () => {
    expect(enlaceDeDescarga('javascript:alert(1)')).toBe('javascript:alert(1)');
  });
});

describe('escapar un enlace para un atributo HTML', () => {
  it('el & se dice &amp; y las comillas y los ángulos no pueden cerrar el atributo', () => {
    expect(escaparAtributo('https://x.org/a?b=1&c=2')).toBe('https://x.org/a?b=1&amp;c=2');
    expect(escaparAtributo('https://x.org/"><script>')).toBe('https://x.org/&quot;&gt;&lt;script&gt;');
  });
});

describe('leer la pestaña', () => {
  const celda = (texto: string, enlace?: string): CeldaDeLaHoja => ({ texto, enlace: enlace ?? null });
  const titulos = ['N.º', 'Nombre', 'Correo', 'Ponencia', 'Perfil', 'Total', 'Con registro', 'Total de horas', COLUMNA_DE_CONSTANCIA].map((t) => celda(t));
  const fila = (n: string, nombre: string, correo: string, registro: string, constancia: CeldaDeLaHoja): CeldaDeLaHoja[] =>
    [celda(n), celda(nombre), celda(correo), celda(''), celda('Público general'), celda('1'), celda(registro), celda(''), constancia];

  it('las columnas se buscan por su título, no por su letra', () => {
    const revuelta = [[...titulos].reverse(), ...[fila('1', 'Ana Ruiz', 'ana@x.org', 'TRUE', celda('https://x.org/a.pdf'))].map((f) => [...f].reverse())];
    const [f] = filasDeConstancias(revuelta);
    expect(f).toMatchObject({ numero: '1', nombre: 'Ana Ruiz', correo: 'ana@x.org', conRegistro: true, enlace: 'https://x.org/a.pdf' });
  });

  it('el hipervínculo de la celda manda sobre lo que se lee en ella', () => {
    const [f] = filasDeConstancias([titulos, fila('1', 'Ana Ruiz', 'ana@x.org', 'TRUE', celda('Constancia de Ana', 'https://drive.google.com/file/d/ID1/view'))]);
    expect(f.enlace).toBe('https://drive.google.com/uc?export=download&id=ID1');
    expect(f.texto).toBe('Constancia de Ana');
  });

  it('sin hipervínculo, vale el enlace escrito en la celda', () => {
    const [f] = filasDeConstancias([titulos, fila('1', 'Ana Ruiz', 'ana@x.org', 'TRUE', celda('https://x.org/a.pdf'))]);
    expect(f.enlace).toBe('https://x.org/a.pdf');
  });

  it('lo que no es un enlace queda sin enlace, y se conserva lo que decía para avisar', () => {
    const [f] = filasDeConstancias([titulos, fila('1', 'Ana Ruiz', 'ana@x.org', 'TRUE', celda('En proceso'))]);
    expect(f.enlace).toBeNull();
    expect(f.texto).toBe('En proceso');
  });

  it('el correo se lee en minúsculas y «Con registro» sólo es cierto si dice TRUE', () => {
    const filas = filasDeConstancias([titulos, fila('1', 'Ana', 'ANA@X.org', 'TRUE', celda('')), fila('2', 'Eva', 'eva@x.org', 'FALSE', celda('')), fila('3', 'Luis', 'l@x.org', '', celda(''))]);
    expect(filas.map((f) => [f.correo, f.conRegistro])).toEqual([['ana@x.org', true], ['eva@x.org', false], ['l@x.org', false]]);
  });

  it('las filas en blanco no cuentan', () => {
    expect(filasDeConstancias([titulos, titulos.map(() => celda('')), fila('1', 'Ana', 'a@x.org', 'TRUE', celda(''))])).toHaveLength(1);
  });

  it('si falta una columna, dice cuál: no adivina de dónde sacar un enlace', () => {
    for (const quita of ['Nombre', 'Correo', 'Con registro', COLUMNA_DE_CONSTANCIA]) {
      expect(() => filasDeConstancias([titulos.filter((t) => t.texto !== quita)]), quita).toThrow(new RegExp(`columna «${quita}»`));
    }
  });
});

describe('a quién le toca su constancia', () => {
  const f = (n: number, extra: Partial<FilaDeConstancia> = {}): FilaDeConstancia => ({
    numero: String(n), nombre: `Persona ${n}`, correo: `p${n}@x.org`, conRegistro: true, texto: `https://x.org/${n}.pdf`, enlace: `https://x.org/${n}.pdf`, ...extra,
  });
  const registros = [
    { id: 'r1', correo: 'p1@x.org', idioma: 'es' }, { id: 'r2', correo: 'P2@x.org', idioma: 'en' }, { id: 'r3', correo: 'p3@x.org', idioma: 'pt' },
  ];
  const nadie = new Map<string, Set<string>>();

  it('a quien tiene «Con registro», un enlace y un correo, con SU enlace y en el idioma de su registro', () => {
    const s = elegirDestinatariosDeConstancias({ filas: [f(1), f(2), f(3)], registros, yaEnviadas: nadie });
    expect(s.destinatarios.map((d) => [d.correo, d.idioma, d.registro_id, d.datos.enlace])).toEqual([
      ['p1@x.org', 'es', 'r1', 'https://x.org/1.pdf'], ['p2@x.org', 'en', 'r2', 'https://x.org/2.pdf'], ['p3@x.org', 'pt', 'r3', 'https://x.org/3.pdf'],
    ]);
    expect(s.destinatarios[1].datos).toEqual({ enlace: 'https://x.org/2.pdf', nombre: 'Persona 2', numero: '2' });
    expect(s.porIdioma).toEqual({ es: 1, en: 1, pt: 1 });
  });

  it('sin la casilla «Con registro» no hay constancia, aunque haya enlace', () => {
    const s = elegirDestinatariosDeConstancias({ filas: [f(1, { conRegistro: false })], registros, yaEnviadas: nadie });
    expect(s.destinatarios).toEqual([]);
    expect(s.excluidos.sinRegistro).toBe(1);
  });

  it('con registro y sin enlace: queda fuera y sale en la lista de quienes faltan, con su fila', () => {
    const s = elegirDestinatariosDeConstancias({ filas: [f(1), f(2, { texto: '', enlace: null }), f(3, { texto: 'pendiente', enlace: null })], registros, yaEnviadas: nadie });
    expect(s.destinatarios).toHaveLength(1);
    expect(s.excluidos).toMatchObject({ sinConstancia: 1, enlaceInvalido: 1 });
    expect(s.faltan).toEqual([{ numero: '2', nombre: 'Persona 2', correo: expect.any(String) }]);
  });

  it('un correo que no es válido, o que falta, deja fuera a esa fila', () => {
    const s = elegirDestinatariosDeConstancias({ filas: [f(1, { correo: '' }), f(2, { correo: 'no-es-correo' })], registros, yaEnviadas: nadie });
    expect(s.destinatarios).toEqual([]);
    expect(s.excluidos.sinCorreo).toBe(2);
  });

  it('un correo en dos filas recibe una sola vez, con el enlace de la primera', () => {
    const s = elegirDestinatariosDeConstancias({ filas: [f(1), f(9, { correo: 'p1@x.org', enlace: 'https://x.org/otra.pdf', texto: 'https://x.org/otra.pdf' })], registros, yaEnviadas: nadie });
    expect(s.destinatarios).toHaveLength(1);
    expect(s.destinatarios[0].datos.enlace).toBe('https://x.org/1.pdf');
    expect(s.excluidos.correoRepetido).toBe(1);
  });

  it('quien ya recibió ese mismo enlace queda fuera: repetir el envío sólo alcanza a quienes faltan', () => {
    const ya = new Map([['p1@x.org', new Set(['https://x.org/1.pdf'])]]);
    const s = elegirDestinatariosDeConstancias({ filas: [f(1), f(2)], registros, yaEnviadas: ya });
    expect(s.destinatarios.map((d) => d.correo)).toEqual(['p2@x.org']);
    expect(s.excluidos.yaRecibieron).toBe(1);
    expect(s.enlaceNuevo).toBe(0);
  });

  it('si el enlace cambió (se corrigió la constancia) se manda otra vez, y se cuenta aparte', () => {
    const ya = new Map([['p1@x.org', new Set(['https://x.org/viejo.pdf'])]]);
    const s = elegirDestinatariosDeConstancias({ filas: [f(1)], registros, yaEnviadas: ya });
    expect(s.destinatarios).toHaveLength(1);
    expect(s.enlaceNuevo).toBe(1);
  });

  it('un correo que no es de ningún registro recibe en español, y se cuenta', () => {
    const s = elegirDestinatariosDeConstancias({ filas: [f(7)], registros, yaEnviadas: nadie });
    expect(s.destinatarios[0]).toMatchObject({ idioma: 'es', registro_id: null });
    expect(s.sinRegistroDeCorreo).toBe(1);
  });

  it('un idioma raro en el registro no rompe: se manda en español', () => {
    const s = elegirDestinatariosDeConstancias({ filas: [f(1)], registros: [{ id: 'r1', correo: 'p1@x.org', idioma: 'fr' }], yaEnviadas: nadie });
    expect(s.destinatarios[0].idioma).toBe('es');
  });

  it('sin filas no hay nadie', () => {
    expect(elegirDestinatariosDeConstancias({ filas: [], registros, yaEnviadas: nadie }).destinatarios).toEqual([]);
  });
});

describe('el correo con el botón de la constancia', () => {
  const datos = (idioma: string, enlace?: string) => ({
    clave: 'constancia' as const,
    registro: { folio: 'REG-1', nombres: 'Ana Ruiz', apellidos: '', correo: 'a@b.org', idioma },
    correoContacto: 'congreso@ciess.org', fechaLimite: '', urlAgenda: '', enlaceConstancia: enlace,
  });
  const plantilla = { asunto: 'Su constancia · Congreso', cuerpo_html: '<p>Estimada {{nombre}}:</p>{{boton_constancia}}<p>Enlace: {{url_constancia}}</p>' };

  it('lleva el botón con el enlace de la persona, y el enlace visible por si el botón no abre', () => {
    const c = armarCorreoConPlantilla(datos('es', 'https://drive.google.com/uc?export=download&id=ID1'), plantilla);
    expect(c.html).toContain('href="https://drive.google.com/uc?export=download&amp;id=ID1"');
    expect(c.html).toContain('Descargar constancia');
    expect(c.html).toContain('Estimada Ana Ruiz:');
    expect(c.html).toContain('Si el botón no se abre');
    expect(c.html).toContain('Enlace: https://drive.google.com/uc?export=download&amp;id=ID1');
  });

  it('en el idioma de quien lo recibe', () => {
    expect(armarCorreoConPlantilla(datos('en', 'https://x.org/a.pdf'), plantilla).html).toContain('Download certificate');
    expect(armarCorreoConPlantilla(datos('pt', 'https://x.org/a.pdf'), plantilla).html).toContain('Baixar certificado');
  });

  it('el enlace no puede romper el atributo ni meter HTML', () => {
    const c = armarCorreoConPlantilla(datos('es', 'https://x.org/"><script>alert(1)</script>'), plantilla);
    expect(c.html).not.toContain('<script>alert(1)</script>');
    expect(c.html).not.toContain('href="https://x.org/">');
  });

  it('sin enlace (cualquier otro correo) no hay botón ni enlace', () => {
    const v = variablesDeRegistro(datos('es'));
    expect(v.boton_constancia).toBe('');
    expect(v.url_constancia).toBe('');
  });
});
