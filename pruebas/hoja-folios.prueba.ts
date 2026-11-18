import { beforeEach, describe, expect, it, vi } from 'vitest';

/** El llenado de la columna «Folio» en la hoja de Google, con una hoja simulada con memoria: dónde escribe y dónde no. */

type Celda = string | number | boolean;
const hoja = {
  configurado: true,
  tabla: [] as Celda[][],
  escrituras: [] as { valueInputOption: string; data: { range: string; values: Celda[][] }[] }[],
  /** Qué hace «otra persona» justo antes de la segunda lectura: para ver que se compara con lo que la hoja tiene de verdad. */
  ignorarEscritura: false,
};
const comoLoLeeGoogle = (v: Celda) => (v === true ? 'TRUE' : v === false ? 'FALSE' : String(v));

vi.mock('@/lib/servidor/google', () => ({
  googleConfigurado: () => hoja.configurado,
  clienteSheets: () => ({
    spreadsheets: {
      values: {
        get: async () => ({ data: { values: hoja.tabla.map((f) => f.map(comoLoLeeGoogle)) } }),
        batchUpdate: async (p: { requestBody: { valueInputOption: string; data: { range: string; values: Celda[][] }[] } }) => {
          hoja.escrituras.push(p.requestBody);
          if (hoja.ignorarEscritura) return { data: {} };
          for (const { range, values } of p.requestBody.data) {
            const m = /!([A-Z]+)(\d+):[A-Z]+(\d+)$/.exec(range)!;
            const col = m[1].charCodeAt(0) - 65;
            values.forEach((v, k) => {
              const fila = hoja.tabla[Number(m[2]) - 1 + k];
              while (fila.length <= col) fila.push('');
              fila[col] = v[0];
            });
          }
          return { data: {} };
        },
      },
    },
  }),
}));
vi.mock('@/lib/servidor/sheets', () => ({ conEspera: async <T>(op: () => Promise<T>) => op() }));

const { llenarFolios, tramos } = await import('@/lib/servidor/folios');

const TITULOS = ['N.º', 'Nombre', 'Correo', 'Ponencia', 'Perfil', 'Miércoles 11', 'Jueves 12', 'Viernes 13', 'Total', 'Con registro', 'Total de horas', 'N° de constancia', 'Folio'];
const persona = (n: number, perfil: 'Público general' | 'Ponente' | '', conRegistro: boolean, folio = ''): Celda[] =>
  [n, `Persona ${n}`, `p${n}@x.org`, '', perfil, 0, 1, 0, 1, conRegistro, '', '', folio];
const folios = () => hoja.tabla.slice(1).map((f) => f[12] ?? '');

beforeEach(() => {
  process.env.GOOGLE_SHEETS_ID = 'libro-de-prueba';
  hoja.configurado = true; hoja.escrituras = []; hoja.ignorarEscritura = false;
  hoja.tabla = [
    [...TITULOS],
    persona(1, 'Público general', true),
    persona(2, '', false), // asistió sin registro
    persona(3, 'Ponente', true),
    persona(4, 'Público general', true),
    persona(5, 'Público general', false), // registro cancelado
    persona(6, 'Público general', true),
  ];
});

describe('los tramos de filas seguidas', () => {
  it('juntan lo consecutivo y separan lo demás', () => {
    expect(tramos([3, 4, 5, 9, 10, 12])).toEqual([[3, 5], [9, 10], [12, 12]]);
    expect(tramos([])).toEqual([]);
  });
});

