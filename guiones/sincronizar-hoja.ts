/**
 * Copia a Google Sheets los registros que aún no están en la hoja.
 *
 *   npm run sincronizar             # todos los pendientes
 *   npm run sincronizar -- 20       # sólo los primeros 20
 *   npm run sincronizar -- --callado  # sin ruido si no había nada (cron)
 *   npm run sincronizar -- --rehacer  # vacía la hoja y la escribe entera
 *
 * Hace lo mismo que el botón del panel, pero desde el servidor. Esa es la
 * razón de que exista: si el panel no abre, o la sesión caducó, la hoja se
 * queda vacía sin que nadie sepa por qué. Aquí el fallo se ve completo y en
 * la consola, con el folio y el motivo de cada registro que no pasó.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

cargarEntorno(resolve(RAIZ, '.env'));

function faltante(configurado: boolean): string | null {
  if (!process.env.DATABASE_URL) return 'Falta DATABASE_URL.';
  if (!configurado) {
    return 'Google no está conectado: faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY en el .env.';
  }
  if (!process.env.GOOGLE_SHEETS_ID) return 'Falta GOOGLE_SHEETS_ID en el .env.';
  return null;
}

async function principal() {
  // Se importan aquí, ya cargado el entorno: el módulo de la base abre la
  // conexión con lo que encuentre en el momento de cargarse.
  const { consultar } = await import('../src/lib/bd/conexion');
  const { sincronizarRegistro, vaciarHojas } = await import('../src/lib/servidor/sheets');
  const { googleConfigurado } = await import('../src/lib/servidor/google');

  const problema = faltante(googleConfigurado());
  if (problema) {
    console.error(problema);
    process.exit(1);
  }

  // Desde cron conviene el silencio: un registro cada diez minutos diciendo
  // «no había nada» sepulta el aviso del día en que sí falle algo.
  const callado = process.argv.includes('--callado');
  const decir = (mensaje: string) => {
    if (!callado) console.log(mensaje);
  };

  const numerico = process.argv.slice(2).find((a) => /^\d+$/.test(a));
  const tope = Math.min(Math.max(Number(numerico) || 500, 1), 5000);

  // Volver a escribirlo todo: se vacía la hoja y se marcan los registros como
  // no copiados. Sin vaciar antes, lo que saldría son las filas duplicadas.
  if (process.argv.includes('--rehacer')) {
    console.log('Vaciando la hoja para escribirla entera…');
    await vaciarHojas();
    await consultar('update registros set sheets_sincronizado_en = null, sheets_error = null');
  }
  const pendientes = await consultar<Record<string, unknown> & { id: string; folio: string }>(
    `select * from registros
      where sheets_sincronizado_en is null
      order by creado_en
      limit $1`,
    [tope],
  );

  if (pendientes.length === 0) {
    decir('No hay nada pendiente: la hoja ya está al día.');
    return;
  }

  decir(`Por copiar: ${pendientes.length} registros.`);
  let copiados = 0;
  const fallidos: { folio: string; motivo: string }[] = [];

  for (const registro of pendientes) {
    try {
      await sincronizarRegistro(registro);
      await consultar(
        `update registros set sheets_sincronizado_en = now(), sheets_error = null where id = $1`,
        [registro.id],
      );
      copiados += 1;
      if (copiados % 25 === 0 || copiados === pendientes.length) {
        decir(`Copiados ${copiados} de ${pendientes.length}…`);
      }
    } catch (fallo) {
      const motivo = fallo instanceof Error ? fallo.message : String(fallo);
      await consultar('update registros set sheets_error = $2 where id = $1', [
        registro.id,
        motivo,
      ]);
      fallidos.push({ folio: registro.folio, motivo });
      // Si el primero ya falla, el resto fallará igual: no tiene sentido
      // insistir 100 veces contra la misma puerta cerrada.
      if (fallidos.length >= 3 && copiados === 0) break;
    }
  }

  decir(`Copiados ${copiados} registros a la hoja.`);
  if (fallidos.length > 0) {
    console.error(`\nNo se pudieron copiar ${fallidos.length}:`);
    for (const f of fallidos.slice(0, 5)) console.error(`  ${f.folio}: ${f.motivo}`);
    process.exit(1);
  }
}

principal().catch((error) => {
  console.error('Falló la copia a la hoja:', error instanceof Error ? error.message : error);
  process.exit(1);
});
