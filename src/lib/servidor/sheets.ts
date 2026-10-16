import 'server-only';
import { clienteSheets, googleConfigurado } from './google';
import { consultar } from '@/lib/bd/conexion';
import { HOJAS, filasDeRegistro } from '@/lib/normalizacion';
import { leerDatosCongreso, leerEjes } from './contenido';
import { traducir } from '@/lib/contenido';

type Registro = Record<string, unknown>;
type Eje = { clave: string; nombre: unknown };

/**
 * El libro de seguimiento se lleva en español y con nombres legibles: aquí se
 * resuelve la clave del eje temático y se fija el límite de semblanza vigente.
 *
 * Recibe los ejes y los datos del congreso ya leídos porque esto se llama una
 * vez por registro: con cuarenta pendientes eran ochenta consultas a la base
 * para traer ochenta veces la misma tabla de ejes.
 */
function prepararParaHoja(registro: Registro, ejes: Eje[], limiteSemblanza: unknown): Registro {
  const eje = ejes.find((e) => e.clave === registro.eje_tematico);

  return {
    ...registro,
    eje_tematico: eje ? traducir(eje.nombre as never, 'es') : registro.eje_tematico,
    limite_semblanza_palabras: limiteSemblanza,
  };
}

/**
 * El número de orden de cada registro: su puesto por fecha de alta entre
 * todos los de la base.
 *
 * Se calcula aquí y no se guarda en una columna porque es una posición, no
 * un dato del registro: si mañana se borra el número siete, los que venían
 * detrás corren un puesto, y una columna guardada se quedaría mintiendo. La
 * base es la que manda, y la hoja la copia.
 *
 * Es una consulta por escritura, no por registro: copiar cincuenta y dos
 * pendientes la hace una vez.
 */
async function numerosDeOrden(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const filas = await consultar<{ id: string; numero: string }>(
    `select id, numero from (
          select id, row_number() over (order by creado_en, id) as numero
            from registros
        ) as ordenados
      where id = any($1::uuid[])`,
    [ids],
  );
  return new Map(filas.map((f) => [String(f.id), Number(f.numero)]));
}

/**
 * Google corta a las sesenta escrituras por minuto y por cuenta, y no avisa
 * antes: devuelve «Quota exceeded for quota metric 'Write requests'» y tira la
 * llamada. Es un límite por ventana de un minuto, así que no es un fallo del
 * que haya que salir corriendo —es uno que se cura esperando.
 *
 * Las esperas suman más de un minuto a propósito: si se agotó la cuota en el
 * segundo 1 de la ventana, hay que llegar al segundo 61 para que se renueve.
 */
const ESPERAS_MS = [2_000, 8_000, 20_000, 45_000];

/** ¿Es de los fallos que se curan esperando? */
export function esCupoAgotado(fallo: unknown): boolean {
  const e = fallo as { code?: number | string; status?: number; message?: string };
  const codigo = Number(e?.code ?? e?.status ?? 0);
  if (codigo === 429 || codigo === 503) return true;
  return /quota exceeded|rate limit|resource[_ ]?exhausted|try again later/i.test(
    String(e?.message ?? ''),
  );
}

/** Repite la llamada mientras Google diga que vamos demasiado rápido. */
async function conEspera<T>(operacion: () => Promise<T>): Promise<T> {
  for (let intento = 0; ; intento += 1) {
    try {
      return await operacion();
    } catch (fallo) {
      if (intento >= ESPERAS_MS.length || !esCupoAgotado(fallo)) throw fallo;
      await new Promise((seguir) => setTimeout(seguir, ESPERAS_MS[intento]));
    }
  }
}

/** La primera fila de cada pestaña pedida, tal como está hoy en la hoja. */
async function leerPrimeraFila(idLibro: string, nombres: string[]): Promise<Map<string, string[]>> {
  const sheets = clienteSheets();
  const leidos = await conEspera(() =>
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: idLibro,
      ranges: nombres.map((n) => `${n}!1:1`),
    }),
  );
  return new Map(
    nombres.map((nombre, i) => [
      nombre,
      (leidos.data.valueRanges?.[i]?.values?.[0] ?? []) as string[],
    ]),
  );
}

/** Escribe los encabezados de ahora en la primera fila de cada pestaña. */
async function escribirEncabezados(idLibro: string, nombres: string[]): Promise<void> {
  if (nombres.length === 0) return;
  const sheets = clienteSheets();
  await conEspera(() =>
    sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: idLibro,
      requestBody: {
        valueInputOption: 'RAW',
        data: nombres.map((nombre) => ({ range: `${nombre}!A1`, values: [HOJAS[nombre]] })),
      },
    }),
  );
}

