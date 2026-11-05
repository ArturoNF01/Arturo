/**
 * Copia a Google Sheets los registros que aún no están en la hoja.
 *
 *   npm run sincronizar             # todos los pendientes
 *   npm run sincronizar -- 20       # sólo los primeros 20
 *   npm run sincronizar -- --callado  # sin ruido si no había nada (cron)
 *   npm run sincronizar -- --rehacer  # vacía la hoja y la escribe entera
 *   npm run sincronizar -- --vaciar   # sólo la vacía, sin escribir nada
 *   npm run sincronizar -- --simular  # dice qué quitaría de la hoja, sin tocar nada
 *   npm run sincronizar -- --forzar   # quita de la hoja más de 10 bajas de una vez
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
  const { alinearHojaConLaBase, cuadrarPestanasEspejo, revisarLibro, sincronizarRegistros, vaciarHojas } =
    await import('../src/lib/servidor/sheets');
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

  // Las pestañas que son copia de la base (la lista de registrados) se ponen
  // al día en cada pasada, haya o no pendientes: una pestaña recién creada
  // nace vacía y sus registros ya constan como copiados, así que ninguna otra
  // ruta se los volvería a mandar. Sólo añade lo que falta.
  const cuadrarEspejos = async () => {
    const añadidas = await cuadrarPestanasEspejo();
    for (const [hoja, n] of Object.entries(añadidas)) {
      if (n > 0) decir(`${hoja}: se añadieron ${n} filas que faltaban.`);
    }
  };

  // Los registros que se dieron de baja desde el panel se quitan de la hoja, y
  // los N.º de los que quedan se corrigen. Dar de baja sólo borraba de la base:
  // la fila seguía en la hoja y todas las de detrás tenían un número que ya no
  // era el suyo. Esto sí se dice aunque sea desde cron: es un cambio en la hoja
  // y quien la lea mañana tiene que poder saber por qué cambió.
  const alinearConLaBase = async () => {
    const r = await alinearHojaConLaBase({ forzar: process.argv.includes('--forzar') });
    if (r.omitido) decir(r.omitido);
    for (const [hoja, n] of Object.entries(r.quitadas)) {
      console.log(`${hoja}: se quitaron ${n} filas de registros que ya no existen.`);
    }
    // Queda en el registro de la tarea qué registros eran, por si hay que revisarlo después.
    if (r.folios.length > 0) console.log(`Registros quitados de la hoja: ${r.folios.join(', ')}`);
    if (r.enBlanco > 0) console.log(`Se quitaron ${r.enBlanco} filas en blanco.`);
    if (r.renumeradas > 0) console.log(`Se corrigieron ${r.renumeradas} números de orden (N.º).`);
    for (const hoja of r.reconstruidas) {
      console.log(`${hoja}: no coincidía con la base y se volvió a escribir.`);
    }
  };

  const numerico = process.argv.slice(2).find((a) => /^\d+$/.test(a));
  const tope = Math.min(Math.max(Number(numerico) || 500, 1), 5000);

  // Decir qué se quitaría de la hoja por registros dados de baja, sin tocar
  // nada: para comprobar la lista antes de forzar una limpieza grande.
  if (process.argv.includes('--simular')) {
    const r = await alinearHojaConLaBase({ simular: true });
    if (r.omitido) {
      console.log(r.omitido);
      return;
    }
    const total = Object.values(r.quitadas).reduce((a, b) => a + b, 0);
    console.log(`Se quitarían ${r.folios.length} registros (${total} filas en total):`);
    for (const folio of r.folios) console.log(`  ${folio}`);
    for (const [hoja, n] of Object.entries(r.quitadas)) console.log(`  ${hoja}: ${n} filas`);
    if (r.enBlanco > 0) console.log(`Filas en blanco que se quitarían: ${r.enBlanco}`);
    if (r.renumeradas > 0) console.log(`N.º que se corregirían: ${r.renumeradas}`);
    for (const hoja of r.reconstruidas) console.log(`${hoja}: se volvería a escribir entera.`);
    console.log('No se tocó nada. Si la lista es la que espera: npm run sincronizar -- --forzar');
    return;
  }

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
    await alinearConLaBase();
    await cuadrarEspejos();
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
  if (fallidos.length === 0) {
    await alinearConLaBase();
    await cuadrarEspejos();
  }
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
