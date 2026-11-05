import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La pestaña «Resumen Registro»: cómo se llena con los registros que ya
 * existían, que repetirlo no duplica ni borra nada, y qué pasa cuando sus
 * columnas cambian.
 *
 * Los registros anteriores a la pestaña constan como copiados, así que ninguna
 * de las rutas de siempre se los vuelve a mandar: los recoge
 * `cuadrarPestanasEspejo`. Aquí se ejercita contra una hoja simulada con
 * memoria, para ver lo que de verdad queda escrito.
 */

type Peticion = Record<string, unknown>;
type Regla = {
  ranges: { sheetId: number; startRowIndex?: number; startColumnIndex: number; endColumnIndex: number; endRowIndex?: number }[];
  booleanRule: {
    condition: { type: string; values: { userEnteredValue: string }[] };
    format?: { backgroundColor: { red: number; green: number; blue: number } };
  };
};

const ENCABEZADOS = ['N.º', 'Nombre', 'Perfil', 'País', 'Institución', 'Modalidad'];
const ANTERIORES = ['N.º', 'Nombre', 'País', 'Institución', 'Modalidad'];
const ID_LISTA = 2; // el sheetId de «Resumen Registro» en el libro simulado

const estado: {
  /** Los títulos que la lista tiene en la fila 1. */
  encabezado: string[];
  /** Las filas de datos de la lista, tal como están en la hoja. */
  filas: (string | number)[][];
  /** Todas las peticiones de estructura, en el orden en que llegaron. */
  peticiones: Peticion[];
  /** Los rangos que se pidieron, tal como los vería Google. */
  rangos: string[];
  /** Las reglas de color que la lista tiene ahora. */
  reglas: Regla[];
  /** Los títulos que se escribieron, por pestaña. */
  titulosEscritos: Record<string, string[]>;
  /** Los títulos de REG_Respuestas en el libro simulado. */
  encabezadoReg: string[];
  /** Si la pestaña existe en el libro simulado. */
  existe: boolean;
} = {
  encabezado: ENCABEZADOS, filas: [], peticiones: [], rangos: [], reglas: [],
  titulosEscritos: {}, encabezadoReg: ['__otra pestaña__'], existe: true,
};

/** Registros de la base simulada, ya con su número de orden. */
let base: Record<string, unknown>[] = [];

const nombreDe = (rango: string) => rango.split('!')[0].replace(/^'(.*)'$/, '$1');

