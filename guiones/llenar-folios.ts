/**
 * Llena la columna «Folio» de «Asistencia por persona».
 *
 *   npm run llenar-folios                    # mira: dice qué folios pondría y de cuál a cuál; no escribe nada
 *   npm run llenar-folios -- --aplicar       # los escribe, sólo en las celdas de «Folio» que están vacías
 *   npm run llenar-folios -- --detalle       # además, uno por uno: fila, nombre y folio
 *   npm run llenar-folios -- --aplicar --forzar   # aunque queden repetidos por revisar
 *
 * Público general: CONG-EISS-RIUSS-A01, A02, A03…; ponentes: CONG-EISS-RIUSS-P01, P02, P03…, de uno en uno y en el orden de las filas.
 * Sólo reciben folio las filas con «Con registro» marcado (sin registro vigente no hay constancia). Nunca se pisa un folio que ya
 * esté, y la serie sigue desde el número más alto que ya haya.
 *
 * Antes de escribir, conviene haber resuelto los repetidos (npm run revisar-repetidos): una persona en dos filas recibiría dos folios,
 * y los folios no se reutilizan. Con repetidos pendientes no escribe sin --forzar.
 *
 * Desde el servidor:  sudo bash /opt/congreso/guiones/servidor/llenar-folios.sh [--aplicar]
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

async function principal() {
  if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL.'); process.exit(1); }
  const { googleConfigurado } = await import('../src/lib/servidor/google');
  if (!googleConfigurado() || !process.env.GOOGLE_SHEETS_ID) {
    console.error('Google no está conectado: faltan GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY o GOOGLE_SHEETS_ID en el .env.');
    process.exit(1);
  }
  const { llenarFolios } = await import('../src/lib/servidor/folios');
  const { leerRevisionDeRepetidos } = await import('../src/lib/servidor/repetidos');
  const { sincronizarAsistencias } = await import('../src/lib/servidor/sheets-asistencia');
  const { PREFIJOS_DE_FOLIO } = await import('../src/lib/folios');

  const aplicar = process.argv.includes('--aplicar');
  const forzar = process.argv.includes('--forzar');
  const detallar = process.argv.includes('--detalle');
  const en = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

  // Los repetidos: una persona en dos filas con registro recibiría dos folios, y un folio no se reutiliza.
  const revision = await leerRevisionDeRepetidos();
  const dobles = revision.resumen.dosConstancias;
  if (dobles > 0) {
    console.log(`\x1b[33mOjo: hay ${en(dobles, 'caso', 'casos')} de una misma persona con dos registros vigentes (dos folios). Resuélvalos primero:\x1b[0m`);
    console.log('  sudo bash /opt/congreso/guiones/servidor/revisar-repetidos.sh\n');
    if (aplicar && !forzar) {
      console.error('No se escribió ningún folio. Si aun así es lo que se quiere: --aplicar --forzar');
      process.exit(1);
    }
  }

  // Que la pestaña esté al día con la base antes de numerar: los folios caen en las filas tal como están.
  if (aplicar) {
    const hoja = await sincronizarAsistencias();
    for (const aviso of hoja.avisos ?? []) console.log(aviso);
    if (hoja.omitido) { console.error(`La pestaña no quedó al día: ${hoja.omitido}`); process.exit(1); }
  }

  const r = await llenarFolios({ aplicar });
  const p = r.plan;
  console.log(`«Asistencia por persona»: ${r.filas} filas.`);
  const serie = (nombre: string, s: typeof p.porSerie.ponente, prefijo: string) => {
    const rango = s.nuevos > 0 ? `: de ${s.primero} a ${s.ultimo}` : '';
    console.log(`  ${nombre}: ${s.yaTenian} con folio, ${s.nuevos} ${aplicar ? 'nuevos' : 'por poner'}${rango}  (${prefijo}…)`);
  };
  serie('Público general', p.porSerie.publico_general, PREFIJOS_DE_FOLIO.publico_general);
  serie('Ponentes', p.porSerie.ponente, PREFIJOS_DE_FOLIO.ponente);
  if (p.sinRegistro > 0) console.log(`  ${en(p.sinRegistro, 'fila sin registro vigente', 'filas sin registro vigente')}: sin folio, porque no recibirían constancia.`);
  if (p.sinSerie > 0) console.log(`  ${en(p.sinSerie, 'fila sin perfil', 'filas sin perfil')} (asistieron sin registro): sin folio.`);
  if (p.repetidos.length > 0) console.log(`\x1b[33m  Folios que ya estaban en más de una fila: ${p.repetidos.join(', ')}. Un folio es de una sola persona: revíselos.\x1b[0m`);
  if (p.incoherentes > 0) console.log(`\x1b[33m  ${en(p.incoherentes, 'fila tiene', 'filas tienen')} un folio de la otra serie (por ejemplo un ponente con «A…»): se dejaron como estaban.\x1b[0m`);

  if (detallar || (!aplicar && r.detalle.length <= 12)) {
    for (const d of r.detalle) console.log(`  N.º ${d.numero.padEnd(4)} ${d.nombre}  →  ${d.folio}`);
  }

  if (!aplicar) {
    if (r.detalle.length > 0) {
      console.log(`\nNo se escribió nada. Para poner los ${r.detalle.length} folios: sudo bash /opt/congreso/guiones/servidor/llenar-folios.sh --aplicar`);
    } else {
      console.log('\nNo hay folios que poner.');
    }
    return;
  }
  if (r.escritas === 0) { console.log('\nNo había folios que poner.'); return; }
  console.log(`\nSe escribieron ${en(r.escritas, 'folio', 'folios')}${r.verificadas ? ', y al volver a leer la hoja todos coinciden.' : '.'}`);
  if (!r.verificadas) { console.error('Al volver a leer la hoja, algún folio no dice lo que se escribió: revise la columna «Folio».'); process.exit(1); }
  console.log('Desde ahora, no ligue asistencias ni dé de baja registros sin avisar: eso recorre las filas y los folios, que son de la celda, no se mueven con ellas.');
}

principal().catch((error) => {
  console.error('Falló el llenado de folios:', error instanceof Error ? error.message : error);
  process.exit(1);
});
