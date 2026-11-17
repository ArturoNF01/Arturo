import 'server-only';
import {
  COLUMNA_CON_REGISTRO, ENCABEZADOS_DE_LA_HOJA_RETIRADA, ENCABEZADOS_PERSONAS, HOJA_PERSONAS, HOJA_RETIRADA, filasDePersonas, planDeHoja,
} from '@/lib/asistencia';
import { HOJA_LISTA, nombreDePerfil, rangoDe } from '@/lib/normalizacion';
import { ponenciasParaLaHoja } from '@/lib/ponentes';
import { todasLasAsistencias } from './asistencia';
import { clienteSheets, googleConfigurado } from './google';
import { conEspera, peticionesDeTitulos } from './sheets';

/**
 * La pestaña «Asistencia por persona» de la hoja de Google: una fila por persona, como la tabla «Por persona» del
 * panel —nombre, correo, perfil, un día por columna y el total— más «Con registro», una casilla de verificación que está
 * marcada si la persona tenía registro, y «Ponencia», el título de la ponencia del programa en que participó, si presentó
 * una. De ahí se hacen las constancias, que sólo reciben quienes estaban registrados.
 *
 * La pestaña «Asistencias» que había antes (una fila por asistencia) se retiró: esta pasada la quita de la hoja, una
 * sola vez y sólo si es la que puso el sistema (`retirarLaPestanaVieja`). El detalle por asistencia sigue en el panel y en
 * su CSV.
 *
 * **No se escribe al escanear, sino poco después y por lotes.** Cien personas escaneando a la vez serían cien
 * escrituras a Google, que corta a las sesenta por minuto, y el escaneo no puede depender de que Google
 * conteste. Por eso cada asistencia se guarda primero en la base, y la hoja se pone al día así:
 *
 *  - unos segundos después del último escaneo (`pedirSincronizacionDeAsistencias`): todos los escaneos de esa
 *    ráfaga se juntan en una sola pasada;
 *  - cada diez minutos por cron y en cada despliegue (`npm run sincronizar`), que es la red de abajo: si Google
 *    falló en el momento, la pasada siguiente lo alcanza;
 *  - a pedido, con el botón del panel.
 *
 * La pestaña es una copia de la base (la base manda): se compara fila por fila y sólo se escribe lo que
 * falta o cambió. Sólo toca sus diez columnas; lo que alguien anote a la derecha no se pisa. Y como una copia
 * que desaparece es peor que una copia que tarda, no quita filas de golpe: si la hoja tuviera muchas más
 * que la base (un respaldo viejo restaurado, una tabla vaciada), se detiene y lo dice.
 */

const FILAS_POR_ESCRITURA = 1000;
const MAXIMO_DE_FILAS_QUE_SOBRAN = 10;
/** Filas de más que se piden al ampliar la pestaña, para no ampliarla en cada pasada. */
const HOLGURA_DE_FILAS = 500;
/** Lo que se espera tras el último escaneo antes de pasar a la hoja: junta una ráfaga en una sola pasada. */
export const ESPERA_AUTOMATICA_MS = 15_000;

/** Lo que pasó con la pestaña «Asistencias» del diseño anterior, que esta pasada encontró y retira. */
export interface RetiroDeLaPestana {
  /** Verdadero si se quitó (o, al simular, si se quitaría). */
  quitada: boolean;
  /** Verdadero si se intentó quitar y Google no dejó: se reintenta en la siguiente pasada. */
  fallo?: boolean;
  mensaje: string;
}

export interface ResultadoDeAsistencias {
  nuevas: number;
  cambiadas: number;
  quitadas: number;
  /** Si no se tocó la hoja, por qué. */
  omitido?: string;
  /** Verdadero si sólo se calculó lo que pasaría. */
  simulado?: boolean;
  /** Si la hoja todavía tenía la pestaña «Asistencias» del diseño anterior, qué se hizo con ella. */
  retirada?: RetiroDeLaPestana;
  /** Cambios en la estructura de la hoja que conviene decir: una columna que se insertó, por ejemplo. */
  avisos?: string[];
}

export interface OpcionesDeSincronizacion {
  /** Quitar de la hoja más filas de las que se quitan solas, o vaciarla si la base quedó vacía. */
  forzar?: boolean;
  /** Sólo calcular lo que pasaría. */
  simular?: boolean;
}

