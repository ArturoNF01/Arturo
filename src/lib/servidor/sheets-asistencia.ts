import 'server-only';
import {
  ENCABEZADOS_ANTERIORES, ENCABEZADOS_ASISTENCIAS, ENCABEZADOS_PERSONAS, HOJA_ASISTENCIAS, HOJA_PERSONAS,
  filasDeAsistencias, filasDePersonas, planDeHoja, type FilaDeHoja,
} from '@/lib/asistencia';
import { HOJA_LISTA, nombreDePerfil, rangoDe } from '@/lib/normalizacion';
import { todasLasAsistencias, type Asistente } from './asistencia';
import { clienteSheets, googleConfigurado } from './google';
import { conEspera, peticionesDeTitulos } from './sheets';

/**
 * Las pestañas de asistencia de la hoja de Google, las dos copias de la base:
 *
 *  - «Asistencias»: una fila por asistencia, con el nombre, el correo, el día y la modalidad (el detalle).
 *  - «Asistencia por persona»: una fila por persona, como la pestaña «Personas» del panel —nombre, correo, perfil, un día por
 *    columna y el total— más «Con registro». De ahí se hacen las constancias, que sólo reciben quienes estaban registrados.
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
 * Cada pestaña es una copia de la base (la base manda): se compara fila por fila y sólo se escribe lo que
 * falta o cambió. Sólo toca sus propias columnas; lo que alguien anote a la derecha no se pisa. Y como una copia
 * que desaparece es peor que una copia que tarda, no quita filas de golpe: si la hoja tuviera muchas más
 * que la base (un respaldo viejo restaurado, una tabla vaciada), se detiene y lo dice.
 */

const FILAS_POR_ESCRITURA = 1000;
const MAXIMO_DE_FILAS_QUE_SOBRAN = 10;
/** Filas de más que se piden al ampliar la pestaña, para no ampliarla en cada pasada. */
const HOLGURA_DE_FILAS = 500;
/** Lo que se espera tras el último escaneo antes de pasar a la hoja: junta una ráfaga en una sola pasada. */
export const ESPERA_AUTOMATICA_MS = 15_000;

export interface ResultadoDeAsistencias {
  nuevas: number;
  cambiadas: number;
  quitadas: number;
  /** Si no se tocó la hoja, por qué. */
  omitido?: string;
  /** Verdadero si sólo se calculó lo que pasaría. */
  simulado?: boolean;
}

/** Una pestaña de asistencia: cómo se llama, qué columnas lleva y qué filas le tocan según la base. */
interface Pestana {
  titulo: string;
  encabezados: readonly string[];
  /** Los títulos que tuvo en un diseño anterior, si lo hubo: se reconocen para rehacerla con los de ahora. */
  anteriores?: readonly string[];
  filas: (asistencias: Asistente[]) => FilaDeHoja[];
}

const PESTANA_DE_DETALLE: Pestana = {
  titulo: HOJA_ASISTENCIAS,
  encabezados: ENCABEZADOS_ASISTENCIAS,
  anteriores: ENCABEZADOS_ANTERIORES,
  filas: filasDeAsistencias,
};

const PESTANA_POR_PERSONA: Pestana = {
  titulo: HOJA_PERSONAS,
  encabezados: ENCABEZADOS_PERSONAS,
  filas: (asistencias) => filasDePersonas(asistencias, nombreDePerfil),
};

/** La letra de la columna n: la 5.ª es la E. Las pestañas de asistencia no pasan de 26 columnas. */
const letraDeColumna = (n: number) => String.fromCharCode('A'.charCodeAt(0) + n - 1);

const enBlanco = (fila: readonly unknown[]) => fila.every((c) => String(c ?? '').trim() === '');

export interface OpcionesDeSincronizacion {
  /** Quitar de la hoja más filas de las que se quitan solas, o vaciarla si la base quedó vacía. */
  forzar?: boolean;
  /** Sólo calcular lo que pasaría. */
  simular?: boolean;
}

