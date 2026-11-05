import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La pestaña «Resumen Registro»: cómo se llena con los registros que ya
 * existían, y que repetirlo no duplica ni borra nada.
 *
 * Los registros anteriores a la pestaña constan como copiados, así que ninguna
 * de las rutas de siempre se los vuelve a mandar: los recoge
 * `cuadrarPestanasEspejo`. Aquí se ejercita contra una hoja simulada con
 * memoria, para ver lo que de verdad queda escrito.
 */

type Peticion = Record<string, unknown>;

const estado: {
  /** Lo que la columna A de la lista tiene ya, fila a fila. */
  columnaA: (string | number)[];
  /** Las filas que se han añadido, en el orden en que entraron. */
  anadidas: (string | number)[][];
  /** Todas las peticiones de estructura (orden, colores, anchos). */
  peticiones: Peticion[];
  /** Los rangos que se pidieron, tal como los vería Google. */
  rangos: string[];
  /** Las reglas de color que la pestaña ya tiene. */
  reglas: unknown[];
  /** Cuántas lecturas de la estructura del libro se hicieron. */
  lecturasDelLibro: number;
  /** Si la pestaña existe en el libro simulado. */
  existe: boolean;
} = { columnaA: [], anadidas: [], peticiones: [], rangos: [], reglas: [], lecturasDelLibro: 0, existe: true };

const ENCABEZADOS = ['N.º', 'Nombre', 'País', 'Institución', 'Modalidad'];

/** Registros de la base simulada, ya con su número de orden. */
let base: Record<string, unknown>[] = [];

vi.mock('googleapis', () => ({
  google: {
    auth: { JWT: class { constructor(_: unknown) {} } },
    sheets: () => ({
      spreadsheets: {
        get: async () => {
          estado.lecturasDelLibro += 1;
          const hojas = ['REG_Respuestas', 'PAR_Participantes', 'PSE_Personificadores_Semblanzas'];
          if (estado.existe) hojas.splice(1, 0, 'Resumen Registro');
          return {
            data: {
              sheets: hojas.map((title, i) => ({
                properties: { title, sheetId: i + 1, gridProperties: { rowCount: 50 } },
                conditionalFormats: title === 'Resumen Registro' ? estado.reglas : [],
              })),
            },
          };
        },
        batchUpdate: async (p: { requestBody: { requests: Peticion[] } }) => {
          estado.peticiones.push(...p.requestBody.requests);
          return { data: { replies: [] } };
        },
        values: {
          get: async ({ range }: { range: string }) => {
            estado.rangos.push(range);
            return { data: { values: estado.columnaA.map((n) => [String(n)]) } };
          },
          append: async ({ range, requestBody }: { range: string; requestBody: { values: (string | number)[][] } }) => {
            estado.rangos.push(range);
            estado.anadidas.push(...requestBody.values);
            // Como Sheets: lo añadido queda debajo, en la columna A.
            estado.columnaA.push(...requestBody.values.map((f) => f[0]));
            return { data: {} };
          },
          batchGet: async ({ ranges }: { ranges: string[] }) => ({
            data: {
              valueRanges: ranges.map((r) => {
                const nombre = r.split('!')[0].replace(/^'(.*)'$/, '$1');
                const fila = nombre === 'Resumen Registro'
                  ? ENCABEZADOS
                  : ['__otra pestaña__'];
                return { values: [fila] };
              }),
            },
          }),
          batchUpdate: async () => ({ data: {} }),
        },
      },
    }),
    drive: () => ({ files: {} }),
  },
}));

vi.mock('@/lib/bd/conexion', () => ({
  consultar: async () => base,
}));

vi.mock('@/lib/servidor/contenido', () => ({
  leerEjes: async () => ({ filas: [] }),
  leerDatosCongreso: async () => ({ limite_semblanza_palabras: 60 }),
}));

// Las otras pestañas no son lo que se prueba aquí: se les da por buenos los
// encabezados para que `asegurarHojas` no se queje.
vi.mock('@/lib/normalizacion', async (importar) => {
  const real = await importar<typeof import('@/lib/normalizacion')>();
  return {
    ...real,
    HOJAS: {
      REG_Respuestas: ['__otra pestaña__'],
      'Resumen Registro': ENCABEZADOS,
      PAR_Participantes: ['__otra pestaña__'],
      PSE_Personificadores_Semblanzas: ['__otra pestaña__'],
    },
  };
});

function persona(numero: number, extra: Record<string, unknown> = {}) {
  return {
    numero_en_hoja: String(numero), // la base devuelve los bigint como texto
    nombres: `Persona${numero}`,
    apellidos: 'Prueba',
    pais_residencia: 'México',
    institucion: 'CIESS',
    modalidad: numero % 2 ? 'presencial' : 'en_linea',
    ...extra,
  };
}