vi.mock('googleapis', () => ({
  google: {
    auth: { JWT: class { constructor(_: unknown) {} } },
    sheets: () => ({
      spreadsheets: {
        get: async () => {
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
          for (const peticion of p.requestBody.requests) {
            estado.peticiones.push(peticion);
            // La hoja simulada hace lo que Google haría con cada una.
            const borrar = peticion.deleteDimension as { range: { sheetId: number } } | undefined;
            if (borrar?.range.sheetId === ID_LISTA) estado.filas = [];
            if (peticion.deleteConditionalFormatRule) estado.reglas.shift();
            const nueva = peticion.addConditionalFormatRule as { rule: Regla } | undefined;
            if (nueva) estado.reglas.unshift(nueva.rule);
            const vaciar = peticion.updateCells as { range: { sheetId: number } } | undefined;
            if (vaciar?.range.sheetId === ID_LISTA) estado.encabezado = [];
          }
          return { data: { replies: [] } };
        },
        values: {
          get: async ({ range }: { range: string }) => {
            estado.rangos.push(range);
            return { data: { values: estado.filas.map((f) => [String(f[0])]) } };
          },
          append: async ({ range, requestBody }: { range: string; requestBody: { values: (string | number)[][] } }) => {
            estado.rangos.push(range);
            estado.filas.push(...requestBody.values);
            return { data: {} };
          },
          batchGet: async ({ ranges }: { ranges: string[] }) => ({
            data: {
              valueRanges: ranges.map((r) => {
                const nombre = nombreDe(r);
                const fila = nombre === 'Resumen Registro'
                  ? estado.encabezado
                  : nombre === 'REG_Respuestas' ? estado.encabezadoReg : ['__otra pestaña__'];
                return { values: fila.length ? [fila] : [] };
              }),
            },
          }),
          batchUpdate: async ({ requestBody }: { requestBody: { data: { range: string; values: string[][] }[] } }) => {
            for (const { range, values } of requestBody.data) {
              const nombre = nombreDe(range);
              estado.titulosEscritos[nombre] = values[0];
              if (nombre === 'Resumen Registro') estado.encabezado = values[0];
            }
            return { data: {} };
          },
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
    perfil: numero % 3 ? 'ponente' : 'conferencista',
    pais_residencia: 'México',
    institucion: 'CIESS',
    modalidad: numero % 2 ? 'presencial' : 'en_linea',
    ...extra,
  };
}

beforeEach(async () => {
  estado.encabezado = ENCABEZADOS;
  estado.filas = [];
  estado.peticiones = [];
  estado.rangos = [];
  estado.reglas = [];
  estado.titulosEscritos = {};
  estado.encabezadoReg = ['__otra pestaña__'];
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
const numeros = () => estado.filas.map((f) => f[0]);

describe('poner al día la lista de registrados', () => {
  it('copia todos los registros que ya existían, numerados y en orden', async () => {
    base = [persona(1), persona(2), persona(3)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    const resultado = await cuadrarPestanasEspejo();

    expect(resultado).toEqual({ 'Resumen Registro': 3 });
    expect(estado.filas).toEqual([
      [1, 'Persona1 Prueba', 'Ponente', 'México', 'CIESS', 'Presencial'],
      [2, 'Persona2 Prueba', 'Ponente', 'México', 'CIESS', 'En línea'],
      [3, 'Persona3 Prueba', 'Conferencista', 'México', 'CIESS', 'Presencial'],
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
    const segunda = await cuadrarPestanasEspejo();

    expect(segunda).toEqual({ 'Resumen Registro': 0 });
    expect(numeros()).toEqual([1, 2]);
  });

  it('un registro nuevo entra solo en la siguiente pasada, sin repetir los anteriores', async () => {
    base = [persona(1), persona(2)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    base = [...base, persona(3)];
    const resultado = await cuadrarPestanasEspejo();

    expect(resultado['Resumen Registro']).toBe(1);
    expect(numeros()).toEqual([1, 2, 3]);
  });

  it('sólo añade lo que falta: completa los huecos sin tocar lo que ya está', async () => {
    estado.filas = [[1, 'a'], [2, 'b'], [4, 'd']];
    base = [persona(1), persona(2), persona(3), persona(4)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    await cuadrarPestanasEspejo();

    expect(estado.filas.slice(0, 3)).toEqual([[1, 'a'], [2, 'b'], [4, 'd']]);
    expect(numeros().slice(3)).toEqual([3]);
  });

  it('si la lista ya tenía números mayores, la ordena por la columna A al terminar', async () => {
    // Entró un alta (la 5) antes de que se pusiera al día la pestaña.
    estado.filas = [[5, 'x']];
    base = [persona(1), persona(2), persona(5)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    await cuadrarPestanasEspejo();

    const orden = de('sortRange') as { range: { startRowIndex: number }; sortSpecs: { dimensionIndex: number; sortOrder: string }[] }[];
    expect(orden).toHaveLength(1);
    expect(orden[0].range.startRowIndex, 'los títulos de la fila 1 no se mueven').toBe(1);
    expect(orden[0].sortSpecs).toEqual([{ dimensionIndex: 0, sortOrder: 'ASCENDING' }]);
  });

  it('si ya está ordenada no la reordena, ni toca los anchos que alguien puso', async () => {
    estado.filas = [[1, 'a'], [2, 'b']];
    base = [persona(1), persona(2), persona(3)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    await cuadrarPestanasEspejo();

    expect(de('sortRange')).toHaveLength(0);
    expect(de('autoResizeDimensions')).toHaveLength(0);
  });

  it('la primera vez que se llena, ajusta el ancho de sus seis columnas', async () => {
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    const anchos = de('autoResizeDimensions') as { dimensions: { startIndex: number; endIndex: number } }[];
    expect(anchos).toHaveLength(1);
    expect(anchos[0].dimensions).toMatchObject({ startIndex: 0, endIndex: 6 });
  });

  it('con la pestaña al día nunca borra: ninguna petición quita filas ni vacía celdas', async () => {
    estado.filas = [[1, 'a']];
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

    expect(estado.filas[0][1]).toMatch(/^'=/);
    expect(estado.filas[0][4]).toMatch(/^'\+/);
  });

  it('con más de mil registros escribe por tandas de mil', async () => {
    base = Array.from({ length: 2500 }, (_, i) => persona(i + 1));
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    const escrituras = estado.rangos.filter((r) => r.endsWith('!A1'));
    expect(escrituras).toHaveLength(3);
    expect(estado.filas).toHaveLength(2500);
  });
});

describe('los colores de Modalidad', () => {
  const rgb = (c: { red: number; green: number; blue: number }) =>
    '#' + [c.red, c.green, c.blue].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

  it('presencial se pinta verde #d9ead3 y en línea azul #c9daf8', async () => {
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    const porTexto = Object.fromEntries(
      estado.reglas.map((r) => [r.booleanRule.condition.values[0].userEnteredValue, rgb(r.booleanRule.format!.backgroundColor)]),
    );
    expect(porTexto).toEqual({ Presencial: '#d9ead3', 'En línea': '#c9daf8' });
  });

  it('sólo en la columna Modalidad (la F), de la fila 2 hacia abajo y sin tope', async () => {
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    expect(estado.reglas).toHaveLength(2);
    for (const r of estado.reglas) {
      const [rango] = r.ranges;
      expect(rango.startColumnIndex, 'columna F').toBe(5);
      expect(rango.endColumnIndex).toBe(6);
      expect(ENCABEZADOS[rango.startColumnIndex]).toBe('Modalidad');
      expect(rango.startRowIndex, 'la fila 1 son los títulos').toBe(1);
      // Sin fila final: las filas que lleguen mañana ya quedan dentro.
      expect(rango.endRowIndex).toBeUndefined();
      expect(r.booleanRule.condition.type).toBe('TEXT_EQ');
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
    estado.peticiones = [];

    await cuadrarPestanasEspejo();

    expect(de('addConditionalFormatRule')).toHaveLength(0);
    expect(estado.reglas).toHaveLength(2);
  });

  it('si falta una sola, pone sólo esa', async () => {
    estado.reglas = [{
      ranges: [{ sheetId: ID_LISTA, startRowIndex: 1, startColumnIndex: 5, endColumnIndex: 6 }],
      booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Presencial' }] } },
    }];
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    const nuevas = de('addConditionalFormatRule') as { rule: Regla }[];
    expect(nuevas.map((r) => r.rule.booleanRule.condition.values[0].userEnteredValue)).toEqual(['En línea']);
  });

  it('los pone aunque no haya ningún registro que copiar', async () => {
    base = [];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    expect(de('addConditionalFormatRule')).toHaveLength(2);
    expect(estado.filas).toHaveLength(0);
  });
});

describe('si la pestaña ya existía con otras columnas', () => {
  /** La lista como la dejó la versión anterior: cinco columnas, sin Perfil. */
  function listaAnterior() {
    estado.encabezado = ANTERIORES;
    estado.filas = [
      [1, 'Persona1 Prueba', 'México', 'CIESS', 'Presencial'],
      [2, 'Persona2 Prueba', 'México', 'CIESS', 'En línea'],
    ];
    // Sus colores apuntaban a la columna E, donde estaba Modalidad.
    estado.reglas = ['Presencial', 'En línea'].map((texto) => ({
      ranges: [{ sheetId: ID_LISTA, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 }],
      booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: texto }] } },
    }));
    base = [persona(1), persona(2), persona(3)];
  }

  it('no se niega a escribir: se reconstruye sola con las columnas de ahora', async () => {
    listaAnterior();
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    await expect(cuadrarPestanasEspejo()).resolves.toEqual({ 'Resumen Registro': 3 });

    expect(estado.encabezado).toEqual(ENCABEZADOS);
    expect(estado.filas).toEqual([
      [1, 'Persona1 Prueba', 'Ponente', 'México', 'CIESS', 'Presencial'],
      [2, 'Persona2 Prueba', 'Ponente', 'México', 'CIESS', 'En línea'],
      [3, 'Persona3 Prueba', 'Conferencista', 'México', 'CIESS', 'Presencial'],
    ]);
  });

  it('el color pasa a la columna nueva de Modalidad y no queda ninguna regla en la vieja', async () => {
    listaAnterior();
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    expect(estado.reglas).toHaveLength(2);
    for (const r of estado.reglas) {
      expect(r.ranges[0].startColumnIndex).toBe(5);
      expect(r.ranges[0].endColumnIndex).toBe(6);
    }
  });

  it('sólo toca su pestaña: no vacía ni borra filas de ninguna otra', async () => {
    listaAnterior();
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();

    const hojas = [...de('deleteDimension'), ...de('updateCells'), ...de('appendDimension')]
      .map((p: { range?: { sheetId: number }; sheetId?: number }) => p.range?.sheetId ?? p.sheetId);
    expect(hojas.length).toBeGreaterThan(0);
    for (const id of hojas) expect(id, 'sólo la lista').toBe(ID_LISTA);
    // Ni los títulos de las demás se reescriben.
    expect(Object.keys(estado.titulosEscritos)).toEqual(['Resumen Registro']);
  });

  it('la segunda pasada ya no reconstruye nada', async () => {
    listaAnterior();
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await cuadrarPestanasEspejo();
    estado.peticiones = [];

    await cuadrarPestanasEspejo();

    expect(de('deleteDimension')).toHaveLength(0);
    expect(de('deleteConditionalFormatRule')).toHaveLength(0);
    expect(numeros()).toEqual([1, 2, 3]);
  });

  it('el alta de una persona tampoco se bloquea por eso', async () => {
    listaAnterior();
    const { sincronizarRegistro } = await import('@/lib/servidor/sheets');

    const alta = {
      id: '0f5d3f64-4b9c-4f0e-9a2a-7d4b1e2c3a55', folio: 'REG-1', creado_en: '2026-11-05T18:00:00.000Z',
      perfil: 'ponente', modalidad: 'presencial', idioma: 'es', apellidos: 'Ruiz', nombres: 'Ana',
      correo: 'ana@ejemplo.org', institucion: 'UNAM', procedencia: 'nacional', pais_residencia: 'México',
      consentimiento_datos: true, estado: 'en_proceso',
    };
    await expect(sincronizarRegistro(alta)).resolves.toBeUndefined();
    expect(estado.encabezado).toEqual(ENCABEZADOS);
  });

  it('una pestaña de trabajo con otras columnas sigue pidiendo rehacer, sin tocar la lista', async () => {
    estado.encabezadoReg = ['columna', 'de', 'antes'];
    base = [persona(1)];
    const { cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    await expect(cuadrarPestanasEspejo()).rejects.toThrow(/columnas anteriores en REG_Respuestas/);
    expect(estado.filas).toHaveLength(0);
  });
});

describe('cuando la pestaña no existe todavía', () => {
  it('se crea detrás de REG_Respuestas, con título fijo', async () => {
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
