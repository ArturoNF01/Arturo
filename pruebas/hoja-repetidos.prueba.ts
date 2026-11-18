import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENCABEZADOS_DE_REPETIDOS, revisarRepetidos } from '@/lib/repetidos';
import type { FilaDeAsistencia, RegistroDePonente } from '@/lib/asistencia';

/**
 * La parte de la revisión de repetidos que toca la hoja de Google y la base: la pestaña «Repetidos por revisar» y la lectura de lo
 * mismo que lee la pasada de la hoja. Con una hoja simulada; las reglas están en repetidos.prueba.ts.
 */

type Peticion = Record<string, unknown>;
const hoja = {
  configurado: true,
  existe: false,
  filasDeLaCuadricula: 1000,
  batchUpdates: [] as Peticion[][],
  limpiezas: [] as string[],
  escrituras: [] as { range: string; valueInputOption: string; values: (string | number)[][] }[],
};
let asistencias: FilaDeAsistencia[] = [];
let ponentesDeLaBase: RegistroDePonente[] = [];

vi.mock('@/lib/servidor/google', () => ({
  googleConfigurado: () => hoja.configurado,
  clienteSheets: () => ({
    spreadsheets: {
      get: async () => ({
        data: { sheets: hoja.existe ? [{ properties: { title: 'Repetidos por revisar', sheetId: 12, gridProperties: { rowCount: hoja.filasDeLaCuadricula, columnCount: 26 } } }] : [] },
      }),
      batchUpdate: async (p: { requestBody: { requests: Peticion[] } }) => {
        hoja.batchUpdates.push(p.requestBody.requests);
        if (p.requestBody.requests.find((r) => r.addSheet)) {
          hoja.existe = true;
          return { data: { replies: [{ addSheet: { properties: { sheetId: 12, gridProperties: { rowCount: hoja.filasDeLaCuadricula } } } }] } };
        }
        return { data: { replies: [] } };
      },
      values: {
        clear: async (p: { range: string }) => { hoja.limpiezas.push(p.range); return { data: {} }; },
        update: async (p: { range: string; valueInputOption: string; requestBody: { values: (string | number)[][] } }) => {
          hoja.escrituras.push({ range: p.range, valueInputOption: p.valueInputOption, values: p.requestBody.values });
          return { data: {} };
        },
      },
    },
  }),
}));
vi.mock('@/lib/servidor/sheets', () => ({
  conEspera: async <T>(op: () => Promise<T>) => op(),
  peticionesDeTitulos: (id: number) => [{ titulos: id }],
}));
vi.mock('@/lib/servidor/asistencia', () => ({ todasLasAsistencias: async () => asistencias, ponentesRegistrados: async () => ponentesDeLaBase }));

const { HOJA_REPETIDOS, escribirRepetidosEnLaHoja, leerRevisionDeRepetidos } = await import('@/lib/servidor/repetidos');

const de = (sesion: string, nombre: string, correo: string, registro: string | null): FilaDeAsistencia => ({
  id: `${sesion}-${correo}`, sesion, via: 'presencial', registro_id: registro, nombre, correo, perfil: registro ? 'publico_general' : null, folio: null,
  creada_en: '2026-11-12T20:00:00Z', estado_registro: registro ? 'confirmado' : null,
});

beforeEach(() => {
  process.env.GOOGLE_SHEETS_ID = 'libro-de-prueba';
  hoja.configurado = true; hoja.existe = false; hoja.filasDeLaCuadricula = 1000;
  hoja.batchUpdates = []; hoja.limpiezas = []; hoja.escrituras = [];
  asistencias = [];
  ponentesDeLaBase = [];
});

