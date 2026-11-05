import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { diccionarios } from '@/i18n';
import { FAQS } from '@/i18n/faqs';
import { partirNegritas } from '@/lib/negritas';

vi.mock('@/lib/bd/conexion', () => ({
  unaFila: async () => null,
  consultar: async () => [],
}));
vi.mock('@/lib/servidor/contenido', () => ({ leerEjes: async () => ({ filas: [] }) }));

const { variablesDeRegistro } = await import('@/lib/servidor/correo');

/**
 * La constancia exige registrarse y un porcentaje de asistencia mínimo del 80 %, en persona o
 * en línea. Es lo que más gente se
 * pierde —el enlace de Zoom y el de Meet están a la vista y cualquiera puede entrar sin
 * registrarse—, así que el requisito tiene que decirse igual en todos los sitios donde se
 * decide o se recuerda: la agenda, el registro, la confirmación, el correo y las preguntas
 * frecuentes. Estas pruebas no vigilan la redacción, vigilan que el requisito siga ahí.
 */
const REQUISITO = {
  es: { registro: /registr/i, asistencia: /asistencia mínimo del 80\s?%/i, viejo: /todas las sesiones/i },
  en: { registro: /register/i, asistencia: /minimum attendance of 80\s?%/i, viejo: /all the (Congress )?sessions/i },
  pt: { registro: /inscrev|inscrit/i, asistencia: /frequência mínima de 80\s?%/i, viejo: /todas as sessões/i },
} as const;
const IDIOMAS = ['es', 'en', 'pt'] as const;

describe('el aviso de la constancia', () => {
  it('existe en los tres idiomas y dice que hay que registrarse y tener un 80 % de asistencia', () => {
    for (const idioma of IDIOMAS) {
      const c = diccionarios[idioma].constancia;
      for (const clave of ['titulo', 'texto', 'recordatorio', 'ir'] as const) {
        expect(c[clave].trim().length, `${idioma}.${clave}`).toBeGreaterThan(3);
      }
      for (const texto of [c.texto, c.recordatorio]) {
        expect(texto, idioma).toMatch(REQUISITO[idioma].registro);
        expect(texto, idioma).toMatch(REQUISITO[idioma].asistencia);
        // Ya no se pide asistir a todas las sesiones: que no quede el requisito viejo.
        expect(texto, idioma).not.toMatch(REQUISITO[idioma].viejo);
      }
    }
  });

  it('el recordatorio de quien ya se registró dice exactamente lo acordado', () => {
    expect(diccionarios.es.constancia.recordatorio).toBe(
      'Para recibir su constancia de participación es requisito estar registrado y tener un porcentaje de asistencia mínimo del 80%, en persona o en línea.',
    );
  });

  it('no amenaza al público: ya no dice que entrar a Zoom o a Meet sin registro no da constancia', () => {
    // Se quitó para no ser tan tajantes. El requisito es el mismo —registrarse y el 80 %—; lo
    // que no está es la frase que lo decía en negativo.
    for (const idioma of IDIOMAS) {
      const { texto, recordatorio } = diccionarios[idioma].constancia;
      for (const t of [texto, recordatorio]) {
        expect(t, idioma).not.toMatch(/Zoom|Meet/);
        expect(t, idioma).not.toMatch(/no da derecho|does not entitle|não dá direito/i);
      }
      const faq = FAQS[idioma].find((f) => f.id === 'constancia')!;
      expect(faq.respuesta, `faq ${idioma}`).not.toMatch(/Zoom|Meet/);
    }
  });

  it('la pregunta frecuente de la constancia (respaldo en código) lo dice en los tres idiomas', () => {
    for (const idioma of IDIOMAS) {
      const faq = FAQS[idioma].find((f) => f.id === 'constancia')!;
      expect(faq.respuesta, idioma).toMatch(REQUISITO[idioma].registro);
      expect(faq.respuesta, idioma).toMatch(REQUISITO[idioma].asistencia);
      expect(faq.respuesta, idioma).not.toMatch(REQUISITO[idioma].viejo);
    }
  });
});

describe('«registrarse» en negritas', () => {
  const VERBO = { es: 'registrarse', en: 'register', pt: 'inscrever-se' } as const;

  it('el aviso marca en negritas sólo el verbo de registrarse, en los tres idiomas', () => {
    for (const idioma of IDIOMAS) {
      const tramos = partirNegritas(diccionarios[idioma].constancia.texto);
      const negritas = tramos.filter((t) => t.negrita);
      expect(negritas.map((t) => t.texto), idioma).toEqual([VERBO[idioma]]);
      // Y lo demás sigue ahí, sin asteriscos sueltos.
      expect(tramos.map((t) => t.texto).join(''), idioma).not.toContain('*');
      expect(tramos.map((t) => t.texto).join(''), idioma).toMatch(REQUISITO[idioma].asistencia);
    }
  });

  it('el texto que va tal cual al correo y a la pantalla de confirmación no lleva marcas', () => {
    // El bloque del correo mete `recordatorio` en HTML sin pasarlo por partirNegritas: un
    // asterisco ahí se vería literal en la bandeja de entrada.
    for (const idioma of IDIOMAS) {
      const c = diccionarios[idioma].constancia;
      for (const clave of ['titulo', 'recordatorio', 'ir'] as const) {
        expect(c[clave], `${idioma}.${clave}`).not.toContain('**');
      }
    }
  });

  it('partirNegritas reparte el texto en tramos y no pierde nada', () => {
    expect(partirNegritas('a **b** c')).toEqual([
      { texto: 'a ', negrita: false }, { texto: 'b', negrita: true }, { texto: ' c', negrita: false },
    ]);
    expect(partirNegritas('sin marcas')).toEqual([{ texto: 'sin marcas', negrita: false }]);
    expect(partirNegritas('**todo**')).toEqual([{ texto: 'todo', negrita: true }]);
    expect(partirNegritas('')).toEqual([]);
  });
});

