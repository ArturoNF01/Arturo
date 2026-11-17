import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COLUMNA_CON_REGISTRO, ENCABEZADOS_DE_LA_HOJA_RETIRADA, ENCABEZADOS_PERSONAS, HOJA_PERSONAS, HOJA_RETIRADA,
  conRegistro, filasDePersonas, planDeHoja, type FilaDeAsistencia, type FilaDeHoja,
} from '@/lib/asistencia';
import { SEPARADOR_DE_PONENCIAS } from '@/lib/ponentes';
import { MESAS } from '@/lib/programa';

/** Los títulos del programa en los que figura un autor, tal como están en el programa. */
const titulosDe = (autor: string) => MESAS.flatMap((m) => m.ponencias).filter((p) => p.autores.includes(autor)).map((p) => p.titulo);

/**
 * La pestaña «Asistencia por persona» de la hoja de Google: nombre, correo, perfil, un día por columna, el total,
 * «Con registro» como casilla de verificación y la «Ponencia» de los ponentes. Se llena por lotes, no al escanear, y es copia de la base. Aquí se ve con una
 * hoja simulada con memoria lo que de verdad queda en cada fila, y cómo se retira la pestaña «Asistencias» del diseño anterior.
 */

const de = (sesion: string, nombre: string, registro: string | null, extra: Partial<FilaDeAsistencia> = {}): FilaDeAsistencia => ({
  id: `${sesion}-${nombre}`, sesion, via: 'presencial', registro_id: registro, nombre,
  correo: `${nombre.toLowerCase().replace(/\s/g, '.')}@x.org`, perfil: registro ? 'publico_general' : null, folio: null,
  creada_en: '2026-11-12T20:00:00Z', estado_registro: registro ? 'confirmado' : null, ...extra,
});