describe('leer los repetidos de la base', () => {
  it('lee lo mismo que la pasada de la hoja —las asistencias y los ponentes sin asistencia— y trae la ponencia de cada ponente', async () => {
    asistencias = [de('jueves', 'Sebastian Grillo', 'otro@typo.org', null)];
    ponentesDeLaBase = [{ id: 'rp-1', nombre: 'Sebastian Grillo', correo: 'sg@x.org', perfil: 'ponente', folio: 'F-1', estado: 'confirmado' }];
    const r = await leerRevisionDeRepetidos();
    expect(r.resumen).toMatchObject({ filas: 2, nombresRepetidos: 1, casos: 1, diasRepartidos: 1 });
    expect(r.casos[0].filas.map((f) => f.numero)).toEqual([1, 2]);
    // La ponencia del programa, tal como la lleva la hoja (sólo la fila del ponente se reconoce por su registro; ésta, por su nombre).
    expect(r.casos[0].filas.every((f) => f.ponencia !== '')).toBe(true);
  });

  it('sin nada repetido no hay casos', async () => {
    asistencias = [de('jueves', 'Ana Ruiz', 'ana@x.org', 'r1')];
    expect((await leerRevisionDeRepetidos()).casos).toEqual([]);
  });
});

describe('la pestaña «Repetidos por revisar»', () => {
  const revision = () => revisarRepetidos(
    [de('jueves', 'Ana Ruiz', 'ana@casa.org', 'r1'), de('viernes', 'Ana Ruiz', 'ana@trabajo.org', 'r2')],
    [],
  );

  it('se llama como se dijo y lleva sus trece títulos', () => {
    expect(HOJA_REPETIDOS).toBe('Repetidos por revisar');
    expect(ENCABEZADOS_DE_REPETIDOS).toHaveLength(13);
  });

  it('si no existe se crea con la primera fila fija y anchos a la medida, y se escribe con sus títulos', async () => {
    const r = await escribirRepetidosEnLaHoja(revision());
    expect(r.filas).toBe(2);
    const creacion = hoja.batchUpdates[0].find((p) => p.addSheet) as { addSheet: { properties: { title: string; gridProperties: { frozenRowCount: number } } } };
    expect(creacion.addSheet.properties).toMatchObject({ title: 'Repetidos por revisar', gridProperties: { frozenRowCount: 1 } });
    expect(hoja.batchUpdates[1].filter((p) => p.updateDimensionProperties)).toHaveLength(13);
    expect(hoja.escrituras).toHaveLength(1);
    expect(hoja.escrituras[0].range).toBe("'Repetidos por revisar'!A1");
    expect(hoja.escrituras[0].values[0]).toEqual([...ENCABEZADOS_DE_REPETIDOS]);
    expect(hoja.escrituras[0].values).toHaveLength(1 + 2);
  });

  it('se escribe sin interpretar: un nombre que empiece por «=» no se vuelve fórmula', async () => {
    await escribirRepetidosEnLaHoja(revision());
    expect(hoja.escrituras[0].valueInputOption).toBe('RAW');
  });

  it('si ya existe no se vuelve a crear: se vacía y se escribe de nuevo, para que lo resuelto desaparezca', async () => {
    hoja.existe = true;
    await escribirRepetidosEnLaHoja(revision());
    expect(hoja.batchUpdates.flat().some((p) => p.addSheet)).toBe(false);
    expect(hoja.limpiezas).toEqual(["'Repetidos por revisar'!A1:M"]);
    expect(hoja.escrituras).toHaveLength(1);
  });

  it('cuando ya no queda ninguno, queda sólo con los títulos', async () => {
    hoja.existe = true;
    const r = await escribirRepetidosEnLaHoja(revisarRepetidos([], []));
    expect(r.filas).toBe(0);
    expect(hoja.limpiezas).toHaveLength(1);
    expect(hoja.escrituras[0].values).toEqual([[...ENCABEZADOS_DE_REPETIDOS]]);
  });

  it('amplía la cuadrícula si los casos no caben', async () => {
    hoja.existe = true;
    hoja.filasDeLaCuadricula = 2; // los títulos y las dos filas del caso piden tres
    await escribirRepetidosEnLaHoja(revision());
    const ampliacion = hoja.batchUpdates.flat().find((p) => p.appendDimension) as { appendDimension: { dimension: string; length: number } } | undefined;
    expect(ampliacion?.appendDimension.dimension).toBe('ROWS');
    expect(ampliacion!.appendDimension.length).toBeGreaterThanOrEqual(1);
  });

  it('sin Google conectado falla con un mensaje claro, sin escribir nada', async () => {
    hoja.configurado = false;
    await expect(escribirRepetidosEnLaHoja(revision())).rejects.toThrow(/Google Sheets no está configurado/);
    expect(hoja.escrituras).toEqual([]);
  });
});
