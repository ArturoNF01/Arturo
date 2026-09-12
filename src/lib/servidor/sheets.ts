import 'server-only';
import { clienteSheets, googleConfigurado } from './google';
import { HOJAS, filasDeRegistro } from '@/lib/normalizacion';
import { leerDatosCongreso, leerEjes } from './contenido';
import { traducir } from '@/lib/contenido';

type Registro = Record<string, unknown>;

/**
 * El libro de seguimiento se lleva en español y con nombres legibles: aquí se
 * resuelve la clave del eje temático y se fija el límite de semblanza vigente.
 */
async function prepararParaHoja(registro: Registro): Promise<Registro> {
  const [{ filas: ejes }, congreso] = await Promise.all([leerEjes(), leerDatosCongreso()]);
  const eje = ejes.find((e) => e.clave === registro.eje_tematico);

  return {
    ...registro,
    eje_tematico: eje ? traducir(eje.nombre, 'es') : registro.eje_tematico,
    limite_semblanza_palabras: congreso.limite_semblanza_palabras,
  };
}

/** Crea las pestañas que falten y escribe sus encabezados. */
async function asegurarHojas(idLibro: string) {
  const sheets = clienteSheets();
  const libro = await sheets.spreadsheets.get({ spreadsheetId: idLibro });
  const existentes = new Set(
    (libro.data.sheets ?? []).map((h) => h.properties?.title).filter(Boolean) as string[],
  );

  const faltantes = Object.keys(HOJAS).filter((nombre) => !existentes.has(nombre));
  if (faltantes.length === 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: idLibro,
    requestBody: {
      requests: faltantes.map((title) => ({ addSheet: { properties: { title } } })),
    },
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: idLibro,
    requestBody: {
      valueInputOption: 'RAW',
      data: faltantes.map((nombre) => ({
        range: `${nombre}!A1`,
        values: [HOJAS[nombre]],
      })),
    },
  });
}

/**
 * Pone un apóstrofo delante de lo que Sheets intentaría interpretar.
 *
 * Un teléfono «+52 55 …» entra como fórmula y la celda acaba en #ERROR!, que
 * es lo que se veía. Los otros tres signos —=, - y @— abren el mismo camino,
 * y ahí ya no es sólo un número mal puesto: son datos que escribe cualquiera
 * desde el formulario público, y una celda que empieza por «=» se ejecuta al
 * abrir la hoja. El apóstrofo no se guarda ni se ve: le dice a Sheets «esto
 * es texto» y la celda muestra el número tal cual.
 */
const PELIGROSOS = /^[=+\-@]/;

export function blindar(valor: string | number): string | number {
  // Los números van como números: un cupo o un límite de palabras debe poder
  // sumarse en la hoja.
  return typeof valor === 'string' && PELIGROSOS.test(valor) ? `'${valor}` : valor;
}

/** Añade un registro a todas las pestañas que le corresponden. */
export async function sincronizarRegistro(registro: Registro): Promise<void> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) {
    throw new Error('Google Sheets no está configurado.');
  }

  await asegurarHojas(idLibro);
  const sheets = clienteSheets();
  const filas = filasDeRegistro(await prepararParaHoja(registro));

  for (const [hoja, valores] of Object.entries(filas)) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: idLibro,
      range: `${hoja}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: valores.map((fila) => fila.map(blindar)) },
    });
  }
}

/**
 * Borra el contenido de todas las pestañas, dejando los encabezados.
 *
 * Hace falta cuando lo que cambia es *cómo* se escribe una celda —y no el
 * registro— y hay que volver a volcarlo todo: reenviar sin más añadiría
 * cien filas repetidas debajo de las cien que ya están.
 */
export async function vaciarHojas(): Promise<void> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) throw new Error('Google Sheets no está configurado.');

  await asegurarHojas(idLibro);
  const sheets = clienteSheets();
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: idLibro,
    // Desde la fila 2: la 1 lleva los encabezados y se queda.
    requestBody: { ranges: Object.keys(HOJAS).map((hoja) => `${hoja}!A2:ZZ`) },
  });
}

/**
 * Reemplaza en Sheets las filas de un registro editado: borra las que llevan
 * su folio en la columna A y vuelve a insertarlas con los datos nuevos.
 */
export async function resincronizarRegistro(registro: Registro): Promise<void> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) throw new Error('Google Sheets no está configurado.');

  await asegurarHojas(idLibro);
  const sheets = clienteSheets();
  const folio = String(registro.folio ?? '');
  const libro = await sheets.spreadsheets.get({ spreadsheetId: idLibro });
  const idsHoja = new Map(
    (libro.data.sheets ?? []).map((h) => [h.properties?.title ?? '', h.properties?.sheetId ?? 0]),
  );

  for (const hoja of Object.keys(HOJAS)) {
    const columnaA = await sheets.spreadsheets.values.get({
      spreadsheetId: idLibro,
      range: `${hoja}!A2:A`,
    });
    const indices = (columnaA.data.values ?? [])
      .map((fila, i) => (fila[0] === folio ? i + 1 : -1)) // +1: la fila 1 es encabezado
      .filter((i) => i >= 0)
      .sort((a, b) => b - a);

    if (indices.length === 0) continue;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: idLibro,
      requestBody: {
        requests: indices.map((indice) => ({
          deleteDimension: {
            range: {
              sheetId: idsHoja.get(hoja),
              dimension: 'ROWS',
              startIndex: indice,
              endIndex: indice + 1,
            },
          },
        })),
      },
    });
  }

  await sincronizarRegistro(registro);
}