/** La letra de la columna n: la 5.ª es la E. La pestaña no pasa de 26 columnas. */
const letraDeColumna = (n: number) => String.fromCharCode('A'.charCodeAt(0) + n - 1);
/** La letra de la última columna propia: J con diez columnas. */
const ULTIMA_COLUMNA = letraDeColumna(ENCABEZADOS_PERSONAS.length);

const enBlanco = (fila: readonly unknown[]) => fila.every((c) => String(c ?? '').trim() === '');

type Cliente = ReturnType<typeof clienteSheets>;
interface PestanaDelLibro { properties?: { title?: string | null; sheetId?: number | null } | null }

/** El rango de «Con registro» en esas filas (la primera fila de la hoja es la 0, y `hasta` no entra). */
const rangoDeCasillas = (sheetId: number, desde: number, hasta: number) => ({
  sheetId, startRowIndex: desde, endRowIndex: hasta, startColumnIndex: COLUMNA_CON_REGISTRO, endColumnIndex: COLUMNA_CON_REGISTRO + 1,
});

/**
 * Pide que esas celdas sean casillas de verificación. Una validación «booleana» estricta es lo que Sheets muestra como
 * casilla: el verdadero se ve marcado y el falso, vacío. Sólo se pone en las filas con datos —en una columna entera
 * saldrían casillas vacías hasta el final de la hoja— y se pone antes de escribir los valores, para que, si falla, la pasada
 * siguiente lo repita todo junto en vez de dejar «TRUE» y «FALSE» escritos como texto.
 */
const pedirCasillas = (sheetId: number, desde: number, hasta: number) => ({
  setDataValidation: { range: rangoDeCasillas(sheetId, desde, hasta), rule: { condition: { type: 'BOOLEAN' }, strict: true } },
});

/** Lo contrario, para las filas que se vacían: sin `rule`, Google quita la validación de ese rango. */
const quitarCasillas = (sheetId: number, desde: number, hasta: number) => ({
  setDataValidation: { range: rangoDeCasillas(sheetId, desde, hasta) },
});

/**
 * Quita la pestaña «Asistencias» del diseño anterior (una fila por asistencia): se pidió dejar sólo «Asistencia por
 * persona». Es una copia de la base —no se pierde nada: el panel y su CSV siguen teniendo el detalle— y, si hiciera falta,
 * Archivo → Historial de versiones la recupera.
 *
 * Aun así se mira antes de borrar: sólo se quita si sus títulos son exactamente los que le ponía el sistema (ni una columna de
 * más, ni una distinta); una pestaña con ese nombre hecha a mano, o a la que alguien añadió algo, se deja y se avisa. Se
 * llama al final de una pasada que sí dejó al día «Asistencia por persona», nunca antes: no se quita lo viejo hasta tener lo
 * nuevo. Y se hace sin estado que recordar: una vez quitada ya no está, y una pasada siguiente no la encuentra.
 */
async function retirarLaPestanaVieja(
  sheets: Cliente, idLibro: string, hojas: readonly PestanaDelLibro[], simular: boolean,
): Promise<RetiroDeLaPestana | undefined> {
  const sheetId = hojas.find((h) => h.properties?.title === HOJA_RETIRADA)?.properties?.sheetId;
  if (typeof sheetId !== 'number') return undefined;

  // Hasta la Z, no sólo hasta donde llegaban sus títulos: lo que alguien haya añadido a la derecha tiene que verse.
  const titulos = (await conEspera(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: idLibro, range: rangoDe(HOJA_RETIRADA, 'A1:Z1') }),
  )).data.values?.[0] ?? [];
  const puestos = titulos.map((t) => String(t ?? '').trim());
  while (puestos.length > 0 && puestos[puestos.length - 1] === '') puestos.pop();
  const esLaDelSistema = ENCABEZADOS_DE_LA_HOJA_RETIRADA.some(
    (e) => e.length === puestos.length && e.every((t, i) => puestos[i] === t),
  );
  if (!esLaDelSistema) {
    return {
      quitada: false,
      mensaje: `La pestaña «${HOJA_RETIRADA}» no se quitó: no tiene los títulos que le ponía el sistema (¿se le añadió algo?). Si ya no la necesita, bórrela a mano.`,
    };
  }
  if (simular) {
    return { quitada: true, mensaje: `Se quitaría la pestaña «${HOJA_RETIRADA}» (una fila por asistencia): sólo queda «${HOJA_PERSONAS}».` };
  }
  try {
    await conEspera(() =>
      sheets.spreadsheets.batchUpdate({ spreadsheetId: idLibro, requestBody: { requests: [{ deleteSheet: { sheetId } }] } }),
    );
    return {
      quitada: true,
      mensaje: `Se quitó la pestaña «${HOJA_RETIRADA}» (una fila por asistencia): sólo queda «${HOJA_PERSONAS}». Si hiciera falta, Archivo → Historial de versiones la recupera.`,
    };
  } catch (fallo) {
    // Que no se pueda quitar lo viejo no estropea lo nuevo, que ya quedó bien: se dice y se reintenta en la siguiente pasada.
    return {
      quitada: false,
      fallo: true,
      mensaje: `No se pudo quitar la pestaña «${HOJA_RETIRADA}»: ${fallo instanceof Error ? fallo.message : String(fallo)}. Se reintenta en la siguiente pasada.`,
    };
  }
}

