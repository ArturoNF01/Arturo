import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENCABEZADOS_ASISTENCIAS, ENCABEZADOS_PERSONAS, HOJA_ASISTENCIAS, HOJA_PERSONAS, filasDeAsistencias, filasDePersonas, planDeHoja,
  textoDeRegistro, type FilaDeAsistencia, type FilaDeHoja,
} from '@/lib/asistencia';

/**
 * Las pestañas de asistencia de la hoja de Google: «Asistencias» (nombre, correo, día y modalidad, una fila por asistencia)
 * y «Asistencia por persona» (una fila por persona, con un día por columna y si tenía registro). Se llenan por lotes, no al
 * escanear, y son copia de la base. Aquí se ve con una hoja simulada con memoria lo que de verdad queda en cada fila.
 */

const fila = (
  sesion: string, via: 'presencial' | 'en_linea', nombre: string, correo: string,
): Pick<FilaDeAsistencia, 'sesion' | 'via' | 'nombre' | 'correo'> => ({ sesion, via, nombre, correo });

describe('las filas de la pestaña', () => {
  it('llevan N.º, nombre, correo, día y modalidad, con el N.º seguido; ya no hay columna de mesa', () => {
    expect([...ENCABEZADOS_ASISTENCIAS]).toEqual(['N.º', 'Nombre', 'Correo', 'Día', 'Modalidad']);
    expect(HOJA_ASISTENCIAS).toBe('Asistencias');
    const filas = filasDeAsistencias([
      fila('jueves', 'presencial', 'María Robles', 'maria@ejemplo.org'),
      fila('miercoles', 'en_linea', 'Luis Pérez', 'luis@ejemplo.org'),
    ]);
    expect(filas[0]).toEqual([1, 'María Robles', 'maria@ejemplo.org', 'Jueves 12 de noviembre', 'Presencial']);
    expect(filas[1]).toEqual([2, 'Luis Pérez', 'luis@ejemplo.org', 'Miércoles 11 de noviembre', 'En línea']);
  });

  it('la sesión de prueba sale con el día «Prueba»', () => {
    expect(filasDeAsistencias([fila('prueba', 'presencial', 'Ana', 'ana@x.org')])[0].slice(3)).toEqual(['Prueba', 'Presencial']);
  });
});