describe('las filas de la pestaña', () => {
  it('lleva lo de la tabla «Por persona» del panel —nombre, correo, perfil, un día por columna, total— y «Con registro» al final', () => {
    expect(HOJA_PERSONAS).toBe('Asistencia por persona');
    expect([...ENCABEZADOS_PERSONAS]).toEqual([
      'N.º', 'Nombre', 'Correo', 'Perfil', 'Miércoles 11', 'Jueves 12', 'Viernes 13', 'Total', 'Con registro', 'Ponencia',
    ]);
    // La columna I: la que se muestra con casillas de verificación.
    expect(COLUMNA_CON_REGISTRO).toBe(8);
    expect(ENCABEZADOS_PERSONAS[COLUMNA_CON_REGISTRO]).toBe('Con registro');
    // Y la nueva, «Ponencia», a su derecha: lo de antes no cambia de letra.
    expect(ENCABEZADOS_PERSONAS[COLUMNA_CON_REGISTRO + 1]).toBe('Ponencia');
    expect(ENCABEZADOS_PERSONAS).toHaveLength(10);
  });

  it('una fila por persona, con 1 o 0 en cada día, el total y la casilla de si tenía registro (como en el panel)', () => {
    const filas = filasDePersonas([
      de('miercoles', 'Silvana Costa', 'r1'), de('jueves', 'Silvana Costa', 'r1'), de('viernes', 'Silvana Costa', 'r1'),
      de('jueves', 'Luis Pérez', 'r2'),
    ]);
    expect(filas).toEqual([
      [1, 'Silvana Costa', 'silvana.costa@x.org', 'publico_general', 1, 1, 1, 3, true, ''],
      [2, 'Luis Pérez', 'luis.pérez@x.org', 'publico_general', 0, 1, 0, 1, true, ''],
    ]);
    // Cada fila trae una celda por título.
    expect(filas.every((f) => f.length === ENCABEZADOS_PERSONAS.length)).toBe(true);
  });

  it('«Con registro» es un valor lógico, no un texto: es lo que la casilla muestra marcado o vacío', () => {
    const filas = filasDePersonas([de('jueves', 'Ana Ruiz', 'r1'), de('jueves', 'Pedro Soto', null)]);
    expect(filas.map((f) => f[COLUMNA_CON_REGISTRO])).toEqual([true, false]);
    expect(filas.map((f) => typeof f[COLUMNA_CON_REGISTRO])).toEqual(['boolean', 'boolean']);
  });

  it('el perfil sale como se lee, no como se guarda, si se da cómo nombrarlo; sin registro no tiene perfil', () => {
    const nombre = (clave: string) => ({ publico_general: 'Público general' })[clave] ?? clave;
    const filas = filasDePersonas([de('jueves', 'Ana Ruiz', 'r1'), de('jueves', 'Pedro Soto', null)], nombre);
    expect(filas[0][3]).toBe('Público general');
    expect(filas[1][3]).toBe('');
  });

  it('quien asistió sin estar registrado queda sin marcar: no recibe constancia', () => {
    expect(conRegistro({ sinRegistro: true, estadoDelRegistro: null })).toBe(false);
  });

  it('un registro cancelado después de asistir sigue ligado, pero no vale: sin marcar; en espera o en proceso sí es registro', () => {
    expect(filasDePersonas([de('jueves', 'Carla Baja', 'r9', { estado_registro: 'cancelado' })])[0][COLUMNA_CON_REGISTRO]).toBe(false);
    for (const estado of ['en_proceso', 'lista_espera', 'confirmado']) {
      expect(filasDePersonas([de('jueves', 'Ana Ruiz', 'r1', { estado_registro: estado })])[0][COLUMNA_CON_REGISTRO], estado).toBe(true);
    }
    // Si no se sabe el estado pero está ligada a un registro, cuenta.
    expect(conRegistro({ sinRegistro: false, estadoDelRegistro: null })).toBe(true);
  });

  it('quien está sin registro se junta por su correo: dos escaneos suyos son una fila, aunque los nombres difieran', () => {
    const filas = filasDePersonas([
      de('miercoles', 'Pedro Soto', null, { correo: 'pedro@x.org' }),
      de('viernes', 'Pedro S.', null, { correo: 'PEDRO@x.org' }),
    ]);
    expect(filas).toHaveLength(1);
    expect(filas[0].slice(4)).toEqual([1, 0, 1, 2, false, '']);
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

  it('la «Ponencia» es la última celda y sale de lo que se dé para cada nombre; sin nada que dar, queda en blanco', () => {
    const ponencia = (nombre: string) => (nombre === 'Ana Ruiz' ? 'Título de Ana' : '');
    const filas = filasDePersonas([de('jueves', 'Ana Ruiz', 'r1'), de('jueves', 'Luis Pérez', 'r2')], undefined, ponencia);
    expect(filas.map((f) => f.at(-1))).toEqual(['Título de Ana', '']);
    expect(filas.every((f) => f.length === ENCABEZADOS_PERSONAS.length)).toBe(true);
  });

  it('la sesión de prueba no cuenta: quien sólo hizo la prueba no tiene fila', () => {
    expect(filasDePersonas([de('prueba', 'Ana Ruiz', 'r1')])).toEqual([]);
    expect(filasDePersonas([de('prueba', 'Ana Ruiz', 'r1'), de('jueves', 'Ana Ruiz', 'r1')])[0].slice(4)).toEqual([0, 1, 0, 1, true, '']);
  });
});

describe('qué hay que escribir en la hoja', () => {
  const f = (n: number, nombre = `P${n}`, registro = true, ponencia = ''): FilaDeHoja => [n, nombre, `p${n}@x.org`, 'Público general', 0, 1, 0, 1, registro, ponencia];

  it('una hoja igual a la base no necesita nada', () => {
    const p = planDeHoja([f(1), f(2)], [f(1), f(2)]);
    expect(p).toMatchObject({ escribir: [], sobran: 0, cambian: 0, nuevas: 0 });
  });

  it('las filas nuevas se añaden al final, sin reescribir las anteriores', () => {
    const p = planDeHoja([f(1), f(2), f(3), f(4)], [f(1), f(2)]);
    expect(p.desde).toBe(2);
    expect(p.escribir).toEqual([f(3), f(4)]);
    expect(p).toMatchObject({ nuevas: 2, cambian: 0, sobran: 0 });
  });

  it('en una hoja vacía se escribe todo', () => {
    const p = planDeHoja([f(1), f(2)], []);
    expect(p).toMatchObject({ desde: 0, nuevas: 2, cambian: 0 });
  });

  it('una fila que cambió (se concilió) se reescribe desde ahí', () => {
    const p = planDeHoja([f(1), f(2, 'Nombre Correcto'), f(3)], [f(1), f(2), f(3)]);
    expect(p.desde).toBe(1);
    expect(p.escribir).toEqual([f(2, 'Nombre Correcto'), f(3)]);
    expect(p).toMatchObject({ cambian: 2, nuevas: 0, sobran: 0 });
  });

  it('si se quitó una fila, se corrige desde ahí y sobra una al final', () => {
    const p = planDeHoja([f(1), f(2, 'P3'), f(3, 'P4')].map((x, i) => [i + 1, ...x.slice(1)]), [f(1), f(2), f(3), f(4)]);
    expect(p.desde).toBe(1);
    expect(p.sobran).toBe(1);
  });

  it('compara como texto: lo que la hoja devuelve como «1», «TRUE» o «FALSE» no es un cambio', () => {
    const enLaHoja = ['1', 'P1', 'p1@x.org', 'Público general', '0', '1', '0', '1', 'TRUE'];
    expect(planDeHoja([f(1)], [enLaHoja]).escribir).toEqual([]);
    expect(planDeHoja([f(1, 'P1', false)], [[...enLaHoja.slice(0, 8), 'FALSE']]).escribir).toEqual([]);
  });

  it('una casilla que alguien cambió a mano se corrige: la base manda', () => {
    const p = planDeHoja([f(1, 'P1', true)], [[...f(1).slice(0, 8), 'FALSE']]);
    expect(p.escribir).toEqual([f(1, 'P1', true)]);
    expect(p.cambian).toBe(1);
  });

  it('un «Sí» o «No» de la versión anterior de la hoja es un cambio: se reescribe como casilla', () => {
    expect(planDeHoja([f(1)], [[...f(1).slice(0, 8), 'Sí']]).escribir).toEqual([f(1)]);
    expect(planDeHoja([f(1, 'P1', false)], [[...f(1).slice(0, 8), 'No']]).escribir).toEqual([f(1, 'P1', false)]);
  });

  it('una ponencia que se añade a una fila que no la tenía es un cambio; una hoja de nueve columnas no la trae y cuenta como vacía', () => {
    expect(planDeHoja([f(1, 'P1', true, 'Título')], [f(1)]).escribir).toEqual([f(1, 'P1', true, 'Título')]);
    // La pestaña de antes no tenía la columna: una fila sin la décima celda es igual a una con la celda en blanco.
    expect(planDeHoja([f(1)], [f(1).slice(0, 9)]).escribir).toEqual([]);
  });

  it('no mira lo que alguien haya anotado a la derecha de las diez columnas', () => {
    expect(planDeHoja([f(1)], [[...f(1), 'constancia.pdf']]).escribir).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Con una hoja simulada
// ---------------------------------------------------------------------------

type Celda = string | number | boolean;

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
  /** Las casillas de verificación que se pidieron (filas de la API, desde 0, sin incluir `hasta`) y las que se quitaron. */
  casillas: { desde: number; hasta: number; columna: number }[];
  casillasQuitadas: { desde: number; hasta: number; columna: number }[];
  /** Si es verdadero, Google rechaza las escrituras de esta pestaña y de ninguna otra. */
  fallaPropia: string | null;
}
const pestanaNueva = (titulo: string, sheetId: number): PestanaSimulada => ({
  titulo, sheetId, existe: false, encabezados: [], filas: [], indice: undefined, escrituras: [], limpiezas: [],
  creadaEn: undefined, cuadricula: 1000, ampliaciones: [], casillas: [], casillasQuitadas: [], fallaPropia: null,
});

/** La pestaña «Asistencias» del diseño anterior: la que se retira. */
const vieja = pestanaNueva('Asistencias', 7);
/** La pestaña «Asistencia por persona». */
const personas = pestanaNueva('Asistencia por persona', 8);
const pestanasSimuladas = [vieja, personas];

const hoja = {
  configurado: true,
  /** Si es verdadero, Google rechaza las escrituras de todas las pestañas (un permiso quitado, la hoja borrada…). */
  falla: null as string | null,
  /** Si es verdadero, Google no deja quitar una pestaña. */
  fallaAlBorrar: null as string | null,
  /** Si es verdadero, Google rechaza poner las casillas de verificación (pero no los valores). */
  fallaAlValidar: null as string | null,
  /** Lo que pasó, en orden: «casillas 1-3», «valores A2:J3», «crear», «borrar Asistencias»… */
  eventos: [] as string[],
  /** Cuántas veces se leyeron los títulos de la pestaña vieja (para ver que no se mira si no está). */
  lecturasDeLaVieja: 0,
};

/** La pestaña a la que apunta un rango de Google: con nombre entre comillas, la de personas; sin ellas, la vieja. */
const pestanaDeRango = (rango: string) => pestanasSimuladas.find((p) => rango.startsWith(`'${p.titulo}'!`)) ?? vieja;
const fallaDe = (p: PestanaSimulada) => hoja.falla ?? p.fallaPropia;
/** Lo que devuelve Google al leer sin pedir otro formato: todo como texto («1», «TRUE»). */
const comoLoLeeGoogle = (valor: Celda) => (valor === true ? 'TRUE' : valor === false ? 'FALSE' : String(valor));

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
            hoja.eventos.push(`crear ${nueva.titulo}`);
            return { addSheet: { properties: { sheetId: nueva.sheetId, gridProperties: { rowCount: nueva.cuadricula } } } };
          }
          const borrar = r.deleteSheet as { sheetId: number } | undefined;
          if (borrar) {
            if (hoja.fallaAlBorrar) throw new Error(hoja.fallaAlBorrar);
            const destino = pestanasSimuladas.find((x) => x.sheetId === borrar.sheetId)!;
            destino.existe = false; destino.encabezados = []; destino.filas = [];
            hoja.eventos.push(`borrar ${destino.titulo}`);
            return {};
          }
          const insertar = r.insertDimension as
            { range: { sheetId: number; dimension: string; startIndex: number; endIndex: number }; inheritFromBefore?: boolean } | undefined;
          if (insertar) {
            const destino = pestanasSimuladas.find((x) => x.sheetId === insertar.range.sheetId)!;
            if (fallaDe(destino)) throw new Error(fallaDe(destino)!);
            expect(insertar.range.dimension).toBe('COLUMNS');
            const donde = insertar.range.startIndex;
            const cuantas = insertar.range.endIndex - insertar.range.startIndex;
            const hueco = Array.from({ length: cuantas }, () => '' as Celda);
            // Lo que había desde esa columna se recorre a la derecha, títulos y datos; la nueva queda en blanco.
            if (destino.encabezados.length > donde) destino.encabezados = [...destino.encabezados.slice(0, donde), ...hueco, ...destino.encabezados.slice(donde)];
            destino.filas = destino.filas.map((fila) => (fila.length > donde ? [...fila.slice(0, donde), ...hueco, ...fila.slice(donde)] : fila));
            hoja.eventos.push(`insertar columna ${donde}`);
            return {};
          }
          const ampliar = r.appendDimension as { sheetId: number; dimension: string; length: number } | undefined;
          if (ampliar) {
            const destino = pestanasSimuladas.find((x) => x.sheetId === ampliar.sheetId)!;
            if (fallaDe(destino)) throw new Error(fallaDe(destino)!);
            destino.cuadricula += ampliar.length;
            destino.ampliaciones.push(ampliar.length);
            return {};
          }
          const validar = r.setDataValidation as {
            range: { sheetId: number; startRowIndex: number; endRowIndex: number; startColumnIndex: number };
            rule?: { condition: { type: string }; strict: boolean };
          } | undefined;
          if (validar) {
            const destino = pestanasSimuladas.find((x) => x.sheetId === validar.range.sheetId)!;
            if (fallaDe(destino)) throw new Error(fallaDe(destino)!);
            const rango = { desde: validar.range.startRowIndex, hasta: validar.range.endRowIndex, columna: validar.range.startColumnIndex };
            if (validar.rule) {
              if (hoja.fallaAlValidar) throw new Error(hoja.fallaAlValidar);
              // Una validación «booleana» estricta es lo que Sheets muestra como casilla de verificación.
              expect(validar.rule).toEqual({ condition: { type: 'BOOLEAN' }, strict: true });
              destino.casillas.push(rango);
              hoja.eventos.push(`casillas ${rango.desde}-${rango.hasta}`);
            } else {
              destino.casillasQuitadas.push(rango);
              hoja.eventos.push(`sin casillas ${rango.desde}-${rango.hasta}`);
            }
            return {};
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
          if (destino === vieja) hoja.lecturasDeLaVieja += 1;
          // Los títulos (fila 1) y los datos (desde la 2) son lecturas distintas.
          if (/A1:[A-Z]1$/.test(p.range)) {
            return { data: { values: destino.encabezados.length > 0 ? [destino.encabezados.map(comoLoLeeGoogle)] : undefined } };
          }
          return { data: { values: destino.filas.map((f) => f.map(comoLoLeeGoogle)) } };
        },
        update: async (p: { range: string; valueInputOption: string; requestBody: { values: Celda[][] } }) => {
          const destino = pestanaDeRango(p.range);
          // Como Google: se sobrescriben las celdas que se escriben y las de más a la derecha se quedan como estaban.
          const encima = <T,>(nuevas: T[], que: T[]) => [...nuevas, ...que.slice(nuevas.length)];
          if (/!A1$/.test(p.range)) {
            destino.encabezados = encima(p.requestBody.values[0], destino.encabezados);
            return { data: {} };
          }
          if (fallaDe(destino)) throw new Error(fallaDe(destino)!);
          const primera = filaInicial(p.range); // fila de Google: la 2 es la primera de datos
          const ultima = Number(/:[A-Z](\d+)$/.exec(p.range)?.[1]);
          // Lo que hace Google: no escribe fuera de la cuadrícula.
          if (ultima > destino.cuadricula) throw new Error(`Range (${p.range}) exceeds grid limits. Max rows: ${destino.cuadricula}`);
          p.requestBody.values.forEach((valores, i) => { destino.filas[primera - 2 + i] = encima(valores, destino.filas[primera - 2 + i] ?? []); });
          destino.escrituras.push({ range: p.range, valueInputOption: p.valueInputOption, filas: p.requestBody.values });
          hoja.eventos.push(`valores ${p.range.split('!')[1]}`);
          return { data: {} };
        },
        clear: async (p: { range: string }) => {
          const destino = pestanaDeRango(p.range);
          destino.limpiezas.push(p.range);
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
  ESPERA_AUTOMATICA_MS, estadoDeLaHoja, pedirSincronizacionDeAsistencias, sincronizarAsistencias, sincronizarYAnotar,
} = await import('@/lib/servidor/sheets-asistencia');

beforeEach(() => {
  process.env.GOOGLE_SHEETS_ID = 'libro-de-prueba';
  for (const p of pestanasSimuladas) {
    p.existe = false; p.encabezados = []; p.filas = []; p.indice = undefined;
    p.escrituras = []; p.limpiezas = []; p.creadaEn = undefined;
    p.cuadricula = 1000; p.ampliaciones = []; p.casillas = []; p.casillasQuitadas = []; p.fallaPropia = null;
  }
  hoja.configurado = true; hoja.falla = null; hoja.fallaAlBorrar = null; hoja.fallaAlValidar = null; hoja.eventos = []; hoja.lecturasDeLaVieja = 0;
  asistencias = [];
});

const registrada = (sesion: string, nombre: string, correo: string, extra: Record<string, unknown> = {}) =>
  una(sesion, 'presencial', nombre, correo, { registro_id: `r-${correo}`, perfil: 'publico_general', estado_registro: 'confirmado', ...extra });

describe('sincronizar la pestaña con la base', () => {
  it('sin asistencias no crea la pestaña: nace con la primera', async () => {
    const r = await sincronizarAsistencias();
    expect(r).toEqual({ nuevas: 0, cambiadas: 0, quitadas: 0 });
    expect(personas.existe).toBe(false);
  });

  it('se crea detrás de «Resumen Registro», con sus títulos, y escribe una fila por persona', async () => {
    asistencias = [
      registrada('miercoles', 'Silvana Costa', 'silvana@x.org'), registrada('jueves', 'Silvana Costa', 'silvana@x.org'),
      una('jueves', 'presencial', 'Pedro Soto', 'pedro@x.org'),
    ];
    const r = await sincronizarAsistencias();
    expect(r).toMatchObject({ nuevas: 2, cambiadas: 0, quitadas: 0 });
    expect(personas.existe).toBe(true);
    expect(personas.creadaEn).toBe(2); // justo después de «Resumen Registro», que es la segunda
    expect(personas.encabezados).toEqual([...ENCABEZADOS_PERSONAS]);
    expect(personas.filas).toEqual([
      [1, 'Silvana Costa', 'silvana@x.org', 'Público general', 1, 1, 0, 2, true, ''],
      [2, 'Pedro Soto', 'pedro@x.org', '', 0, 1, 0, 1, false, ''],
    ]);
    // Texto tal cual, sin interpretar: un nombre que empiece por «=» no se vuelve fórmula.
    expect(personas.escrituras[0].valueInputOption).toBe('RAW');
  });

  it('repetir no escribe nada: ya está al día (y las casillas, que la hoja devuelve como «TRUE», no cuentan como cambio)', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org'), una('jueves', 'presencial', 'Pedro Soto', 'pedro@x.org')];
    await sincronizarAsistencias();
    personas.escrituras = []; personas.casillas = []; hoja.eventos = [];
    const r = await sincronizarAsistencias();
    expect(r).toMatchObject({ nuevas: 0, cambiadas: 0, quitadas: 0 });
    expect(personas.escrituras).toEqual([]);
    expect(personas.casillas).toEqual([]);
    expect(hoja.eventos).toEqual([]);
  });

  it('quien llega después se añade al final, empezando por la fila que toca, sin reescribir las de antes', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org')];
    await sincronizarAsistencias();
    personas.escrituras = [];
    asistencias.push(registrada('jueves', 'Luis Pérez', 'luis@x.org'), registrada('viernes', 'Eva Mora', 'eva@x.org'));
    const r = await sincronizarAsistencias();
    expect(r.nuevas).toBe(2);
    expect(personas.escrituras).toHaveLength(1);
    expect(personas.escrituras[0].range).toMatch(/!A3:J4$/); // la 2 ya estaba ocupada
    expect(personas.filas.map((f) => f[0])).toEqual([1, 2, 3]);
  });

  it('quien suma un día se corrige en su fila; las de antes no se tocan', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org'), registrada('jueves', 'Luis Pérez', 'luis@x.org')];
    await sincronizarAsistencias();
    personas.escrituras = [];
    asistencias.push(registrada('viernes', 'Luis Pérez', 'luis@x.org'));
    const r = await sincronizarAsistencias();
    expect(r).toMatchObject({ nuevas: 0, cambiadas: 1, quitadas: 0 });
    expect(personas.escrituras).toHaveLength(1);
    expect(personas.escrituras[0].range).toMatch(/!A3:J3$/); // sólo la fila de Luis
    expect(personas.filas[1].slice(4)).toEqual([0, 1, 1, 2, true, '']);
    expect(personas.filas[0].slice(4)).toEqual([0, 1, 0, 1, true, '']);
  });

  it('lo que el comité concilia pasa a casilla marcada en su fila', async () => {
    asistencias = [una('jueves', 'presencial', 'Pedro (typo)', 'pedro@typo.org'), registrada('jueves', 'Luis Pérez', 'luis@x.org')];
    await sincronizarAsistencias();
    expect(personas.filas[0][COLUMNA_CON_REGISTRO]).toBe(false);
    asistencias[0] = registrada('jueves', 'Pedro Ramírez Soto', 'pedro@ok.org', { id: asistencias[0].id });
    const r = await sincronizarAsistencias();
    expect(r.cambiadas).toBe(2);
    expect(personas.filas[0]).toEqual([1, 'Pedro Ramírez Soto', 'pedro@ok.org', 'Público general', 0, 1, 0, 1, true, '']);
  });

  it('una persona cuyo registro se cancela después de asistir queda sin marcar', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org')];
    await sincronizarAsistencias();
    expect(personas.filas[0][COLUMNA_CON_REGISTRO]).toBe(true);
    asistencias[0] = { ...asistencias[0], estado_registro: 'cancelado' };
    await sincronizarAsistencias();
    expect(personas.filas[0][COLUMNA_CON_REGISTRO]).toBe(false);
    asistencias[0] = { ...asistencias[0], estado_registro: 'en_proceso' }; // se reactiva en el panel
    await sincronizarAsistencias();
    expect(personas.filas[0][COLUMNA_CON_REGISTRO]).toBe(true);
  });

  it('una fila que se fusiona con otra (se concilió a quien ya tenía asistencia) no deja hueco: sobra una al final, sin valores ni casilla', async () => {
    asistencias = [
      registrada('miercoles', 'Ana Ruiz', 'ana@x.org'),
      una('jueves', 'presencial', 'Ana R.', 'ana@typo.org'),
      registrada('jueves', 'Luis Pérez', 'luis@x.org'),
    ];
    await sincronizarAsistencias();
    expect(personas.filas).toHaveLength(3);
    asistencias[1] = registrada('jueves', 'Ana Ruiz', 'ana@x.org', { id: asistencias[1].id });
    const r = await sincronizarAsistencias();
    expect(r.quitadas).toBe(1);
    expect(personas.filas.map((f) => [f[0], f[1], f[7]])).toEqual([[1, 'Ana Ruiz', 2], [2, 'Luis Pérez', 1]]);
    expect(personas.limpiezas.at(-1)).toMatch(/!A4:J4$/);
    // Ni queda una casilla vacía en la fila que ya no es de nadie (la fila 4 de la hoja es la 3 de la API).
    expect(personas.casillasQuitadas).toEqual([{ desde: 3, hasta: 4, columna: COLUMNA_CON_REGISTRO }]);
  });

  it('no escribe fuera de sus diez columnas: lo que se genere o anote a la derecha no se pisa', async () => {
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org'), registrada('jueves', 'Dos', 'dos@x.org')];
    await sincronizarAsistencias();
    asistencias.push(registrada('miercoles', 'Tres', 'tres@x.org'), registrada('viernes', 'Dos', 'dos@x.org'));
    await sincronizarAsistencias();
    for (const e of personas.escrituras) expect(e.range).toMatch(/^'Asistencia por persona'!A\d+:J\d+$/);
    for (const c of personas.casillas) expect(c.columna).toBe(8);
  });

  it('si la base se vació y la pestaña no, no la toca; con --forzar sí', async () => {
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org')];
    await sincronizarAsistencias();
    asistencias = [];
    const r = await sincronizarAsistencias();
    expect(r.omitido).toMatch(/Asistencia por persona.*--forzar/);
    expect(personas.filas).toHaveLength(1);
    const forzada = await sincronizarAsistencias({ forzar: true });
    expect(forzada.omitido).toBeUndefined();
    expect(personas.filas).toHaveLength(0);
  });

  it('si la pestaña tiene muchas más filas que la base, se detiene y lo dice', async () => {
    asistencias = Array.from({ length: 15 }, (_, i) => registrada('jueves', `P${i}`, `p${i}@x.org`));
    await sincronizarAsistencias();
    asistencias = asistencias.slice(0, 3);
    const r = await sincronizarAsistencias();
    expect(r.omitido).toMatch(/12 filas más/);
    expect(personas.filas).toHaveLength(15);
  });

  it('simular dice lo que haría sin tocar nada', async () => {
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org')];
    const r = await sincronizarAsistencias({ simular: true });
    expect(r).toMatchObject({ nuevas: 1, simulado: true });
    expect(personas.existe).toBe(false);
    expect(personas.escrituras).toEqual([]);
    expect(hoja.eventos).toEqual([]);
  });
});

