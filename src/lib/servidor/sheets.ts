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

/**
 * Comprueba que la hoja tenga las columnas que este código escribe.
 *
 * Cuando el formulario cambia, cambian las columnas. Si la hoja se quedó con
 * las de antes, cada fila nueva entra desplazada: el teléfono debajo de
 * «Cargo», la institución debajo de «Correo». Nadie lo nota hasta que alguien
 * lee la hoja meses después y los datos no significan nada.
 *
 * Así que no se sigue adelante: se para con un aviso que dice qué hacer. Una
 * fila que no llega se recupera; cien filas descolocadas, no.
 */
async function comprobarEncabezados(idLibro: string) {
  const sheets = clienteSheets();
  const nombres = Object.keys(HOJAS);
  const leidos = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: idLibro,
    ranges: nombres.map((n) => `${n}!1:1`),
  });

  const desfasadas: string[] = [];
  for (const [i, nombre] of nombres.entries()) {
    const fila = (leidos.data.valueRanges?.[i]?.values?.[0] ?? []) as string[];
    // Una pestaña recién creada no tiene encabezados todavía; los escribe
    // `asegurarHojas`. Sólo se compara lo que ya tiene algo.
    if (fila.length === 0) continue;
    const esperados = HOJAS[nombre];
    if (fila.length !== esperados.length || esperados.some((e, j) => fila[j] !== e)) {
      desfasadas.push(nombre);
    }
  }

  if (desfasadas.length > 0) {
    throw new Error(
      `La hoja tiene las columnas anteriores en ${desfasadas.join(', ')}. ` +
        'Reescríbala con: npm run sincronizar -- --rehacer',
    );
  }
}

/**
 * Cuándo se comprobó por última vez que el libro está en su sitio.
 *
 * La comprobación cuesta dos llamadas a Google —la estructura del libro y la
 * primera fila de cada pestaña— y se hacía en cada alta. Con el registro
 * abierto al público eso son entre tres y ocho llamadas por persona, y Google
 * corta a las sesenta por minuto: en la primera hora de una convocatoria
 * masiva, la mitad de los registros no llegaría a la hoja. Llegan igual
 * —quedan pendientes y el cron los recoge— pero el panel se llena de avisos
 * y la hoja va con retraso justo cuando más se mira.
 *
 * Un minuto de memoria basta para lo que importa: una ráfaga de cien altas
 * en el mismo minuto gasta una comprobación en vez de cien. Más tiempo no
 * ahorra mucho más y sí abre un hueco: si alguien reordena las columnas a
 * mano —o se despliega una versión con columnas nuevas sin rehacer la hoja—
 * durante ese rato se escriben filas desplazadas, que es exactamente lo que
 * la comprobación existe para evitar y lo que nadie nota hasta meses después.
 */
let libroRevisado: { id: string; cuando: number } | null = null;
const VIGENCIA_REVISION = 60 * 1000;

/** Olvida lo comprobado. La usan las operaciones que rehacen la hoja. */
export function olvidarRevisionDelLibro(): void {
  libroRevisado = null;
}

/** Crea las pestañas que falten y escribe sus encabezados. */
async function asegurarHojas(idLibro: string) {
  if (
    libroRevisado &&
    libroRevisado.id === idLibro &&
    Date.now() - libroRevisado.cuando < VIGENCIA_REVISION
  ) {
    return;
  }

  const sheets = clienteSheets();
  const libro = await sheets.spreadsheets.get({ spreadsheetId: idLibro });
  const existentes = new Set(
    (libro.data.sheets ?? []).map((h) => h.properties?.title).filter(Boolean) as string[],
  );

  const faltantes = Object.keys(HOJAS).filter((nombre) => !existentes.has(nombre));
  if (faltantes.length === 0) {
    await comprobarEncabezados(idLibro);
    libroRevisado = { id: idLibro, cuando: Date.now() };
    return;
  }

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

  await comprobarEncabezados(idLibro);
  libroRevisado = { id: idLibro, cuando: Date.now() };
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

/**
 * La única fórmula que sale de aquí: el enlace «Descargar» de los archivos
 * en Drive. Se reconoce por su forma exacta, no por empezar con «=», para
 * que una celda que alguien escriba imitándola siga siendo texto.
 */
const ENLACE_PROPIO = /^=HYPERLINK\("https:\/\/[^"]*";"[^"]*"\)$/;

export function blindar(valor: string | number): string | number {
  // Los números van como números: un cupo o un límite de palabras debe poder
  // sumarse en la hoja.
  if (typeof valor !== 'string') return valor;
  if (ENLACE_PROPIO.test(valor)) return valor;
  return PELIGROSOS.test(valor) ? `'${valor}` : valor;
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

  const sheets = clienteSheets();
  // Sin `asegurarHojas`: eso comprueba los encabezados y aquí venimos
  // justamente a arreglarlos. Se vacía todo, encabezados incluidos, y se
  // vuelven a escribir los de ahora.
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: idLibro,
    requestBody: { ranges: Object.keys(HOJAS).map((hoja) => `${hoja}!A:ZZ`) },
  });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: idLibro,
    requestBody: {
      valueInputOption: 'RAW',
      data: Object.entries(HOJAS).map(([nombre, encabezados]) => ({
        range: `${nombre}!A1`,
        values: [encabezados],
      })),
    },
  });
  // El libro acaba de cambiar por debajo: lo que se hubiera comprobado antes
  // ya no describe lo que hay.
  olvidarRevisionDelLibro();
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
