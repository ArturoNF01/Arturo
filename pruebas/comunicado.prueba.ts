import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { urlSitio } from '@/lib/config';
import {
  MAXIMO_DESTINATARIOS_DE_PRUEBA, componerCorreo, destinatariosDePrueba,
  envolverCorreo,
} from '@/lib/plantillas';

vi.mock('@/lib/bd/conexion', () => ({
  unaFila: async () => null,
  consultar: async () => [],
}));
vi.mock('@/lib/servidor/contenido', () => ({ leerEjes: async () => ({ filas: [] }) }));

const { variablesDeRegistro } = await import('@/lib/servidor/correo');

/**
 * El comunicado del comité: el correo masivo con el texto y el estilo de su PDF.
 *
 * Aquí se vigila lo que no se puede dejar al ojo: que el texto sea el que el comité
 * redactó (una errata en un correo a todos los registrados no se corrige después),
 * que ninguna variable llegue sin sustituir, que el diseño lleve sus imágenes con
 * dirección completa, y que nada lo envíe por su cuenta.
 */
const esquema = readFileSync('basedatos/esquema.sql', 'utf8');
const IDIOMAS = ['es', 'en', 'pt'] as const;

/** La plantilla sembrada en la base, tal como está en el esquema. */
function sembrada(idioma: (typeof IDIOMAS)[number]): { asunto: string; cuerpo_html: string } {
  const patron = new RegExp(`\\('comunicado', '${idioma}',\\s*'([^']*)',\\s*\\$html\\$([\\s\\S]*?)\\$html\\$\\)`);
  const m = patron.exec(esquema);
  if (!m) throw new Error(`No hay plantilla «comunicado» en ${idioma}`);
  return { asunto: m[1], cuerpo_html: m[2] };
}