/** Pone al día una pestaña de asistencia: la crea si no existe, pone sus títulos y escribe lo que falta o cambió. */
async function sincronizarPestana(
  pestana: Pestana,
  { forzar = false, simular = false }: OpcionesDeSincronizacion = {},
): Promise<ResultadoDeAsistencias> {
  const { titulo, encabezados, anteriores } = pestana;
  /** La letra de la última columna propia: E con cinco columnas. */
  const ultimaColumna = letraDeColumna(encabezados.length);
  /** Hasta dónde se miran los títulos: las columnas de ahora y las que tuvo un diseño anterior. */
  const ultimaColumnaDeTitulos = letraDeColumna(Math.max(encabezados.length, anteriores?.length ?? 0));

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
  const existente = hojas.find((h) => h.properties?.title === titulo)?.properties;
  let sheetId = existente?.sheetId ?? null;
  // Una pestaña nueva de Google trae 1,000 filas.
  let filasDeLaCuadricula = existente?.gridProperties?.rowCount ?? 1000;

  const deseadas = pestana.filas(await todasLasAsistencias());

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
                title: titulo,
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
  if (sheetId !== null && !simular) {
    const titulos = (await conEspera(() =>
      sheets.spreadsheets.values.get({ spreadsheetId: idLibro, range: rangoDe(titulo, `A1:${ultimaColumnaDeTitulos}1`) }),
    )).data.values?.[0] ?? [];
    const dicen = (esperados: readonly string[]) =>
      esperados.length === titulos.filter((t) => String(t ?? '').trim() !== '').length &&
      esperados.every((t, i) => String(titulos[i] ?? '').trim() === t);

    // La pestaña del diseño anterior (una asistencia por mesa, con su columna «Mesa») se rehace entera: es una copia
    // de la base, y sus filas ya no encajan en las columnas de ahora. Se vacía y se vuelve a escribir desde la base.
    //
    // Con una salvedad: si la base no tiene ninguna asistencia (un respaldo viejo, una tabla vaciada) lo que hay en
    // la hoja podría ser lo único que queda, y no se toca sin `forzar`.
    const anterior = anteriores !== undefined && dicen(anteriores);
    const puedeRehacer = deseadas.length > 0 || forzar;
    if (anterior && puedeRehacer) {
      await conEspera(() =>
        sheets.spreadsheets.values.clear({
          spreadsheetId: idLibro,
          range: rangoDe(titulo, `A1:${ultimaColumnaDeTitulos}`),
        }),
      );
    }
    if (!dicen(encabezados) && (!anterior || puedeRehacer)) {
      await conEspera(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: idLibro,
          range: rangoDe(titulo, 'A1'),
          valueInputOption: 'RAW',
          requestBody: { values: [[...encabezados]] },
        }),
      );
    }
  }

  const leida = sheetId === null
    ? []
    : ((await conEspera(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: idLibro,
          range: rangoDe(titulo, `A2:${ultimaColumna}`),
        }),
      )).data.values ?? []);
  // Sólo se descartan las filas en blanco del final (restos de un borrado a mano): una en blanco a mitad de
  // lista cuenta como una fila que difiere, y se reescribe, para que cada fila siga en su lugar.
  let fin = leida.length;
  while (fin > 0 && enBlanco(leida[fin - 1])) fin -= 1;
  const enLaHoja = leida.slice(0, fin);
  const hojaEstaba = enLaHoja.length;

  const plan = planDeHoja(deseadas, enLaHoja, encabezados.length);
  const resultado: ResultadoDeAsistencias = {
    nuevas: plan.nuevas, cambiadas: plan.cambian, quitadas: plan.sobran, ...(simular ? { simulado: true } : {}),
  };

  if (deseadas.length === 0 && hojaEstaba > 0 && !forzar) {
    return { ...resultado, nuevas: 0, cambiadas: 0, quitadas: 0, omitido: `La base no tiene asistencias y la pestaña «${titulo}» sí: no se toca. Si es lo que se quiere, npm run sincronizar -- --forzar` };
  }
  if (plan.sobran > MAXIMO_DE_FILAS_QUE_SOBRAN && !forzar) {
    return { ...resultado, nuevas: 0, cambiadas: 0, quitadas: 0, omitido: `La pestaña «${titulo}» tiene ${plan.sobran} filas más que la base: no se quitan solas (¿un respaldo viejo?). Si son las que se quitaron a propósito, npm run sincronizar -- --forzar` };
  }
  if (simular || sheetId === null) return resultado;

  // Escribir en una fila que la pestaña no tiene falla («exceeds grid limits»), y una pestaña nueva trae 1,000: con
  // las asistencias de tres días —varios cientos de personas por unas veinte sesiones— se pasaría. Se amplía antes.
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
    await conEspera(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId: idLibro,
        range: rangoDe(titulo, `A${primera}:${ultimaColumna}${primera + lote.length - 1}`),
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
        range: rangoDe(titulo, `A${desde}:${ultimaColumna}${desde + plan.sobran - 1}`),
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
              dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: encabezados.length },
            },
          }],
        },
      }),
    );
  }

  return resultado;
}