describe('el acuse por correo', () => {
  const variables = (idioma: string, programaPublicado: boolean) =>
    variablesDeRegistro({
      clave: 'confirmacion_registro',
      registro: { folio: 'REG-1', nombres: 'Ana', apellidos: 'Ruiz', correo: 'a@b.org', idioma, perfil: 'publico_general', modalidad: 'en_linea' },
      correoContacto: 'congreso@ciess.org',
      fechaLimite: '',
      urlAgenda: 'https://ejemplo.org/agenda',
      programaPublicado,
    });

  it('lleva el recordatorio de la constancia en el idioma del registro, con la agenda publicada o no', () => {
    for (const idioma of IDIOMAS) {
      for (const publicada of [true, false]) {
        const bloque = variables(idioma, publicada).constancia_bloque;
        expect(bloque, `${idioma} ${publicada}`).toContain(diccionarios[idioma].constancia.recordatorio);
        expect(bloque).toContain(diccionarios[idioma].constancia.titulo);
      }
    }
  });
});

describe('lo que se siembra y se migra', () => {
  const esquema = readFileSync('basedatos/esquema.sql', 'utf8');
  const migracion = readFileSync('basedatos/actualizar-convocatoria.sql', 'utf8');

  it('las plantillas de confirmación y de registro confirmado llevan el bloque, delante de la agenda', () => {
    const ocurrencias = esquema.match(/\{\{constancia_bloque\}\}\n\{\{agenda_bloque\}\}/g) ?? [];
    expect(ocurrencias).toHaveLength(6); // dos plantillas × tres idiomas
  });

  it('la migración añade el bloque una sola vez, con marca, para respetar lo que el panel quite', () => {
    expect(migracion).toContain("'migracion_constancia_bloque'");
    expect(migracion).toMatch(/if not exists \(select 1 from configuracion where clave = 'migracion_constancia_bloque'\)/);
  });

  it('ninguna migración vuelve a escribir la frase de Zoom o Meet en la pregunta frecuente', () => {
    // La única mención que queda es la del replace que la quita.
    const sinComentarios = migracion.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
    const escrituras = sinComentarios.match(/'es', 'Sí\. Para recibir la constancia[^']*'/g) ?? [];
    expect(escrituras.length).toBeGreaterThanOrEqual(2);
    for (const e of escrituras) expect(e).not.toMatch(/Zoom|Meet/);
  });

  it('la que quita la frase lo hace con un replace exacto y sólo donde está', () => {
    const quita = migracion.match(/update faqs[\s\S]*?replace\(respuesta->>'es'[\s\S]*?;\n/)?.[0] ?? '';
    expect(quita).toMatch(/replace\(respuesta->>'es', '; entrar a Zoom o a Meet sin haberse registrado no da derecho a constancia\.', '\.'\)/);
    expect(quita).toMatch(/where clave = 'constancia'/);
    expect(quita).toMatch(/like '%; entrar a Zoom o a Meet/);
  });

  it('la pregunta frecuente de la constancia se actualiza sin pisar lo que el comité reescribió', () => {
    // Dos migraciones —la del texto original y la de la versión anterior— que escriben el
    // requisito vigente y sólo actúan si la fila conserva su texto de antes.
    const todas = migracion.match(/update faqs[\s\S]*?where clave = 'constancia'[\s\S]*?;/g) ?? [];
    // (Hay otra, más antigua, que siembra la pregunta sin el requisito; no es de éstas.)
    const actualizaciones = todas.filter((u) => /80%/.test(u) && !/replace\(/.test(u));
    expect(actualizaciones).toHaveLength(2);
    for (const u of actualizaciones) {
      expect(u).toMatch(/80%/);
      expect(u).not.toMatch(/respuesta = jsonb_build_object\([\s\S]*a todas las sesiones del Congreso;/);
      expect(u).toMatch(/and respuesta->>'es' (not )?like/);
    }
  });

  it('ninguna migración borra, vacía ni elimina la tabla de registros', () => {
    // La garantía que más importa: desplegar nunca puede costar un registro. Los guiones que
    // sí borran (limpiar-registros.sh) son manuales y no están en estos archivos.
    for (const [nombre, sql] of [['esquema.sql', esquema], ['actualizar-convocatoria.sql', migracion]]) {
      const sinComentarios = sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
      expect(sinComentarios, nombre).not.toMatch(/delete\s+from\s+registros/i);
      expect(sinComentarios, nombre).not.toMatch(/truncate\s+(table\s+)?registros/i);
      expect(sinComentarios, nombre).not.toMatch(/drop\s+table\s+(if\s+exists\s+)?registros/i);
    }
  });
});
