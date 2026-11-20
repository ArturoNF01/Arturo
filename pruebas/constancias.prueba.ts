import { describe, expect, it, vi } from 'vitest';
import {
  COLUMNA_DE_CONSTANCIA, MAXIMO_DE_LA_LISTA, correosDeUnTexto, elegirDeUnaLista, elegirDestinatariosDeConstancias, enlaceDeDescarga,
  enlaceHttps, escaparAtributo, filasDeConstancias, grupoDePerfil,
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
    for (const quita of ['Nombre', 'Correo', 'Perfil', 'Con registro', COLUMNA_DE_CONSTANCIA]) {
      expect(() => filasDeConstancias([titulos.filter((t) => t.texto !== quita)]), quita).toThrow(new RegExp(`columna «${quita}»`));
    }
  });
});

describe('a quién le toca su constancia', () => {
  const f = (n: number, extra: Partial<FilaDeConstancia> = {}): FilaDeConstancia => ({
    numero: String(n), nombre: `Persona ${n}`, correo: `p${n}@x.org`, conRegistro: true, grupo: 'publico_general', texto: `https://x.org/${n}.pdf`, enlace: `https://x.org/${n}.pdf`, ...extra,
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

  it('lleva el botón con el enlace de la persona, y no escribe el enlace debajo del botón', () => {
    const c = armarCorreoConPlantilla(datos('es', 'https://drive.google.com/uc?export=download&id=ID1'), plantilla);
    expect(c.html).toContain('href="https://drive.google.com/uc?export=download&amp;id=ID1"');
    expect(c.html).toContain('Descargar constancia');
    expect(c.html).toContain('Estimada Ana Ruiz:');
    // El enlace va sólo en el botón: ni el aviso de «si el botón no abre» ni la dirección escrita debajo.
    expect(c.html).not.toContain('Si el botón no se abre');
    expect(c.html.split('uc?export=download&amp;id=ID1').length - 1).toBe(2); // el botón y el {{url_constancia}} de la plantilla de prueba
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

describe('el grupo de cada fila: público general o ponente', () => {
  it('sale de su «Perfil» tal como se lee en la hoja, con o sin mayúsculas y espacios', () => {
    expect(grupoDePerfil('Público general')).toBe('publico_general');
    expect(grupoDePerfil('  ponente ')).toBe('ponente');
    expect(grupoDePerfil('Ponente')).toBe('ponente');
    expect(grupoDePerfil('publico_general')).toBe('publico_general');
    expect(grupoDePerfil('')).toBeNull();
    expect(grupoDePerfil('Organizador')).toBeNull();
  });

  const f = (n: number, grupo: FilaDeConstancia['grupo'], extra: Partial<FilaDeConstancia> = {}): FilaDeConstancia => ({
    numero: String(n), nombre: `Persona ${n}`, correo: `p${n}@x.org`, conRegistro: true, grupo, texto: `https://x.org/${n}.pdf`, enlace: `https://x.org/${n}.pdf`, ...extra,
  });
  const filas = [f(1, 'publico_general'), f(2, 'ponente'), f(3, 'publico_general'), f(4, 'ponente'), f(5, 'publico_general', { conRegistro: false })];
  const nadie = new Map<string, Set<string>>();

  it('cada grupo se elige por separado, y sus cuentas son las suyas', () => {
    const publico = elegirDestinatariosDeConstancias({ filas, registros: [], yaEnviadas: nadie, grupo: 'publico_general' });
    const ponentes = elegirDestinatariosDeConstancias({ filas, registros: [], yaEnviadas: nadie, grupo: 'ponente' });
    expect(publico.destinatarios.map((d) => d.correo)).toEqual(['p1@x.org', 'p3@x.org']);
    expect(ponentes.destinatarios.map((d) => d.correo)).toEqual(['p2@x.org', 'p4@x.org']);
    expect(publico.excluidos.sinRegistro).toBe(1);
    expect(ponentes.excluidos.sinRegistro).toBe(0);
    // Sin grupo, todos, como antes.
    expect(elegirDestinatariosDeConstancias({ filas, registros: [], yaEnviadas: nadie }).destinatarios).toHaveLength(4);
  });

  it('quien sale en las filas de los dos grupos es una persona: se manda una sola vez, con la primera fila', () => {
    const dos = [f(1, 'publico_general', { correo: 'misma@x.org' }), f(2, 'ponente', { correo: 'misma@x.org' })];
    const publico = elegirDestinatariosDeConstancias({ filas: dos, registros: [], yaEnviadas: nadie, grupo: 'publico_general' });
    const ponentes = elegirDestinatariosDeConstancias({ filas: dos, registros: [], yaEnviadas: nadie, grupo: 'ponente' });
    expect(publico.destinatarios).toHaveLength(1);
    expect(ponentes.destinatarios).toHaveLength(0);
    expect(ponentes.excluidos.correoRepetido).toBe(1);
  });

  it('lo que se mandó en un grupo no se repite al mandar el otro, ni al mandar a todos', () => {
    const yaEnviadas = new Map([['p1@x.org', new Set(['https://x.org/1.pdf'])]]);
    const publico = elegirDestinatariosDeConstancias({ filas, registros: [], yaEnviadas, grupo: 'publico_general' });
    expect(publico.destinatarios.map((d) => d.correo)).toEqual(['p3@x.org']);
    expect(publico.excluidos.yaRecibieron).toBe(1);
  });

  it('los que no tienen enlace se cuentan en su grupo: la lista de quienes faltan es la del grupo', () => {
    const con = [f(1, 'publico_general', { texto: '', enlace: null }), f(2, 'ponente', { texto: '', enlace: null }), f(3, 'ponente')];
    const ponentes = elegirDestinatariosDeConstancias({ filas: con, registros: [], yaEnviadas: nadie, grupo: 'ponente' });
    expect(ponentes.faltan.map((x) => x.numero)).toEqual(['2']);
    expect(ponentes.destinatarios.map((d) => d.correo)).toEqual(['p3@x.org']);
  });
});

describe('los correos de una lista', () => {
  it('se separan por comas, punto y coma, saltos de línea o espacios, en minúsculas y sin repetir', () => {
    expect(correosDeUnTexto('Ana@X.org, eva@x.org;luis@x.org\nana@x.org  otra@x.org')).toEqual(['ana@x.org', 'eva@x.org', 'luis@x.org', 'otra@x.org']);
  });

  it('se sacan de un «Nombre <correo>» y no se les pega la puntuación', () => {
    expect(correosDeUnTexto('Ana Ruiz <ana@x.org>\n"Eva Mora" <eva@x.org>.')).toEqual(['ana@x.org', 'eva@x.org']);
  });

  it('un pedazo sin correo no se descarta en silencio: se conserva para decir que no lo es', () => {
    expect(correosDeUnTexto('ana@x.org, Eva Mora\n\n')).toEqual(['ana@x.org', 'Eva Mora']);
    expect(correosDeUnTexto('   ')).toEqual([]);
  });

  it('el máximo de la lista es el que se anuncia', () => {
    expect(MAXIMO_DE_LA_LISTA).toBe(200);
  });
});

describe('verificar una lista de personas', () => {
  const f = (n: number, extra: Partial<FilaDeConstancia> = {}): FilaDeConstancia => ({
    numero: String(n), nombre: `Persona ${n}`, correo: `p${n}@x.org`, conRegistro: true, grupo: n % 2 ? 'publico_general' : 'ponente',
    texto: `https://x.org/${n}.pdf`, enlace: `https://x.org/${n}.pdf`, ...extra,
  });
  const registros = [{ id: 'r1', correo: 'p1@x.org', idioma: 'es' }, { id: 'r2', correo: 'p2@x.org', idioma: 'pt' }];
  const nadie = new Map<string, Set<string>>();
  const filas = [
    f(1), f(2), f(3, { conRegistro: false }), f(4, { texto: '', enlace: null }), f(5, { texto: 'En proceso', enlace: null }),
    f(6, { correo: 'dos@x.org' }), f(7, { correo: 'dos@x.org', enlace: 'https://x.org/otra.pdf', texto: 'https://x.org/otra.pdf' }),
  ];
  const lista = (correos: string[], extra: { reenviar?: boolean; yaEnviadas?: Map<string, Set<string>> } = {}) =>
    elegirDeUnaLista({ correos, filas, registros, yaEnviadas: extra.yaEnviadas ?? nadie, reenviar: extra.reenviar });

  it('dice, por cada correo, si le toca y, si no, por qué', () => {
    const r = lista(['p1@x.org', 'p3@x.org', 'p4@x.org', 'p5@x.org', 'nadie@x.org', 'no es un correo']);
    expect(r.verificacion.map((v) => [v.correo, v.estado])).toEqual([
      ['p1@x.org', 'enviar'], ['p3@x.org', 'sinRegistro'], ['p4@x.org', 'sinConstancia'], ['p5@x.org', 'enlaceInvalido'],
      ['nadie@x.org', 'noEstaEnLaHoja'], ['no es un correo', 'correoInvalido'],
    ]);
    expect(r.destinatarios.map((d) => d.correo)).toEqual(['p1@x.org']);
  });

  it('a quien le toca, con SU enlace, su nombre, su fila y el idioma de su registro; y se dice de qué grupo es', () => {
    const r = lista(['p2@x.org', 'p1@x.org']);
    expect(r.destinatarios.map((d) => [d.correo, d.idioma, d.datos.enlace, d.datos.nombre, d.datos.numero, d.grupo])).toEqual([
      ['p2@x.org', 'pt', 'https://x.org/2.pdf', 'Persona 2', '2', 'ponente'],
      ['p1@x.org', 'es', 'https://x.org/1.pdf', 'Persona 1', '1', 'publico_general'],
    ]);
    expect(r.porIdioma).toEqual({ es: 1, en: 0, pt: 1 });
    expect(r.verificacion[0]).toMatchObject({ numero: '2', nombre: 'Persona 2', grupo: 'ponente' });
  });

  it('quien ya la recibió con ese enlace queda fuera; con «reenviar», se le manda otra vez y se cuenta aparte', () => {
    const ya = new Map([['p1@x.org', new Set(['https://x.org/1.pdf'])]]);
    const sin = lista(['p1@x.org', 'p2@x.org'], { yaEnviadas: ya });
    expect(sin.verificacion.map((v) => v.estado)).toEqual(['yaRecibio', 'enviar']);
    expect(sin.destinatarios.map((d) => d.correo)).toEqual(['p2@x.org']);
    const con = lista(['p1@x.org', 'p2@x.org'], { yaEnviadas: ya, reenviar: true });
    expect(con.destinatarios.map((d) => d.correo)).toEqual(['p1@x.org', 'p2@x.org']);
    expect(con.reenvios).toBe(1);
    expect(con.verificacion[0].reenvio).toBe(true);
  });

  it('si el enlace de la hoja cambió desde que se le mandó, recibe el nuevo sin pedir «reenviar»', () => {
    const ya = new Map([['p1@x.org', new Set(['https://x.org/viejo.pdf'])]]);
    const r = lista(['p1@x.org'], { yaEnviadas: ya });
    expect(r.destinatarios).toHaveLength(1);
    expect(r.enlaceNuevo).toBe(1);
    expect(r.reenvios).toBe(0);
  });

  it('un correo que sale en dos filas usa la primera con registro y enlace válido', () => {
    const r = lista(['dos@x.org']);
    expect(r.destinatarios).toHaveLength(1);
    expect(r.destinatarios[0].datos.enlace).toBe('https://x.org/6.pdf');
  });

  it('con correos pegados en cualquier orden y repetidos no se manda dos veces (la lista ya viene sin repetir)', () => {
    const r = lista(correosDeUnTexto('P1@x.org, p1@x.org\np2@x.org'));
    expect(r.destinatarios.map((d) => d.correo)).toEqual(['p1@x.org', 'p2@x.org']);
  });
});
