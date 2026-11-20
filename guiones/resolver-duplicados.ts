/**
 * Resuelve los registros duplicados de una misma persona: los casos «dos constancias» de la revisión de repetidos.
 *
 *   npm run resolver-duplicados                          # mira: de cada caso, cuál registro queda y cuáles se cancelarían
 *   npm run resolver-duplicados -- --aplicar             # lo hace en los casos que tienen decisión
 *   npm run resolver-duplicados -- --mantener a@x.org    # fija cuál queda en su caso (se puede repetir); sirve para los empates
 *   npm run resolver-duplicados -- --aplicar --forzar    # aunque ya haya algo escrito a la derecha de las filas que se moverían
 *
 * Queda el registro de ponente y, a igualdad, el de más días de asistencia. Los días del que sobra pasan al que queda (los que ya
 * tenía se descartan por repetidos) y el que sobra se cancela en silencio: sin el correo de «su registro fue cancelado», con la
 * auditoría como del sistema. No se borra ningún registro; para reactivar uno, el panel. Lo que los datos no deciden (dos ponentes
 * sin asistencia, nombres distintos) se dice y se deja a una persona.
 *
 * Después, para juntar una asistencia suelta de esa misma persona: limpiar-repetidos; y para los folios: llenar-folios.
 *
 * Desde el servidor:  sudo bash /opt/congreso/guiones/servidor/resolver-duplicados.sh [--aplicar] [--mantener correo]
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

/** Los valores que siguen a cada aparición de `--mantener`. */
function valoresDe(bandera: string): string[] {
  return process.argv.flatMap((a, i, todos) => (a === bandera && todos[i + 1] ? [todos[i + 1]] : []));
}