describe('«Con registro» como casilla de verificación', () => {
  it('se escribe como valor lógico, y antes se piden las casillas de esas filas y sólo de esas', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org'), una('jueves', 'presencial', 'Pedro Soto', 'pedro@x.org')];
    await sincronizarAsistencias();
    // Las filas de datos son la 2 y la 3 de la hoja: la 1 y la 2 de la API. Nada de la columna entera.
    expect(personas.casillas).toEqual([{ desde: 1, hasta: 3, columna: COLUMNA_CON_REGISTRO }]);
    expect(personas.filas.map((f) => f[COLUMNA_CON_REGISTRO])).toEqual([true, false]);
    // Primero las casillas y después los valores: si falla a medias, la pasada siguiente lo repite todo junto.
    expect(hoja.eventos.indexOf('casillas 1-3')).toBeGreaterThanOrEqual(0);
    expect(hoja.eventos.indexOf('casillas 1-3')).toBeLessThan(hoja.eventos.indexOf('valores A2:J3'));
  });

  it('quien llega después recibe su casilla en su fila, y las de antes no se vuelven a pedir', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org')];
    await sincronizarAsistencias();
    asistencias.push(registrada('jueves', 'Luis Pérez', 'luis@x.org'));
    await sincronizarAsistencias();
    expect(personas.casillas).toEqual([
      { desde: 1, hasta: 2, columna: COLUMNA_CON_REGISTRO },
      { desde: 2, hasta: 3, columna: COLUMNA_CON_REGISTRO },
    ]);
  });

  it('si Google no deja poner las casillas, no se escriben valores sueltos que quedarían como «TRUE» y «FALSE» en texto', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org')];
    hoja.fallaAlValidar = 'Quota exceeded';
    await expect(sincronizarAsistencias()).rejects.toThrow(/Quota/);
    expect(personas.filas).toEqual([]);
    expect(personas.escrituras).toEqual([]);
    // La pasada siguiente lo hace todo junto: casillas y valores.
    hoja.fallaAlValidar = null;
    await sincronizarAsistencias();
    expect(personas.filas).toHaveLength(1);
    expect(personas.casillas).toEqual([{ desde: 1, hasta: 2, columna: COLUMNA_CON_REGISTRO }]);
  });

  it('una hoja con la versión anterior (texto «Sí» y «No») se reescribe una vez como casillas, y la pasada siguiente no escribe nada', async () => {
    personas.existe = true;
    personas.encabezados = [...ENCABEZADOS_PERSONAS];
    personas.filas = [
      [1, 'Ana Ruiz', 'ana@x.org', 'Público general', 0, 1, 0, 1, 'Sí'],
      [2, 'Pedro Soto', 'pedro@x.org', '', 0, 1, 0, 1, 'No'],
    ];
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org'), una('jueves', 'presencial', 'Pedro Soto', 'pedro@x.org')];
    const r = await sincronizarAsistencias();
    expect(r.cambiadas).toBe(2);
    expect(personas.filas.map((f) => f[COLUMNA_CON_REGISTRO])).toEqual([true, false]);
    expect(personas.casillas).toEqual([{ desde: 1, hasta: 3, columna: COLUMNA_CON_REGISTRO }]);
    personas.escrituras = [];
    const otra = await sincronizarAsistencias();
    expect(otra).toMatchObject({ nuevas: 0, cambiadas: 0, quitadas: 0 });
    expect(personas.escrituras).toEqual([]);
  });

  it('una casilla que alguien marcó o desmarcó a mano se corrige en la siguiente pasada: la base manda', async () => {
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org'), una('jueves', 'presencial', 'Pedro Soto', 'pedro@x.org')];
    await sincronizarAsistencias();
    personas.filas[1][COLUMNA_CON_REGISTRO] = true; // alguien marca a Pedro, que no tiene registro
    personas.escrituras = [];
    const r = await sincronizarAsistencias();
    expect(r.cambiadas).toBe(1);
    expect(personas.filas[1][COLUMNA_CON_REGISTRO]).toBe(false);
    expect(personas.escrituras[0].range).toMatch(/!A3:J3$/);
  });
});

