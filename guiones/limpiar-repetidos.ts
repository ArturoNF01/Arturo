/**
 * Limpieza de «Asistencia por persona»: repetidos sin registro y nombres todo en mayúsculas.
 *
 *   npm run limpiar-repetidos                 # mira: dice qué se ligaría y qué nombres se pasarían a altas y bajas; no cambia nada
 *   npm run limpiar-repetidos -- --aplicar    # lo hace
 *   npm run limpiar-repetidos -- --aplicar --forzar   # aunque ya haya algo escrito a la derecha de las filas que se recorren
 *
 * 1. Las asistencias «sin registro» que repiten a alguien con registro vigente (el mismo nombre o el mismo correo en otra fila) se
 *    ligan a ese registro, como hace el panel con «Ligar a un registro»: la fila suelta desaparece, los días que no tenía esa persona
 *    se le suman y los que ya tenía se descartan por duplicados. No se pierde ningún día de nadie. Si no se sabe a cuál registro
 *    ligar (dos vigentes) o no hay ninguno, se deja y se dice.
 * 2. Los nombres y apellidos escritos todo en mayúsculas pasan a altas y bajas («CARLOS CHAVERA» → «Carlos Chavera»). No se pisa lo
 *    que alguien haya editado entre tanto, y la auditoría lo asienta como del sistema, con el valor de antes.
 *
 * Al juntar filas, las de detrás se recorren en «Asistencia por persona», y lo que quien hace las constancias haya escrito a la
 * derecha (folios, números…) no se mueve con ellas: si ya hay algo escrito en las filas que se recorrerían, no se hace sin --forzar.
 *
 * Desde el servidor:  sudo bash /opt/congreso/guiones/servidor/limpiar-repetidos.sh [--aplicar]
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

async function principal() {
  if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL.'); process.exit(1); }
  const { revisarRepetidos } = await import('../src/lib/repetidos');
  const { planearFusiones, planearNombresDeRegistros, planearNombresDeSueltas } = await import('../src/lib/limpieza');
  const { ponenciasParaLaHoja } = await import('../src/lib/ponentes');
  const { ponentesRegistrados, todasLasAsistencias } = await import('../src/lib/servidor/asistencia');
  const limpieza = await import('../src/lib/servidor/limpieza');
  const { googleConfigurado } = await import('../src/lib/servidor/google');

  const aplicar = process.argv.includes('--aplicar');
  const forzar = process.argv.includes('--forzar');
  const conHoja = googleConfigurado() && Boolean(process.env.GOOGLE_SHEETS_ID);
  const en = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const titulo = (texto: string) => console.log(`\n${texto}`);

  const revisar = async () => {
    const [asistencias, ponentes] = await Promise.all([todasLasAsistencias(), ponentesRegistrados()]);
    return { asistencias, revision: revisarRepetidos(asistencias, ponentes, ponenciasParaLaHoja) };
  };

  // ---- 1. Asistencias sueltas que repiten a alguien registrado
  const { asistencias, revision } = await revisar();
  const { fusiones, omitidas } = planearFusiones(revision, asistencias);
  titulo(fusiones.length === 0 ? 'Asistencias sueltas repetidas que se puedan ligar: ninguna.' : `${aplicar ? 'Se ligan' : 'Se ligarían'} a su registro (${en(fusiones.length, 'persona', 'personas')}):`);
  for (const f of fusiones) {
    for (const s of f.sueltas) {
      console.log(`  N.º ${String(s.fila.numero).padEnd(4)} ${s.fila.nombre} <${s.fila.correo}> (${en(s.fila.total, 'día', 'días')})  →  N.º ${f.destino.numero} ${f.destino.nombre} <${f.destino.correo}>`);
    }
  }
  if (omitidas.length > 0) {
    titulo('Se dejan como están (que lo decida una persona):');
    for (const o of omitidas) console.log(`  Caso ${o.caso}: ${o.filas.map((x) => `N.º ${x.numero} ${x.nombre} <${x.correo}>`).join('; ')} — ${o.motivo}.`);
  }

  // ---- 2. Nombres todo en mayúsculas
  const idsQueSeLigan = new Set(fusiones.flatMap((f) => f.sueltas.flatMap((s) => s.asistencias)));
  const cambiosDeRegistros = planearNombresDeRegistros(await limpieza.leerRegistrosConNombre());
  const cambiosDeSueltas = planearNombresDeSueltas((await limpieza.leerSueltasConNombre()).filter((a) => !idsQueSeLigan.has(a.id)));
  const total = cambiosDeRegistros.length + cambiosDeSueltas.length;
  titulo(total === 0 ? 'Nombres todo en mayúsculas: ninguno.' : `Nombres todo en mayúsculas que ${aplicar ? 'se pasan' : 'se pasarían'} a altas y bajas (${total}):`);
  for (const c of cambiosDeRegistros) {
    console.log(`  ${c.folio}  ${`${c.antes.nombres} ${c.antes.apellidos}`.trim()}  →  ${`${c.despues.nombres} ${c.despues.apellidos}`.trim()}`);
  }
  for (const c of cambiosDeSueltas) console.log(`  (sin registro) ${c.antes} <${c.correo}>  →  ${c.despues}`);

  if (!aplicar) {
    if (fusiones.length + total > 0) console.log('\nNo se cambió nada. Para hacerlo: sudo bash /opt/congreso/guiones/servidor/limpiar-repetidos.sh --aplicar');
    return;
  }

  // ---- Que no haya nada escrito a la derecha de las filas que se recorrerían
  if (fusiones.length > 0 && conHoja) {
    const primera = Math.min(...fusiones.flatMap((f) => f.sueltas.map((s) => s.fila.numero))) - 1;
    const conDatos = await limpieza.filasConDatosPropiosEnLaHoja(primera);
    if (conDatos.length > 0 && !forzar) {
      console.error(`\nAlto: ${en(conDatos.length, 'fila', 'filas')} desde la N.º ${primera + 1} ya tienen algo escrito a la derecha (folios, números de constancia…): ligar recorre las filas y eso quedaría en otra persona. No se cambió nada.`);
      console.error('Si eso se va a rehacer de todos modos: --aplicar --forzar');
      process.exit(1);
    }
  }

  // ---- Hacerlo
  let fallo = false;
  if (fusiones.length > 0) {
    titulo('Ligando…');
    for (const f of fusiones) {
      const h = await limpieza.aplicarFusion(f);
      console.log(`  ${f.destino.nombre}: ${en(h.ligadas, 'día ligado', 'días ligados')}, ${en(h.descartadas, 'descartado por repetido', 'descartados por repetidos')}${h.fallidas.length > 0 ? `, FALLÓ: ${h.fallidas.join('; ')}` : ''}`);
      if (h.fallidas.length > 0) fallo = true;
    }
  }
  if (total > 0) {
    titulo('Pasando los nombres a altas y bajas…');
    // Las sueltas se vuelven a leer: las que se ligaron ya no son sueltas, y su nombre es el del registro.
    const sueltasAhora = planearNombresDeSueltas((await limpieza.leerSueltasConNombre()));
    const hechos = await limpieza.aplicarNombresDeRegistros(cambiosDeRegistros);
    const cambiadas = await limpieza.aplicarNombresDeSueltas(sueltasAhora);
    const omitidos = hechos.filter((h) => h.omitido);
    const conFallo = hechos.filter((h) => h.hoja === 'fallo');
    console.log(`  ${en(hechos.length - omitidos.length, 'registro cambiado', 'registros cambiados')}, ${en(cambiadas, 'asistencia sin registro cambiada', 'asistencias sin registro cambiadas')}${omitidos.length > 0 ? `, ${omitidos.length} omitidos (los editaron mientras tanto)` : ''}.`);
    if (conFallo.length > 0) { fallo = true; console.error(`  La copia de ${conFallo.length} en la hoja falló: ${conFallo[0].errorDeLaHoja}. Se corrige en la siguiente pasada.`); }
  }

  // ---- La hoja, al día, y cómo queda la cuenta
  if (conHoja) {
    try {
      const { sincronizarAsistencias } = await import('../src/lib/servidor/sheets-asistencia');
      const hoja = await sincronizarAsistencias();
      for (const aviso of hoja.avisos ?? []) console.log(aviso);
      console.log(`\n«Asistencia por persona» puesta al día${hoja.omitido ? `, pero: ${hoja.omitido}` : ''}.`);
    } catch (error) {
      fallo = true;
      console.error(`\nNo se pudo poner al día «Asistencia por persona»: ${error instanceof Error ? error.message : String(error)}. Se pone al día sola en unos minutos.`);
    }
  }
  const despues = (await revisar()).revision.resumen;
  console.log(`\nQuedan ${en(despues.nombresRepetidos, 'nombre repetido', 'nombres repetidos')} y ${en(despues.correosRepetidos, 'correo repetido', 'correos repetidos')} (${en(despues.casos, 'caso', 'casos')}, ${despues.dosConstancias} con riesgo de dos constancias).`);
  if (despues.casos > 0) console.log('El detalle de los que quedan: sudo bash /opt/congreso/guiones/servidor/revisar-repetidos.sh');
  if (fallo) process.exit(1);
}

principal().catch((error) => {
  console.error('Falló la limpieza:', error instanceof Error ? error.message : error);
  process.exit(1);
});
