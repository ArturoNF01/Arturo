import 'server-only';
import { HOJA_PERSONAS } from '@/lib/asistencia';
import { asignarFolios, type FilaParaFolio, type PlanDeFolios, type SerieDeFolio } from '@/lib/folios';
import { nombreDePerfil, rangoDe } from '@/lib/normalizacion';
import { clienteSheets, googleConfigurado } from './google';
import { conEspera } from './sheets';

/**
 * Llena la columna «Folio» de «Asistencia por persona» (`@/lib/folios` dice cómo). Es una de las columnas de quien hace las
 * constancias, en las que el sistema no escribe nunca por su cuenta: esto sólo se corre a pedido, y sólo escribe las celdas de
 * «Folio» que están vacías.
 *
 * Se lee de la propia hoja, no de la base: el folio tiene que caer en la fila que la persona ve. Las columnas se buscan por su
 * título («Perfil», «Con registro», «Folio»), no por su letra, porque quien hace las constancias puede moverlas.
 */

/** Hasta dónde se lee: la Z, como el resto de la pestaña. */
const ULTIMA_COLUMNA = 'Z';

export interface FolioAsignado {
  /** El N.º de la fila en la pestaña, y a quién. */
  numero: string;
  nombre: string;
  folio: string;
}

export interface ResultadoDeFolios {
  plan: PlanDeFolios;
  /** Cuántas filas de datos tiene la pestaña. */
  filas: number;
  /** Los folios que se asignan (o se asignarían), con su fila. */
  detalle: FolioAsignado[];
  /** Cuántas celdas se escribieron (0 si sólo se calculó) y si, al volver a leerlas, todas dicen lo que se escribió. */
  escritas: number;
  verificadas: boolean;
}

const letraDeColumna = (indice: number) => String.fromCharCode('A'.charCodeAt(0) + indice);
const comoTexto = (valor: unknown) => String(valor ?? '').trim();

/** Los índices consecutivos juntos: [3, 4, 5, 9, 10] → [[3, 5], [9, 10]]. Una escritura por tramo no toca lo que hay entre ellos. */
export function tramos(indices: readonly number[]): [number, number][] {
  const resultado: [number, number][] = [];
  for (const i of indices) {
    const ultimo = resultado[resultado.length - 1];
    if (ultimo && ultimo[1] === i - 1) ultimo[1] = i;
    else resultado.push([i, i]);
  }
  return resultado;
}

/** Calcula los folios de la pestaña y, con `aplicar`, los escribe en las celdas vacías de «Folio». Nunca pisa uno que ya esté. */
export async function llenarFolios({ aplicar }: { aplicar: boolean }): Promise<ResultadoDeFolios> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) throw new Error('Google Sheets no está configurado.');
  const sheets = clienteSheets();

  const leer = async () => (await conEspera(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: idLibro, range: rangoDe(HOJA_PERSONAS, `A1:${ULTIMA_COLUMNA}`) }),
  )).data.values ?? [];

  const tabla = await leer();
  const titulos = (tabla[0] ?? []).map(comoTexto);
  const columna = (titulo: string) => {
    const i = titulos.indexOf(titulo);
    if (i < 0) throw new Error(`La pestaña «${HOJA_PERSONAS}» no tiene la columna «${titulo}»: no se puede saber dónde poner los folios.`);
    return i;
  };
  const cPerfil = columna('Perfil');
  const cRegistro = columna('Con registro');
  const cFolio = columna('Folio');
  const cNumero = titulos.indexOf('N.º');
  const cNombre = titulos.indexOf('Nombre');

  // Sólo se descartan las filas en blanco del final.
  let datos = tabla.slice(1);
  while (datos.length > 0 && datos[datos.length - 1].every((c: unknown) => comoTexto(c) === '')) datos = datos.slice(0, -1);

  const serieDe = (etiqueta: string): SerieDeFolio | null =>
    (['publico_general', 'ponente'] as const).find((s) => nombreDePerfil(s) === etiqueta) ?? null;
  const filas: FilaParaFolio[] = datos.map((fila) => ({
    serie: serieDe(comoTexto(fila[cPerfil])),
    conRegistro: fila[cRegistro] === true || comoTexto(fila[cRegistro]).toUpperCase() === 'TRUE',
    folio: comoTexto(fila[cFolio]),
  }));

  const plan = asignarFolios(filas);
  const detalle: FolioAsignado[] = plan.asignaciones.map(({ indice, folio }) => ({
    numero: cNumero >= 0 ? comoTexto(datos[indice][cNumero]) : String(indice + 1),
    nombre: cNombre >= 0 ? comoTexto(datos[indice][cNombre]) : '',
    folio,
  }));
  if (!aplicar || plan.asignaciones.length === 0) return { plan, filas: datos.length, detalle, escritas: 0, verificadas: true };

  // Una escritura por tramo de filas seguidas, todas en una sola petición: lo que hay entre un tramo y otro no se toca. Los
  // números de fila de Google empiezan en 1 y la primera de datos es la 2.
  const letra = letraDeColumna(cFolio);
  const porIndice = new Map(plan.asignaciones.map((a) => [a.indice, a.folio]));
  const data = tramos(plan.asignaciones.map((a) => a.indice)).map(([desde, hasta]) => ({
    range: rangoDe(HOJA_PERSONAS, `${letra}${desde + 2}:${letra}${hasta + 2}`),
    values: Array.from({ length: hasta - desde + 1 }, (_, k) => [porIndice.get(desde + k)!]),
  }));
  await conEspera(() =>
    // RAW: un folio es un texto, nunca una fórmula.
    sheets.spreadsheets.values.batchUpdate({ spreadsheetId: idLibro, requestBody: { valueInputOption: 'RAW', data } }),
  );

  // Se vuelve a leer: lo que se dice que se escribió tiene que ser lo que la hoja tiene.
  const despues = await leer();
  const verificadas = plan.asignaciones.every(({ indice, folio }) => comoTexto((despues[indice + 1] ?? [])[cFolio]) === folio);
  return { plan, filas: datos.length, detalle, escritas: plan.asignaciones.length, verificadas };
}
