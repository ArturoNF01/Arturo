import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Dar de baja un registro desde el panel lo borra de la base y nada más: su
 * fila seguía en la hoja y todas las de detrás conservaban un N.º que ya no
 * era el suyo. `alinearHojaConLaBase` lo arregla sin rehacer la hoja entera —lo
 * que vaciaría también lo que el comité haya escrito a mano—.
 *
 * Se ejercita contra una hoja simulada con memoria, para ver lo que de verdad
 * queda en cada fila y no sólo qué se pidió.
 */

type Peticion = Record<string, unknown>;
type Celda = string | number;

const NOMBRES: Record<number, string> = {
  1: 'REG_Respuestas',
  2: 'Resumen Registro',
  3: 'PAR_Participantes',
  4: 'PSE_Personificadores_Semblanzas',
};
const ID_DE = Object.fromEntries(Object.entries(NOMBRES).map(([id, n]) => [n, Number(id)]));

interface Persona {
  folio: string;
  nombres: string;
}

const estado: {
  /** Las filas de datos de cada pestaña (la 1 son los títulos y no está aquí). */
  filas: Record<string, Celda[][]>;
  /** Cuántas filas tiene la cuadrícula de cada pestaña, títulos incluidos. */
  cuadricula: Record<string, number>;
  peticiones: Peticion[];
  /** Las escrituras de celdas sueltas (renumerar), tal como llegaron. */
  correcciones: { range: string; values: Celda[][] }[];
} = { filas: {}, cuadricula: {}, peticiones: [], correcciones: [] };

/** Los registros que hay ahora en la base, en orden de alta: la posición es el N.º. */
let base: Persona[] = [];

const nombreDe = (rango: string) => rango.split('!')[0].replace(/^'(.*)'$/, '$1');