async function principal() {
  if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL.'); process.exit(1); }
  const { revisarRepetidos } = await import('../src/lib/repetidos');
  const { planearDuplicados } = await import('../src/lib/duplicados');
  const { ponenciasParaLaHoja } = await import('../src/lib/ponentes');
  const { nombreDePerfil } = await import('../src/lib/normalizacion');
  const { ponentesRegistrados, todasLasAsistencias } = await import('../src/lib/servidor/asistencia');
  const { fusionarRegistros } = await import('../src/lib/servidor/duplicados');
  const { filasConDatosPropiosEnLaHoja } = await import('../src/lib/servidor/limpieza');
  const { googleConfigurado } = await import('../src/lib/servidor/google');

  const aplicar = process.argv.includes('--aplicar');
  // Estos cambios son de la base y la hoja los sigue: con «Asistencia por persona» congelada (se edita a mano) no los recibiría.
  if (aplicar) await (await import('../src/lib/servidor/hoja-congelada')).exigirHojaLibre();
  const forzar = process.argv.includes('--forzar');
  const mantener = valoresDe('--mantener');
  const conHoja = googleConfigurado() && Boolean(process.env.GOOGLE_SHEETS_ID);
  const en = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const quien = (f: { numero: number; correo: string; perfil: string | null; total: number }) =>
    `N.º ${String(f.numero).padEnd(4)} <${f.correo}> · ${f.perfil ? nombreDePerfil(f.perfil) : 'sin perfil'} · ${en(f.total, 'día', 'días')}`;

  const leer = async () => {
    const [asistencias, ponentes] = await Promise.all([todasLasAsistencias(), ponentesRegistrados()]);
    return revisarRepetidos(asistencias, ponentes, ponenciasParaLaHoja);
  };
  const revision = await leer();
  const plan = planearDuplicados(revision, mantener);
  const total = plan.resueltos.length + plan.sinResolver.length;
  if (total === 0) {
    console.log('No hay personas con dos registros vigentes.');
    return;
  }

  for (const c of plan.resueltos) {
    console.log(`\nCaso ${c.caso} — ${c.nombre}`);
    console.log(`  QUEDA      ${quien(c.queda)}   (${c.razon})`);
    for (const f of c.cancelar) console.log(`  SE CANCELA ${quien(f)}${f.total > 0 ? `   → sus días pasan al que queda` : ''}`);
  }
  for (const c of plan.sinResolver) {
    console.log(`\n\x1b[33mCaso ${c.caso} — SIN DECIDIR\x1b[0m`);
    for (const f of c.filas) console.log(`  ${f.nombre}  ${quien(f)}`);
    console.log(`  → ${c.razon}`);
  }

  if (!aplicar) {
    console.log(`\nNo se cambió nada.${plan.resueltos.length > 0 ? ` Para hacer ${plan.resueltos.length === 1 ? 'el caso decidido' : `los ${plan.resueltos.length} casos decididos`}: sudo bash /opt/congreso/guiones/servidor/resolver-duplicados.sh --aplicar` : ''}`);
    if (plan.sinResolver.length > 0) console.log('Para fijar cuál queda en los demás: --mantener correo-del-que-queda');
    return;
  }
  if (plan.resueltos.length === 0) { console.log('\nNada que hacer: ningún caso tiene decisión.'); return; }

  // Al juntar, la fila del registro que sobra puede desaparecer o la del que queda adelantarse, y las de detrás se recorren: lo que
  // quien hace las constancias haya escrito a la derecha no se mueve con ellas.
  if (conHoja) {
    const primera = Math.min(...plan.resueltos.flatMap((c) => [c.queda.numero, ...c.cancelar.map((f) => f.numero)])) - 1;
    const conDatos = await filasConDatosPropiosEnLaHoja(primera);
    if (conDatos.length > 0 && !forzar) {
      console.error(`\nAlto: ${en(conDatos.length, 'fila', 'filas')} desde la N.º ${primera + 1} ya tienen algo escrito a la derecha (folios, números de constancia…): juntar registros puede recorrer las filas y eso quedaría en otra persona. No se cambió nada.`);
      console.error('Si eso se va a rehacer de todos modos: --aplicar --forzar');
      process.exit(1);
    }
  }

  let fallo = false;
  console.log('\nResolviendo…');
  for (const c of plan.resueltos) {
    for (const f of c.cancelar) {
      const r = await fusionarRegistros(c.queda.registroId!, f.registroId!);
      if (r.omitido) { console.log(`  ${c.nombre} (N.º ${f.numero}): ${r.omitido}`); fallo = true; continue; }
      const hoja = r.hoja === 'fallo' ? ` (la copia en la hoja falló: ${r.errorDeLaHoja}; se corrige en la siguiente pasada)` : '';
      console.log(`  ${c.nombre}: cancelado N.º ${f.numero} <${f.correo}>; ${en(r.movidas, 'día pasó', 'días pasaron')} al que queda y ${en(r.descartadas, 'se descartó por repetido', 'se descartaron por repetidos')}${hoja}`);
      if (r.hoja === 'fallo') fallo = true;
    }
  }

  if (conHoja) {
    try {
      const { sincronizarAsistencias } = await import('../src/lib/servidor/sheets-asistencia');
      const hoja = await sincronizarAsistencias({ forzar: true });
      for (const aviso of hoja.avisos ?? []) console.log(aviso);
      console.log(`\n«Asistencia por persona» puesta al día${hoja.omitido ? `, pero: ${hoja.omitido}` : ''}.`);
    } catch (error) {
      fallo = true;
      console.error(`\nNo se pudo poner al día «Asistencia por persona»: ${error instanceof Error ? error.message : String(error)}. Se pone al día sola en unos minutos.`);
    }
  }
  const despues = (await leer()).resumen;
  if (despues.dosConstancias === 0) {
    console.log('\nYa no hay personas con dos registros vigentes: no saldría ninguna constancia doble.');
    if (despues.casos > 0) console.log(`Quedan ${en(despues.casos, 'caso', 'casos')} de repetidos sin ese riesgo (registros cancelados, o asistencias que se pueden ligar): sudo bash /opt/congreso/guiones/servidor/revisar-repetidos.sh`);
  } else {
    console.log(`\nQuedan ${en(despues.dosConstancias, 'caso', 'casos')} con dos registros vigentes: sudo bash /opt/congreso/guiones/servidor/resolver-duplicados.sh`);
  }
  if (fallo) process.exit(1);
}

principal().catch((error) => {
  console.error('Falló la resolución de duplicados:', error instanceof Error ? error.message : error);
  process.exit(1);
});