/**
 * Deja la fila 1 como lo que es: una fila de títulos.
 *
 * Inmovilizada, para que siga a la vista al bajar por las cuatrocientas
 * filas de registros —quien abre la hoja en noviembre no tiene por qué
 * recordar qué columna era «Procedencia»—, y en negrita sobre gris, para
 * distinguirla de un dato de un vistazo.
 *
 * Inmovilizarla no es sólo comodidad: le dice a Google, de forma explícita,
 * dónde acaban los títulos y dónde empiezan los datos. Una fila añadida ya
 * no depende de que adivine la forma de la tabla.
 */
function peticionesDeTitulos(sheetId: number | null | undefined) {
  return [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 0 } },
        fields: 'gridProperties(frozenRowCount,frozenColumnCount)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.93, green: 0.94, blue: 0.95 },
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    },
  ];
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
 *
 * Una pestaña con la primera fila en blanco no es una pestaña «sin estrenar»
 * que se pueda dejar pasar: cuando Google añade una fila, busca la tabla que
 * empieza en A1, y si no encuentra ninguna escribe en A1 mismo. El primer
 * registro ocupa entonces la fila de los encabezados y el segundo lo empuja
 * hacia abajo —de ahí los encabezados apareciendo al final de la hoja, debajo
 * de los datos—. Se le escriben los encabezados antes de tocar nada.
 */
async function comprobarEncabezados(
  idLibro: string,
  nombres: string[] = Object.keys(HOJAS),
  reparar = true,
) {
  const primeras = await leerPrimeraFila(idLibro, nombres);

  const desfasadas: string[] = [];
  const vacias: string[] = [];
  for (const nombre of nombres) {
    const fila = primeras.get(nombre) ?? [];
    if (fila.length === 0) {
      vacias.push(nombre);
      continue;
    }
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

  if (vacias.length === 0) return;
  if (!reparar) {
    throw new Error(
      `La primera fila de ${vacias.join(', ')} se quedó sin encabezados. ` +
        'Reescriba la hoja con: npm run sincronizar -- --rehacer',
    );
  }
  await escribirEncabezados(idLibro, vacias);
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
  const libro = await conEspera(() => sheets.spreadsheets.get({ spreadsheetId: idLibro }));
  const existentes = new Set(
    (libro.data.sheets ?? []).map((h) => h.properties?.title).filter(Boolean) as string[],
  );

  const faltantes = Object.keys(HOJAS).filter((nombre) => !existentes.has(nombre));
  if (faltantes.length > 0) {
    const creadas = await conEspera(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: idLibro,
        requestBody: {
          requests: faltantes.map((title) => ({
            addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
          })),
        },
      }),
    );
    await escribirEncabezados(idLibro, faltantes);

    // Una pestaña recién creada estrena sus títulos con el mismo aspecto que
    // las demás, sin esperar a que alguien rehaga el libro.
    const nuevas = (creadas.data.replies ?? [])
      .map((r) => r.addSheet?.properties?.sheetId)
      .filter((id) => id !== null && id !== undefined);
    if (nuevas.length > 0) {
      await conEspera(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: idLibro,
          requestBody: { requests: nuevas.flatMap((id) => peticionesDeTitulos(id)) },
        }),
      );
    }
  }

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

/**
 * Comprueba que el libro esté como el sistema lo espera, sin escribir nada.
 *
 * Existe porque el guion de sincronización sólo tocaba la hoja cuando había
 * algo pendiente que copiar. Con la cola vacía —que es lo normal justo
 * después de desplegar— no la miraba, y anunciaba «la hoja ya está al día»
 * sin haberla abierto. Si el despliegue venía con columnas nuevas, eso era
 * falso: la hoja se quedaba con las de antes y el aviso llegaba semanas más
 * tarde, cuando alguien se registraba y su alta fallaba.
 */
export async function revisarLibro(): Promise<void> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) {
    throw new Error('Google Sheets no está configurado.');
  }
  await asegurarHojas(idLibro);
}

