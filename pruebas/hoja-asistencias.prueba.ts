import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENCABEZADOS_ASISTENCIAS, HOJA_ASISTENCIAS, filasDeAsistencias, planDeHoja,
  type FilaDeAsistencia, type FilaDeHoja,
} from '@/lib/asistencia';

/**
 * La pestaña «Asistencias» de la hoja de Google: nombre, correo, día y mesa. Se llena por lotes, no al
 * escanear, y es una copia de la base. Aquí se ve con una hoja simulada con memoria lo que de verdad
 * queda en cada fila.
 */

const fila = (
  sesion: string, via: 'presencial' | 'en_linea', nombre: string, correo: string,
): Pick<FilaDeAsistencia, 'sesion' | 'via' | 'nombre' | 'correo'> => ({ sesion, via, nombre, correo });

describe('las filas de la pestaña', () => {
  it('llevan N.º, nombre, correo, día, mesa y modalidad, con el N.º seguido', () => {
    expect([...ENCABEZADOS_ASISTENCIAS]).toEqual(['N.º', 'Nombre', 'Correo', 'Día', 'Mesa', 'Modalidad']);
    expect(HOJA_ASISTENCIAS).toBe('Asistencias');
    const filas = filasDeAsistencias([
      fila('mesa-4', 'presencial', 'María Robles', 'maria@ejemplo.org'),
      fila('miercoles-1', 'en_linea', 'Luis Pérez', 'luis@ejemplo.org'),
    ]);
    expect(filas[0].slice(0, 4)).toEqual([1, 'María Robles', 'maria@ejemplo.org', 'Jueves 12 de noviembre']);
    expect(String(filas[0][4])).toMatch(/^Mesa 4 · /);
    expect(filas[0][5]).toBe('Presencial');
    expect(filas[1][0]).toBe(2);
    expect(filas[1][3]).toBe('Miércoles 11 de noviembre');
    expect(String(filas[1][4])).toMatch(/Salud/);
    expect(filas[1][5]).toBe('En línea');
  });
});