/** Los párrafos de un cuerpo, sin etiquetas y con los espacios normalizados. */
function parrafos(html: string): string[] {
  return html
    .replace(/<div[^>]*display:none[\s\S]*?<\/div>/, '') // el texto oculto de la bandeja de entrada
    .split(/<\/(?:p|h1)>/)
    .map((p) => p.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

describe('el texto del comunicado', () => {
  // El texto del PDF del comité, párrafo por párrafo. Es la fuente: si se cambia, que sea a propósito.
  const DEL_PDF = [
    'Acceso a las sesiones, asistencia y constancias',
    'Estimadas y estimados participantes:',
    'Nos dará mucho gusto contar con su participación en el Primer Congreso de Estudios Interamericanos de Seguridad Social, que se realizará del 11 al 13 de noviembre de 2026 en modalidad híbrida, con actividades presenciales y en línea.',
    'El miércoles 11 de noviembre se llevarán a cabo las mesas de trabajo y la reunión general de la RIUSS. El jueves 12 y el viernes 13 tendrán lugar las mesas temáticas de ponencias. En la agenda del Congreso encontrarán los horarios, las salas y los enlaces de acceso a las sesiones virtuales. Todos los horarios corresponden a la Ciudad de México.',
    'Constancia de participación',
    'Se otorgará una constancia a quienes acrediten al menos el 80% de asistencia a las mesas temáticas del 12 y 13 de noviembre. Cuando dos mesas se realicen en el mismo horario, podrán elegir la de su interés y su asistencia contará para ese bloque.',
    'Participación presencial',
    'Les esperamos en la sede del CIESS, en calle San Ramón s/n, colonia San Jerónimo Lídice, C.P. 10200, Ciudad de México. Durante la sesión se distribuirá un código QR con el que podrán registrar su asistencia para cada sesión.',
    'Participación en línea',
    'Para conectarse, consulten la agenda del Congreso y seleccionen el enlace de la sesión a la que desean asistir. La plataforma registrará automáticamente su asistencia. Para que podamos identificarla correctamente, les pedimos ingresar con el nombre completo que utilizaron al inscribirse y conectarse desde el inicio de cada sesión. El registro de la plataforma se utilizará para verificar el cumplimiento del requisito de asistencia para la constancia.',
    'Muchas gracias por sumarse a este encuentro que hemos preparado en conjunto desde la RIUSS. Nos alegra compartir estos días de intercambio con quienes nos acompañarán en la sede y con quienes se conectarán desde distintos países.',
    'Un cordial saludo,',
    'Comité Organizador Congreso de la RIUSS | CIESS',
  ];

  it('en español es, palabra por palabra, el del PDF del comité', () => {
    const real = parrafos(sembrada('es').cuerpo_html);
    // Lo único que no está en el PDF es la línea de contacto del pie, que va aparte.
    const sinPie = real.filter((p) => !p.startsWith('Para dudas o aclaraciones'));
    expect(sinPie).toEqual(DEL_PDF);
  });

  it('lleva las mismas frases en negritas que el PDF', () => {
    const html = sembrada('es').cuerpo_html;
    for (const frase of [
      'Primer Congreso de Estudios Interamericanos de Seguridad Social',
      '11 al 13 de noviembre de 2026', 'modalidad híbrida', 'miércoles 11 de noviembre',
      'jueves 12 y el viernes 13', 'los horarios, las salas y los enlaces de acceso a las sesiones virtuales',
      'Ciudad de México', '80% de asistencia a las mesas temáticas del 12 y 13 de noviembre',
      'calle San Ramón s/n, colonia San Jerónimo Lídice, C.P. 10200, Ciudad de México',
      'código QR con el que podrán registrar su asistencia para cada sesión.', 'enlace de la sesión',
      'nombre completo que utilizaron al inscribirse',
    ]) {
      expect(html, frase).toContain(`<strong>${frase}</strong>`);
    }
  });

  it('lleva los colores del PDF: título, subtítulos y firma en azul marino; saludo y firma en dorado', () => {
    for (const idioma of IDIOMAS) {
      const html = sembrada(idioma).cuerpo_html;
      // Título (h1) y los tres subtítulos, en azul marino.
      expect(html.match(/<h1 style="[^"]*color:#002269;/g), `título ${idioma}`).toHaveLength(1);
      expect(html.match(/font-size:18px;[^"]*font-weight:bold;color:#002269;/g), `subtítulos ${idioma}`).toHaveLength(3);
      // El saludo en dorado y la firma en azul y dorado.
      expect(html, `saludo ${idioma}`).toMatch(/<p style="[^"]*font-weight:bold;color:#a08536;">/);
      expect(html.match(/<span style="color:#002269;">/g), `firma ${idioma}`).toHaveLength(1);
      expect(html.match(/<span style="color:#a08536;">/g), `firma dorada ${idioma}`).toHaveLength(1);
      // Ya no queda el negro del primer diseño en el título.
      expect(html, idioma).not.toContain('color:#111111;">' + sembrada(idioma).cuerpo_html.match(/<h1[^>]*>([^<]*)/)![1]);
    }
  });

  it('existe en los tres idiomas, con asunto, y dice lo mismo: 80 %, la dirección y la agenda', () => {
    for (const idioma of IDIOMAS) {
      const { asunto, cuerpo_html } = sembrada(idioma);
      expect(asunto.length, idioma).toBeGreaterThan(20);
      expect(cuerpo_html, idioma).toMatch(/80%/);
      expect(cuerpo_html, idioma).toContain('San Ramón s/n');
      expect(cuerpo_html, idioma).toContain('C.P. 10200');
      // La agenda del sitio, que es donde están los enlaces de las sesiones, dos veces.
      expect(cuerpo_html.match(/href="\{\{url_sitio\}\}\/#agenda"/g), idioma).toHaveLength(2);
      expect(cuerpo_html, idioma).not.toMatch(/todas las sesiones|all the sessions|todas as sessões/i);
    }
  });

  it('se siembra sin pisar lo que el comité edite en el panel', () => {
    const bloque = esquema.slice(esquema.indexOf("('comunicado', 'es'"));
    expect(bloque).toMatch(/on conflict \(clave, idioma\) do nothing;/);
  });

  it('cada variable de la plantilla existe: ninguna llega al correo con llaves', () => {
    for (const idioma of IDIOMAS) {
      const variables = variablesDeRegistro({
        clave: 'comunicado',
        registro: { id: 'x', token_edicion: 'x', folio: 'REG-1', nombres: 'Ana', apellidos: 'Ruiz', correo: 'a@b.org', idioma, perfil: 'ponente', modalidad: 'presencial' },
        correoContacto: 'congreso@ciess.org',
        fechaLimite: '',
        urlAgenda: 'https://ejemplo.org/agenda',
        programaPublicado: true,
      });
      const { asunto, cuerpo_html } = sembrada(idioma);
      const correo = componerCorreo({ asunto, cuerpo_html }, variables, {
        titulo: 'Congreso', urlBase: 'https://congreso.example.org', idioma,
      });
      expect(correo.asunto, idioma).not.toMatch(/\{\{/);
      expect(correo.html, idioma).not.toMatch(/\{\{/);
      // `{{url_sitio}}` es la dirección del sitio; el enlace lleva a su agenda.
      expect(correo.html, idioma).toContain(`href="${urlSitio()}/#agenda"`);
      expect(correo.html, idioma).toContain('congreso@ciess.org');
    }
  });
});

describe('el diseño común de los correos (el del comunicado)', () => {
  const URL = 'https://congreso.example.org';

  it('lleva el banner y el adorno del PDF como imágenes con dirección completa', () => {
    const html = envolverCorreo('<p>Hola</p>', { titulo: '1er Congreso', urlBase: `${URL}/` });
    expect(html).toContain(`src="${URL}/correo/comunicado-cabecera.png"`);
    expect(html).toContain(`src="${URL}/correo/comunicado-pie.png"`);
    // El banner dice de qué es el correo aunque el cliente bloquee las imágenes.
    expect(html).toMatch(/<img[^>]*alt="1er Congreso"/);
    // Y el cuerpo va entre los dos.
    expect(html.indexOf('comunicado-cabecera')).toBeLessThan(html.indexOf('<p>Hola</p>'));
    expect(html.indexOf('<p>Hola</p>')).toBeLessThan(html.indexOf('comunicado-pie'));
  });

  it('lleva también los logos de la RIUSS y del CIESS, a la derecha del banner', () => {
    const html = envolverCorreo('<p>x</p>', { titulo: 'T', urlBase: URL });
    expect(html).toContain(`src="${URL}/correo/comunicado-logos.png"`);
    expect(html).toMatch(/<img[^>]*alt="RIUSS · CIESS"/);
    expect(html.indexOf('comunicado-cabecera')).toBeLessThan(html.indexOf('comunicado-logos'));
  });

  it('justifica el cuerpo, como el PDF, y en el celular lo alinea a la izquierda', () => {
    const html = envolverCorreo('<p>x</p>', { titulo: 'T', urlBase: URL });
    expect(html).toMatch(/class="m-cuerpo"[^>]*text-align:justify/);
    expect(html).toMatch(/@media only screen and \(max-width:480px\)[\s\S]*\.m-cuerpo\{[^}]*text-align:left!important/);
  });

  it('en el celular apila banner y logos, para que se lea el nombre del Congreso', () => {
    const html = envolverCorreo('<p>x</p>', { titulo: 'T', urlBase: URL });
    expect(html).toMatch(/\.m-bloque\{display:block!important;width:100%!important;\}/);
    expect(html.match(/class="m-bloque/g)).toHaveLength(2);
  });

  it('está hecho como un correo: tablas y estilos en línea; la única hoja de estilos es el ajuste al celular', () => {
    const html = envolverCorreo('<p>x</p>', { titulo: 'T', urlBase: URL });
    expect(html).toMatch(/<table role="presentation"/);
    expect(html).not.toMatch(/<script|<link /i);
    // Una sola hoja, y entera dentro de una consulta de pantalla: nada que se aplique en general.
    const hojas = html.match(/<style>[\s\S]*?<\/style>/g) ?? [];
    expect(hojas).toHaveLength(1);
    expect((hojas[0] ?? '').replace(/<\/?style>/g, '').trim()).toMatch(/^@media only screen and \(max-width:480px\)\{[\s\S]*\}$/);
    expect(html).toMatch(/Work Sans/);
    expect(html).toMatch(/Arial/); // respaldo: casi ningún cliente descarga fuentes
  });

  it('se adapta al móvil: ancho de hasta 620 px y las imágenes se encogen', () => {
    const html = envolverCorreo('<p>x</p>', { titulo: 'T', urlBase: URL });
    expect(html).toContain('max-width:620px');
    expect(html).toMatch(/viewport/);
    expect(html.match(/height:auto/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('las tres imágenes existen en el sitio, son PNG y pesan poco', () => {
    for (const nombre of ['comunicado-cabecera.png', 'comunicado-logos.png', 'comunicado-pie.png']) {
      const ruta = join('public', 'correo', nombre);
      expect(existsSync(ruta), nombre).toBe(true);
      const bytes = readFileSync(ruta);
      expect(bytes.subarray(1, 4).toString(), nombre).toBe('PNG');
      expect(statSync(ruta).size, nombre).toBeLessThan(150_000);
    }
  });
});

describe('el asunto de la prueba', () => {
  it('es el mismo que el del envío real: la prueba no le antepone «[prueba]» ni nada', () => {
    const fuente = readFileSync('src/app/api/plantillas/route.ts', 'utf8');
    expect(fuente).not.toMatch(/\[prueba\]/i);
    // El asunto sale de `componerCorreo`, igual que en el envío masivo y en el de cada registro.
    expect(fuente).toMatch(/subject:\s*correo\.asunto/);
  });
});

describe('las pruebas de envío', () => {
  it('aceptan varias direcciones separadas por coma, espacio o salto de línea, sin repetir', () => {
    const r = destinatariosDePrueba('Ana@Ejemplo.org, luis@ejemplo.org;\n  ana@ejemplo.org  maria@ejemplo.org');
    expect(r.validos).toEqual(['ana@ejemplo.org', 'luis@ejemplo.org', 'maria@ejemplo.org']);
    expect(r.invalidos).toEqual([]);
    expect(r.excede).toBe(false);
  });

  it('señalan las que no son direcciones, para que no se pierdan en silencio', () => {
    const r = destinatariosDePrueba('ana@ejemplo.org, sin-arroba, otra@, <x@y.org>');
    expect(r.validos).toEqual(['ana@ejemplo.org']);
    expect(r.invalidos).toEqual(['sin-arroba', 'otra@', '<x@y.org>']);
  });

  it('tienen tope: una prueba no se convierte en un envío masivo', () => {
    const muchas = Array.from({ length: MAXIMO_DESTINATARIOS_DE_PRUEBA + 1 }, (_, i) => `p${i}@ejemplo.org`).join(',');
    expect(destinatariosDePrueba(muchas).excede).toBe(true);
    expect(destinatariosDePrueba(muchas.split(',').slice(0, MAXIMO_DESTINATARIOS_DE_PRUEBA).join(',')).excede).toBe(false);
  });
});

describe('nada lo envía por su cuenta', () => {
  /** Todos los archivos de código de un directorio. */
  function archivos(dir: string): string[] {
    return readdirSync(dir).flatMap((nombre) => {
      const ruta = join(dir, nombre);
      return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(ts|tsx|sh)$/.test(nombre) ? [ruta] : [];
    });
  }
  const menciona = (ruta: string) => /['"`]comunicado['"`]|comunicados/.test(readFileSync(ruta, 'utf8'));

  it('ningún flujo automático lo toca: ni el alta, ni los recordatorios, ni el cron, ni la hoja', () => {
    // El comunicado sale sólo de un envío que alguien confirma en el panel. Estos son los caminos que
    // corren solos o por otra razón; si alguno lo mencionara, habría un envío sin que nadie lo pida.
    const automaticos = [
      ...archivos('src/app/api/registros'),
      ...archivos('src/app/api/recordatorios'),
      ...archivos('src/app/api/sincronizar'),
      ...archivos('src/app/api/acuses'),
      ...archivos('guiones'),
      'src/lib/recordatorios.ts',
    ];
    const infractores = automaticos.filter(menciona).map((r) => r.replaceAll('\\', '/'));
    expect(infractores).toEqual([]);
  });

  it("sólo el código de envíos y la plantilla nombran 'comunicado' como clave", () => {
    const usos = archivos('src')
      .filter((ruta) => /['"`]comunicado['"`]/.test(readFileSync(ruta, 'utf8')))
      .map((ruta) => ruta.replaceAll('\\', '/'))
      .sort();
    expect(usos).toEqual([
      'src/app/api/comunicados/audiencia/route.ts', // la clave por omisión del envío
      'src/app/api/comunicados/route.ts',
      'src/lib/comunicados.ts', // la lista de plantillas que se pueden mandar en masa
      'src/lib/servidor/correo.ts', // el tipo de plantilla
    ]);
  });
});
