/**
 * Copia a Google Sheets los registros que aún no están en la hoja.
 *
 *   npm run sincronizar             # todos los pendientes
 *   npm run sincronizar -- 20       # sólo los primeros 20
 *   npm run sincronizar -- --callado  # sin ruido si no había nada (cron)
 *   npm run sincronizar -- --rehacer  # vacía la hoja y la escribe entera
 *   npm run sincronizar -- --vaciar   # sólo la vacía, sin escribir nada
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

/**
 * Cuántos registros van en cada escritura a la hoja.
 *
 * Google acepta miles de filas en una sola llamada y corta a las sesenta
 * llamadas por minuto, así que lo caro es el número de llamadas, no el
 * tamaño. Se agrupan de doscientos en doscientos para que un fallo —si lo
 * hay— no se lleve por delante toda la cola, y para poder decir por dónde
 * iba.
 */
const POR_TANDA = 200;

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
  const { revisarLibro, sincronizarRegistros, vaciarHojas } = await import('../src/lib/servidor/sheets');
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

  // Dejar la hoja en blanco, con sus encabezados y nada más. Se usa al
  // limpiar el congreso antes de abrir el registro de verdad.
  if (process.argv.includes('--vaciar')) {
    await vaciarHojas();
    console.log('La hoja quedó vacía, sólo con sus encabezados.');
    return;
  }

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
    // Mirarla aunque no haya nada que copiar. Decir «ya está al día» sin
    // abrirla es lo que hacía que un despliegue con columnas nuevas pasara
    // por bueno: la hoja se quedaba con las de antes y nadie se enteraba
    // hasta que alguien se registraba y su alta fallaba.
    await revisarLibro();
    decir('No hay nada pendiente, y la hoja tiene las columnas de ahora.');
    return;
  }

  decir(`Por copiar: ${pendientes.length} registros.`);
  let copiados = 0;
  const fallidos: { folio: string; motivo: string }[] = [];

  for (let desde = 0; desde < pendientes.length; desde += POR_TANDA) {
    const tanda = pendientes.slice(desde, desde + POR_TANDA);
    try {
      await sincronizarRegistros(tanda);
      await consultar(
        `update registros
            set sheets_sincronizado_en = now(), sheets_error = null
          where id = any($1::uuid[])`,
        [tanda.map((r) => r.id)],
      );
      copiados += tanda.length;
      if (copiados < pendientes.length) decir(`Copiados ${copiados} de ${pendientes.length}…`);
    } catch (fallo) {
      const motivo = fallo instanceof Error ? fallo.message : String(fallo);
      await consultar('update registros set sheets_error = $2 where id = any($1::uuid[])', [
        tanda.map((r) => r.id),
        motivo,
      ]);
      for (const r of tanda) fallidos.push({ folio: r.folio, motivo });
      // Si la primera tanda ya falla, el resto fallará igual: el motivo es el
      // mismo para todas —la hoja, el permiso, la conexión—, y no tiene
      // sentido insistir contra la misma puerta cerrada.
      if (copiados === 0) break;
    }
  }

  decir(`Copiados ${copiados} registros a la hoja.`);
  if (fallidos.length > 0) {
    const motivos = [...new Set(fallidos.map((f) => f.motivo))];
    console.error(`\nNo se pudieron copiar ${fallidos.length}:`);
    for (const motivo of motivos) {
      const folios = fallidos.filter((f) => f.motivo === motivo).map((f) => f.folio);
      console.error(`  ${motivo}`);
      console.error(`    ${folios.slice(0, 5).join(', ')}${folios.length > 5 ? ` … y ${folios.length - 5} más` : ''}`);
    }
    process.exit(1);
  }
}

principal().catch((error) => {
  console.error('Falló la copia a la hoja:', error instanceof Error ? error.message : error);
  process.exit(1);
});