describe('qué hay que escribir en la hoja', () => {
  const f = (n: number, nombre = `P${n}`): FilaDeHoja => [n, nombre, `p${n}@x.org`, 'Jueves 12 de noviembre', 'Presencial'];

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
    expect(planDeHoja([f(1)], [['1', 'P1', 'p1@x.org', 'Jueves 12 de noviembre', 'Presencial']]).escribir).toEqual([]);
  });

  it('no mira lo que alguien haya anotado a la derecha de las cinco columnas', () => {
    expect(planDeHoja([f(1)], [[...f(1), 'nota a mano']]).escribir).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Con una hoja simulada
// ---------------------------------------------------------------------------

type Celda = string | number;

/** Una pestaña de la hoja simulada, con lo que la prueba necesita ver de ella. */
interface PestanaSimulada {
  titulo: string;
  sheetId: number;
  existe: boolean;
  encabezados: Celda[];
  filas: Celda[][];
  indice: number | undefined;
  escrituras: { range: string; valueInputOption: string; filas: Celda[][] }[];
  limpiezas: string[];
  creadaEn: number | undefined;
  /** Cuántas filas tiene la cuadrícula de la pestaña, títulos incluidos (una pestaña nueva de Google trae 1,000). */
  cuadricula: number;
  ampliaciones: number[];
  /** Si es verdadero, Google rechaza las escrituras de esta pestaña y de ninguna otra. */
  fallaPropia: string | null;
}
const pestanaNueva = (titulo: string, sheetId: number): PestanaSimulada => ({
  titulo, sheetId, existe: false, encabezados: [], filas: [], indice: undefined, escrituras: [], limpiezas: [],
  creadaEn: undefined, cuadricula: 1000, ampliaciones: [], fallaPropia: null,
});

/** «Asistencias», con además lo que vale para toda la hoja: si Google está conectado y si rechaza todo. */
const hoja = Object.assign(pestanaNueva('Asistencias', 7), {
  configurado: true,
  /** Si es verdadero, Google rechaza las escrituras de todas las pestañas (un permiso quitado, la hoja borrada…). */
  falla: null as string | null,
  llamadasAGet: 0,
});
const personas = pestanaNueva('Asistencia por persona', 8);
const pestanasSimuladas = [hoja, personas];

/** La pestaña a la que apunta un rango de Google: sin nombre entre comillas es «Asistencias»; con él, la de personas. */
const pestanaDeRango = (rango: string) => pestanasSimuladas.find((p) => rango.startsWith(`'${p.titulo}'!`)) ?? hoja;
const fallaDe = (p: PestanaSimulada) => hoja.falla ?? p.fallaPropia;

let asistencias: ReturnType<typeof una>[] = [];
function una(sesion: string, via: 'presencial' | 'en_linea', nombre: string, correo: string, extra: Record<string, unknown> = {}) {
  return {
    id: `${sesion}-${correo}`, sesion, via, nombre, correo, perfil: null as string | null, folio: null, registro_id: null as string | null,
    estado_registro: null as string | null,
    identificado_por: 'ninguno' as const, capturado_nombre: null, capturado_correo: null, creada_en: new Date().toISOString(),
    ...extra,
  };
}

const filaInicial = (rango: string) => Number(/!A(\d+)/.exec(rango)?.[1]);

vi.mock('@/lib/servidor/google', () => ({
  googleConfigurado: () => hoja.configurado,
  clienteSheets: () => ({
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: [
            { properties: { title: 'REG_Respuestas', sheetId: 1, index: 0 } },
            { properties: { title: 'Resumen Registro', sheetId: 2, index: 1 } },
            ...pestanasSimuladas
              .filter((p) => p.existe)
              .map((p) => ({ properties: { title: p.titulo, sheetId: p.sheetId, index: p.indice ?? 2, gridProperties: { rowCount: p.cuadricula } } })),
          ],
        },
      }),
      batchUpdate: async (p: { requestBody: { requests: Record<string, unknown>[] } }) => {
        const replies = p.requestBody.requests.map((r) => {
          const agregar = r.addSheet as { properties: { title: string; index?: number } } | undefined;
          if (agregar) {
            const nueva = pestanasSimuladas.find((x) => x.titulo === agregar.properties.title)!;
            if (fallaDe(nueva)) throw new Error(fallaDe(nueva)!);
            nueva.existe = true;
            nueva.creadaEn = agregar.properties.index;
            return { addSheet: { properties: { sheetId: nueva.sheetId, gridProperties: { rowCount: nueva.cuadricula } } } };
          }
          const ampliar = r.appendDimension as { sheetId: number; dimension: string; length: number } | undefined;
          if (ampliar) {
            const destino = pestanasSimuladas.find((x) => x.sheetId === ampliar.sheetId)!;
            if (fallaDe(destino)) throw new Error(fallaDe(destino)!);
            destino.cuadricula += ampliar.length;
            destino.ampliaciones.push(ampliar.length);
          }
          if (hoja.falla) throw new Error(hoja.falla);
          return {};
        });
        return { data: { replies } };
      },
      values: {
        get: async (p: { range: string }) => {
          const destino = pestanaDeRango(p.range);
          if (fallaDe(destino)) throw new Error(fallaDe(destino)!);
          hoja.llamadasAGet += 1;
          // Los títulos (fila 1) y los datos (desde la 2) son lecturas distintas.
          if (/A1:[A-Z]1$/.test(p.range)) return { data: { values: destino.encabezados.length > 0 ? [destino.encabezados] : undefined } };
          return { data: { values: destino.filas.map((f) => [...f]) } };
        },
        update: async (p: { range: string; valueInputOption: string; requestBody: { values: Celda[][] } }) => {
          const destino = pestanaDeRango(p.range);
          if (/!A1$/.test(p.range)) {
            destino.encabezados = p.requestBody.values[0];
            return { data: {} };
          }
          if (fallaDe(destino)) throw new Error(fallaDe(destino)!);
          const primera = filaInicial(p.range); // fila de Google: la 2 es la primera de datos
          const ultima = Number(/:[A-Z](\d+)$/.exec(p.range)?.[1]);
          // Lo que hace Google: no escribe fuera de la cuadrícula.
          if (ultima > destino.cuadricula) throw new Error(`Range (${p.range}) exceeds grid limits. Max rows: ${destino.cuadricula}`);
          p.requestBody.values.forEach((valores, i) => { destino.filas[primera - 2 + i] = valores; });
          destino.escrituras.push({ range: p.range, valueInputOption: p.valueInputOption, filas: p.requestBody.values });
          return { data: {} };
        },
        clear: async (p: { range: string }) => {
          const destino = pestanaDeRango(p.range);
          destino.limpiezas.push(p.range);
          // Las columnas enteras (títulos incluidos): lo que se hace al rehacer una pestaña del diseño anterior.
          if (/!A1:[A-Z]$/.test(p.range)) {
            destino.encabezados = [];
            destino.filas = [];
            return { data: {} };
          }
          const [, desde, hasta] = /!A(\d+):[A-Z](\d+)/.exec(p.range)!.map(Number);
          destino.filas.splice(desde - 2, hasta - desde + 1);
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

const {
  ESPERA_AUTOMATICA_MS, estadoDeLaHoja, pedirSincronizacionDeAsistencias, sincronizarAsistenciaPorPersona, sincronizarAsistencias,
  sincronizarLasPestanas, sincronizarYAnotar,
} = await import('@/lib/servidor/sheets-asistencia');

beforeEach(() => {
  process.env.GOOGLE_SHEETS_ID = 'libro-de-prueba';
  for (const p of pestanasSimuladas) {
    p.existe = false; p.encabezados = []; p.filas = []; p.indice = undefined;
    p.escrituras = []; p.limpiezas = []; p.creadaEn = undefined;
    p.cuadricula = 1000; p.ampliaciones = []; p.fallaPropia = null;
  }
  hoja.configurado = true; hoja.falla = null; hoja.llamadasAGet = 0;
  asistencias = [];
});

describe('sincronizar la pestaña con la base', () => {
  it('sin asistencias no crea la pestaña: nace con la primera', async () => {
    const r = await sincronizarAsistencias();
    expect(r).toEqual({ nuevas: 0, cambiadas: 0, quitadas: 0 });
    expect(hoja.existe).toBe(false);
  });

  it('con la primera asistencia crea la pestaña detrás de «Resumen Registro», con sus encabezados, y escribe la fila', async () => {
    asistencias = [una('jueves', 'presencial', 'María Robles', 'maria@ejemplo.org')];
    const r = await sincronizarAsistencias();
    expect(r.nuevas).toBe(1);
    expect(hoja.existe).toBe(true);
    expect(hoja.creadaEn).toBe(2); // justo después de «Resumen Registro», que es la segunda
    expect(hoja.encabezados).toEqual(['N.º', 'Nombre', 'Correo', 'Día', 'Modalidad']);
    expect(hoja.filas).toHaveLength(1);
    expect(hoja.filas[0].slice(0, 3)).toEqual([1, 'María Robles', 'maria@ejemplo.org']);
    // Texto tal cual, sin interpretar: un nombre que empiece por «=» no se vuelve fórmula.
    expect(hoja.escrituras[0].valueInputOption).toBe('RAW');
  });

  it('repetir no escribe nada: ya está al día', async () => {
    asistencias = [una('jueves', 'presencial', 'María Robles', 'maria@ejemplo.org')];
    await sincronizarAsistencias();
    hoja.escrituras = [];
    const r = await sincronizarAsistencias();
    expect(r).toMatchObject({ nuevas: 0, cambiadas: 0, quitadas: 0 });
    expect(hoja.escrituras).toEqual([]);
  });

  it('las asistencias nuevas se añaden al final, empezando por la fila que toca', async () => {
    asistencias = [una('jueves', 'presencial', 'María Robles', 'maria@ejemplo.org')];
    await sincronizarAsistencias();
    hoja.escrituras = [];
    asistencias.push(una('jueves', 'en_linea', 'Luis Pérez', 'luis@ejemplo.org'), una('viernes', 'presencial', 'Ana Ruiz', 'ana@ejemplo.org'));
    const r = await sincronizarAsistencias();
    expect(r.nuevas).toBe(2);
    expect(hoja.escrituras).toHaveLength(1);
    expect(hoja.escrituras[0].range).toMatch(/!A3:E4$/); // la 2 ya estaba ocupada
    expect(hoja.filas.map((f) => f[0])).toEqual([1, 2, 3]);
  });

  it('lo que se concilia a mitad de lista se corrige en su fila', async () => {
    asistencias = [
      una('jueves', 'presencial', 'Pedro (sin registro)', 'p@x.org'),
      una('jueves', 'presencial', 'Luis Pérez', 'luis@ejemplo.org'),
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
      una('jueves', 'presencial', 'Uno', 'uno@x.org'),
      una('jueves', 'presencial', 'Dos', 'dos@x.org'),
      una('jueves', 'presencial', 'Tres', 'tres@x.org'),
    ];
    await sincronizarAsistencias();
    asistencias.splice(0, 1);
    const r = await sincronizarAsistencias();
    expect(r.quitadas).toBe(1);
    expect(hoja.filas.map((f) => [f[0], f[1]])).toEqual([[1, 'Dos'], [2, 'Tres']]);
    expect(hoja.limpiezas[0]).toMatch(/!A4:E4$/);
  });

  it('no escribe fuera de sus cinco columnas: lo que se anote a la derecha no se pisa', async () => {
    asistencias = [una('jueves', 'presencial', 'Uno', 'uno@x.org'), una('jueves', 'presencial', 'Dos', 'dos@x.org')];
    await sincronizarAsistencias();
    asistencias.push(una('miercoles', 'presencial', 'Tres', 'tres@x.org'));
    await sincronizarAsistencias();
    for (const e of hoja.escrituras) expect(e.range).toMatch(/![A]\d+:E\d+$/);
  });

  it('si la base se vació y la hoja no, no la toca: puede ser un respaldo viejo', async () => {
    asistencias = [una('jueves', 'presencial', 'Uno', 'uno@x.org')];
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
    asistencias = Array.from({ length: 15 }, (_, i) => una('jueves', 'presencial', `P${i}`, `p${i}@x.org`));
    await sincronizarAsistencias();
    asistencias = asistencias.slice(0, 3);
    const r = await sincronizarAsistencias();
    expect(r.omitido).toMatch(/12 filas más/);
    expect(hoja.filas).toHaveLength(15);
  });

  it('simular dice lo que haría sin tocar nada', async () => {
    asistencias = [una('jueves', 'presencial', 'Uno', 'uno@x.org')];
    const r = await sincronizarAsistencias({ simular: true });
    expect(r).toMatchObject({ nuevas: 1, simulado: true });
    expect(hoja.existe).toBe(false);
    expect(hoja.escrituras).toEqual([]);
  });
});

describe('cuando son muchas asistencias', () => {
  it('amplía la pestaña antes de escribir: una pestaña nueva trae 1,000 filas y el Congreso pasa de ahí', async () => {
    asistencias = Array.from({ length: 1500 }, (_, i) => una('jueves', 'presencial', `Persona ${i}`, `p${i}@x.org`));
    await sincronizarAsistencias();
    expect(hoja.filas).toHaveLength(1500);
    expect(hoja.ampliaciones).toHaveLength(1);
    expect(hoja.cuadricula).toBeGreaterThanOrEqual(1501);
    expect(hoja.filas[1499][0]).toBe(1500);
  });

  it('sin ampliar la cuadrícula Google rechazaría la escritura (lo que hace el simulacro)', async () => {
    // La prueba de que el simulacro vigila el límite: si no se ampliara, esto fallaría.
    hoja.existe = true;
    hoja.cuadricula = 10;
    asistencias = Array.from({ length: 30 }, (_, i) => una('jueves', 'presencial', `P${i}`, `p${i}@x.org`));
    await sincronizarAsistencias();
    expect(hoja.filas).toHaveLength(30);
    expect(hoja.ampliaciones.length).toBe(1);
  });

  it('una pasada siguiente no vuelve a ampliar si ya cabe', async () => {
    asistencias = Array.from({ length: 1500 }, (_, i) => una('jueves', 'presencial', `P${i}`, `p${i}@x.org`));
    await sincronizarAsistencias();
    asistencias.push(una('miercoles', 'presencial', 'Otra', 'otra@x.org'));
    await sincronizarAsistencias();
    expect(hoja.ampliaciones).toHaveLength(1);
    expect(hoja.filas).toHaveLength(1501);
  });
});

describe('los títulos de la pestaña', () => {
  it('si alguien creó la pestaña a mano, o cambió los títulos, se dejan los de siempre', async () => {
    hoja.existe = true;
    hoja.encabezados = ['Nombre', 'Correo'];
    asistencias = [una('jueves', 'presencial', 'Uno', 'uno@x.org')];
    await sincronizarAsistencias();
    expect(hoja.encabezados).toEqual(['N.º', 'Nombre', 'Correo', 'Día', 'Modalidad']);
  });
});

describe('pasar a la hoja sin esperar al cron', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('unos segundos después del escaneo la asistencia está en la hoja, y una ráfaga hace una sola pasada', async () => {
    asistencias = [una('jueves', 'presencial', 'Uno', 'uno@x.org')];
    pedirSincronizacionDeAsistencias();
    asistencias.push(una('jueves', 'presencial', 'Dos', 'dos@x.org'));
    pedirSincronizacionDeAsistencias();
    asistencias.push(una('jueves', 'en_linea', 'Tres', 'tres@x.org'));
    pedirSincronizacionDeAsistencias();
    expect(hoja.filas).toHaveLength(0); // todavía no: se espera para juntar la ráfaga
    await vi.advanceTimersByTimeAsync(ESPERA_AUTOMATICA_MS + 100);
    expect(hoja.filas.map((f) => f[1])).toEqual(['Uno', 'Dos', 'Tres']);
    expect(hoja.escrituras).toHaveLength(1);
    // Y la pestaña por persona, en la misma pasada.
    expect(personas.filas.map((f) => f[1])).toEqual(['Uno', 'Dos', 'Tres']);
    expect(personas.escrituras).toHaveLength(1);
  });

  it('anota cuándo se hizo, y si falla lo anota y no revienta a nadie: el cron lo alcanza después', async () => {
    asistencias = [una('jueves', 'presencial', 'Uno', 'uno@x.org')];
    hoja.falla = 'The caller does not have permission';
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    pedirSincronizacionDeAsistencias();
    await vi.advanceTimersByTimeAsync(ESPERA_AUTOMATICA_MS + 100);
    expect(estadoDeLaHoja().error).toMatch(/permission/);
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();

    hoja.falla = null;
    pedirSincronizacionDeAsistencias();
    await vi.advanceTimersByTimeAsync(ESPERA_AUTOMATICA_MS + 100);
    expect(estadoDeLaHoja().error).toBeNull();
    expect(estadoDeLaHoja().ultimaVez).not.toBeNull();
    expect(hoja.filas).toHaveLength(1);
  });

  it('el botón del panel dice la causa real cuando falla', async () => {
    asistencias = [una('jueves', 'presencial', 'Uno', 'uno@x.org')];
    hoja.falla = 'Requested entity was not found.';
    await expect(sincronizarYAnotar()).rejects.toThrow(/not found/);
    expect(estadoDeLaHoja().error).toMatch(/not found/);
  });

  it('sin Google conectado (una instalación local) no hace nada ni deja nada pendiente', async () => {
    hoja.configurado = false;
    asistencias = [una('jueves', 'presencial', 'Uno', 'uno@x.org')];
    pedirSincronizacionDeAsistencias();
    await vi.advanceTimersByTimeAsync(ESPERA_AUTOMATICA_MS * 2);
    expect(hoja.existe).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dos pasadas a la vez no se pisan: van una tras otra', async () => {
    asistencias = [una('jueves', 'presencial', 'Uno', 'uno@x.org')];
    const [a, b] = await Promise.all([sincronizarYAnotar(), sincronizarYAnotar()]);
    // La primera escribió una fila en cada pestaña (el detalle y la de por persona); el total es la suma.
    expect(a.pestanas.asistencias.nuevas).toBe(1);
    expect(a.pestanas.personas.nuevas).toBe(1);
    expect(a.nuevas).toBe(2);
    expect(b.nuevas).toBe(0); // la segunda ya encontró las filas escritas por la primera
    expect(hoja.filas).toHaveLength(1);
    expect(personas.filas).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// La pestaña «Asistencia por persona»
// ---------------------------------------------------------------------------

describe('las filas de la pestaña por persona', () => {
  const de = (sesion: string, nombre: string, registro: string | null, extra: Partial<FilaDeAsistencia> = {}): FilaDeAsistencia => ({
    id: `${sesion}-${nombre}`, sesion, via: 'presencial', registro_id: registro, nombre,
    correo: `${nombre.toLowerCase().replace(/\s/g, '.')}@x.org`, perfil: registro ? 'publico_general' : null, folio: null,
    creada_en: '2026-11-12T20:00:00Z', estado_registro: registro ? 'confirmado' : null, ...extra,
  });

  it('lleva lo de la tabla «Personas» del panel —nombre, correo, perfil, un día por columna, total— y «Con registro» al final', () => {
    expect(HOJA_PERSONAS).toBe('Asistencia por persona');
    expect([...ENCABEZADOS_PERSONAS]).toEqual([
      'N.º', 'Nombre', 'Correo', 'Perfil', 'Miércoles 11', 'Jueves 12', 'Viernes 13', 'Total', 'Con registro',
    ]);
  });

  it('una fila por persona, con 1 o 0 en cada día, el total y si tenía registro (como en el panel)', () => {
    const filas = filasDePersonas([
      de('miercoles', 'Silvana Costa', 'r1'), de('jueves', 'Silvana Costa', 'r1'), de('viernes', 'Silvana Costa', 'r1'),
      de('jueves', 'Luis Pérez', 'r2'),
    ]);
    expect(filas).toEqual([
      [1, 'Silvana Costa', 'silvana.costa@x.org', 'publico_general', 1, 1, 1, 3, 'Sí'],
      [2, 'Luis Pérez', 'luis.pérez@x.org', 'publico_general', 0, 1, 0, 1, 'Sí'],
    ]);
    // Cada fila trae una celda por título.
    expect(filas.every((f) => f.length === ENCABEZADOS_PERSONAS.length)).toBe(true);
  });

  it('el perfil sale como se lee, no como se guarda, si se da cómo nombrarlo; sin registro no tiene perfil', () => {
    const nombre = (clave: string) => ({ publico_general: 'Público general' })[clave] ?? clave;
    const filas = filasDePersonas([de('jueves', 'Ana Ruiz', 'r1'), de('jueves', 'Pedro Soto', null)], nombre);
    expect(filas[0][3]).toBe('Público general');
    expect(filas[1][3]).toBe('');
  });

  it('quien asistió sin estar registrado sale con «No»: no recibe constancia', () => {
    const filas = filasDePersonas([de('jueves', 'Ana Ruiz', 'r1'), de('jueves', 'Pedro Soto', null)]);
    expect(filas.map((f) => f.at(-1))).toEqual(['Sí', 'No']);
  });

  it('un registro cancelado después de asistir sigue ligado, pero se dice «No (cancelado)»', () => {
    const cancelada = de('jueves', 'Carla Baja', 'r9', { estado_registro: 'cancelado' });
    expect(filasDePersonas([cancelada]).at(0)?.at(-1)).toBe('No (cancelado)');
    // Un registro en espera o aún en proceso sí cuenta como registro.
    for (const estado of ['en_proceso', 'lista_espera', 'confirmado']) {
      expect(filasDePersonas([de('jueves', 'Ana Ruiz', 'r1', { estado_registro: estado })]).at(0)?.at(-1), estado).toBe('Sí');
    }
    expect(textoDeRegistro({ sinRegistro: false, estadoDelRegistro: null })).toBe('Sí');
  });

  it('quien está sin registro se junta por su correo: dos escaneos suyos son una fila, aunque los nombres difieran', () => {
    const filas = filasDePersonas([
      de('miercoles', 'Pedro Soto', null, { correo: 'pedro@x.org' }),
      de('viernes', 'Pedro S.', null, { correo: 'PEDRO@x.org' }),
    ]);
    expect(filas).toHaveLength(1);
    expect(filas[0].slice(4)).toEqual([1, 0, 1, 2, 'No']);
  });

  it('va en orden de llegada, no por nombre ni por total: quien suma un día después no cambia de lugar', () => {
    const antes = filasDePersonas([de('miercoles', 'Zoe Zárate', 'r1'), de('miercoles', 'Ana Ruiz', 'r2')]);
    expect(antes.map((f) => f[1])).toEqual(['Zoe Zárate', 'Ana Ruiz']);
    // Ana suma dos días y Zoe uno: en el panel Ana iría primero; en la hoja, no se mueve nadie.
    const despues = filasDePersonas([
      de('miercoles', 'Zoe Zárate', 'r1'), de('miercoles', 'Ana Ruiz', 'r2'),
      de('jueves', 'Ana Ruiz', 'r2'), de('viernes', 'Ana Ruiz', 'r2'),
    ]);
    expect(despues.map((f) => f[1])).toEqual(['Zoe Zárate', 'Ana Ruiz']);
    expect(despues.map((f) => f[0])).toEqual([1, 2]);
  });

  it('la sesión de prueba no cuenta: quien sólo hizo la prueba no tiene fila', () => {
    expect(filasDePersonas([de('prueba', 'Ana Ruiz', 'r1')])).toEqual([]);
    expect(filasDePersonas([de('prueba', 'Ana Ruiz', 'r1'), de('jueves', 'Ana Ruiz', 'r1')])[0].slice(4)).toEqual([0, 1, 0, 1, 'Sí']);
  });
});

describe('la pestaña por persona en la hoja', () => {
  const registrada = (sesion: string, nombre: string, correo: string, extra: Record<string, unknown> = {}) =>
    una(sesion, 'presencial', nombre, correo, { registro_id: `r-${correo}`, perfil: 'publico_general', estado_registro: 'confirmado', ...extra });

  it('sin asistencias no se crea: nace con la primera', async () => {
    const r = await sincronizarAsistenciaPorPersona();
    expect(r).toEqual({ nuevas: 0, cambiadas: 0, quitadas: 0 });
    expect(personas.existe).toBe(false);
  });

  it('se crea detrás de «Resumen Registro», con sus títulos, y escribe una fila por persona; «Asistencias» no se toca', async () => {
    asistencias = [
      registrada('miercoles', 'Silvana Costa', 'silvana@x.org'), registrada('jueves', 'Silvana Costa', 'silvana@x.org'),
      una('jueves', 'presencial', 'Pedro Soto', 'pedro@x.org'),
    ];
    const r = await sincronizarAsistenciaPorPersona();
    expect(r.nuevas).toBe(2);
    expect(personas.existe).toBe(true);
    expect(personas.creadaEn).toBe(2); // justo después de «Resumen Registro», que es la segunda
    expect(personas.encabezados).toEqual([...ENCABEZADOS_PERSONAS]);
    expect(personas.filas).toEqual([
      [1, 'Silvana Costa', 'silvana@x.org', 'Público general', 1, 1, 0, 2, 'Sí'],
      [2, 'Pedro Soto', 'pedro@x.org', '', 0, 1, 0, 1, 'No'],
    ]);
    // Texto tal cual, sin interpretar: un nombre que empiece por «=» no se vuelve fórmula.
    expect(personas.escrituras[0].valueInputOption).toBe('RAW');
    expect(hoja.existe).toBe(false);
    expect(hoja.escrituras).toEqual([]);
  });

  it('repetir no escribe nada: ya está al día', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org')];
    await sincronizarAsistenciaPorPersona();
    personas.escrituras = [];
    const r = await sincronizarAsistenciaPorPersona();
    expect(r).toMatchObject({ nuevas: 0, cambiadas: 0, quitadas: 0 });
    expect(personas.escrituras).toEqual([]);
  });

  it('quien llega después se añade al final, sin reescribir las filas de antes', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org')];
    await sincronizarAsistenciaPorPersona();
    personas.escrituras = [];
    asistencias.push(registrada('jueves', 'Luis Pérez', 'luis@x.org'), registrada('viernes', 'Eva Mora', 'eva@x.org'));
    const r = await sincronizarAsistenciaPorPersona();
    expect(r.nuevas).toBe(2);
    expect(personas.escrituras).toHaveLength(1);
    expect(personas.escrituras[0].range).toMatch(/!A3:I4$/); // la 2 ya estaba ocupada
    expect(personas.filas.map((f) => f[0])).toEqual([1, 2, 3]);
  });

  it('quien suma un día se corrige en su fila, y las de antes no se tocan', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org'), registrada('jueves', 'Luis Pérez', 'luis@x.org')];
    await sincronizarAsistenciaPorPersona();
    personas.escrituras = [];
    asistencias.push(registrada('viernes', 'Luis Pérez', 'luis@x.org'));
    const r = await sincronizarAsistenciaPorPersona();
    expect(r).toMatchObject({ nuevas: 0, cambiadas: 1, quitadas: 0 });
    expect(personas.escrituras).toHaveLength(1);
    expect(personas.escrituras[0].range).toMatch(/!A3:I3$/); // sólo la fila de Luis
    expect(personas.filas[1].slice(4)).toEqual([0, 1, 1, 2, 'Sí']);
    expect(personas.filas[0].slice(4)).toEqual([0, 1, 0, 1, 'Sí']);
  });

  it('lo que el comité concilia pasa a «Sí» en su fila', async () => {
    asistencias = [una('jueves', 'presencial', 'Pedro (typo)', 'pedro@typo.org'), registrada('jueves', 'Luis Pérez', 'luis@x.org')];
    await sincronizarAsistenciaPorPersona();
    expect(personas.filas[0].at(-1)).toBe('No');
    asistencias[0] = registrada('jueves', 'Pedro Ramírez Soto', 'pedro@ok.org', { id: asistencias[0].id });
    const r = await sincronizarAsistenciaPorPersona();
    expect(r.cambiadas).toBe(2);
    expect(personas.filas[0]).toEqual([1, 'Pedro Ramírez Soto', 'pedro@ok.org', 'Público general', 0, 1, 0, 1, 'Sí']);
  });

  it('una fila que se fusiona con otra (se concilió a quien ya tenía asistencia) no deja hueco: sobra una al final y se vacía', async () => {
    asistencias = [
      registrada('miercoles', 'Ana Ruiz', 'ana@x.org'),
      una('jueves', 'presencial', 'Ana R.', 'ana@typo.org'),
      registrada('jueves', 'Luis Pérez', 'luis@x.org'),
    ];
    await sincronizarAsistenciaPorPersona();
    expect(personas.filas).toHaveLength(3);
    asistencias[1] = registrada('jueves', 'Ana Ruiz', 'ana@x.org', { id: asistencias[1].id });
    const r = await sincronizarAsistenciaPorPersona();
    expect(r.quitadas).toBe(1);
    expect(personas.filas.map((f) => [f[0], f[1], f[7]])).toEqual([[1, 'Ana Ruiz', 2], [2, 'Luis Pérez', 1]]);
    expect(personas.limpiezas.at(-1)).toMatch(/!A4:I4$/);
  });

  it('no escribe fuera de sus nueve columnas: lo que se genere o anote a la derecha no se pisa', async () => {
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org'), registrada('jueves', 'Dos', 'dos@x.org')];
    await sincronizarAsistenciaPorPersona();
    asistencias.push(registrada('miercoles', 'Tres', 'tres@x.org'), registrada('viernes', 'Dos', 'dos@x.org'));
    await sincronizarAsistenciaPorPersona();
    for (const e of personas.escrituras) expect(e.range).toMatch(/![A]\d+:I\d+$/);
    // Lo que alguien puso en la columna J no cambia el plan: no se mira.
    expect(planDeHoja([[1, 'A', 'a@x.org']], [[1, 'A', 'a@x.org', 'constancia.pdf']], 3).escribir).toEqual([]);
  });

  it('si la base se vació y la pestaña no, no la toca; con --forzar sí', async () => {
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org')];
    await sincronizarAsistenciaPorPersona();
    asistencias = [];
    const r = await sincronizarAsistenciaPorPersona();
    expect(r.omitido).toMatch(/Asistencia por persona.*--forzar/);
    expect(personas.filas).toHaveLength(1);
    const forzada = await sincronizarAsistenciaPorPersona({ forzar: true });
    expect(forzada.omitido).toBeUndefined();
    expect(personas.filas).toHaveLength(0);
  });

  it('si la pestaña tiene muchas más filas que la base, se detiene y lo dice', async () => {
    asistencias = Array.from({ length: 15 }, (_, i) => registrada('jueves', `P${i}`, `p${i}@x.org`));
    await sincronizarAsistenciaPorPersona();
    asistencias = asistencias.slice(0, 3);
    const r = await sincronizarAsistenciaPorPersona();
    expect(r.omitido).toMatch(/12 filas más/);
    expect(personas.filas).toHaveLength(15);
  });

  it('con cientos de personas amplía la cuadrícula antes de escribir', async () => {
    asistencias = Array.from({ length: 1500 }, (_, i) => registrada('jueves', `Persona ${i}`, `p${i}@x.org`));
    await sincronizarAsistenciaPorPersona();
    expect(personas.filas).toHaveLength(1500);
    expect(personas.ampliaciones).toHaveLength(1);
    expect(personas.filas[1499][0]).toBe(1500);
  });

  it('si alguien cambió los títulos, se dejan los de siempre', async () => {
    personas.existe = true;
    personas.encabezados = ['Nombre', 'Correo'];
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org')];
    await sincronizarAsistenciaPorPersona();
    expect(personas.encabezados).toEqual([...ENCABEZADOS_PERSONAS]);
  });

  it('simular dice lo que haría sin tocar nada', async () => {
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org')];
    const r = await sincronizarAsistenciaPorPersona({ simular: true });
    expect(r).toMatchObject({ nuevas: 1, simulado: true });
    expect(personas.existe).toBe(false);
  });

  it('al lado de «Asistencias», cada pestaña escribe en la suya y con sus columnas', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org'), registrada('viernes', 'Ana Ruiz', 'ana@x.org')];
    const r = await sincronizarLasPestanas();
    expect(r).toMatchObject({ nuevas: 3, cambiadas: 0, quitadas: 0 });
    expect(r.pestanas.asistencias.nuevas).toBe(2); // dos asistencias…
    expect(r.pestanas.personas.nuevas).toBe(1); // …de una persona
    expect(hoja.filas).toHaveLength(2);
    expect(hoja.encabezados).toEqual([...ENCABEZADOS_ASISTENCIAS]);
    expect(personas.filas).toEqual([[1, 'Ana Ruiz', 'ana@x.org', 'Público general', 0, 1, 1, 2, 'Sí']]);
    for (const e of hoja.escrituras) expect(e.range).toMatch(/^Asistencias!A\d+:E\d+$/);
    for (const e of personas.escrituras) expect(e.range).toMatch(/^'Asistencia por persona'!A\d+:I\d+$/);
  });

  it('si una pestaña falla, la otra se pone al día igual y el error se dice', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org')];
    hoja.fallaPropia = 'The caller does not have permission';
    await expect(sincronizarLasPestanas()).rejects.toThrow(/permission/);
    expect(hoja.filas).toHaveLength(0);
    expect(personas.filas).toHaveLength(1);

    hoja.fallaPropia = null;
    personas.fallaPropia = 'Quota exceeded';
    asistencias.push(registrada('viernes', 'Luis Pérez', 'luis@x.org'));
    await expect(sincronizarLasPestanas()).rejects.toThrow(/Quota/);
    expect(hoja.filas).toHaveLength(2); // la de detalle sí avanzó
    expect(personas.filas).toHaveLength(1);
  });

  it('lo que la pasada omite por prudencia se suma al aviso del panel, con el nombre de la pestaña', async () => {
    asistencias = Array.from({ length: 15 }, (_, i) => registrada('jueves', `P${i}`, `p${i}@x.org`));
    await sincronizarLasPestanas();
    asistencias = asistencias.slice(0, 3);
    const r = await sincronizarLasPestanas();
    expect(r.omitido).toMatch(/«Asistencias» tiene 12 filas más/);
    expect(r.omitido).toMatch(/«Asistencia por persona» tiene 12 filas más/);
  });
});

describe('la pestaña del diseño anterior (una asistencia por mesa, con su columna «Mesa»)', () => {
  const anteriores = ['N.º', 'Nombre', 'Correo', 'Día', 'Mesa', 'Modalidad'];

  it('se rehace con las columnas de ahora, sin dejar nada de la columna «Mesa»', async () => {
    hoja.existe = true;
    hoja.encabezados = [...anteriores];
    hoja.filas = [
      [1, 'María Robles', 'maria@ejemplo.org', 'Jueves 12 de noviembre', 'Mesa 4 · Envejecimiento', 'Presencial'],
      [2, 'Luis Pérez', 'luis@ejemplo.org', 'Jueves 12 de noviembre', 'Mesa 3 · Pensiones', 'En línea'],
    ];
    asistencias = [
      una('jueves', 'presencial', 'María Robles', 'maria@ejemplo.org'),
      una('jueves', 'en_linea', 'Luis Pérez', 'luis@ejemplo.org'),
    ];
    await sincronizarAsistencias();
    expect(hoja.encabezados).toEqual(['N.º', 'Nombre', 'Correo', 'Día', 'Modalidad']);
    expect(hoja.filas).toEqual([
      [1, 'María Robles', 'maria@ejemplo.org', 'Jueves 12 de noviembre', 'Presencial'],
      [2, 'Luis Pérez', 'luis@ejemplo.org', 'Jueves 12 de noviembre', 'En línea'],
    ]);
    expect(hoja.filas.every((f) => f.length === 5)).toBe(true);
  });

  it('una pasada siguiente ya no la rehace', async () => {
    hoja.existe = true;
    hoja.encabezados = [...anteriores];
    asistencias = [una('jueves', 'presencial', 'Uno', 'uno@x.org')];
    await sincronizarAsistencias();
    hoja.limpiezas = [];
    hoja.escrituras = [];
    await sincronizarAsistencias();
    expect(hoja.limpiezas).toEqual([]);
    expect(hoja.escrituras).toEqual([]);
  });

  it('si la base no tiene asistencias no la toca: lo que hay en la hoja podría ser lo único que queda', async () => {
    hoja.existe = true;
    hoja.encabezados = [...anteriores];
    hoja.filas = [[1, 'María Robles', 'maria@ejemplo.org', 'Jueves 12 de noviembre', 'Mesa 4', 'Presencial']];
    asistencias = [];
    const r = await sincronizarAsistencias();
    expect(r.omitido).toMatch(/--forzar/);
    expect(hoja.filas).toHaveLength(1);
    expect(hoja.encabezados).toEqual(anteriores);
  });
});