/** La pestaña «Asistencias»: una fila por asistencia. */
export function sincronizarAsistencias(opciones: OpcionesDeSincronizacion = {}): Promise<ResultadoDeAsistencias> {
  return sincronizarPestana(PESTANA_DE_DETALLE, opciones);
}

/** La pestaña «Asistencia por persona»: una fila por persona, con un día por columna y si tenía registro. */
export function sincronizarAsistenciaPorPersona(opciones: OpcionesDeSincronizacion = {}): Promise<ResultadoDeAsistencias> {
  return sincronizarPestana(PESTANA_POR_PERSONA, opciones);
}

/** Las pestañas de asistencia, en el orden en que se ponen al día (para el script, que dice cómo le fue a cada una). */
export const PESTANAS_DE_ASISTENCIA: readonly { titulo: string; sincronizar: (opciones?: OpcionesDeSincronizacion) => Promise<ResultadoDeAsistencias> }[] = [
  { titulo: HOJA_ASISTENCIAS, sincronizar: sincronizarAsistencias },
  { titulo: HOJA_PERSONAS, sincronizar: sincronizarAsistenciaPorPersona },
];

export interface ResultadoDeLaHoja extends ResultadoDeAsistencias {
  /** Lo de cada pestaña por separado; los totales de arriba son la suma de las dos. */
  pestanas: { asistencias: ResultadoDeAsistencias; personas: ResultadoDeAsistencias };
}

/**
 * Pone al día las dos pestañas. Si una falla no deja a la otra sin pasar: se intentan las dos y, si alguna falló, se
 * relanza su error (el de la primera, si fallaron ambas).
 */
export async function sincronizarLasPestanas(opciones: OpcionesDeSincronizacion = {}): Promise<ResultadoDeLaHoja> {
  const resultados: ResultadoDeAsistencias[] = [];
  let fallo: { error: unknown } | null = null;
  for (const { sincronizar } of PESTANAS_DE_ASISTENCIA) {
    try {
      resultados.push(await sincronizar(opciones));
    } catch (error) {
      fallo ??= { error };
      resultados.push({ nuevas: 0, cambiadas: 0, quitadas: 0 });
    }
  }
  if (fallo) throw fallo.error;

  const [asistencias, personas] = resultados;
  const omitidos = resultados.map((r) => r.omitido).filter((o): o is string => Boolean(o));
  return {
    nuevas: asistencias.nuevas + personas.nuevas,
    cambiadas: asistencias.cambiadas + personas.cambiadas,
    quitadas: asistencias.quitadas + personas.quitadas,
    ...(omitidos.length > 0 ? { omitido: omitidos.join(' ') } : {}),
    ...(opciones.simular ? { simulado: true } : {}),
    pestanas: { asistencias, personas },
  };
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

/** Una pasada a las dos pestañas que además anota cómo le fue, para que el panel lo enseñe. Si falla, relanza el error. */
export function sincronizarYAnotar(opciones?: { forzar?: boolean }): Promise<ResultadoDeLaHoja> {
  const pasada = cola.then(async () => {
    try {
      const r = await sincronizarLasPestanas(opciones);
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