describe('la columna «Ponencia»', () => {
  const ponente = (sesion: string, nombre: string, correo: string, extra: Record<string, unknown> = {}) =>
    registrada(sesion, nombre, correo, { perfil: 'ponente', ...extra });

  it('los ponentes llevan el título de su ponencia, tal como está en el programa; los demás, la celda en blanco', async () => {
    asistencias = [ponente('jueves', 'Sebastian Grillo', 'sg@x.org'), registrada('jueves', 'Ana Ruiz', 'ana@x.org')];
    await sincronizarAsistencias();
    expect(titulosDe('Sebastian Grillo')).toHaveLength(1);
    expect(personas.filas[0].at(-1)).toBe(titulosDe('Sebastian Grillo')[0]);
    expect(personas.filas[1].at(-1)).toBe('');
  });

  it('quien presentó dos ponencias lleva las dos, en el orden del programa, separadas', async () => {
    asistencias = [ponente('viernes', 'Nuria Ape', 'na@x.org')];
    await sincronizarAsistencias();
    const titulos = titulosDe('Nuria Ape');
    expect(titulos).toHaveLength(2);
    expect(personas.filas[0].at(-1)).toBe(titulos.join(SEPARADOR_DE_PONENCIAS));
  });

  it('se reconoce a quien se registró con los dos apellidos, sin acentos o en mayúsculas', async () => {
    asistencias = [ponente('jueves', 'SEBASTIÁN GRILLO PÉREZ', 'sg@x.org')];
    await sincronizarAsistencias();
    expect(personas.filas[0].at(-1)).toBe(titulosDe('Sebastian Grillo')[0]);
  });

  it('quien no figura en el programa queda en blanco, aunque se haya registrado como ponente', async () => {
    asistencias = [ponente('jueves', 'Juan Nadie Pérez', 'jn@x.org')];
    await sincronizarAsistencias();
    expect(personas.filas[0].at(-1)).toBe('');
  });

  it('también se reconoce a quien asistió sin registro, por el nombre que escribió', async () => {
    asistencias = [una('jueves', 'presencial', 'Sebastian Grillo', 'otro.correo@x.org')];
    await sincronizarAsistencias();
    expect(personas.filas[0][COLUMNA_CON_REGISTRO]).toBe(false);
    expect(personas.filas[0].at(-1)).toBe(titulosDe('Sebastian Grillo')[0]);
  });

  it('una celda de ponencia cambiada a mano se corrige: la base manda', async () => {
    asistencias = [ponente('jueves', 'Sebastian Grillo', 'sg@x.org')];
    await sincronizarAsistencias();
    personas.filas[0][9] = 'Otro título';
    const r = await sincronizarAsistencias();
    expect(r.cambiadas).toBe(1);
    expect(personas.filas[0].at(-1)).toBe(titulosDe('Sebastian Grillo')[0]);
  });
});

