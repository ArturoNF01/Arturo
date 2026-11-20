import { describe, expect, it, vi } from 'vitest';
import { filasDeConstancias } from '@/lib/constancias';

/** Leer la pestaña con sus hipervínculos: lo que la API de Google devuelve por celda, convertido a lo que mira el envío. */

const hoja = { configurado: true, peticiones: [] as Record<string, unknown>[], filas: [] as { values?: { formattedValue?: string; hyperlink?: string }[] }[] };

vi.mock('@/lib/servidor/google', () => ({
  googleConfigurado: () => hoja.configurado,
  clienteSheets: () => ({
    spreadsheets: {
      get: async (p: Record<string, unknown>) => {
        hoja.peticiones.push(p);
        return { data: { sheets: [{ data: [{ rowData: hoja.filas }] }] } };
      },
    },
  }),
}));
vi.mock('@/lib/servidor/sheets', () => ({ conEspera: async <T>(op: () => Promise<T>) => op() }));
vi.mock('@/lib/bd/conexion', () => ({ consultar: async () => [], enTransaccion: async () => null }));

const { leerTablaDeLaHoja } = await import('@/lib/servidor/constancias');

const v = (formattedValue?: string, hyperlink?: string) => ({ formattedValue, hyperlink });

describe('leer la pestaña de la hoja', () => {
  it('pide la pestaña «Asistencia por persona» con los hipervínculos, y sólo lo necesario de cada celda', async () => {
    process.env.GOOGLE_SHEETS_ID = 'libro-de-prueba';
    hoja.filas = [];
    await leerTablaDeLaHoja();
    const p = hoja.peticiones.at(-1)!;
    expect(p.spreadsheetId).toBe('libro-de-prueba');
    expect(p.ranges).toEqual(["'Asistencia por persona'!A1:Z"]);
    expect(p.includeGridData).toBe(true);
    expect(p.fields).toBe('sheets(data(rowData(values(formattedValue,hyperlink))))');
  });

  it('convierte cada celda en su texto y su hipervínculo, y una fila sin celdas en una fila vacía', async () => {
    process.env.GOOGLE_SHEETS_ID = 'libro-de-prueba';
    hoja.filas = [
      { values: [v('N.º'), v('Nombre'), v('Correo'), v('Con registro'), v('Constancia')] },
      { values: [v('1'), v('Ana Ruiz'), v('ana@x.org'), v('TRUE'), v('Constancia de Ana', 'https://drive.google.com/file/d/ID1/view')] },
      {},
      { values: [v('3'), v('Eva Mora'), v('eva@x.org'), v('TRUE'), v('https://x.org/eva.pdf')] },
    ];
    const tabla = await leerTablaDeLaHoja();
    expect(tabla[1][4]).toEqual({ texto: 'Constancia de Ana', enlace: 'https://drive.google.com/file/d/ID1/view' });
    expect(tabla[2]).toEqual([]);
    expect(tabla[3][4]).toEqual({ texto: 'https://x.org/eva.pdf', enlace: null });
    // Y lo que sale de ahí es lo que se manda: el enlace de Ana, de descarga; el de Eva, tal cual.
    expect(filasDeConstancias(tabla).map((f) => [f.nombre, f.enlace])).toEqual([
      ['Ana Ruiz', 'https://drive.google.com/uc?export=download&id=ID1'], ['Eva Mora', 'https://x.org/eva.pdf'],
    ]);
  });

  it('sin Google conectado falla con un mensaje claro', async () => {
    hoja.configurado = false;
    await expect(leerTablaDeLaHoja()).rejects.toThrow(/Google Sheets no está configurado/);
    hoja.configurado = true;
  });
});