describe('qué hay que escribir en la hoja', () => {
  const f = (n: number, nombre = `P${n}`): FilaDeHoja => [n, nombre, `p${n}@x.org`, 'Jueves 12 de noviembre', 'Mesa 1', 'Presencial'];

  it('una hoja igual a la base no necesita nada', () => {
    const p = planDeHoja([f(1), f(2)], [f(1), f(2)]);
    expect(p).toMatchObject({ escribir: [], sobran: 0, cambian: 0, nuevas: 0 });
  });

  it('las asistencias nuevas se añaden al final, sin reescribir las anteriores', () => {
    const p = planDeHoja([f(1), f(2), f(3), f(4)], [f(1), f(2)]);
    expect(p.desde).toBe(2);
    expect(p.escribir).toEqual([f(3), f(4)]);
    expect(p).toMatchObject({ nuevas: 2, cambian: 0, sobran: 0 });
  });

  it('en una hoja vacía se escribe todo', () => {
    const p = planDeHoja([f(1), f(2)], []);
    expect(p).toMatchObject({ desde: 0, nuevas: 2, cambian: 0 });
  });

  it('una fila que cambió (se conciliaron los datos) se reescribe desde ahí', () => {
    const p = planDeHoja([f(1), f(2, 'Nombre Correcto'), f(3)], [f(1), f(2), f(3)]);
    expect(p.desde).toBe(1);
    expect(p.escribir).toEqual([f(2, 'Nombre Correcto'), f(3)]);
    expect(p).toMatchObject({ cambian: 2, nuevas: 0, sobran: 0 });
  });

  it('si se quitó una asistencia, se corrige desde ahí y sobra una fila al final', () => {
    const p = planDeHoja([f(1), f(2, 'P3'), f(3, 'P4')].map((x, i) => [i + 1, ...x.slice(1)]), [f(1), f(2), f(3), f(4)]);
    expect(p.desde).toBe(1);
    expect(p.sobran).toBe(1);
  });

  it('compara como texto: un número que la hoja devuelve como «1» no es un cambio', () => {
    expect(planDeHoja([f(1)], [['1', 'P1', 'p1@x.org', 'Jueves 12 de noviembre', 'Mesa 1', 'Presencial']]).escribir).toEqual([]);
  });

  it('no mira lo que alguien haya anotado a la derecha de las seis columnas', () => {
    expect(planDeHoja([f(1)], [[...f(1), 'nota a mano']]).escribir).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Con una hoja simulada
// ---------------------------------------------------------------------------

type Celda = string | number;
const hoja: {
  existe: boolean;
  encabezados: Celda[];
  filas: Celda[][];
  indice: number | undefined;
  escrituras: { range: string; valueInputOption: string; filas: Celda[][] }[];
  limpiezas: string[];
  creadaEn: number | undefined;
} = { existe: false, encabezados: [], filas: [], indice: undefined, escrituras: [], limpiezas: [], creadaEn: undefined };

let asistencias: ReturnType<typeof una>[] = [];
function una(sesion: string, via: 'presencial' | 'en_linea', nombre: string, correo: string) {
  return {
    id: `${sesion}-${correo}`, sesion, via, nombre, correo, perfil: null, folio: null, registro_id: null,
    identificado_por: 'ninguno' as const, capturado_nombre: null, capturado_correo: null, creada_en: new Date().toISOString(),
  };
}

const filaInicial = (rango: string) => Number(/!A(\d+)/.exec(rango)?.[1]);

vi.mock('@/lib/servidor/google', () => ({
  googleConfigurado: () => true,
  clienteSheets: () => ({
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: [
            { properties: { title: 'REG_Respuestas', sheetId: 1, index: 0 } },
            { properties: { title: 'Resumen Registro', sheetId: 2, index: 1 } },
            ...(hoja.existe ? [{ properties: { title: 'Asistencias', sheetId: 7, index: hoja.indice ?? 2 } }] : []),
          ],
        },
      }),
      batchUpdate: async (p: { requestBody: { requests: Record<string, unknown>[] } }) => {
        const replies = p.requestBody.requests.map((r) => {
          const agregar = r.addSheet as { properties: { index?: number } } | undefined;
          if (agregar) {
            hoja.existe = true;
            hoja.creadaEn = agregar.properties.index;
            return { addSheet: { properties: { sheetId: 7 } } };
          }
          return {};
        });
        return { data: { replies } };
      },
      values: {
        get: async () => ({ data: { values: hoja.filas.map((f) => [...f]) } }),
        update: async (p: { range: string; valueInputOption: string; requestBody: { values: Celda[][] } }) => {
          if (/!A1$/.test(p.range)) {
            hoja.encabezados = p.requestBody.values[0];
            return { data: {} };
          }
          const primera = filaInicial(p.range); // fila de Google: la 2 es la primera de datos
          p.requestBody.values.forEach((valores, i) => { hoja.filas[primera - 2 + i] = valores; });
          hoja.escrituras.push({ range: p.range, valueInputOption: p.valueInputOption, filas: p.requestBody.values });
          return { data: {} };
        },
        clear: async (p: { range: string }) => {
          hoja.limpiezas.push(p.range);
          const [, desde, hasta] = /!A(\d+):[A-Z](\d+)/.exec(p.range)!.map(Number);
          hoja.filas.splice(desde - 2, hasta - desde + 1);
          return { data: {} };
        },
      },
    },
  }),
}));
vi.mock('@/lib/servidor/sheets', () => ({
  conEspera: async <T>(op: () => Promise<T>) => op(),
  peticionesDeTitulos: () => [],
}));
vi.mock('@/lib/servidor/asistencia', () => ({ todasLasAsistencias: async () => asistencias }));

const { sincronizarAsistencias } = await import('@/lib/servidor/sheets-asistencia');

beforeEach(() => {
  process.env.GOOGLE_SHEETS_ID = 'libro-de-prueba';
  hoja.existe = false; hoja.encabezados = []; hoja.filas = []; hoja.indice = undefined;
  hoja.escrituras = []; hoja.limpiezas = []; hoja.creadaEn = undefined;
  asistencias = [];
});

