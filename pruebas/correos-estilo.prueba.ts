import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { componerCorreo, estilizarCuerpo, tituloDeAsunto } from '@/lib/plantillas';

vi.mock('@/lib/bd/conexion', () => ({
  unaFila: async () => null,
  consultar: async () => [],
}));
vi.mock('@/lib/servidor/contenido', () => ({ leerEjes: async () => ({ filas: [] }) }));

const { variablesDeRegistro } = await import('@/lib/servidor/correo');

/**
 * Todos los correos del Congreso llevan el diseño del comunicado: la cabecera con los logos,
 * el título en azul marino, el saludo y la firma en dorado y el adorno de pie. Los textos viven en
 * la base y se reescriben desde el panel, así que el estilo se pone al componer el correo y no
 * depende de que el texto lo traiga: estas pruebas lo vigilan sobre los textos sembrados.
 */
const esquema = readFileSync('basedatos/esquema.sql', 'utf8');

/** Todas las plantillas sembradas: [clave, idioma, asunto, cuerpo]. */
const SEMBRADAS = [
  ...esquema.matchAll(/\('([a-z_]+)', '(es|en|pt)',\s*'([^']*)',\s*\$html\$([\s\S]*?)\$html\$\)/g),
].map(([, clave, idioma, asunto, cuerpo]) => ({ clave, idioma, asunto, cuerpo_html: cuerpo }));

const URL = 'https://congreso.example.org';

function componer(p: (typeof SEMBRADAS)[number]) {
  const variables = variablesDeRegistro({
    clave: p.clave as never,
    registro: {
      id: 'x', token_edicion: 'x', folio: 'REG-1', nombres: 'Ana', apellidos: 'Ruiz', correo: 'a@b.org',
      idioma: p.idioma, perfil: 'ponente', modalidad: 'presencial',
    },
    correoContacto: 'congreso@ciess.org',
    fechaLimite: '',
    urlAgenda: 'https://ejemplo.org/agenda',
    programaPublicado: true,
  });
  return componerCorreo(p, variables, { titulo: 'Congreso', urlBase: URL, idioma: p.idioma });
}