/**
 * Añade varios registros a la hoja: una sola escritura por pestaña.
 *
 * Antes se escribía registro por registro, y cada registro son dos o tres
 * escrituras —una por pestaña—. Copiar cuarenta y dos pendientes eran más de
 * noventa llamadas seguidas contra un límite de sesenta por minuto: pasaban
 * veintitrés y el resto moría con «Quota exceeded», que es exactamente lo que
 * ocurrió al rehacer la hoja. Agrupadas, esos mismos cuarenta y dos registros
 * son tres llamadas, y cinco mil también.
 */
export async function sincronizarRegistros(registros: Registro[]): Promise<void> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) {
    throw new Error('Google Sheets no está configurado.');
  }
  if (registros.length === 0) return;

  await asegurarHojas(idLibro);
  const sheets = clienteSheets();

  const [{ filas: ejes }, congreso, numeros] = await Promise.all([
    leerEjes(),
    leerDatosCongreso(),
    numerosDeOrden(registros.map((r) => String(r.id))),
  ]);
  const porPestana = new Map<string, (string | number)[][]>();
  for (const registro of registros) {
    const preparado = prepararParaHoja(
      { ...registro, numero_en_hoja: numeros.get(String(registro.id)) },
      ejes as Eje[],
      congreso.limite_semblanza_palabras,
    );
    for (const [hoja, valores] of Object.entries(filasDeRegistro(preparado))) {
      const juntas = porPestana.get(hoja) ?? [];
      juntas.push(...valores.map((fila) => fila.map(blindar)));
      porPestana.set(hoja, juntas);
    }
  }

  for (const [hoja, valores] of porPestana) {
    await conEspera(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: idLibro,
        range: `${hoja}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: valores },
      }),
    );
  }

  // Tras una escritura grande, mirar que los encabezados sigan en la fila 1.
  // Si una pestaña se quedó sin ellos, Google empieza a escribir en A1 y los
  // datos van empujando la fila de títulos hacia abajo. Aquí ya está escrito
  // —no se deshace—, pero se dice en voz alta en vez de descubrirlo meses
  // después. En el alta de una persona no se gasta esta lectura: ahí la
  // comprobación previa es la que manda.
  if (registros.length > 1) {
    await comprobarEncabezados(idLibro, [...porPestana.keys()], false);
  }
}

/** Añade un registro a todas las pestañas que le corresponden. */
export async function sincronizarRegistro(registro: Registro): Promise<void> {
  await sincronizarRegistros([registro]);
}

/**
 * Deja cada pestaña con una sola fila: la de los encabezados de ahora.
 *
 * Hace falta cuando lo que cambia es *cómo* se escribe una celda —y no el
 * registro— y hay que volver a volcarlo todo: reenviar sin más añadiría
 * cien filas repetidas debajo de las cien que ya están.
 *
 * Borra las filas, no sólo su contenido. Vaciar las celdas dejaba atrás
 * cientos de filas en blanco y, sobre todo, dejaba a Google decidiendo dónde
 * empieza la tabla; borrándolas no queda nada que interpretar: la fila 1 son
 * los encabezados y la 2 es la primera que se escriba.
 */
const FILAS_EN_BLANCO = 1000;

export async function vaciarHojas(): Promise<void> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) throw new Error('Google Sheets no está configurado.');

  const sheets = clienteSheets();
  // Sin `asegurarHojas`: eso comprueba los encabezados y aquí venimos
  // justamente a arreglarlos.
  const libro = await conEspera(() => sheets.spreadsheets.get({ spreadsheetId: idLibro }));
  const propiedades = new Map(
    (libro.data.sheets ?? []).map((h) => [h.properties?.title ?? '', h.properties]),
  );
  const presentes = Object.keys(HOJAS).filter((nombre) => propiedades.has(nombre));

  const peticiones = presentes.flatMap((nombre) => {
    const props = propiedades.get(nombre);
    const sheetId = props?.sheetId;
    const filas = props?.gridProperties?.rowCount ?? 0;
    const lista: Record<string, unknown>[] = [];
    if (filas > 1) {
      lista.push({
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: filas },
        },
      });
    }
    // Y se le devuelven las filas en blanco. Borrándolas sin más, la pestaña
    // queda con una sola fila —la de los títulos— y cada escritura depende
    // de que Google agrande la cuadrícula sola. Lo hace, pero no hay por qué
    // apoyarse en ello cuando pedirlas cuesta nada y van en la misma llamada.
    // Además, una hoja de una sola fila parece rota a quien la abre.
    lista.push({ appendDimension: { sheetId, dimension: 'ROWS', length: FILAS_EN_BLANCO } });
    // Y se borra la fila 1 entera antes de volver a escribirla.
    //
    // Sin esto, rehacer la hoja no la arreglaba: escribir treinta
    // encabezados sobre una fila que tenía treinta y seis —la forma del
    // formulario anterior, con semblanza, fotografía y autorizaciones—
    // sustituye los treinta primeros y deja los seis últimos intactos. La
    // comprobación lee la fila entera, cuenta treinta y seis donde espera
    // treinta, y concluye que la hoja sigue con las columnas de antes. Y
    // como la salida de eso es «reescríbala con --rehacer», el remedio se
    // acusaba a sí mismo: ninguna fila volvía a entrar nunca.
    lista.push({
      updateCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        fields: 'userEnteredValue',
        rows: [],
      },
    });
    lista.push(...peticionesDeTitulos(sheetId));
    return lista;
  });

  if (peticiones.length > 0) {
    await conEspera(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: idLibro,
        requestBody: { requests: peticiones },
      }),
    );
  }
  await escribirEncabezados(idLibro, presentes);

  // El libro acaba de cambiar por debajo: lo que se hubiera comprobado antes
  // ya no describe lo que hay.
  olvidarRevisionDelLibro();
}

/**
 * Actualiza en la hoja las filas de un registro editado, en su sitio.
 *
 * Antes borraba las filas del registro y las volvía a añadir al final. Con
 * una columna de orden eso se nota: el registro siete reaparecía abajo del
 * todo, con un siete al lado y el cincuenta y tres encima. Ahora se escribe
 * encima de la fila que ya tenía, así que corregir un correo en el panel no
 * reordena la hoja ni gasta dos llamadas donde basta una.
 *
 * Si el registro deja de corresponderle a una pestaña —cambia de perfil y ya
 * no sale en el programa—, su fila se borra de ahí. Y si no estaba, se añade
 * al final, que es donde le toca.
 */
export async function resincronizarRegistro(registro: Registro): Promise<void> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) throw new Error('Google Sheets no está configurado.');

  await asegurarHojas(idLibro);
  const sheets = clienteSheets();
  const folio = String(registro.folio ?? '');

  const [{ filas: ejes }, congreso, numeros] = await Promise.all([
    leerEjes(),
    leerDatosCongreso(),
    numerosDeOrden([String(registro.id)]),
  ]);
  const filas = filasDeRegistro(
    prepararParaHoja(
      { ...registro, numero_en_hoja: numeros.get(String(registro.id)) },
      ejes as Eje[],
      congreso.limite_semblanza_palabras,
    ),
  );

  const libro = await conEspera(() => sheets.spreadsheets.get({ spreadsheetId: idLibro }));
  const idsHoja = new Map(
    (libro.data.sheets ?? []).map((h) => [h.properties?.title ?? '', h.properties?.sheetId ?? 0]),
  );

  for (const hoja of Object.keys(HOJAS)) {
    // El folio vive en la columna B: la A lleva el número de orden.
    const columnaFolio = await conEspera(() =>
      sheets.spreadsheets.values.get({ spreadsheetId: idLibro, range: `${hoja}!B2:B` }),
    );
    const suyas = (columnaFolio.data.values ?? [])
      .map((fila, i) => (String(fila[0] ?? '') === folio ? i + 2 : -1)) // +2: la 1 es encabezado
      .filter((n) => n > 0);

    const valores = filas[hoja]?.map((fila) => fila.map(blindar));

    if (valores && suyas.length > 0) {
      await conEspera(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: idLibro,
          range: `${hoja}!A${suyas[0]}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: valores },
        }),
      );
    }

    // Lo que sobre —filas repetidas de otras veces, o la pestaña entera si
    // el registro ya no le corresponde— se borra de abajo arriba, para que
    // borrar una no mueva de sitio a la siguiente.
    const sobrantes = (valores ? suyas.slice(1) : suyas).sort((a, b) => b - a);
    if (sobrantes.length > 0) {
      await conEspera(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: idLibro,
          requestBody: {
            requests: sobrantes.map((fila) => ({
              deleteDimension: {
                range: {
                  sheetId: idsHoja.get(hoja),
                  dimension: 'ROWS',
                  startIndex: fila - 1,
                  endIndex: fila,
                },
              },
            })),
          },
        }),
      );
    }

    // Y si no estaba, entra al final.
    if (valores && suyas.length === 0) {
      await conEspera(() =>
        sheets.spreadsheets.values.append({
          spreadsheetId: idLibro,
          range: `${hoja}!A1`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: valores },
        }),
      );
    }
  }
}
