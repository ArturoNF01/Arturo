import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

/**
 * Conexión a PostgreSQL.
 *
 * DigitalOcean entrega la cadena con `sslmode=require` y un certificado
 * emitido para su dominio interno, que el cliente no reconoce por sí solo:
 * se cifra la conexión y se confía en ese certificado, que es lo que hace su
 * propio panel.
 */

let piscina: Pool | null = null;

/**
 * ¿Hay que cifrar? Manda lo que diga `sslmode`; si no dice nada, se cifra
 * salvo contra una base local, que es la de desarrollo y la de las pruebas.
 */
function configuracionSsl(cadena: string): { rejectUnauthorized: boolean } | undefined {
  const modo = /[?&]sslmode=([^&]+)/.exec(cadena)?.[1];
  if (modo === 'disable') return undefined;
  if (modo) return { rejectUnauthorized: false };

  const esLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(cadena) || cadena.includes('host=/');
  return esLocal ? undefined : { rejectUnauthorized: false };
}

export function bdConfigurada(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function obtenerPiscina(): Pool {
  if (!bdConfigurada()) {
    throw new Error('Falta DATABASE_URL.');
  }
  if (!piscina) {
    piscina = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: configuracionSsl(process.env.DATABASE_URL ?? ''),
      // App Platform reinicia contenedores con frecuencia: pocas conexiones
      // por instancia, para no agotar el límite del clúster.
      max: Number(process.env.BD_CONEXIONES_MAXIMAS ?? 8),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    piscina.on('error', (error) => {
      // Una conexión ociosa que se cae no debe tumbar el proceso.
      console.error('Error en una conexión ociosa de PostgreSQL:', error.message);
    });
  }
  return piscina;
}

/** Consulta suelta. Para varias operaciones relacionadas, usar `enTransaccion`. */
export async function consultar<T extends QueryResultRow = QueryResultRow>(
  texto: string,
  valores: unknown[] = [],
): Promise<T[]> {
  const { rows } = await obtenerPiscina().query<T>(texto, valores);
  return rows;
}

/** Primera fila, o null. */
export async function unaFila<T extends QueryResultRow = QueryResultRow>(
  texto: string,
  valores: unknown[] = [],
): Promise<T | null> {
  const filas = await consultar<T>(texto, valores);
  return filas[0] ?? null;
}

/** Conteo exacto de una tabla o vista, sin traerse las filas. */
export async function contar(tabla: string, donde = '', valores: unknown[] = []): Promise<number> {
  // `tabla` nunca viene del usuario: son nombres fijos del propio código.
  const fila = await unaFila<{ total: string }>(
    `select count(*)::text as total from ${tabla} ${donde}`,
    valores,
  );
  return Number(fila?.total ?? 0);
}

/**
 * Ejecuta varias operaciones en una transacción.
 *
 * `actorId` fija quién está actuando: la auditoría lo lee con
 * `usuario_actual_id()`. Sin él, la operación queda asentada como del
 * sistema, que es lo correcto para el alta pública de un registro o para el
 * cron.
 */
export async function enTransaccion<T>(
  trabajo: (cliente: PoolClient) => Promise<T>,
  actorId?: string | null,
): Promise<T> {
  const cliente = await obtenerPiscina().connect();
  try {
    await cliente.query('begin');
    // El tercer argumento en true limita el ajuste a esta transacción.
    await cliente.query('select set_config($1, $2, true)', ['app.usuario_id', actorId ?? '']);
    const resultado = await trabajo(cliente);
    await cliente.query('commit');
    return resultado;
  } catch (error) {
    await cliente.query('rollback').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

/**
 * Transacción de sólo lectura, para la consola SQL del perfil de ciencia de
 * datos. La garantía la da el motor: dentro de una transacción `read only`
 * ninguna escritura pasa, aunque venga escondida en una función o en un CTE.
 */
export async function enSoloLectura<T>(
  trabajo: (cliente: PoolClient) => Promise<T>,
  tiempoMaximoMs = 15_000,
): Promise<T> {
  const cliente = await obtenerPiscina().connect();
  try {
    await cliente.query('begin read only');
    await cliente.query(`set local statement_timeout = ${Number(tiempoMaximoMs)}`);
    const resultado = await trabajo(cliente);
    await cliente.query('commit');
    return resultado;
  } catch (error) {
    await cliente.query('rollback').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

/** Una sola operación con actor, sin escribir la transacción a mano. */
export async function conActor<T extends QueryResultRow = QueryResultRow>(
  actorId: string | null | undefined,
  texto: string,
  valores: unknown[] = [],
): Promise<T[]> {
  return enTransaccion(async (cliente) => {
    const { rows } = await cliente.query<T>(texto, valores);
    return rows;
  }, actorId);
}

/**
 * Arma la lista de columnas de un INSERT o de un UPDATE a partir de un
 * objeto, con sus marcadores numerados.
 *
 * El tipo se deduce del valor, y la distinción que importa es ésta: un
 * **arreglo** va a una columna de arreglo de PostgreSQL —así están declaradas
 * `autorizaciones`, `documentacion_solicitada` y `requerimientos_tecnicos`—,
 * mientras que un **objeto** va a una columna jsonb, que es como se guardan
 * los textos multilingües. El controlador ya traduce los arreglos de
 * JavaScript a arreglos de PostgreSQL, así que sólo hay que no estorbarle.
 *
 * Si alguna vez hiciera falta guardar un arreglo dentro de una columna jsonb,
 * hay que escribir el `::jsonb` a mano en la consulta, como hace la ruta de
 * configuración: desde el valor no se puede distinguir.
 */
function marcador(valor: unknown, valores: unknown[]): string {
  const esJson =
    valor !== null &&
    typeof valor === 'object' &&
    !Array.isArray(valor) &&
    !(valor instanceof Date) &&
    !Buffer.isBuffer(valor);

  valores.push(esJson ? JSON.stringify(valor) : valor);
  return `$${valores.length}${esJson ? '::jsonb' : ''}`;
}

export function armarInsercion(datos: Record<string, unknown>): {
  columnas: string;
  marcadores: string;
  valores: unknown[];
} {
  const valores: unknown[] = [];
  const columnas = Object.keys(datos);
  const marcadores = columnas.map((c) => marcador(datos[c], valores)).join(', ');
  return { columnas: columnas.join(', '), marcadores, valores };
}

export function armarActualizacion(datos: Record<string, unknown>): {
  asignaciones: string;
  valores: unknown[];
} {
  const valores: unknown[] = [];
  const asignaciones = Object.keys(datos)
    .map((c) => `${c} = ${marcador(datos[c], valores)}`)
    .join(', ');
  return { asignaciones, valores };
}