describe('el diseño en todas las plantillas sembradas', () => {
  it('hay las diez plantillas en los tres idiomas', () => {
    expect(SEMBRADAS).toHaveLength(30);
    expect(new Set(SEMBRADAS.map((p) => p.clave)).size).toBe(10);
  });

  it('todas salen con la cabecera con logos, el pie y el título azul marino', () => {
    for (const p of SEMBRADAS) {
      const { html } = componer(p);
      const quien = `${p.clave}/${p.idioma}`;
      expect(html, quien).toContain(`${URL}/correo/comunicado-cabecera.png`);
      expect(html, quien).toContain(`${URL}/correo/comunicado-logos.png`);
      expect(html, quien).toContain(`${URL}/correo/comunicado-pie.png`);
      expect(html.match(/<h1[\s>]/g), quien).toHaveLength(1);
      expect(html, quien).toMatch(/<h1 style="[^"]*color:#002269/);
      // Ya no queda nada de la envoltura sobria de antes.
      expect(html, quien).not.toContain('#2e5c8a');
      expect(html, quien).not.toContain('Centro Interamericano de Estudios de Seguridad Social');
      expect(html, quien).not.toMatch(/\{\{/);
    }
  });

  it('el título es lo primero del asunto, y cambia con él', () => {
    expect(tituloDeAsunto('Registro recibido · 1er Congreso de Estudios Interamericanos')).toBe('Registro recibido');
    expect(tituloDeAsunto('Sin separador')).toBe('Sin separador');
    const p = SEMBRADAS.find((x) => x.clave === 'recordatorio' && x.idioma === 'es')!;
    expect(componer(p).html).toMatch(/<h1[^>]*>Faltan \{\{dias_faltantes\}\} días<\/h1>|<h1[^>]*>Faltan [^<]* días<\/h1>/);
  });

  it('el saludo va en dorado y negritas, y la firma en azul marino y dorado, en los tres idiomas', () => {
    for (const p of SEMBRADAS.filter((x) => x.clave !== 'comunicado')) {
      const { html } = componer(p);
      const quien = `${p.clave}/${p.idioma}`;
      expect(html, quien).toMatch(/<p style="margin:0 0 18px;font-weight:bold;color:#a08536;">(Estimada persona participante:|Dear participant,|Prezada pessoa participante,)<\/p>/);
      expect(html, quien).toMatch(/<p style="margin:0 0 24px;font-weight:bold;"><span style="color:#002269;">(Comité|Organizing|Review|Comitê)/);
    }
  });

  it('los enlaces del cuerpo salen con el color del PDF', () => {
    const p = SEMBRADAS.find((x) => x.clave === 'confirmacion_registro' && x.idioma === 'es')!;
    const { html } = componer(p);
    expect(html).toMatch(/<a style="color:#467886;[^"]*" href="[^"]*\/confirmacion\//);
  });

  it('el comunicado no cambia: ya viene vestido y no gana un segundo título', () => {
    const p = SEMBRADAS.find((x) => x.clave === 'comunicado' && x.idioma === 'es')!;
    expect(estilizarCuerpo(p.cuerpo_html, { titulo: 'Otro título' })).toBe(p.cuerpo_html);
  });
});

describe('estilizarCuerpo', () => {
  it('no cambia ni una palabra: sólo añade estilo y el título', () => {
    const texto = (h: string) => h.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const cuerpo = '<p>Estimada persona:</p><p>Un <strong>texto</strong> con <a href="https://a.b">enlace</a>.</p><ul><li>Uno</li></ul><p>Comité organizador<br/>CIESS · RIUSS</p>';
    expect(texto(estilizarCuerpo(cuerpo))).toBe(texto(cuerpo));
    expect(texto(estilizarCuerpo(cuerpo, { titulo: 'Título' }))).toBe(`Título ${texto(cuerpo)}`);
  });

  it('es idempotente: aplicarlo dos veces da lo mismo que una', () => {
    for (const p of SEMBRADAS) {
      const una = estilizarCuerpo(p.cuerpo_html, { titulo: tituloDeAsunto(p.asunto) });
      expect(estilizarCuerpo(una, { titulo: tituloDeAsunto(p.asunto) }), `${p.clave}/${p.idioma}`).toBe(una);
    }
  });

  it('respeta lo que ya trae estilo: los bloques del sistema y los enlaces con el suyo', () => {
    const bloque = '<div style="margin:20px 0;"><p style="margin:0;">Hola</p><a href="x" style="color:#fff;">Ir</a></div>';
    expect(estilizarCuerpo(bloque)).toBe(bloque);
  });

  it('si el comité reescribe el texto y ya no hay saludo ni firma, queda como párrafos normales', () => {
    const salida = estilizarCuerpo('<p>Aviso importante para todas las personas registradas en el Congreso, que se realizará pronto y que no lleva dos puntos al final</p><p>Gracias.</p>');
    expect(salida).not.toContain('#a08536');
    expect(salida).not.toContain('#002269');
    expect(salida.match(/<p style="margin:0 0 16px;">/g)).toHaveLength(2);
  });

  it('el párrafo con un enlace va alineado a la izquierda: un enlace largo no abre huecos al justificar', () => {
    const salida = estilizarCuerpo('<p>Con <a href="https://a.b/x">enlace</a></p><p>Sin enlace</p>');
    expect(salida).toContain('<p style="margin:0 0 16px;text-align:left;">Con ');
    expect(salida).toContain('<p style="margin:0 0 16px;">Sin enlace</p>');
  });

  it('sin título no añade encabezado', () => {
    expect(estilizarCuerpo('<p>Hola:</p>')).not.toContain('<h1');
  });
});

describe('una sola envoltura', () => {
  const archivos = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? archivos(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : [],
    );

  it('ningún código de la aplicación vuelve a armar otra envoltura de correo', () => {
    for (const f of archivos('src')) {
      const fuente = readFileSync(f, 'utf8');
      expect(fuente, f).not.toMatch(/envolverHtml|envolverSegunClave|envolverComunicado/);
    }
  });

  it('los correos sueltos (enlace de acceso al panel) pasan por la misma envoltura', () => {
    const fuente = readFileSync('src/lib/servidor/correo.ts', 'utf8');
    const simple = fuente.slice(fuente.indexOf('export async function enviarCorreoSimple'));
    expect(simple).toContain('envolverCorreo(');
    expect(simple).toContain('estilizarCuerpo(');
  });
});
