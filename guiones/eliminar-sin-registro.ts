/**
 * Elimina las filas «sin registro» de «Asistencia por persona»: quien escaneó sin que se hallara su registro (sin perfil y con
 * «Con registro» sin marcar). No reciben constancia.
 *
 *   npm run eliminar-sin-registro               # mira: cuántas son y cuáles; no borra nada
 *   npm run eliminar-sin-registro -- --aplicar  # las borra, tras guardar una copia en un CSV, y deja la hoja al día
 *   npm run eliminar-sin-registro -- --aplicar --forzar   # aunque algunas se pudieran ligar a un registro, o haya algo escrito a la derecha
 *
 * Borra sus asistencias de la base (la hoja es una copia de la base: si sólo se quitaran de la hoja, volverían en la siguiente
 * pasada). No toca ningún registro: las filas de un registro cancelado se quedan, con «Con registro» sin marcar.
 *
 * Conviene correr antes `limpiar-repetidos`: una asistencia suelta que repite a alguien registrado se liga a su registro y no se
 * pierde su día; si se borra, ese día se pierde. Con alguna así pendiente, no borra sin --forzar. Y si ya hay algo escrito a la
 * derecha de las filas que se recorrerían (folios, números de constancia), tampoco: quedaría en otra persona.
 *
 * Desde el servidor:  sudo bash /opt/congreso/guiones/servidor/eliminar-sin-registro.sh [--aplicar]
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

/** Cuántas filas se enseñan en pantalla; la copia en CSV las lleva todas. */
const MAXIMO_EN_PANTALLA = 60;