vi.mock('googleapis', () => ({
  google: {
    auth: { JWT: class { constructor(_: unknown) {} } },
    sheets: () => ({
      spreadsheets: {
        get: async () => ({
          data: {
            sheets: Object.entries(NOMBRES).map(([id, title]) => ({
              properties: {
                title, sheetId: Number(id),
                gridProperties: { rowCount: estado.cuadricula[title] ?? 1 },
              },
              conditionalFormats: [],
            })),
          },
        }),
        batchUpdate: async (p: { requestBody: { requests: Peticion[] } }) => {
          for (const peticion of p.requestBody.requests) {
            estado.peticiones.push(peticion);
            const anadir = peticion.appendDimension as { sheetId: number; length: number } | undefined;
            if (anadir) estado.cuadricula[NOMBRES[anadir.sheetId]] += anadir.length;
            const borrar = peticion.deleteDimension as
              { range: { sheetId: number; startIndex: number; endIndex: number } } | undefined;
            if (borrar) {
              const nombre = NOMBRES[borrar.range.sheetId];
              const { startIndex, endIndex } = borrar.range;
              // La regla de Google que se ve al chocar con ella: no se pueden
              // borrar todas las filas no inmovilizadas.
              if (endIndex - startIndex >= estado.cuadricula[nombre] - 1) {
                throw new Error('Invalid requests: it is not possible to delete all non-frozen rows.');
              }
              estado.filas[nombre].splice(startIndex - 1, endIndex - startIndex);
              estado.cuadricula[nombre] -= endIndex - startIndex;
            }
          }
          return { data: { replies: [] } };
        },
        values: {
          // Google entrega copias de lo que hay, no la hoja viva: lo leído antes de
          // borrar filas no cambia por borrarlas.
          get: async ({ range }: { range: string }) => ({
            data: { values: (estado.filas[nombreDe(range)] ?? []).map((f) => [...f]) },
          }),
          append: async ({ range, requestBody }: { range: string; requestBody: { values: Celda[][] } }) => {
            estado.filas[nombreDe(range)].push(...requestBody.values);
            return { data: {} };
          },
          batchGet: async ({ ranges }: { ranges: string[] }) => ({
            data: {
              valueRanges: ranges.map((r) => {
                const nombre = nombreDe(r);
                if (r.endsWith('!1:1')) return { values: [ENCABEZADOS[nombre]] };
                // «A2:AZ»: cada fila entera; una fila en blanco entre datos llega como [].
                return { values: (estado.filas[nombre] ?? []).map((f) => [...f]) };
              }),
            },
          }),
          batchUpdate: async ({ requestBody }: { requestBody: { data: { range: string; values: Celda[][] }[] } }) => {
            for (const { range, values } of requestBody.data) {
              const suelta = /!A(\d+):A(\d+)$/.exec(range);
              if (!suelta) continue; // los títulos
              estado.correcciones.push({ range, values });
              const nombre = nombreDe(range);
              values.forEach((v, k) => {
                estado.filas[nombre][Number(suelta[1]) - 2 + k][0] = v[0];
              });
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
  consultar: async (texto: string) =>
    texto.includes('select folio')
      ? base.map((p, i) => ({ folio: p.folio, numero: String(i + 1) }))
      : base.map((p, i) => ({
          numero_en_hoja: String(i + 1), nombres: p.nombres, apellidos: 'Prueba', perfil: 'ponente',
          pais_residencia: 'México', institucion: 'CIESS', modalidad: 'presencial',
        })),
}));

vi.mock('@/lib/servidor/contenido', () => ({
  leerEjes: async () => ({ filas: [] }),
  leerDatosCongreso: async () => ({ limite_semblanza_palabras: 60 }),
}));

// Se usan los encabezados de verdad: así `asegurarHojas` no se queja y se
// comprueba además que alinear no los toca.
let ENCABEZADOS: Record<string, string[]> = {};

function f(n: number) {
  return `REG-20261105-${String(n).padStart(6, '0')}`;
}
const persona = (n: number): Persona => ({ folio: f(n), nombres: `Persona${n}` });

/**
 * La hoja como estaba antes de las bajas: una fila por cada registro de `antes`,
 * con su N.º de entonces, el folio y, detrás, una columna que el comité llena a mano.
 */
function hojaCon(antes: Persona[], { pse = [] as number[] } = {}) {
  const manual = (p: Persona) => `nota de ${p.folio}`;
  estado.filas.REG_Respuestas = antes.map((p, i) => [i + 1, p.folio, manual(p)]);
  estado.filas.PAR_Participantes = antes.map((p, i) => [i + 1, p.folio, manual(p)]);
  estado.filas.PSE_Personificadores_Semblanzas = antes
    .map((p, i) => [i + 1, p.folio, manual(p)] as Celda[])
    .filter((_, i) => pse.includes(i + 1));
  estado.filas['Resumen Registro'] = antes.map((p, i) => [
    i + 1, `${p.nombres} Prueba`, 'Ponente', 'México', 'CIESS', 'Presencial',
  ]);
  for (const [nombre, filas] of Object.entries(estado.filas)) estado.cuadricula[nombre] = filas.length + 1 + 20;
}

const folios = (hoja: string) => estado.filas[hoja].map((x) => x[1]);
const numeros = (hoja: string) => estado.filas[hoja].map((x) => x[0]);
const de = (clave: string) => estado.peticiones.filter((p) => clave in p).map((p) => p[clave] as never);

beforeEach(async () => {
  const { HOJAS } = await import('@/lib/normalizacion');
  ENCABEZADOS = HOJAS;
  estado.filas = {};
  estado.cuadricula = {};
  estado.peticiones = [];
  estado.correcciones = [];
  base = [];
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'cuenta@ejemplo.iam.gserviceaccount.com';
  process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----\\n';
  process.env.GOOGLE_SHEETS_ID = 'hoja-de-prueba';
  const { olvidarRevisionDelLibro } = await import('@/lib/servidor/sheets');
  olvidarRevisionDelLibro();
});

describe('dos registros dados de baja desde el panel', () => {
  // Cinco registros en la hoja; se dan de baja el 2 y el 4.
  const antes = [1, 2, 3, 4, 5].map(persona);

  beforeEach(() => {
    hojaCon(antes, { pse: [1, 4, 5] });
    base = [persona(1), persona(3), persona(5)];
  });

  it('quita sus filas de las pestañas de trabajo y deja las de los demás', async () => {
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');
    const r = await alinearHojaConLaBase();

    expect(folios('REG_Respuestas')).toEqual([f(1), f(3), f(5)]);
    expect(folios('PAR_Participantes')).toEqual([f(1), f(3), f(5)]);
    // En la del personificador sólo estaba la 4 de las dos bajas.
    expect(folios('PSE_Personificadores_Semblanzas')).toEqual([f(1), f(5)]);
    expect(r.quitadas).toEqual({ REG_Respuestas: 2, PAR_Participantes: 2, PSE_Personificadores_Semblanzas: 1 });
  });

  it('corrige el N.º de los que venían detrás: ahora son el 1, el 2 y el 3', async () => {
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');
    const r = await alinearHojaConLaBase();

    expect(numeros('REG_Respuestas')).toEqual([1, 2, 3]);
    expect(numeros('PAR_Participantes')).toEqual([1, 2, 3]);
    // En la del personificador el número salta, y eso es información: de qué registro viene cada ficha.
    expect(numeros('PSE_Personificadores_Semblanzas')).toEqual([1, 3]);
    expect(r.renumeradas).toBeGreaterThan(0);
  });

  it('no toca lo que el comité escribió a mano: sólo se escribe la columna A', async () => {
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');
    await alinearHojaConLaBase();

    for (const hoja of ['REG_Respuestas', 'PAR_Participantes', 'PSE_Personificadores_Semblanzas']) {
      for (const x of estado.filas[hoja]) expect(x[2], `${hoja} ${x[1]}`).toBe(`nota de ${x[1]}`);
    }
    for (const { range } of estado.correcciones) expect(range, range).toMatch(/!A\d+:A\d+$/);
  });

  it('la lista de registrados, que es una copia, se vuelve a escribir desde la base', async () => {
    const { alinearHojaConLaBase, cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    const r = await alinearHojaConLaBase();
    expect(r.reconstruidas).toEqual(['Resumen Registro']);

    await cuadrarPestanasEspejo();
    expect(estado.filas['Resumen Registro']).toEqual([
      [1, 'Persona1 Prueba', 'Ponente', 'México', 'CIESS', 'Presencial'],
      [2, 'Persona3 Prueba', 'Ponente', 'México', 'CIESS', 'Presencial'],
      [3, 'Persona5 Prueba', 'Ponente', 'México', 'CIESS', 'Presencial'],
    ]);
  });

  it('borra de abajo arriba, para que quitar una fila no mueva la siguiente', async () => {
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');
    await alinearHojaConLaBase();

    const deREG = (de('deleteDimension') as { range: { sheetId: number; startIndex: number } }[])
      .filter((d) => d.range.sheetId === ID_DE.REG_Respuestas)
      .map((d) => d.range.startIndex);
    expect(deREG).toEqual([...deREG].sort((a, b) => b - a));
    expect(deREG).toHaveLength(2);
  });

  it('repetirlo no hace nada: la segunda pasada no escribe ni borra', async () => {
    const { alinearHojaConLaBase, cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await alinearHojaConLaBase();
    await cuadrarPestanasEspejo();
    estado.peticiones = [];
    estado.correcciones = [];

    const r = await alinearHojaConLaBase();

    expect(r).toEqual({ quitadas: {}, renumeradas: 0, enBlanco: 0, reconstruidas: [] });
    expect(estado.peticiones).toHaveLength(0);
    expect(estado.correcciones).toHaveLength(0);
  });

  it('no escribe en ninguna otra parte: ni títulos, ni registros nuevos', async () => {
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');
    await alinearHojaConLaBase();

    expect(de('updateCells').every((u: { range: { sheetId: number } }) => u.range.sheetId === ID_DE['Resumen Registro'])).toBe(true);
  });
});

describe('con la hoja ya al día', () => {
  it('no toca nada', async () => {
    const todos = [1, 2, 3].map(persona);
    hojaCon(todos, { pse: [2] });
    base = todos;
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');

    const r = await alinearHojaConLaBase();

    expect(r).toEqual({ quitadas: {}, renumeradas: 0, enBlanco: 0, reconstruidas: [] });
    expect(estado.peticiones).toHaveLength(0);
    expect(estado.correcciones).toHaveLength(0);
  });

  it('un registro que ya está en la base y aún no en la hoja se deja para la copia de siempre', async () => {
    // El 2 se dio de alta pero Google falló: no está en la hoja, y no por eso sobra nada.
    hojaCon([persona(1), persona(3)]);
    base = [1, 2, 3].map(persona);
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');

    const r = await alinearHojaConLaBase();

    expect(r.quitadas).toEqual({});
    expect(folios('REG_Respuestas')).toEqual([f(1), f(3)]);
    // Pero el 3 sí es el 3 ahora: el número sale de la base.
    expect(numeros('REG_Respuestas')).toEqual([1, 3]);
  });
});

describe('las guardas', () => {
  it('una base sin registros no se toma por una orden de vaciar la hoja', async () => {
    hojaCon([1, 2, 3].map(persona));
    base = [];
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');

    const r = await alinearHojaConLaBase();

    expect(r.omitido).toMatch(/no tiene registros/);
    expect(folios('REG_Respuestas')).toHaveLength(3);
    expect(estado.peticiones).toHaveLength(0);
  });

  it('una fila que no tiene un folio del sistema —una nota a mano— no se toca', async () => {
    hojaCon([1, 2].map(persona));
    estado.filas.REG_Respuestas.push(['', 'Pendiente de revisar con el comité', 'x']);
    estado.filas.REG_Respuestas.push(['', '', 'fila en blanco con nota']);
    base = [persona(1), persona(2)];
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');

    await alinearHojaConLaBase();

    expect(estado.filas.REG_Respuestas).toHaveLength(4);
    expect(estado.filas.REG_Respuestas[2][1]).toBe('Pendiente de revisar con el comité');
  });

  it('más de diez bajas de una vez se paran, y no se borra nada', async () => {
    // Lo que parecería una restauración de un respaldo viejo por error.
    hojaCon(Array.from({ length: 30 }, (_, i) => persona(i + 1)));
    base = [persona(1), persona(2)];
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');

    await expect(alinearHojaConLaBase()).rejects.toThrow(/Se quitarían 28 registros.*--forzar/);
    expect(estado.filas.REG_Respuestas).toHaveLength(30);
    expect(de('deleteDimension')).toHaveLength(0);
  });

  it('con --forzar sí las quita', async () => {
    hojaCon(Array.from({ length: 30 }, (_, i) => persona(i + 1)));
    base = [persona(1), persona(2)];
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');

    await alinearHojaConLaBase({ forzar: true });

    expect(folios('REG_Respuestas')).toEqual([f(1), f(2)]);
  });

  it('si lo que se quita es todo lo que hay bajo los títulos, no revienta contra la regla de Google', async () => {
    // PSE sólo tenía la ficha del registro dado de baja y su cuadrícula es mínima.
    hojaCon([1, 2].map(persona), { pse: [2] });
    estado.cuadricula.PSE_Personificadores_Semblanzas = 2; // títulos + una fila
    base = [persona(1)];
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');

    await expect(alinearHojaConLaBase()).resolves.toMatchObject({
      quitadas: expect.objectContaining({ PSE_Personificadores_Semblanzas: 1 }),
    });
    expect(estado.filas.PSE_Personificadores_Semblanzas).toHaveLength(0);
  });

  it('las bajas seguidas se quitan en un solo tramo', async () => {
    hojaCon([1, 2, 3, 4, 5, 6].map(persona));
    base = [persona(1), persona(5), persona(6)];
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');

    await alinearHojaConLaBase();

    const deREG = (de('deleteDimension') as { range: { sheetId: number; startIndex: number; endIndex: number } }[])
      .filter((d) => d.range.sheetId === ID_DE.REG_Respuestas);
    expect(deREG).toHaveLength(1);
    expect(folios('REG_Respuestas')).toEqual([f(1), f(5), f(6)]);
    expect(numeros('REG_Respuestas')).toEqual([1, 2, 3]);
  });
});

describe('seguida y sin huecos', () => {
  it('tras varias bajas la numeración queda 1, 2, 3… sin saltos en las pestañas de trabajo', async () => {
    hojaCon([1, 2, 3, 4, 5, 6, 7, 8].map(persona));
    base = [persona(2), persona(5), persona(6), persona(8)]; // se dieron de baja 1, 3, 4 y 7
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');

    await alinearHojaConLaBase();

    for (const hoja of ['REG_Respuestas', 'PAR_Participantes']) {
      expect(numeros(hoja), hoja).toEqual([1, 2, 3, 4]);
      expect(folios(hoja), hoja).toEqual([f(2), f(5), f(6), f(8)]);
    }
  });

  it('una fila que quedó en blanco entre los datos se quita, y la numeración sigue seguida', async () => {
    hojaCon([1, 2, 3].map(persona));
    // Alguien vació a mano la fila del registro 2 en la hoja y dejó el hueco.
    estado.filas.REG_Respuestas[1] = [];
    base = [persona(1), persona(3)];
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');

    const r = await alinearHojaConLaBase();

    expect(r.enBlanco).toBe(1);
    expect(folios('REG_Respuestas')).toEqual([f(1), f(3)]);
    expect(numeros('REG_Respuestas')).toEqual([1, 2]);
  });

  it('una fila sin folio pero con algo escrito no es un hueco: se deja', async () => {
    hojaCon([1, 2].map(persona));
    estado.filas.REG_Respuestas.push(['', '', 'nota suelta del comité']);
    base = [persona(1), persona(2)];
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');

    const r = await alinearHojaConLaBase();

    expect(r.enBlanco).toBe(0);
    expect(estado.filas.REG_Respuestas).toHaveLength(3);
  });

  it('la lista de registrados con un hueco entre sus filas se vuelve a escribir', async () => {
    hojaCon([1, 2, 3].map(persona));
    base = [1, 2, 3].map(persona);
    estado.filas['Resumen Registro'][1] = []; // un hueco donde iba el 2
    const { alinearHojaConLaBase, cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    const r = await alinearHojaConLaBase();
    expect(r.reconstruidas).toEqual(['Resumen Registro']);

    await cuadrarPestanasEspejo();
    expect(numeros('Resumen Registro')).toEqual([1, 2, 3]);
  });

  it('la lista de registrados con las filas desordenadas se vuelve a escribir en orden', async () => {
    hojaCon([1, 2, 3].map(persona));
    base = [1, 2, 3].map(persona);
    const lista = estado.filas['Resumen Registro'];
    estado.filas['Resumen Registro'] = [lista[2], lista[0], lista[1]];
    const { alinearHojaConLaBase, cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    const r = await alinearHojaConLaBase();
    expect(r.reconstruidas).toEqual(['Resumen Registro']);

    await cuadrarPestanasEspejo();
    expect(numeros('Resumen Registro')).toEqual([1, 2, 3]);
  });

  it('una lista bien hecha no se rehace', async () => {
    hojaCon([1, 2, 3].map(persona));
    base = [1, 2, 3].map(persona);
    const { alinearHojaConLaBase } = await import('@/lib/servidor/sheets');

    const r = await alinearHojaConLaBase();

    expect(r.reconstruidas).toEqual([]);
  });
});

describe('la pestaña «Resumen Registro» también va seguida y sin huecos', () => {
  it('tras varias bajas queda 1, 2, 3… con los registros que hay y ninguna fila vacía', async () => {
    hojaCon([1, 2, 3, 4, 5, 6].map(persona));
    base = [persona(2), persona(3), persona(6)]; // se dieron de baja 1, 4 y 5
    const { alinearHojaConLaBase, cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    await alinearHojaConLaBase();
    await cuadrarPestanasEspejo();

    const lista = estado.filas['Resumen Registro'];
    expect(lista.map((x) => x[0])).toEqual([1, 2, 3]);
    expect(lista.map((x) => x[1])).toEqual(['Persona2 Prueba', 'Persona3 Prueba', 'Persona6 Prueba']);
    for (const x of lista) expect(x.some((c) => String(c).trim() !== ''), 'ninguna fila vacía').toBe(true);
  });

  it('una baja que llega con el sistema funcionando se refleja sin dejar un hueco', async () => {
    // Misma lista, pero el hueco ya estaba: alguien borró una fila a mano y luego se dio otra baja.
    hojaCon([1, 2, 3, 4].map(persona));
    estado.filas['Resumen Registro'][0] = [];
    base = [persona(1), persona(2), persona(4)];
    const { alinearHojaConLaBase, cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');

    await alinearHojaConLaBase();
    await cuadrarPestanasEspejo();

    expect(numeros('Resumen Registro')).toEqual([1, 2, 3]);
  });

  it('un registro nuevo después de las bajas entra con el número que sigue', async () => {
    hojaCon([1, 2, 3].map(persona));
    base = [persona(1), persona(3)];
    const { alinearHojaConLaBase, cuadrarPestanasEspejo } = await import('@/lib/servidor/sheets');
    await alinearHojaConLaBase();
    await cuadrarPestanasEspejo();

    base = [...base, persona(4)]; // el alta de hoy: tercera de la base
    await cuadrarPestanasEspejo();

    expect(numeros('Resumen Registro')).toEqual([1, 2, 3]);
    expect(estado.filas['Resumen Registro'][2][1]).toBe('Persona4 Prueba');
  });
});