describe('la pestaña que ya existía sin la columna «Ponencia»', () => {
  const nueve = ENCABEZADOS_PERSONAS.slice(0, 9);
  const filaDeNueve = (n: number, nombre: string, correo: string) => [n, nombre, correo, 'Público general', 0, 1, 0, 1, true];
  const ponente = (sesion: string, nombre: string, correo: string) =>
    registrada(sesion, nombre, correo, { perfil: 'ponente' });

  beforeEach(() => {
    personas.existe = true;
    personas.encabezados = [...nueve];
    personas.filas = [filaDeNueve(1, 'Ana Ruiz', 'ana@x.org')];
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org'), ponente('jueves', 'Sebastian Grillo', 'sg@x.org')];
  });

  it('con la columna libre, sólo se pone el título y se escriben las filas que cambian: sin insertar nada', async () => {
    const r = await sincronizarAsistencias();
    expect(personas.encabezados).toEqual([...ENCABEZADOS_PERSONAS]);
    expect(hoja.eventos.some((e) => e.startsWith('insertar'))).toBe(false);
    expect(r.avisos).toBeUndefined();
    // Ana ya estaba bien (su celda de ponencia vacía es igual a ninguna): sólo se escribe la fila nueva.
    expect(personas.escrituras).toHaveLength(1);
    expect(personas.escrituras[0].range).toMatch(/!A3:J3$/);
    expect(personas.filas[1].at(-1)).toBe(titulosDe('Sebastian Grillo')[0]);
  });

  it('si en ese lugar había una columna de quien hace las constancias, se inserta una nueva y la suya se recorre con sus datos', async () => {
    personas.encabezados = [...nueve, 'Enlace a la constancia'];
    personas.filas = [[...filaDeNueve(1, 'Ana Ruiz', 'ana@x.org'), 'https://docs.example/ana']];
    const r = await sincronizarAsistencias();
    expect(hoja.eventos.filter((e) => e === 'insertar columna 9')).toHaveLength(1);
    expect(personas.encabezados).toEqual([...ENCABEZADOS_PERSONAS, 'Enlace a la constancia']);
    // Lo suyo sigue en la fila de la misma persona, una columna más a la derecha.
    expect(personas.filas[0][10]).toBe('https://docs.example/ana');
    expect(personas.filas[0][9]).toBe('');
    expect(r.avisos?.[0]).toMatch(/Se insertó la columna «Ponencia» \(J\)/);
  });

  it('y en la pasada siguiente no inserta otra: ya está su título', async () => {
    personas.encabezados = [...nueve, 'Enlace a la constancia'];
    personas.filas = [[...filaDeNueve(1, 'Ana Ruiz', 'ana@x.org'), 'https://docs.example/ana']];
    await sincronizarAsistencias();
    const otra = await sincronizarAsistencias();
    expect(hoja.eventos.filter((e) => e === 'insertar columna 9')).toHaveLength(1);
    expect(otra.avisos).toBeUndefined();
    expect(otra).toMatchObject({ nuevas: 0, cambiadas: 0, quitadas: 0 });
    expect(personas.encabezados.at(-1)).toBe('Enlace a la constancia');
  });

  it('si la columna ya está en blanco (se insertó y la pasada se cortó antes de poner el título), no inserta otra', async () => {
    personas.encabezados = [...nueve, ''];
    await sincronizarAsistencias();
    expect(hoja.eventos.some((e) => e.startsWith('insertar'))).toBe(false);
    expect(personas.encabezados).toEqual([...ENCABEZADOS_PERSONAS]);
  });

  it('el aviso de la columna insertada llega aunque la pasada se detenga por prudencia', async () => {
    personas.encabezados = [...nueve, 'Mi columna'];
    personas.filas = Array.from({ length: 15 }, (_, i) => filaDeNueve(i + 1, `P${i}`, `p${i}@x.org`));
    asistencias = [registrada('jueves', 'Ana Ruiz', 'ana@x.org')];
    const r = await sincronizarAsistencias();
    expect(r.omitido).toBeDefined();
    expect(r.avisos?.[0]).toMatch(/Se insertó la columna/);
  });

  it('simular no inserta nada', async () => {
    personas.encabezados = [...nueve, 'Mi columna'];
    await sincronizarAsistencias({ simular: true });
    expect(hoja.eventos).toEqual([]);
    expect(personas.encabezados).toEqual([...nueve, 'Mi columna']);
  });
});

