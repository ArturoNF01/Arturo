import 'server-only';
import { consultar, enTransaccion } from '@/lib/bd/conexion';
import { HOJA_PERSONAS } from '@/lib/asistencia';
import { AUDIENCIA_DE_CONSTANCIAS, confirmacionValida, type IdiomaEnvio } from '@/lib/comunicados';
import {
  elegirDestinatariosDeConstancias, filasDeConstancias, type CeldaDeLaHoja, type SeleccionDeConstancias,
} from '@/lib/constancias';
import { rangoDe } from '@/lib/normalizacion';
import type { ResultadoDeCreacion } from './comunicados';
import { clienteSheets, googleConfigurado } from './google';
import { conEspera } from './sheets';

/**
 * El envío de constancias, del lado del servidor: leer los enlaces de la hoja, calcular a quién le toca y crear el envío. Las reglas
 * están en `@/lib/constancias`; el envío tanda a tanda es el de los comunicados (`enviarSiguienteTanda`): cada persona es una fila
 * del envío con su enlace, se manda tras reclamarla en la base y nunca dos veces.
 */

/** La clave de la plantilla y de las campañas de este envío. */
export const CLAVE_DE_CONSTANCIA = 'constancia';

/** Hasta dónde se lee la pestaña: la Z, como el resto. */
const ULTIMA_COLUMNA = 'Z';

/**
 * La pestaña «Asistencia por persona» tal como está en la hoja, con el hipervínculo de cada celda cuando lo tiene: el enlace de una
 * constancia puede estar escrito en la celda, en una fórmula `=HYPERLINK(…)` o en un texto con enlace («Constancia de Ana»), y sólo
 * en los dos últimos casos lo que se ve no es el enlace.
 */
export async function leerTablaDeLaHoja(): Promise<CeldaDeLaHoja[][]> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) throw new Error('Google Sheets no está configurado.');
  const respuesta = await conEspera(() =>
    clienteSheets().spreadsheets.get({
      spreadsheetId: idLibro,
      ranges: [rangoDe(HOJA_PERSONAS, `A1:${ULTIMA_COLUMNA}`)],
      includeGridData: true,
      fields: 'sheets(data(rowData(values(formattedValue,hyperlink))))',
    }),
  );
  const filas = respuesta.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
  return filas.map((f) => (f.values ?? []).map((c) => ({ texto: c.formattedValue ?? '', enlace: c.hyperlink ?? null })));
}

export interface EstadoDeConstancias extends SeleccionDeConstancias {
  /** Cuántas filas de datos tiene la pestaña, y cuántas con la casilla «Con registro» marcada. */
  filas: number;
  conRegistro: number;
}

/**
 * A quién le toca su constancia ahora: lee la hoja y la base, no escribe nada. `tabla` es la pestaña ya leída; sin ella se lee de la
 * hoja de Google (con ella, se calcula sobre lo que se dé: las pruebas, o quien ya la tiene a mano).
 */
export async function calcularConstancias(tabla?: CeldaDeLaHoja[][]): Promise<EstadoDeConstancias> {
  const [celdas, registros, enviadas] = await Promise.all([
    tabla ?? leerTablaDeLaHoja(),
    // Con dos registros del mismo correo (uno cancelado), gana el vigente: va al final.
    consultar<{ id: string; correo: string; idioma: string }>(
      `select id, correo, idioma from registros order by (estado = 'cancelado') desc, creado_en`,
    ),
    consultar<{ correo: string; enlace: string }>(
      `select lower(e.correo) as correo, e.datos->>'enlace' as enlace
         from envios_campana e join campanas_correo c on c.id = e.campana_id
        where c.clave = $1 and e.estado = 'enviado' and e.datos->>'enlace' is not null`,
      [CLAVE_DE_CONSTANCIA],
    ),
  ]);
  const filas = filasDeConstancias(celdas);
  const yaEnviadas = new Map<string, Set<string>>();
  for (const e of enviadas) {
    const enlaces = yaEnviadas.get(e.correo) ?? new Set<string>();
    enlaces.add(e.enlace);
    yaEnviadas.set(e.correo, enlaces);
  }
  return {
    ...elegirDestinatariosDeConstancias({ filas, registros, yaEnviadas }),
    filas: filas.length,
    conRegistro: filas.filter((f) => f.conRegistro).length,
  };
}

