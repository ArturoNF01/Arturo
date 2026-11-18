import 'server-only';
import { rangoDe } from '@/lib/normalizacion';
import { clienteSheets, googleConfigurado } from './google';
import { conEspera, peticionesDeTitulos } from './sheets';

/**
 * Una pestaña de la hoja de Google que es una vista para revisar —el cotejo de ponentes, los repetidos—, no un dato: se vuelve a
 * escribir entera cada vez que se corre su comando, y lo que alguien anote ahí no se conserva. Fuera de la pasada de la hoja de
 * asistencia: nada la escribe sola, y si alguien la borra no vuelve a aparecer hasta que se corra el comando otra vez.
 */
export interface PestanaDeRevision {
  titulo: string;
  encabezados: readonly string[];
  filas: readonly (readonly (string | number)[])[];
  /** Anchos de las columnas, en píxeles, al crearla: las de texto largo, anchas; las demás, a la medida. */
  anchos: readonly number[];
}

/**
 * La crea al final del libro si no existe (con la primera fila fija y los anchos), la vacía y escribe sus títulos y sus filas.
 * Devuelve cuántas filas de datos escribió.
 */
export async function escribirPestanaDeRevision({ titulo, encabezados, filas, anchos }: PestanaDeRevision): Promise<{ filas: number }> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) throw new Error('Google Sheets no está configurado.');
  const sheets = clienteSheets();

  const libro = await conEspera(() =>
    sheets.spreadsheets.get({ spreadsheetId: idLibro, fields: 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))' }),
  );
  const existente = (libro.data.sheets ?? []).find((h) => h.properties?.title === titulo)?.properties;
  let sheetId = existente?.sheetId ?? null;
  let filasDeLaCuadricula = existente?.gridProperties?.rowCount ?? 1000;

  if (sheetId === null) {
    const creada = await conEspera(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: idLibro,
        requestBody: { requests: [{ addSheet: { properties: { title: titulo, gridProperties: { frozenRowCount: 1 } } } }] },
      }),
    );
    const propiedades = creada.data.replies?.[0]?.addSheet?.properties;
    sheetId = propiedades?.sheetId ?? null;
    filasDeLaCuadricula = propiedades?.gridProperties?.rowCount ?? 1000;
    if (sheetId !== null) {
      await conEspera(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: idLibro,
          requestBody: {
            requests: [
              ...peticionesDeTitulos(sheetId),
              ...anchos.map((pixelSize, i) => ({
                updateDimensionProperties: {
                  range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
                  properties: { pixelSize },
                  fields: 'pixelSize',
                },
              })),
            ],
          },
        }),
      );
    }
  }

  const ultima = String.fromCharCode('A'.charCodeAt(0) + encabezados.length - 1);
  // Escribir fuera de la cuadrícula falla: se amplía si hace falta.
  if (sheetId !== null && filasDeLaCuadricula < filas.length + 1) {
    await conEspera(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: idLibro,
        requestBody: { requests: [{ appendDimension: { sheetId, dimension: 'ROWS', length: filas.length + 1 - filasDeLaCuadricula + 100 } }] },
      }),
    );
  }
  await conEspera(() => sheets.spreadsheets.values.clear({ spreadsheetId: idLibro, range: rangoDe(titulo, `A1:${ultima}`) }));
  await conEspera(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: idLibro,
      range: rangoDe(titulo, 'A1'),
      // RAW: nombres y títulos los escribe cualquiera en el formulario público; nunca se interpretan como fórmula.
      valueInputOption: 'RAW',
      requestBody: { values: [[...encabezados], ...filas.map((f) => [...f])] },
    }),
  );
  return { filas: filas.length };
}