describe('cuando son muchas personas', () => {
  it('amplía la pestaña antes de escribir: una pestaña nueva trae 1,000 filas', async () => {
    asistencias = Array.from({ length: 1500 }, (_, i) => registrada('jueves', `Persona ${i}`, `p${i}@x.org`));
    await sincronizarAsistencias();
    expect(personas.filas).toHaveLength(1500);
    expect(personas.ampliaciones).toHaveLength(1);
    expect(personas.cuadricula).toBeGreaterThanOrEqual(1501);
    expect(personas.filas[1499][0]).toBe(1500);
    // Las casillas, por lotes de mil filas, cubren de la 1 a la 1500 de la API sin dejar hueco ni pasarse.
    expect(personas.casillas.map((c) => [c.desde, c.hasta])).toEqual([[1, 1001], [1001, 1501]]);
  });

  it('sin ampliar la cuadrícula Google rechazaría la escritura (lo que hace el simulacro)', async () => {
    // La prueba de que el simulacro vigila el límite: si no se ampliara, esto fallaría.
    personas.existe = true;
    personas.cuadricula = 10;
    asistencias = Array.from({ length: 30 }, (_, i) => registrada('jueves', `P${i}`, `p${i}@x.org`));
    await sincronizarAsistencias();
    expect(personas.filas).toHaveLength(30);
    expect(personas.ampliaciones.length).toBe(1);
  });

  it('una pasada siguiente no vuelve a ampliar si ya cabe', async () => {
    asistencias = Array.from({ length: 1500 }, (_, i) => registrada('jueves', `P${i}`, `p${i}@x.org`));
    await sincronizarAsistencias();
    asistencias.push(registrada('miercoles', 'Otra', 'otra@x.org'));
    await sincronizarAsistencias();
    expect(personas.ampliaciones).toHaveLength(1);
    expect(personas.filas).toHaveLength(1501);
  });
});