/** Pone al día la pestaña «Asistencia por persona»: la crea si no existe, pone sus títulos y escribe lo que falta o cambió. */
export async function sincronizarAsistencias(
  { forzar = false, simular = false }: OpcionesDeSincronizacion = {},
): Promise<ResultadoDeAsistencias> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) throw new Error('Google Sheets no está configurado.');
  const sheets = clienteSheets();

  const libro = await conEspera(() =>
    sheets.spreadsheets.get({
      spreadsheetId: idLibro,
      fields: 'sheets(properties(sheetId,title,index,gridProperties(rowCount)))',
    }),
  );
  const hojas = libro.data.sheets ?? [];
  const existente = hojas.find((h) => h.properties?.title === HOJA_PERSONAS)?.properties;
  let sheetId = existente?.sheetId ?? null;
  // Una pestaña nueva de Google trae 1,000 filas.
  let filasDeLaCuadricula = existente?.gridProperties?.rowCount ?? 1000;

  const deseadas = filasDePersonas(await todasLasAsistencias(), nombreDePerfil, ponenciasParaLaHoja);

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
                title: HOJA_PERSONAS,
                ...(typeof ancla === 'number' ? { index: ancla + 1 } : {}),
                gridProperties: { frozenRowCount: 1 },
              },
            },
          }],
        },
      }),
    );
    const propiedades = creada.data.replies?.[0]?.addSheet?.properties;
    sheetId = propiedades?.sheetId ?? null;
    filasDeLaCuadricula = propiedades?.gridProperties?.rowCount ?? 1000;
    if (sheetId !== null) {
      await conEspera(() =>
        sheets.spreadsheets.batchUpdate({ spreadsheetId: idLibro, requestBody: { requests: peticionesDeTitulos(sheetId) } }),
      );
    }
  }

  // Los títulos: si la pestaña acaba de crearse, o alguien la creó a mano o los cambió, se ponen los de siempre.
  // Sin ellos la primera fila de datos quedaría debajo de nada, y «N.º» no se encontraría.
  const avisos: string[] = [];
  const conAvisos = (r: ResultadoDeAsistencias): ResultadoDeAsistencias => (avisos.length > 0 ? { ...r, avisos } : r);
  if (sheetId !== null && !simular) {
    const titulos = ((await conEspera(() =>
      sheets.spreadsheets.values.get({ spreadsheetId: idLibro, range: rangoDe(HOJA_PERSONAS, `A1:${ULTIMA_COLUMNA}1`) }),
    )).data.values?.[0] ?? []).map((t) => String(t ?? '').trim());

    // La última columna («Ponencia») se añadió después de que la pestaña existiera, y a su derecha pudo haber crecido algo
    // de quien hace las constancias: las columnas que añaden los complementos de Sheets (el enlace de cada documento, si ya
    // se mandó…) van justo detrás de la última. Si en el lugar que le toca ya hay una columna que no es nuestra, no se
    // escribe encima: se inserta una nueva y lo de esa persona se recorre una a la derecha, con sus datos y fórmulas. Una
    // celda en blanco, o la nuestra, no necesita nada; y una vez puesto el título, no vuelve a hacer falta.
    const nueva = ENCABEZADOS_PERSONAS.length - 1;
    if ((titulos[nueva] ?? '') !== '' && titulos[nueva] !== ENCABEZADOS_PERSONAS[nueva]) {
      await conEspera(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: idLibro,
          requestBody: {
            requests: [{
              insertDimension: { range: { sheetId, dimension: 'COLUMNS', startIndex: nueva, endIndex: nueva + 1 }, inheritFromBefore: false },
            }],
          },
        }),
      );
      titulos[nueva] = '';
      avisos.push(`Se insertó la columna «${ENCABEZADOS_PERSONAS[nueva]}» (${letraDeColumna(nueva + 1)}) de «${HOJA_PERSONAS}»: lo que había a su derecha se recorrió una columna, con sus datos.`);
    }

    const dicenLoEsperado =
      ENCABEZADOS_PERSONAS.length === titulos.filter((t) => t !== '').length &&
      ENCABEZADOS_PERSONAS.every((t, i) => titulos[i] === t);
    if (!dicenLoEsperado) {
      await conEspera(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: idLibro,
          range: rangoDe(HOJA_PERSONAS, 'A1'),
          valueInputOption: 'RAW',
          requestBody: { values: [[...ENCABEZADOS_PERSONAS]] },
        }),
      );
    }
  }

  const leida = sheetId === null
    ? []
    : ((await conEspera(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: idLibro,
          range: rangoDe(HOJA_PERSONAS, `A2:${ULTIMA_COLUMNA}`),
        }),
      )).data.values ?? []);
  // Sólo se descartan las filas en blanco del final (restos de un borrado a mano): una en blanco a mitad de
  // lista cuenta como una fila que difiere, y se reescribe, para que cada fila siga en su lugar.
  let fin = leida.length;
  while (fin > 0 && enBlanco(leida[fin - 1])) fin -= 1;
  const enLaHoja = leida.slice(0, fin);
  const hojaEstaba = enLaHoja.length;

  const plan = planDeHoja(deseadas, enLaHoja, ENCABEZADOS_PERSONAS.length);
  const resultado: ResultadoDeAsistencias = {
    nuevas: plan.nuevas, cambiadas: plan.cambian, quitadas: plan.sobran, ...(simular ? { simulado: true } : {}),
  };

  if (deseadas.length === 0 && hojaEstaba > 0 && !forzar) {
    return conAvisos({ ...resultado, nuevas: 0, cambiadas: 0, quitadas: 0, omitido: `La base no tiene asistencias y la pestaña «${HOJA_PERSONAS}» sí: no se toca. Si es lo que se quiere, npm run sincronizar -- --forzar` });
  }
  if (plan.sobran > MAXIMO_DE_FILAS_QUE_SOBRAN && !forzar) {
    return conAvisos({ ...resultado, nuevas: 0, cambiadas: 0, quitadas: 0, omitido: `La pestaña «${HOJA_PERSONAS}» tiene ${plan.sobran} filas más que la base: no se quitan solas (¿un respaldo viejo?). Si son las que se quitaron a propósito, npm run sincronizar -- --forzar` });
  }
  if (simular) {
    const retirada = await retirarLaPestanaVieja(sheets, idLibro, hojas, true);
    return { ...resultado, ...(retirada ? { retirada } : {}) };
  }
  if (sheetId === null) return resultado;

  // Escribir en una fila que la pestaña no tiene falla («exceeds grid limits»), y una pestaña nueva trae 1,000: con
  // varios cientos de personas se podría pasar. Se amplía antes.
  const filasNecesarias = deseadas.length + 1;
  if (plan.escribir.length > 0 && filasDeLaCuadricula < filasNecesarias) {
    const largo = filasNecesarias - filasDeLaCuadricula + HOLGURA_DE_FILAS;
    await conEspera(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: idLibro,
        requestBody: { requests: [{ appendDimension: { sheetId, dimension: 'ROWS', length: largo } }] },
      }),
    );
  }

  for (let i = 0; i < plan.escribir.length; i += FILAS_POR_ESCRITURA) {
    const lote = plan.escribir.slice(i, i + FILAS_POR_ESCRITURA);
    const primera = plan.desde + i + 2; // +1 por los títulos y +1 porque las filas de Google empiezan en 1
    // Primero las casillas de «Con registro» de esas filas (la fila de Google n es la n-1 de la API), luego los valores.
    await conEspera(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: idLibro,
        requestBody: { requests: [pedirCasillas(sheetId, primera - 1, primera - 1 + lote.length)] },
      }),
    );
    await conEspera(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId: idLibro,
        range: rangoDe(HOJA_PERSONAS, `A${primera}:${ULTIMA_COLUMNA}${primera + lote.length - 1}`),
        // RAW: lo que escribe cualquiera en el formulario público no se interpreta nunca como fórmula; y el verdadero y el
        // falso van como valores lógicos, que es lo que las casillas muestran.
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
        range: rangoDe(HOJA_PERSONAS, `A${desde}:${ULTIMA_COLUMNA}${desde + plan.sobran - 1}`),
      }),
    );
    // Y sus casillas: sin esto quedarían casillas vacías en filas que ya no son de nadie.
    await conEspera(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: idLibro,
        requestBody: { requests: [quitarCasillas(sheetId, desde - 1, desde - 1 + plan.sobran)] },
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
              dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: ENCABEZADOS_PERSONAS.length },
            },
          }],
        },
      }),
    );
  }

  // Lo nuevo ya está al día: ahora sí se quita la pestaña vieja, si todavía está.
  const retirada = await retirarLaPestanaVieja(sheets, idLibro, hojas, false);
  return conAvisos(retirada ? { ...resultado, retirada } : resultado);
}