interface PlantillaCongelada {
  es: { asunto: string; cuerpo_html: string };
  en?: { asunto: string; cuerpo_html: string };
  pt?: { asunto: string; cuerpo_html: string };
}

/**
 * Crea el envío de constancias: congela la plantilla y deja a cada persona «pendiente», con su enlace. No manda nada todavía: eso lo
 * hace `enviarSiguienteTanda`, tanda a tanda.
 *
 * Igual que un comunicado: se niega si la cifra que escribió quien confirma no coincide con la que sale ahora (la hoja cambió entre
 * que se miró y que se confirmó) y si ya hay un envío de constancias sin terminar.
 */
export async function crearCampanaDeConstancias(
  { confirmacion, usuarioId, tabla }: { confirmacion: unknown; usuarioId: string; tabla?: CeldaDeLaHoja[][] },
): Promise<ResultadoDeCreacion> {
  const estado = await calcularConstancias(tabla);
  const total = estado.destinatarios.length;
  if (total === 0) return { ok: false, codigo: 'invalido', mensaje: 'No hay a quién enviar: las constancias con enlace ya se enviaron.' };
  if (!confirmacionValida(confirmacion, total)) {
    return {
      ok: false, codigo: 'cifra',
      mensaje: `La cifra no coincide: ahora corresponden ${total} personas. Revise y confirme de nuevo.`,
    };
  }

  const enCurso = await consultar<{ id: string }>(
    `select c.id from campanas_correo c
      where c.clave = $1 and c.estado = 'en_curso'
        and exists (select 1 from envios_campana e where e.campana_id = c.id and e.estado in ('pendiente', 'enviando'))
      limit 1`,
    [CLAVE_DE_CONSTANCIA],
  );
  if (enCurso[0]) {
    return {
      ok: false, codigo: 'en_curso', campanaEnCurso: enCurso[0].id,
      mensaje: 'Ya hay un envío de constancias sin terminar. Continúelo o espere a que termine.',
    };
  }

  const plantillas = await consultar<{ idioma: IdiomaEnvio; asunto: string; cuerpo_html: string }>(
    'select idioma, asunto, cuerpo_html from plantillas_correo where clave = $1 and activa',
    [CLAVE_DE_CONSTANCIA],
  );
  const congelada: Partial<PlantillaCongelada> = {};
  for (const fila of plantillas) congelada[fila.idioma] = { asunto: fila.asunto, cuerpo_html: fila.cuerpo_html };
  const faltan = [...new Set(estado.destinatarios.map((d) => d.idioma))].filter((i) => !congelada[i]);
  if (!congelada.es || faltan.length > 0) {
    return { ok: false, codigo: 'sin_plantilla', mensaje: `Falta la plantilla de la constancia en ${(faltan.length ? faltan : ['es']).join(', ')}.` };
  }

  const id = await enTransaccion(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into campanas_correo (clave, audiencia, plantilla, creada_por, total)
       values ($1, $2, $3::jsonb, $4, $5) returning id`,
      [CLAVE_DE_CONSTANCIA, AUDIENCIA_DE_CONSTANCIAS, JSON.stringify(congelada), usuarioId, total],
    );
    const campana = rows[0].id;
    const d = estado.destinatarios;
    await cliente.query(
      `insert into envios_campana (campana_id, correo, registro_id, idioma, datos)
       select $1, correo, registro_id, idioma, datos::jsonb
         from unnest($2::text[], $3::uuid[], $4::text[], $5::text[]) as t(correo, registro_id, idioma, datos)`,
      [campana, d.map((x) => x.correo), d.map((x) => x.registro_id), d.map((x) => x.idioma), d.map((x) => JSON.stringify(x.datos))],
    );
    return campana;
  }, usuarioId);

  return { ok: true, id, total };
}