describe('los títulos de la pestaña', () => {
  it('si alguien creó la pestaña a mano, o cambió los títulos, se dejan los de siempre', async () => {
    personas.existe = true;
    personas.encabezados = ['Nombre', 'Correo'];
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org')];
    await sincronizarAsistencias();
    expect(personas.encabezados).toEqual([...ENCABEZADOS_PERSONAS]);
  });
});

describe('pasar a la hoja sin esperar al cron', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('unos segundos después del escaneo la asistencia está en la hoja, y una ráfaga hace una sola pasada', async () => {
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org')];
    pedirSincronizacionDeAsistencias();
    asistencias.push(registrada('jueves', 'Dos', 'dos@x.org'));
    pedirSincronizacionDeAsistencias();
    asistencias.push(una('jueves', 'en_linea', 'Tres', 'tres@x.org'));
    pedirSincronizacionDeAsistencias();
    expect(personas.filas).toHaveLength(0); // todavía no: se espera para juntar la ráfaga
    await vi.advanceTimersByTimeAsync(ESPERA_AUTOMATICA_MS + 100);
    expect(personas.filas.map((f) => f[1])).toEqual(['Uno', 'Dos', 'Tres']);
    expect(personas.escrituras).toHaveLength(1);
  });

  it('anota cuándo se hizo, y si falla lo anota y no revienta a nadie: el cron lo alcanza después', async () => {
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org')];
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
    expect(personas.filas).toHaveLength(1);
  });

  it('el botón del panel dice la causa real cuando falla', async () => {
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org')];
    hoja.falla = 'Requested entity was not found.';
    await expect(sincronizarYAnotar()).rejects.toThrow(/not found/);
    expect(estadoDeLaHoja().error).toMatch(/not found/);
  });

  it('sin Google conectado (una instalación local) no hace nada ni deja nada pendiente', async () => {
    hoja.configurado = false;
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org')];
    pedirSincronizacionDeAsistencias();
    await vi.advanceTimersByTimeAsync(ESPERA_AUTOMATICA_MS * 2);
    expect(personas.existe).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dos pasadas a la vez no se pisan: van una tras otra', async () => {
    asistencias = [registrada('jueves', 'Uno', 'uno@x.org')];
    const [a, b] = await Promise.all([sincronizarYAnotar(), sincronizarYAnotar()]);
    expect(a.nuevas).toBe(1);
    expect(b.nuevas).toBe(0); // la segunda ya encontró la fila escrita por la primera
    expect(personas.filas).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// La pestaña «Asistencias» del diseño anterior
// ---------------------------------------------------------------------------

describe('retirar la pestaña «Asistencias» del diseño anterior', () => {
  const ponerLaVieja = (encabezados: Celda[] = [...ENCABEZADOS_DE_LA_HOJA_RETIRADA[0]]) => {
    vieja.existe = true;
    vieja.encabezados = encabezados;
    vieja.filas = [[1, 'María Robles', 'maria@ejemplo.org', 'Jueves 12 de noviembre', 'Presencial']];
  };
  beforeEach(() => { asistencias = [registrada('jueves', 'María Robles', 'maria@ejemplo.org')]; });

  it('se quita, y se quita después de dejar al día la nueva', async () => {
    ponerLaVieja();
    const r = await sincronizarAsistencias();
    expect(vieja.existe).toBe(false);
    expect(personas.filas).toHaveLength(1);
    expect(r.retirada).toMatchObject({ quitada: true });
    expect(r.retirada?.mensaje).toMatch(/Se quitó la pestaña «Asistencias»/);
    // Primero lo nuevo, y sólo al final lo viejo: nunca se queda la hoja sin ninguna de las dos.
    expect(hoja.eventos.at(-1)).toBe('borrar Asistencias');
    expect(hoja.eventos.indexOf('crear Asistencia por persona')).toBeLessThan(hoja.eventos.indexOf('valores A2:J2'));
    expect(hoja.eventos.indexOf('valores A2:J2')).toBeLessThan(hoja.eventos.indexOf('borrar Asistencias'));
  });

  it('también se reconoce la del diseño por mesa, con su columna «Mesa»', async () => {
    ponerLaVieja([...ENCABEZADOS_DE_LA_HOJA_RETIRADA[1]]);
    const r = await sincronizarAsistencias();
    expect(vieja.existe).toBe(false);
    expect(r.retirada?.quitada).toBe(true);
  });

  it('se quita una sola vez: después ya no está, no se vuelve a crear y ni se mira', async () => {
    ponerLaVieja();
    await sincronizarAsistencias();
    expect(hoja.lecturasDeLaVieja).toBe(1);
    const otra = await sincronizarAsistencias();
    expect(otra.retirada).toBeUndefined();
    expect(vieja.existe).toBe(false);
    expect(hoja.lecturasDeLaVieja).toBe(1);
  });

  it('si alguien creó después una pestaña «Asistencias» con otros títulos, no se toca', async () => {
    await sincronizarAsistencias();
    ponerLaVieja(['Nombre', 'Notas mías']);
    const r = await sincronizarAsistencias();
    expect(vieja.existe).toBe(true);
    expect(r.retirada).toMatchObject({ quitada: false });
    expect(r.retirada?.fallo).toBeUndefined();
    expect(r.retirada?.mensaje).toMatch(/no se quitó/);
  });

  it('si a la del sistema le añadieron una columna a la derecha, no se toca: ahí puede haber algo de alguien', async () => {
    ponerLaVieja([...ENCABEZADOS_DE_LA_HOJA_RETIRADA[0], 'Constancia enviada']);
    const r = await sincronizarAsistencias();
    expect(vieja.existe).toBe(true);
    expect(r.retirada?.quitada).toBe(false);
  });

  it('una pestaña «Asistencias» vacía no se toca: no se sabe de quién es', async () => {
    vieja.existe = true;
    const r = await sincronizarAsistencias();
    expect(vieja.existe).toBe(true);
    expect(r.retirada?.quitada).toBe(false);
  });

  it('si la pasada se detiene por prudencia, no se quita nada', async () => {
    asistencias = Array.from({ length: 15 }, (_, i) => registrada('jueves', `P${i}`, `p${i}@x.org`));
    await sincronizarAsistencias();
    ponerLaVieja();
    asistencias = asistencias.slice(0, 3);
    const r = await sincronizarAsistencias();
    expect(r.omitido).toBeDefined();
    expect(r.retirada).toBeUndefined();
    expect(vieja.existe).toBe(true);
  });

  it('si la base no tiene asistencias y no hay pestaña nueva que crear, no se quita nada: podría ser lo único que queda', async () => {
    ponerLaVieja();
    asistencias = [];
    const r = await sincronizarAsistencias();
    expect(personas.existe).toBe(false);
    expect(vieja.existe).toBe(true);
    expect(r.retirada).toBeUndefined();
  });

  it('si la pasada falla, no se quita nada', async () => {
    ponerLaVieja();
    personas.fallaPropia = 'Quota exceeded';
    await expect(sincronizarAsistencias()).rejects.toThrow(/Quota/);
    expect(vieja.existe).toBe(true);
  });

  it('simular dice que se quitaría, sin quitarla', async () => {
    ponerLaVieja();
    const r = await sincronizarAsistencias({ simular: true });
    expect(r.retirada).toMatchObject({ quitada: true });
    expect(r.retirada?.mensaje).toMatch(/Se quitaría/);
    expect(vieja.existe).toBe(true);
    expect(hoja.eventos).toEqual([]);
  });

  it('si Google no la deja quitar, la pasada no falla —lo nuevo ya quedó bien— y lo dice; la siguiente lo reintenta', async () => {
    ponerLaVieja();
    hoja.fallaAlBorrar = 'The caller does not have permission';
    const r = await sincronizarAsistencias();
    expect(personas.filas).toHaveLength(1);
    expect(r.retirada).toMatchObject({ quitada: false, fallo: true });
    expect(r.retirada?.mensaje).toMatch(/permission/);
    expect(vieja.existe).toBe(true);

    hoja.fallaAlBorrar = null;
    const otra = await sincronizarAsistencias();
    expect(otra.retirada?.quitada).toBe(true);
    expect(vieja.existe).toBe(false);
  });

  it('el botón del panel también la quita', async () => {
    ponerLaVieja();
    const r = await sincronizarYAnotar();
    expect(r.retirada?.quitada).toBe(true);
    expect(vieja.existe).toBe(false);
    expect(HOJA_RETIRADA).toBe('Asistencias');
  });
});
