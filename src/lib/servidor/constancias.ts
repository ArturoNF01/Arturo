import 'server-only';
import { consultar, enTransaccion } from '@/lib/bd/conexion';
import { HOJA_PERSONAS } from '@/lib/asistencia';
import { AUDIENCIA_DE_CONSTANCIAS, confirmacionValida, type IdiomaEnvio } from '@/lib/comunicados';
import {
  MAXIMO_DE_LA_LISTA, elegirDeUnaLista, elegirDestinatariosDeConstancias, filasDeConstancias,
  type AlcanceDeConstancias, type CeldaDeLaHoja, type GrupoDeConstancia, type SeleccionDeConstancias, type SeleccionDeLista,
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

/** Lo que hace falta de la hoja y de la base para decidir a quién le toca: se lee una vez y de ahí se calculan todos los envíos. */
interface ContextoDeConstancias {
  filas: ReturnType<typeof filasDeConstancias>;
  registros: { id: string; correo: string; idioma: string }[];
  yaEnviadas: Map<string, Set<string>>;
}

/**
 * Lee la hoja y la base. `tabla` es la pestaña ya leída; sin ella se lee de la hoja de Google (con ella, se calcula sobre lo que se
 * dé: las pruebas, o quien ya la tiene a mano).
 */
async function leerContexto(tabla?: CeldaDeLaHoja[][]): Promise<ContextoDeConstancias> {
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
  const yaEnviadas = new Map<string, Set<string>>();
  for (const e of enviadas) {
    const enlaces = yaEnviadas.get(e.correo) ?? new Set<string>();
    enlaces.add(e.enlace);
    yaEnviadas.set(e.correo, enlaces);
  }
  return { filas: filasDeConstancias(celdas), registros, yaEnviadas };
}

/**
 * A quién le toca su constancia ahora: lee la hoja y la base, no escribe nada. Con `grupo`, sólo ese grupo (público general o
 * ponentes); sin él, todos los que tienen enlace.
 */
export async function calcularConstancias(tabla?: CeldaDeLaHoja[][], grupo?: GrupoDeConstancia): Promise<EstadoDeConstancias> {
  const c = await leerContexto(tabla);
  return {
    ...elegirDestinatariosDeConstancias({ filas: c.filas, registros: c.registros, yaEnviadas: c.yaEnviadas, grupo }),
    filas: c.filas.length,
    conRegistro: c.filas.filter((f) => f.conRegistro).length,
  };
}

export interface EstadoPorGrupo {
  filas: number;
  conRegistro: number;
  /** Con registro, pero con un perfil que no es ninguno de los dos grupos: no entran en ningún envío por grupo. */
  sinPerfil: number;
  grupos: Record<GrupoDeConstancia, SeleccionDeConstancias>;
}

/** Lo que dice la hoja, por grupo: una sola lectura para los dos. */
export async function calcularPorGrupo(tabla?: CeldaDeLaHoja[][]): Promise<EstadoPorGrupo> {
  const c = await leerContexto(tabla);
  const para = (grupo: GrupoDeConstancia) =>
    elegirDestinatariosDeConstancias({ filas: c.filas, registros: c.registros, yaEnviadas: c.yaEnviadas, grupo });
  return {
    filas: c.filas.length,
    conRegistro: c.filas.filter((f) => f.conRegistro).length,
    sinPerfil: c.filas.filter((f) => f.conRegistro && f.grupo === null).length,
    grupos: { publico_general: para('publico_general'), ponente: para('ponente') },
  };
}

/** Comprueba una lista de correos contra la hoja: a quién le toca su constancia y, a quien no, por qué. No escribe nada. */
export async function verificarListaDeConstancias(
  { correos, reenviar = false, tabla }: { correos: readonly string[]; reenviar?: boolean; tabla?: CeldaDeLaHoja[][] },
): Promise<SeleccionDeLista> {
  const c = await leerContexto(tabla);
  return elegirDeUnaLista({ correos, filas: c.filas, registros: c.registros, yaEnviadas: c.yaEnviadas, reenviar });
}

/** El texto con que se guarda el alcance de un envío, para el historial. */
const ETIQUETA_DE_ALCANCE = (alcance: AlcanceDeConstancias): string => (alcance.tipo === 'grupo' ? alcance.grupo : alcance.tipo);

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
  { confirmacion, usuarioId, tabla, alcance = { tipo: 'todos' } }:
  { confirmacion: unknown; usuarioId: string; tabla?: CeldaDeLaHoja[][]; alcance?: AlcanceDeConstancias },
): Promise<ResultadoDeCreacion> {
  if (alcance.tipo === 'lista' && (alcance.correos.length === 0 || alcance.correos.length > MAXIMO_DE_LA_LISTA)) {
    return { ok: false, codigo: 'invalido', mensaje: `La lista debe llevar de 1 a ${MAXIMO_DE_LA_LISTA} correos.` };
  }
  const c = await leerContexto(tabla);
  const destinatarios = alcance.tipo === 'lista'
    ? elegirDeUnaLista({ correos: alcance.correos, filas: c.filas, registros: c.registros, yaEnviadas: c.yaEnviadas, reenviar: alcance.reenviar }).destinatarios
    : elegirDestinatariosDeConstancias({
        filas: c.filas, registros: c.registros, yaEnviadas: c.yaEnviadas, grupo: alcance.tipo === 'grupo' ? alcance.grupo : undefined,
      }).destinatarios;
  const estado = { destinatarios };
  const total = estado.destinatarios.length;
  if (total === 0) {
    return {
      ok: false, codigo: 'invalido',
      mensaje: alcance.tipo === 'lista'
        ? 'Ninguna de esas personas tiene constancia por enviar: revise la verificación de la lista.'
        : 'No hay a quién enviar: las constancias con enlace ya se enviaron.',
    };
  }
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
      [campana, d.map((x) => x.correo), d.map((x) => x.registro_id), d.map((x) => x.idioma), d.map((x) => JSON.stringify({ ...x.datos, alcance: ETIQUETA_DE_ALCANCE(alcance) }))],
    );
    return campana;
  }, usuarioId);

  return { ok: true, id, total };
}
