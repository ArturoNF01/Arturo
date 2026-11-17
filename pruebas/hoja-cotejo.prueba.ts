import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENCABEZADOS_DE_COTEJO, cotejarPonentes, type RegistroParaCotejo } from '@/lib/cotejo-ponentes';
import type { Mesa } from '@/lib/programa';

/**
 * La parte del cotejo que toca la hoja de Google y la base: la pestaña «Cotejo de ponentes» y el cambio de perfil. Con una hoja
 * simulada y una base simulada; las reglas del cotejo están en cotejo-ponentes.prueba.ts y contra PostgreSQL en prueba-bd.
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
const base = {
  /** Lo que devuelve «update registros … returning *»: una fila si el registro se pudo cambiar, ninguna si no. */
  devuelve: [] as { id: string }[],
  actualizaciones: [] as { texto: string; valores: unknown[]; actor: unknown }[],
  consultas: [] as { texto: string; valores: unknown[] }[],
  fallaLaHoja: null as string | null,
  resincronizados: [] as string[],
};

vi.mock('@/lib/servidor/google', () => ({
  googleConfigurado: () => hoja.configurado,
  clienteSheets: () => ({
    spreadsheets: {
      get: async () => ({
        data: { sheets: hoja.existe ? [{ properties: { title: 'Cotejo de ponentes', sheetId: 9, gridProperties: { rowCount: hoja.filasDeLaCuadricula, columnCount: 26 } } }] : [] },
      }),
      batchUpdate: async (p: { requestBody: { requests: Peticion[] } }) => {
        hoja.batchUpdates.push(p.requestBody.requests);
        const agregar = p.requestBody.requests.find((r) => r.addSheet) as { addSheet: { properties: { title: string } } } | undefined;
        if (agregar) {
          hoja.existe = true;
          return { data: { replies: [{ addSheet: { properties: { sheetId: 9, gridProperties: { rowCount: hoja.filasDeLaCuadricula } } } }] } };
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
  resincronizarRegistro: async (registro: { id: string }) => {
    if (base.fallaLaHoja) throw new Error(base.fallaLaHoja);
    base.resincronizados.push(registro.id);
  },
}));
vi.mock('@/lib/bd/conexion', () => ({
  conActor: async (actor: unknown, texto: string, valores: unknown[]) => { base.actualizaciones.push({ texto, valores, actor }); return base.devuelve; },
  consultar: async (texto: string, valores: unknown[]) => { base.consultas.push({ texto, valores }); return []; },
}));

const { HOJA_COTEJO, aplicarCambiosDePerfil, escribirCotejoEnLaHoja } = await import('@/lib/servidor/cotejo-ponentes');

const mesas: Pick<Mesa, 'numero' | 'ponencias'>[] = [{
  numero: 1,
  ponencias: [
    { titulo: 'Título A', autores: ['Ana María López Ruiz'], pais: 'mx', participacion: 'presencial' },
    { titulo: 'Título B', autores: ['Eva Mora Díaz', 'Luis Pérez'], pais: 'co', participacion: 'virtual' },
  ],
}];
const registro = (n: number, nombre: string, perfil: string, extra: Partial<RegistroParaCotejo> = {}): RegistroParaCotejo => ({
  id: `r-${n}`, folio: `F-${n}`, nombre, correo: `p${n}@x.org`, perfil, estado: 'confirmado', titulo_ponencia: null, eje_tematico: null, ...extra,
});
const cotejo = () => cotejarPonentes(mesas, [registro(1, 'Ana María López Ruiz', 'publico_general'), registro(2, 'Eva Mora Díaz', 'ponente'), registro(3, 'Fuera De Agenda', 'ponente')]);

beforeEach(() => {
  process.env.GOOGLE_SHEETS_ID = 'libro-de-prueba';
  hoja.configurado = true; hoja.existe = false; hoja.filasDeLaCuadricula = 1000;
  hoja.batchUpdates = []; hoja.limpiezas = []; hoja.escrituras = [];
  base.devuelve = []; base.actualizaciones = []; base.consultas = []; base.fallaLaHoja = null; base.resincronizados = [];
});

describe('la pestaña «Cotejo de ponentes»', () => {
  it('se llama como se dijo y lleva sus catorce títulos', () => {
    expect(HOJA_COTEJO).toBe('Cotejo de ponentes');
    expect(ENCABEZADOS_DE_COTEJO).toHaveLength(14);
  });

  it('si no existe se crea con la primera fila fija y anchos a la medida, y se escribe con sus títulos', async () => {
    const r = await escribirCotejoEnLaHoja(cotejo());
    expect(r.filas).toBe(3 + 1); // tres autores de la agenda y un ponente fuera de ella
    const creacion = hoja.batchUpdates[0].find((p) => p.addSheet) as { addSheet: { properties: { title: string; gridProperties: { frozenRowCount: number } } } };
    expect(creacion.addSheet.properties).toMatchObject({ title: 'Cotejo de ponentes', gridProperties: { frozenRowCount: 1 } });
    const formato = hoja.batchUpdates[1];
    expect(formato.filter((p) => p.updateDimensionProperties)).toHaveLength(14);
    expect(hoja.escrituras).toHaveLength(1);
    expect(hoja.escrituras[0].range).toBe("'Cotejo de ponentes'!A1");
    expect(hoja.escrituras[0].values[0]).toEqual([...ENCABEZADOS_DE_COTEJO]);
    expect(hoja.escrituras[0].values).toHaveLength(1 + 4);
  });

  it('se escribe sin interpretar: nada de lo que venga del formulario público se vuelve fórmula', async () => {
    await escribirCotejoEnLaHoja(cotejo());
    expect(hoja.escrituras[0].valueInputOption).toBe('RAW');
  });

  it('si ya existe no se vuelve a crear: se vacía y se escribe de nuevo', async () => {
    hoja.existe = true;
    await escribirCotejoEnLaHoja(cotejo());
    expect(hoja.batchUpdates.flat().some((p) => p.addSheet)).toBe(false);
    expect(hoja.limpiezas).toEqual(["'Cotejo de ponentes'!A1:N"]);
    expect(hoja.escrituras).toHaveLength(1);
  });

  it('cada fila trae una celda por título, y lo que acaba de cambiarse sale ya como ponente', async () => {
    await escribirCotejoEnLaHoja(cotejo(), new Set(['r-1']));
    const filas = hoja.escrituras[0].values.slice(1);
    expect(filas.every((f) => f.length === ENCABEZADOS_DE_COTEJO.length)).toBe(true);
    const ana = filas.find((f) => f[2] === 'Ana María López Ruiz')!;
    expect(ana[5]).toBe('Se registró como público general: ya se cambió a ponente');
    expect(ana[9]).toBe('Ponente');
    expect(filas.find((f) => f[2] === 'Luis Pérez')![5]).toBe('No está registrado');
    expect(filas.at(-1)![5]).toBe('Ponente registrado que no figura en la agenda');
  });

  it('si la cuadrícula es chica se amplía antes de escribir: escribir fuera de ella falla', async () => {
    hoja.existe = true;
    hoja.filasDeLaCuadricula = 3;
    await escribirCotejoEnLaHoja(cotejo());
    const ampliar = hoja.batchUpdates.flat().find((p) => p.appendDimension) as { appendDimension: { dimension: string; length: number } };
    expect(ampliar.appendDimension.dimension).toBe('ROWS');
    expect(3 + ampliar.appendDimension.length).toBeGreaterThanOrEqual(5);
  });

  it('sin Google conectado no hace nada y lo dice', async () => {
    hoja.configurado = false;
    await expect(escribirCotejoEnLaHoja(cotejo())).rejects.toThrow(/no está configurado/);
    expect(hoja.escrituras).toEqual([]);
  });
});

describe('el cambio de perfil', () => {
  const cambio = () => ({ registro: registro(1, 'Ana María López Ruiz', 'publico_general'), autor: 'Ana María López Ruiz' });

  it('sólo toca el perfil, y sólo si sigue siendo de público general y no está cancelado; sin actor: la auditoría lo asienta como del sistema', async () => {
    base.devuelve = [{ id: 'r-1' }];
    await aplicarCambiosDePerfil([cambio()]);
    expect(base.actualizaciones).toHaveLength(1);
    const { texto, valores, actor } = base.actualizaciones[0];
    expect(actor).toBeNull();
    expect(texto).toMatch(/update registros set perfil = \$2/);
    expect(texto).toMatch(/perfil = any\(\$3::text\[\]\)/);
    expect(texto).toMatch(/estado <> 'cancelado'/);
    expect(valores).toEqual(['r-1', 'ponente', ['publico_general']]);
  });

  it('pone al día la copia del registro en la hoja, como el panel al editarlo, y lo anota', async () => {
    base.devuelve = [{ id: 'r-1' }];
    const [r] = await aplicarCambiosDePerfil([cambio()]);
    expect(r).toMatchObject({ id: 'r-1', folio: 'F-1', hoja: 'al_dia' });
    expect(base.resincronizados).toEqual(['r-1']);
    expect(base.consultas[0].texto).toMatch(/sheets_sincronizado_en = now\(\), sheets_error = null/);
  });

  it('si la hoja falla, el perfil ya cambió: se anota el motivo en el registro, como el panel, y se dice', async () => {
    base.devuelve = [{ id: 'r-1' }];
    base.fallaLaHoja = 'Quota exceeded';
    const [r] = await aplicarCambiosDePerfil([cambio()]);
    expect(r).toMatchObject({ hoja: 'fallo', errorDeLaHoja: 'Quota exceeded' });
    expect(base.consultas[0].texto).toMatch(/set sheets_error = \$2/);
    expect(base.consultas[0].valores).toEqual(['r-1', 'Quota exceeded']);
  });

  it('si el registro ya no era de público general (o se canceló), no se cambia y se dice por qué', async () => {
    base.devuelve = [];
    const [r] = await aplicarCambiosDePerfil([cambio()]);
    expect(r.omitido).toMatch(/ya no era de público general/);
    expect(base.resincronizados).toEqual([]);
  });

  it('sin Google conectado cambia el perfil y lo dice', async () => {
    hoja.configurado = false;
    base.devuelve = [{ id: 'r-1' }];
    const [r] = await aplicarCambiosDePerfil([cambio()]);
    expect(r.hoja).toBe('sin_google');
    expect(base.resincronizados).toEqual([]);
  });

  it('sin cambios no hace nada', async () => {
    expect(await aplicarCambiosDePerfil([])).toEqual([]);
    expect(base.actualizaciones).toEqual([]);
  });
});