describe('llenar la columna «Folio»', () => {
  it('sin --aplicar sólo calcula: dice qué pondría y no escribe nada', async () => {
    const r = await llenarFolios({ aplicar: false });
    expect(r.escritas).toBe(0);
    expect(hoja.escrituras).toEqual([]);
    expect(r.detalle).toEqual([
      { numero: '1', nombre: 'Persona 1', folio: 'CONG-EISS-RIUSS-A01' },
      { numero: '3', nombre: 'Persona 3', folio: 'CONG-EISS-RIUSS-P01' },
      { numero: '4', nombre: 'Persona 4', folio: 'CONG-EISS-RIUSS-A02' },
      { numero: '6', nombre: 'Persona 6', folio: 'CONG-EISS-RIUSS-A03' },
    ]);
    expect(r.plan).toMatchObject({ sinRegistro: 1, sinSerie: 1 });
    expect(folios()).toEqual(['', '', '', '', '', '']);
  });

  it('escribe sólo las celdas de «Folio» de las filas que reciben folio; las demás, y todo lo otro, se quedan', async () => {
    const antes = hoja.tabla.map((f) => f.slice(0, 12));
    const r = await llenarFolios({ aplicar: true });
    expect(r.escritas).toBe(4);
    expect(folios()).toEqual(['CONG-EISS-RIUSS-A01', '', 'CONG-EISS-RIUSS-P01', 'CONG-EISS-RIUSS-A02', '', 'CONG-EISS-RIUSS-A03']);
    expect(hoja.tabla.map((f) => f.slice(0, 12))).toEqual(antes); // nada más cambió
  });

  it('en una sola petición, un tramo por cada grupo de filas seguidas, sin pasar por las que no reciben', async () => {
    await llenarFolios({ aplicar: true });
    expect(hoja.escrituras).toHaveLength(1);
    expect(hoja.escrituras[0].valueInputOption).toBe('RAW');
    expect(hoja.escrituras[0].data.map((d) => d.range)).toEqual([
      "'Asistencia por persona'!M2:M2", "'Asistencia por persona'!M4:M5", "'Asistencia por persona'!M7:M7",
    ]);
  });

  it('al volver a leer comprueba que lo escrito es lo que la hoja tiene', async () => {
    expect((await llenarFolios({ aplicar: true })).verificadas).toBe(true);
    beforeEachReset();
    hoja.ignorarEscritura = true;
    expect((await llenarFolios({ aplicar: true })).verificadas).toBe(false);
  });

  it('repetirlo no escribe nada: ya están', async () => {
    await llenarFolios({ aplicar: true });
    hoja.escrituras = [];
    const r = await llenarFolios({ aplicar: true });
    expect(r.escritas).toBe(0);
    expect(hoja.escrituras).toEqual([]);
  });

  it('nunca pisa un folio que ya estaba, y sigue la serie desde el más alto', async () => {
    hoja.tabla[1][12] = 'CONG-EISS-RIUSS-A07'; // lo puso quien hace las constancias
    await llenarFolios({ aplicar: true });
    expect(folios()).toEqual(['CONG-EISS-RIUSS-A07', '', 'CONG-EISS-RIUSS-P01', 'CONG-EISS-RIUSS-A08', '', 'CONG-EISS-RIUSS-A09']);
  });

  it('las columnas se buscan por su título: si «Folio» está en otra letra, escribe ahí', async () => {
    // «Folio» movida a la P, con otras columnas entre medio.
    hoja.tabla = hoja.tabla.map((f, i) => (i === 0 ? [...f.slice(0, 12), 'Libro', 'Foja', 'Folio'] : [...f.slice(0, 12), '', '', f[12]]));
    await llenarFolios({ aplicar: true });
    expect(hoja.escrituras[0].data[0].range).toBe("'Asistencia por persona'!O2:O2");
    expect(hoja.tabla.slice(1).map((f) => f[14])).toEqual(['CONG-EISS-RIUSS-A01', '', 'CONG-EISS-RIUSS-P01', 'CONG-EISS-RIUSS-A02', '', 'CONG-EISS-RIUSS-A03']);
  });

  it('la casilla se lee como la devuelve la hoja («TRUE» y «FALSE»), no como valor lógico', async () => {
    hoja.tabla[4][9] = 'FALSE'; // la persona 4
    hoja.tabla[5][9] = 'TRUE'; // la persona 5, que estaba sin marcar
    const r = await llenarFolios({ aplicar: false });
    expect(r.detalle.map((d) => d.numero)).toEqual(['1', '3', '5', '6']);
  });

  it('una fila en blanco al final (restos de un borrado a mano) no cuenta', async () => {
    hoja.tabla.push(['', '', '', '', '', '', '', '', '', '', '', '', '']);
    expect((await llenarFolios({ aplicar: false })).filas).toBe(6);
  });

  it('sin la columna «Folio», o sin «Con registro», se detiene y dice cuál falta: no adivina dónde escribir', async () => {
    hoja.tabla[0] = TITULOS.filter((t) => t !== 'Folio');
    await expect(llenarFolios({ aplicar: true })).rejects.toThrow(/no tiene la columna «Folio»/);
    hoja.tabla[0] = TITULOS.filter((t) => t !== 'Con registro');
    await expect(llenarFolios({ aplicar: true })).rejects.toThrow(/no tiene la columna «Con registro»/);
    expect(hoja.escrituras).toEqual([]);
  });

  it('sin Google conectado falla con un mensaje claro', async () => {
    hoja.configurado = false;
    await expect(llenarFolios({ aplicar: true })).rejects.toThrow(/Google Sheets no está configurado/);
  });
});

/** Vuelve la hoja a como estaba antes de numerar (para repetir una prueba dentro de la misma). */
function beforeEachReset() {
  hoja.escrituras = [];
  hoja.tabla = hoja.tabla.map((f, i) => (i === 0 ? f : [...f.slice(0, 12), '']));
}