// ---------------------------------------------------------------------------
// Pasar a la hoja sin esperar al cron
// ---------------------------------------------------------------------------

export interface EstadoDeLaHoja {
  /** Cuándo se puso al día la hoja por última vez desde este proceso (ISO), si ya pasó. */
  ultimaVez: string | null;
  /** Por qué falló la última vez, si falló. Se borra al siguiente éxito. */
  error: string | null;
}

const estado: EstadoDeLaHoja = { ultimaVez: null, error: null };
export const estadoDeLaHoja = (): EstadoDeLaHoja => ({ ...estado });

/**
 * Las pasadas a la hoja de este proceso van de una en una: el botón del panel y la pasada automática no se
 * pisan. (El cron es otro proceso, pero compara contra la hoja antes de escribir, así que lo que ya está no
 * se repite.)
 */
let cola: Promise<unknown> = Promise.resolve();

/** Una pasada a la hoja que además anota cómo le fue, para que el panel lo enseñe. Si falla, relanza el error. */
export function sincronizarYAnotar(opciones?: { forzar?: boolean }): Promise<ResultadoDeAsistencias> {
  const pasada = cola.then(async () => {
    try {
      const r = await sincronizarAsistencias(opciones);
      estado.ultimaVez = new Date().toISOString();
      estado.error = r.omitido ?? null;
      return r;
    } catch (fallo) {
      estado.error = fallo instanceof Error ? fallo.message : String(fallo);
      throw fallo;
    }
  });
  cola = pasada.catch(() => undefined);
  return pasada;
}

let temporizador: ReturnType<typeof setTimeout> | null = null;

/**
 * Pide pasar la asistencia a la hoja «en un rato»: tras el último escaneo espera unos segundos y hace una sola
 * pasada para todos los que llegaron en ese lapso. Pedirlo muchas veces seguidas no multiplica las pasadas. Si
 * falla, no pasa nada grave: queda anotado en el estado, y el cron lo alcanza a los diez minutos.
 *
 * No hace nada si Google no está conectado (en una instalación local, por ejemplo).
 */
export function pedirSincronizacionDeAsistencias(): void {
  if (!googleConfigurado() || !process.env.GOOGLE_SHEETS_ID) return;
  if (temporizador) return;
  temporizador = setTimeout(() => {
    temporizador = null;
    sincronizarYAnotar().catch((fallo) => {
      console.error('No se pudo pasar la asistencia a la hoja:', fallo instanceof Error ? fallo.message : fallo);
    });
  }, ESPERA_AUTOMATICA_MS);
  // Que esperar la pasada no impida que el proceso termine.
  temporizador.unref?.();
}
