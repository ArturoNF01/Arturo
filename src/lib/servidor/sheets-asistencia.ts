import 'server-only';
import {
  ENCABEZADOS_ASISTENCIAS, HOJA_ASISTENCIAS, filasDeAsistencias, planDeHoja,
} from '@/lib/asistencia';
import { HOJA_LISTA, rangoDe } from '@/lib/normalizacion';
import { todasLasAsistencias } from './asistencia';
import { clienteSheets, googleConfigurado } from './google';
import { conEspera, peticionesDeTitulos } from './sheets';

/**
 * La pestaña «Asistencias» de la hoja de Google: una fila por asistencia, con el nombre, el correo, el día
 * y la mesa (y la modalidad).
 *
 * **No se escribe al escanear.** Cien personas escaneando a la vez serían cien escrituras a Google, que corta
 * a las sesenta por minuto, y el escaneo no puede depender de que Google conteste. La asistencia se guarda
 * en la base y esta pestaña se pone al día por lotes con `npm run sincronizar` —en cada despliegue y cada
 * diez minutos por cron—: una lectura y, si hay algo nuevo, una escritura.
 *
 * La pestaña es una copia de la base (la base manda): se compara fila por fila y sólo se escribe lo que
 * falta o cambió. Sólo toca sus seis columnas; lo que alguien anote a la derecha no se pisa. Y como una copia
 * que desaparece es peor que una copia que tarda, no quita filas de golpe: si la hoja tuviera muchas más
 * que la base (un respaldo viejo restaurado, una tabla vaciada), se detiene y lo dice.
 */

const FILAS_POR_ESCRITURA = 1000;
const MAXIMO_DE_FILAS_QUE_SOBRAN = 10;

export interface ResultadoDeAsistencias {
  nuevas: number;
  cambiadas: number;
  quitadas: number;
  /** Si no se tocó la hoja, por qué. */
  omitido?: string;
  /** Verdadero si sólo se calculó lo que pasaría. */
  simulado?: boolean;
}

/** La letra de la última columna propia: F con seis columnas. */
const ULTIMA_COLUMNA = String.fromCharCode('A'.charCodeAt(0) + ENCABEZADOS_ASISTENCIAS.length - 1);

export async function sincronizarAsistencias(
  { forzar = false, simular = false }: { forzar?: boolean; simular?: boolean } = {},
): Promise<ResultadoDeAsistencias> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) throw new Error('Google Sheets no está configurado.');
  const sheets = clienteSheets();

  const libro = await conEspera(() =>
    sheets.spreadsheets.get({ spreadsheetId: idLibro, fields: 'sheets(properties(sheetId,title,index))' }),
  );
  const hojas = libro.data.sheets ?? [];
  let sheetId = hojas.find((h) => h.properties?.title === HOJA_ASISTENCIAS)?.properties?.sheetId ?? null;

  const asistencias = await todasLasAsistencias();
  const deseadas = filasDeAsistencias(asistencias);

  // Sin pestaña y sin asistencias no hay nada que crear: la pestaña nace con la primera asistencia.
  if (sheetId === null && deseadas.length === 0) return { nuevas: 0, cambiadas: 0, quitadas: 0 };

  if (sheetId === null && !simular) {
    // Justo detrás de la lista de registrados, si está; si no, al final.
    const ancla = hojas.find((h) => h.properties?.title === HOJA_LISTA)?.properties?.index;
    const creada = await conEspera(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: idLibro,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: HOJA_ASISTENCIAS,
                ...(typeof ancla === 'number' ? { index: ancla + 1 } : {}),
                gridProperties: { frozenRowCount: 1 },
              },
            },
          }],
        },
      }),
    );
    sheetId = creada.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
    await conEspera(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId: idLibro,
        range: rangoDe(HOJA_ASISTENCIAS, 'A1'),
        valueInputOption: 'RAW',
        requestBody: { values: [[...ENCABEZADOS_ASISTENCIAS]] },
      }),
    );
    if (sheetId !== null) {
      await conEspera(() =>
        sheets.spreadsheets.batchUpdate({ spreadsheetId: idLibro, requestBody: { requests: peticionesDeTitulos(sheetId) } }),
      );
    }
  }

  const leida = sheetId === null
    ? []
    : ((await conEspera(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: idLibro,
          range: rangoDe(HOJA_ASISTENCIAS, `A2:${ULTIMA_COLUMNA}`),
        }),
      )).data.values ?? []);
  // Sólo se descartan las filas en blanco del final (restos de un borrado a mano): una en blanco a mitad de
  // lista cuenta como una fila que difiere, y se reescribe, para que cada fila siga en su lugar.
  let fin = leida.length;
  while (fin > 0 && leida[fin - 1].every((c) => String(c ?? '').trim() === '')) fin -= 1;
  const enLaHoja = leida.slice(0, fin);
  const hojaEstaba = enLaHoja.length;

  const plan = planDeHoja(deseadas, enLaHoja);
  const resultado: ResultadoDeAsistencias = {
    nuevas: plan.nuevas, cambiadas: plan.cambian, quitadas: plan.sobran, ...(simular ? { simulado: true } : {}),
  };

  if (deseadas.length === 0 && hojaEstaba > 0 && !forzar) {
    return { ...resultado, nuevas: 0, cambiadas: 0, quitadas: 0, omitido: 'La base no tiene asistencias y la hoja sí: no se toca la hoja. Si es lo que se quiere, npm run sincronizar -- --forzar' };
  }
  if (plan.sobran > MAXIMO_DE_FILAS_QUE_SOBRAN && !forzar) {
    return { ...resultado, nuevas: 0, cambiadas: 0, quitadas: 0, omitido: `La hoja tiene ${plan.sobran} filas más que la base: no se quitan solas (¿un respaldo viejo?). Si son las que se quitaron a propósito, npm run sincronizar -- --forzar` };
  }
  if (simular || sheetId === null) return resultado;

  for (let i = 0; i < plan.escribir.length; i += FILAS_POR_ESCRITURA) {
    const lote = plan.escribir.slice(i, i + FILAS_POR_ESCRITURA);
    const primera = plan.desde + i + 2; // +1 por los títulos y +1 porque las filas de Google empiezan en 1
    await conEspera(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId: idLibro,
        range: rangoDe(HOJA_ASISTENCIAS, `A${primera}:${ULTIMA_COLUMNA}${primera + lote.length - 1}`),
        // RAW: lo que escribe cualquiera en el formulario público no se interpreta nunca como fórmula.
        valueInputOption: 'RAW',
        requestBody: { values: lote },
      }),
    );
  }

  if (plan.sobran > 0) {
    const desde = deseadas.length + 2;
    await conEspera(() =>
      sheets.spreadsheets.values.clear({
        spreadsheetId: idLibro,
        range: rangoDe(HOJA_ASISTENCIAS, `A${desde}:${ULTIMA_COLUMNA}${desde + plan.sobran - 1}`),
      }),
    );
  }

  // Anchos a la medida la primera vez que se llena; después se respetan los que alguien haya puesto.
  if (hojaEstaba === 0 && plan.escribir.length > 0) {
    await conEspera(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: idLibro,
        requestBody: {
          requests: [{
            autoResizeDimensions: {
              dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: ENCABEZADOS_ASISTENCIAS.length },
            },
          }],
        },
      }),
    );
  }

  return resultado;
}