beforeEach(async () => {
  estado.columnaA = [];
  estado.anadidas = [];
  estado.peticiones = [];
  estado.rangos = [];
  estado.reglas = [];
  estado.lecturasDelLibro = 0;
  estado.existe = true;
  base = [];
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'cuenta@ejemplo.iam.gserviceaccount.com';
  process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----\\n';
  process.env.GOOGLE_SHEETS_ID = 'hoja-de-prueba';
  const { olvidarRevisionDelLibro } = await import('@/lib/servidor/sheets');
  olvidarRevisionDelLibro();
});

/** Las peticiones de un tipo, sin importar en qué tanda fueron. */
const de = (clave: string) => estado.peticiones.filter((p) => clave in p).map((p) => p[clave] as never);

describe('poner al día la lista de registrados', () => {
  it('copia todos los registros que ya existían, numerados y en orden', async () => {
    base = [persona(1), persona(2), persona(3)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    const resultado = await cuadrarPestanasEspejo();

    expect(resultado).toEqual({ 'Resumen Registro': 3 });
    expect(estado.anadidas).toEqual([
      [1, 'Persona1 Prueba', 'México', 'CIESS', 'Presencial'],
      [2, 'Persona2 Prueba', 'México', 'CIESS', 'En línea'],
      [3, 'Persona3 Prueba', 'México', 'CIESS', 'Presencial'],
    ]);
  });

  it('el nombre de la pestaña va entre comillas en cada rango', async () => {
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    expect(estado.rangos.length).toBeGreaterThan(0);
    for (const rango of estado.rangos) expect(rango, rango).toMatch(/^'Resumen Registro'!/);
  });

  it('repetirlo no duplica nada: la segunda vez no escribe una fila', async () => {
    base = [persona(1), persona(2)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    await cuadrarPestanasEspejo();
    const tras1 = estado.anadidas.length;
    const segunda = await cuadrarPestanasEspejo();

    expect(segunda).toEqual({ 'Resumen Registro': 0 });
    expect(estado.anadidas).toHaveLength(tras1);
    expect(estado.columnaA).toEqual([1, 2]);
  });

  it('un registro nuevo entra solo en la siguiente pasada, sin repetir los anteriores', async () => {
    base = [persona(1), persona(2)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    base = [...base, persona(3)];
    const resultado = await cuadrarPestanasEspejo();

    expect(resultado['Resumen Registro']).toBe(1);
    expect(estado.columnaA).toEqual([1, 2, 3]);
  });

  it('sólo añade lo que falta: completa los huecos sin tocar lo que ya está', async () => {
    estado.columnaA = [1, 2, 4];
    base = [persona(1), persona(2), persona(3), persona(4)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    await cuadrarPestanasEspejo();

    expect(estado.anadidas.map((f) => f[0])).toEqual([3]);
  });

  it('si la lista ya tenía números mayores, la ordena por la columna A al terminar', async () => {
    // Entró un alta (la 5) antes de que se pusiera al día la pestaña.
    estado.columnaA = [5];
    base = [persona(1), persona(2), persona(5)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    await cuadrarPestanasEspejo();

    const orden = de('sortRange') as { range: { startRowIndex: number }; sortSpecs: { dimensionIndex: number; sortOrder: string }[] }[];
    expect(orden).toHaveLength(1);
    expect(orden[0].range.startRowIndex, 'los títulos de la fila 1 no se mueven').toBe(1);
    expect(orden[0].sortSpecs).toEqual([{ dimensionIndex: 0, sortOrder: 'ASCENDING' }]);
  });

  it('si ya está ordenada no la reordena, ni toca los anchos que alguien puso', async () => {
    estado.columnaA = [1, 2];
    base = [persona(1), persona(2), persona(3)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    await cuadrarPestanasEspejo();

    expect(de('sortRange')).toHaveLength(0);
    expect(de('autoResizeDimensions')).toHaveLength(0);
  });

  it('la primera vez que se llena, ajusta el ancho de sus cinco columnas', async () => {
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    const anchos = de('autoResizeDimensions') as { dimensions: { startIndex: number; endIndex: number } }[];
    expect(anchos).toHaveLength(1);
    expect(anchos[0].dimensions).toMatchObject({ startIndex: 0, endIndex: 5 });
  });

  it('nunca borra: ninguna petición quita filas ni vacía celdas', async () => {
    estado.columnaA = [1];
    base = [persona(1), persona(2)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    for (const peticion of estado.peticiones) {
      for (const prohibida of ['deleteDimension', 'deleteRange', 'updateCells', 'deleteSheet']) {
        expect(prohibida in peticion, prohibida).toBe(false);
      }
    }
  });

  it('una celda que parece fórmula se escribe como texto', async () => {
    base = [persona(1, { nombres: '=HYPERLINK("http://x")', institucion: '+52 UNAM' })];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    expect(estado.anadidas[0][1]).toMatch(/^'=/);
    expect(estado.anadidas[0][3]).toMatch(/^'\+/);
  });

  it('con más de mil registros escribe por tandas de mil', async () => {
    base = Array.from({ length: 2500 }, (_, i) => persona(i + 1));
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    const escrituras = estado.rangos.filter((r) => r.endsWith('!A1'));
    expect(escrituras).toHaveLength(3);
    expect(estado.columnaA).toHaveLength(2500);
  });
});

describe('los colores de Modalidad', () => {
  const rgb = (c: { red: number; green: number; blue: number }) =>
    '#' + [c.red, c.green, c.blue].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

  type Regla = {
    index: number;
    rule: {
      ranges: { sheetId: number; startRowIndex: number; startColumnIndex: number; endColumnIndex: number; endRowIndex?: number }[];
      booleanRule: {
        condition: { type: string; values: { userEnteredValue: string }[] };
        format: { backgroundColor: { red: number; green: number; blue: number } };
      };
    };
  };

  it('presencial se pinta verde #d9ead3 y en línea azul #c9daf8', async () => {
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    const reglas = de('addConditionalFormatRule') as Regla[];
    const porTexto = Object.fromEntries(
      reglas.map((r) => [r.rule.booleanRule.condition.values[0].userEnteredValue, rgb(r.rule.booleanRule.format.backgroundColor)]),
    );
    expect(porTexto).toEqual({ Presencial: '#d9ead3', 'En línea': '#c9daf8' });
  });

  it('sólo en la columna Modalidad, de la fila 2 hacia abajo y sin tope', async () => {
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    for (const r of de('addConditionalFormatRule') as Regla[]) {
      const [rango] = r.rule.ranges;
      expect(rango.startColumnIndex, 'columna E').toBe(4);
      expect(rango.endColumnIndex).toBe(5);
      expect(rango.startRowIndex, 'la fila 1 son los títulos').toBe(1);
      // Sin fila final: las filas que lleguen mañana ya quedan dentro.
      expect(rango.endRowIndex).toBeUndefined();
      expect(r.rule.booleanRule.condition.type).toBe('TEXT_EQ');
    }
  });

  it('es formato condicional: una fila nueva se pinta sin escribir nada más', async () => {
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    // Nada de repeatCell/updateCells fila a fila: sería una escritura más por alta.
    expect(de('repeatCell')).toHaveLength(0);
    expect(de('addConditionalFormatRule')).toHaveLength(2);
  });

  it('no repite las reglas que la pestaña ya tiene', async () => {
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();
    const puestas = de('addConditionalFormatRule') as Regla[];

    // La hoja ya las tiene: la siguiente pasada no pide ninguna.
    estado.reglas = puestas.map((r) => ({
      ranges: r.rule.ranges,
      booleanRule: r.rule.booleanRule,
    }));
    estado.peticiones = [];
    await cuadrarPestanasEspejo();

    expect(de('addConditionalFormatRule')).toHaveLength(0);
  });

  it('si falta una sola, pone sólo esa', async () => {
    estado.reglas = [{
      ranges: [{ sheetId: 2, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 }],
      booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Presencial' }] } },
    }];
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    const nuevas = de('addConditionalFormatRule') as Regla[];
    expect(nuevas.map((r) => r.rule.booleanRule.condition.values[0].userEnteredValue)).toEqual(['En línea']);
  });

  it('los pone aunque no haya ningún registro que copiar', async () => {
    base = [];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    expect(de('addConditionalFormatRule')).toHaveLength(2);
    expect(estado.anadidas).toHaveLength(0);
  });
});

describe('cuando la pestaña no existe todavía', () => {
  it('se crea detrás de REG_Respuestas, con título fijo y sus colores', async () => {
    estado.existe = false;
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    // La hoja simulada no la crea de verdad: lo que importa es lo que se pide.
    await cuadrarPestanasEspejo().catch(() => undefined);

    const creadas = de('addSheet') as { properties: { title: string; index?: number; gridProperties: { frozenRowCount: number } } }[];
    expect(creadas).toHaveLength(1);
    expect(creadas[0].properties.title).toBe('Resumen Registro');
    expect(creadas[0].properties.index, 'segunda, tras REG_Respuestas').toBe(1);
    expect(creadas[0].properties.gridProperties.frozenRowCount).toBe(1);
  });
});