describe('sincronizar la pestaña con la base', () => {
  it('sin asistencias no crea la pestaña: nace con la primera', async () => {
    const r = await sincronizarAsistencias();
    expect(r).toEqual({ nuevas: 0, cambiadas: 0, quitadas: 0 });
    expect(hoja.existe).toBe(false);
  });

  it('con la primera asistencia crea la pestaña detrás de «Resumen Registro», con sus encabezados, y escribe la fila', async () => {
    asistencias = [una('mesa-4', 'presencial', 'María Robles', 'maria@ejemplo.org')];
    const r = await sincronizarAsistencias();
    expect(r.nuevas).toBe(1);
    expect(hoja.existe).toBe(true);
    expect(hoja.creadaEn).toBe(2); // justo después de «Resumen Registro», que es la segunda
    expect(hoja.encabezados).toEqual(['N.º', 'Nombre', 'Correo', 'Día', 'Mesa', 'Modalidad']);
    expect(hoja.filas).toHaveLength(1);
    expect(hoja.filas[0].slice(0, 3)).toEqual([1, 'María Robles', 'maria@ejemplo.org']);
    // Texto tal cual, sin interpretar: un nombre que empiece por «=» no se vuelve fórmula.
    expect(hoja.escrituras[0].valueInputOption).toBe('RAW');
  });

  it('repetir no escribe nada: ya está al día', async () => {
    asistencias = [una('mesa-4', 'presencial', 'María Robles', 'maria@ejemplo.org')];
    await sincronizarAsistencias();
    hoja.escrituras = [];
    const r = await sincronizarAsistencias();
    expect(r).toMatchObject({ nuevas: 0, cambiadas: 0, quitadas: 0 });
    expect(hoja.escrituras).toEqual([]);
  });

  it('las asistencias nuevas se añaden al final, empezando por la fila que toca', async () => {
    asistencias = [una('mesa-4', 'presencial', 'María Robles', 'maria@ejemplo.org')];
    await sincronizarAsistencias();
    hoja.escrituras = [];
    asistencias.push(una('mesa-4', 'en_linea', 'Luis Pérez', 'luis@ejemplo.org'), una('mesa-3', 'presencial', 'Ana Ruiz', 'ana@ejemplo.org'));
    const r = await sincronizarAsistencias();
    expect(r.nuevas).toBe(2);
    expect(hoja.escrituras).toHaveLength(1);
    expect(hoja.escrituras[0].range).toMatch(/!A3:F4$/); // la 2 ya estaba ocupada
    expect(hoja.filas.map((f) => f[0])).toEqual([1, 2, 3]);
  });

  it('lo que se concilia a mitad de lista se corrige en su fila', async () => {
    asistencias = [
      una('mesa-4', 'presencial', 'Pedro (sin registro)', 'p@x.org'),
      una('mesa-4', 'presencial', 'Luis Pérez', 'luis@ejemplo.org'),
    ];
    await sincronizarAsistencias();
    asistencias[0] = { ...asistencias[0], nombre: 'Pedro Ramírez Soto' };
    const r = await sincronizarAsistencias();
    expect(r.cambiadas).toBe(2);
    expect(hoja.filas[0][1]).toBe('Pedro Ramírez Soto');
    expect(hoja.filas[1][1]).toBe('Luis Pérez');
  });

  it('una asistencia quitada no deja hueco: la numeración sigue seguida y sobra una fila que se vacía', async () => {
    asistencias = [
      una('mesa-4', 'presencial', 'Uno', 'uno@x.org'),
      una('mesa-4', 'presencial', 'Dos', 'dos@x.org'),
      una('mesa-4', 'presencial', 'Tres', 'tres@x.org'),
    ];
    await sincronizarAsistencias();
    asistencias.splice(0, 1);
    const r = await sincronizarAsistencias();
    expect(r.quitadas).toBe(1);
    expect(hoja.filas.map((f) => [f[0], f[1]])).toEqual([[1, 'Dos'], [2, 'Tres']]);
    expect(hoja.limpiezas[0]).toMatch(/!A4:F4$/);
  });

  it('no escribe fuera de sus seis columnas: lo que se anote a la derecha no se pisa', async () => {
    asistencias = [una('mesa-4', 'presencial', 'Uno', 'uno@x.org'), una('mesa-4', 'presencial', 'Dos', 'dos@x.org')];
    await sincronizarAsistencias();
    asistencias.push(una('mesa-1', 'presencial', 'Tres', 'tres@x.org'));
    await sincronizarAsistencias();
    for (const e of hoja.escrituras) expect(e.range).toMatch(/![A]\d+:F\d+$/);
  });

  it('si la base se vació y la hoja no, no la toca: puede ser un respaldo viejo', async () => {
    asistencias = [una('mesa-4', 'presencial', 'Uno', 'uno@x.org')];
    await sincronizarAsistencias();
    asistencias = [];
    const r = await sincronizarAsistencias();
    expect(r.omitido).toMatch(/--forzar/);
    expect(hoja.filas).toHaveLength(1);
    const forzada = await sincronizarAsistencias({ forzar: true });
    expect(forzada.omitido).toBeUndefined();
    expect(hoja.filas).toHaveLength(0);
  });

  it('si la hoja tiene muchas más filas que la base, se detiene y lo dice', async () => {
    asistencias = Array.from({ length: 15 }, (_, i) => una('mesa-4', 'presencial', `P${i}`, `p${i}@x.org`));
    await sincronizarAsistencias();
    asistencias = asistencias.slice(0, 3);
    const r = await sincronizarAsistencias();
    expect(r.omitido).toMatch(/12 filas más/);
    expect(hoja.filas).toHaveLength(15);
  });

  it('simular dice lo que haría sin tocar nada', async () => {
    asistencias = [una('mesa-4', 'presencial', 'Uno', 'uno@x.org')];
    const r = await sincronizarAsistencias({ simular: true });
    expect(r).toMatchObject({ nuevas: 1, simulado: true });
    expect(hoja.existe).toBe(false);
    expect(hoja.escrituras).toEqual([]);
  });
});