async function principal() {
  if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL.'); process.exit(1); }
  const { revisarRepetidos } = await import('../src/lib/repetidos');
  const { planearFusiones } = await import('../src/lib/limpieza');
  const { filasSinRegistro } = await import('../src/lib/sin-registro');
  const { ponenciasParaLaHoja } = await import('../src/lib/ponentes');
  const { ponentesRegistrados, todasLasAsistencias } = await import('../src/lib/servidor/asistencia');
  const { eliminarAsistenciasSinRegistro, respaldarAsistencias } = await import('../src/lib/servidor/sin-registro');
  const { filasConDatosPropiosEnLaHoja } = await import('../src/lib/servidor/limpieza');
  const { googleConfigurado } = await import('../src/lib/servidor/google');

  const aplicar = process.argv.includes('--aplicar');
  // Estos cambios son de la base y la hoja los sigue: con «Asistencia por persona» congelada (se edita a mano) no los recibiría.
  if (aplicar) await (await import('../src/lib/servidor/hoja-congelada')).exigirHojaLibre();
  const forzar = process.argv.includes('--forzar');
  const conHoja = googleConfigurado() && Boolean(process.env.GOOGLE_SHEETS_ID);
  const en = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

  const [asistencias, ponentes] = await Promise.all([todasLasAsistencias(), ponentesRegistrados()]);
  const { filas, total, conRegistroCancelado } = filasSinRegistro(asistencias, ponentes);
  console.log(`«Asistencia por persona»: ${total} filas.`);
  if (filas.length === 0) {
    console.log('No hay filas sin registro.');
    return;
  }
  const ids = filas.flatMap((f) => f.asistencias);
  console.log(`  ${en(filas.length, 'fila sin registro', 'filas sin registro')} (${en(ids.length, 'asistencia', 'asistencias')}): ${aplicar ? 'se eliminan' : 'se eliminarían'}.`);
  if (conRegistroCancelado > 0) console.log(`  ${en(conRegistroCancelado, 'fila con el registro cancelado', 'filas con el registro cancelado')}: no se tocan (no se borra ningún registro).`);
  console.log('');
  for (const f of filas.slice(0, MAXIMO_EN_PANTALLA)) {
    console.log(`  N.º ${String(f.numero).padEnd(4)} ${f.nombre} <${f.correo}> (${en(f.total, 'día', 'días')})`);
  }
  if (filas.length > MAXIMO_EN_PANTALLA) console.log(`  … y ${filas.length - MAXIMO_EN_PANTALLA} más (van todas en la copia en CSV).`);

  // Las que repiten a alguien registrado se podrían ligar a su registro, sin perder el día.
  const ligables = planearFusiones(revisarRepetidos(asistencias, ponentes, ponenciasParaLaHoja), asistencias).fusiones
    .flatMap((f) => f.sueltas.map((s) => s.fila));
  if (ligables.length > 0) {
    console.log(`\n\x1b[33mOjo: ${en(ligables.length, 'de estas filas repite', 'de estas filas repiten')} a alguien registrado: ${ligables.map((f) => `N.º ${f.numero}`).join(', ')}.\x1b[0m`);
    console.log('  Ligadas a su registro no se pierde su día; borradas, sí. Antes:  sudo bash /opt/congreso/guiones/servidor/limpiar-repetidos.sh --aplicar');
  }

  if (!aplicar) {
    console.log(`\nNo se borró nada. Para borrar las ${filas.length}: sudo bash /opt/congreso/guiones/servidor/eliminar-sin-registro.sh --aplicar`);
    return;
  }
  if (ligables.length > 0 && !forzar) {
    console.error('\nNo se borró nada. Si aun así es lo que se quiere: --aplicar --forzar');
    process.exit(1);
  }

  // Al borrar filas, las de detrás se recorren, y lo escrito a la derecha no se mueve con ellas.
  if (conHoja) {
    const primera = Math.min(...filas.map((f) => f.numero)) - 1;
    const conDatos = await filasConDatosPropiosEnLaHoja(primera);
    if (conDatos.length > 0 && !forzar) {
      console.error(`\nAlto: ${en(conDatos.length, 'fila', 'filas')} desde la N.º ${primera + 1} ya tienen algo escrito a la derecha (folios, números de constancia…): borrar recorre las filas y eso quedaría en otra persona. No se borró nada.`);
      console.error('Si eso se va a rehacer de todos modos: --aplicar --forzar');
      process.exit(1);
    }
  }

  // La copia primero: si no se pudo guardar, no se borra nada.
  const carpeta = process.env.DESTINO_DE_RESPALDOS ?? resolve(RAIZ, 'respaldos');
  const copia = await respaldarAsistencias(ids, carpeta);
  console.log(`\nCopia de las ${en(ids.length, 'asistencia', 'asistencias')} guardada en ${copia}`);

  const borradas = await eliminarAsistenciasSinRegistro(ids);
  console.log(`Se borraron ${en(borradas, 'asistencia', 'asistencias')}${borradas < ids.length ? ` (${ids.length - borradas} ya se habían ligado a un registro y se dejaron)` : ''}.`);

  let fallo = false;
  if (conHoja) {
    try {
      // Sobran muchas filas a propósito: es lo que se quiere, así que se permite.
      const { sincronizarAsistencias } = await import('../src/lib/servidor/sheets-asistencia');
      const hoja = await sincronizarAsistencias({ forzar: true });
      for (const aviso of hoja.avisos ?? []) console.log(aviso);
      console.log(`«Asistencia por persona» puesta al día${hoja.quitadas > 0 ? `: se quitaron ${en(hoja.quitadas, 'fila', 'filas')} del final` : ''}${hoja.cambiadas > 0 ? `, ${en(hoja.cambiadas, 'fila recorrida', 'filas recorridas')}` : ''}.`);
    } catch (error) {
      fallo = true;
      console.error(`No se pudo poner al día «Asistencia por persona»: ${error instanceof Error ? error.message : String(error)}. Se pone al día sola en unos minutos.`);
    }
  }
  console.log(`\nQuedan ${total - filas.length} filas.`);
  if (fallo) process.exit(1);
}

principal().catch((error) => {
  console.error('Falló la eliminación:', error instanceof Error ? error.message : error);
  process.exit(1);
});
