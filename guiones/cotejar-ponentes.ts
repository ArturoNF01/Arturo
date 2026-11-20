/**
 * Cotejo de los ponentes de la agenda con los registros.
 *
 *   npm run cotejar-ponentes                # mira, cuenta y llena la pestaña «Cotejo de ponentes»; no cambia ningún registro
 *   npm run cotejar-ponentes -- --aplicar   # además pasa a ponente a quien se registró como público general
 *   npm run cotejar-ponentes -- --sin-hoja  # no toca la hoja de Google: sólo el resumen en pantalla
 *   npm run cotejar-ponentes -- --aplicar --forzar   # permite más de 25 cambios de una vez
 *
 * Los autores de las ponencias de la agenda se buscan entre los registros por su nombre. Lo claro se hace; lo dudoso (un nombre
 * que podría ser de dos registros, uno que sólo se parece, un registro cancelado, alguien con otro perfil) se enseña y se deja
 * para que lo decida una persona. Al cambiar un perfil sólo se toca el perfil, no se manda correo y la auditoría lo asienta como
 * del sistema, con el valor de antes.
 *
 * Desde el servidor:  sudo bash /opt/congreso/guiones/servidor/cotejar-ponentes.sh [--aplicar]
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

/** Si el cotejo pide más cambios que éstos, algo está mal con los nombres (no con la gente): no se aplican sin `--forzar`. */
const MAXIMO_DE_CAMBIOS = 25;

async function principal() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL.');
    process.exit(1);
  }
  // Se importan aquí, ya cargado el entorno: el módulo de la base abre la conexión con lo que encuentre al cargarse.
  const { cotejarPonentes } = await import('../src/lib/cotejo-ponentes');
  const { aplicarCambiosDePerfil, escribirCotejoEnLaHoja, HOJA_COTEJO, leerRegistrosParaCotejo } =
    await import('../src/lib/servidor/cotejo-ponentes');
  const { MESAS } = await import('../src/lib/programa');
  const { nombreDePerfil } = await import('../src/lib/normalizacion');
  const { googleConfigurado } = await import('../src/lib/servidor/google');

  const aplicar = process.argv.includes('--aplicar');
  // Estos cambios son de la base y la hoja los sigue: con «Asistencia por persona» congelada (se edita a mano) no los recibiría.
  if (aplicar) await (await import('../src/lib/servidor/hoja-congelada')).exigirHojaLibre();
  const forzar = process.argv.includes('--forzar');
  const conHoja = !process.argv.includes('--sin-hoja') && googleConfigurado() && Boolean(process.env.GOOGLE_SHEETS_ID);

  let registros = await leerRegistrosParaCotejo();
  let cotejo = cotejarPonentes(MESAS, registros);
  const r = cotejo.resumen;

  const titulo = (texto: string) => console.log(`\n${texto}`);
  const verbo = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);
  const quien = (x: { nombre: string; folio: string; correo: string; perfil: string }) =>
    `${x.nombre} (${x.folio}, ${x.correo}, ${nombreDePerfil(x.perfil)})`;

  console.log(`Agenda: ${r.mesas} mesas, ${r.ponencias} ponencias, ${r.autores} autores distintos.`);
  console.log(`Registros con perfil de ponente: ${r.ponentesRegistrados}.`);
  titulo(`De los ${r.autores} autores de la agenda:`);
  console.log(`  ${String(r.yaPonentes).padStart(3)} ${verbo(r.yaPonentes, 'ya está registrado', 'ya están registrados')} como ${verbo(r.yaPonentes, 'ponente', 'ponentes')}`);
  console.log(`  ${String(r.porCambiar).padStart(3)} ${verbo(r.porCambiar, 'se registró', 'se registraron')} como público general${aplicar ? ': se cambian a ponente' : ' (se cambian con --aplicar)'}`);
  console.log(`  ${String(r.otroPerfil).padStart(3)} ${verbo(r.otroPerfil, 'tiene', 'tienen')} otro perfil: no se cambian`);
  console.log(`  ${String(r.cancelados).padStart(3)} ${verbo(r.cancelados, 'tiene', 'tienen')} el registro cancelado`);
  console.log(`  ${String(r.dudosos).padStart(3)} ${verbo(r.dudosos, 'podría ser', 'podrían ser')} más de un registro: a revisar`);
  console.log(`  ${String(r.sinRegistro).padStart(3)} ${verbo(r.sinRegistro, 'no está registrado', 'no están registrados')}`);
  console.log(`Ponentes registrados que la agenda no menciona: ${r.ponentesFueraDeAgenda}.`);
  const t = r.titulos;
  console.log(`Títulos (de las ponencias cuyo autor tiene registro): coinciden ${t.si}, parecidos ${t.parecido}, distintos ${t.no}, sin título ${t.sin_titulo}.`);

  if (cotejo.cambios.length > 0) {
    titulo(aplicar ? 'Se pasan a ponente:' : 'Se pasarían a ponente:');
    for (const c of cotejo.cambios) console.log(`  ${quien(c.registro)}  ⇐  «${c.autor}» en la agenda`);
  }
  const lista = (texto: string, filas: string[]) => {
    if (filas.length === 0) return;
    titulo(texto);
    for (const f of filas.slice(0, 40)) console.log(`  ${f}`);
    if (filas.length > 40) console.log(`  … y ${filas.length - 40} más (están en la pestaña).`);
  };
  const unicos = <T,>(xs: T[], clave: (x: T) => string) => [...new Map(xs.map((x) => [clave(x), x])).values()];
  lista('Autores sin registro (hay que registrarlos, o su nombre está escrito distinto):',
    unicos(cotejo.filas.filter((f) => f.resultado === 'sin_registro'), (f) => f.autor).map((f) => `${f.autor} (mesa ${f.mesa})`));
  lista('Autores que podrían ser más de un registro (a revisar):',
    unicos(cotejo.filas.filter((f) => f.resultado === 'dudoso'), (f) => f.autor).map((f) => `${f.autor}: ${f.candidatos.map(quien).join('  |  ')}`));
  lista('Autores con otro perfil (no se cambian):',
    unicos(cotejo.filas.filter((f) => f.resultado === 'otro_perfil'), (f) => f.autor).map((f) => `${f.autor}: ${quien(f.registro!)}`));
  lista('Autores con el registro cancelado:',
    unicos(cotejo.filas.filter((f) => f.resultado === 'cancelado'), (f) => f.autor).map((f) => `${f.autor}: ${quien(f.registro!)}`));
  lista('Autores con un segundo registro (posible duplicado):',
    unicos(cotejo.filas.filter((f) => f.otros.length > 0), (f) => f.autor).map((f) => `${f.autor}: ${quien(f.registro!)} y ${f.otros.map(quien).join(', ')}`));
  lista('Ponentes registrados que la agenda no menciona:',
    cotejo.soloRegistrados.map((s) => `${quien(s.registro)}${s.parecidas.length > 0 ? `  → su título se parece al de la mesa ${s.parecidas[0].mesa} (${s.parecidas[0].autores.join(', ')})` : ''}`));

  // ---- Cambiar los perfiles
  const cambiados = new Set<string>();
  if (aplicar) {
    if (cotejo.cambios.length === 0) {
      titulo('No hay ningún perfil que cambiar.');
    } else if (cotejo.cambios.length > MAXIMO_DE_CAMBIOS && !forzar) {
      console.error(`\nAlto: el cotejo pide cambiar ${cotejo.cambios.length} perfiles, más de ${MAXIMO_DE_CAMBIOS}. Eso no se parece a lo que se espera de una agenda de ${r.autores} autores: revise la lista de arriba. Si es lo que se quiere: --aplicar --forzar`);
      process.exit(1);
    } else {
      titulo('Cambiando los perfiles…');
      const aplicados = await aplicarCambiosDePerfil(cotejo.cambios);
      for (const a of aplicados) {
        if (a.omitido) console.log(`  OMITIDO ${a.nombre} (${a.folio}): ${a.omitido}`);
        else {
          cambiados.add(a.id);
          const hoja = a.hoja === 'al_dia' ? 'hoja al día' : a.hoja === 'sin_google' ? 'sin Google' : `la hoja falló: ${a.errorDeLaHoja}`;
          console.log(`  ${a.nombre} (${a.folio}): público general → ponente (${hoja})`);
        }
      }
      // Se vuelve a leer: el reporte y la hoja tienen que decir cómo quedó, no cómo estaba.
      registros = await leerRegistrosParaCotejo();
      cotejo = cotejarPonentes(MESAS, registros);
      console.log(`\nAhora hay ${cotejo.resumen.ponentesRegistrados} registros con perfil de ponente.`);
    }
  }

  // ---- La pestaña de la hoja. Si falla no se pierde lo ya hecho (los perfiles están cambiados): se dice y se sale con error al final.
  let fallo = false;
  if (conHoja) {
    try {
      const { filas } = await escribirCotejoEnLaHoja(cotejo, cambiados);
      console.log(`\nLa pestaña «${HOJA_COTEJO}» quedó con ${filas} filas.`);
    } catch (error) {
      fallo = true;
      console.error(`\nNo se pudo escribir la pestaña «${HOJA_COTEJO}»: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (!process.argv.includes('--sin-hoja')) {
    console.log('\nGoogle no está conectado: no se escribió la pestaña.');
  }

  // ---- Que la hoja de asistencia lleve ya a los ponentes que acaban de serlo (si no, el cron lo hace en unos minutos)
  if (cambiados.size > 0 && conHoja) {
    try {
      const { sincronizarAsistencias } = await import('../src/lib/servidor/sheets-asistencia');
      const hoja = await sincronizarAsistencias();
      console.log(`«Asistencia por persona» puesta al día${hoja.ponentes ? `: ${hoja.ponentes.total} ponentes (${hoja.ponentes.total - hoja.ponentes.sinAsistencia} con asistencia y ${hoja.ponentes.sinAsistencia} sin ella)` : ''}.`);
    } catch (error) {
      fallo = true;
      console.error(`No se pudo poner al día «Asistencia por persona»: ${error instanceof Error ? error.message : String(error)}. Se pone al día sola en unos minutos.`);
    }
  }

  // ---- Cómo queda la cuenta
  if (aplicar) {
    titulo(`Ponentes registrados: ${cotejo.resumen.ponentesRegistrados}.`);
  } else if (cotejo.cambios.length > 0) {
    titulo(`Ponentes registrados: ${cotejo.resumen.ponentesRegistrados}; con los ${cotejo.cambios.length} cambios serían ${cotejo.resumen.ponentesDespues}.`);
    console.log('Para hacer los cambios: sudo bash /opt/congreso/guiones/servidor/cotejar-ponentes.sh --aplicar');
  } else {
    titulo(`Ponentes registrados: ${cotejo.resumen.ponentesRegistrados}. No hay perfiles que cambiar.`);
  }
  if (fallo) process.exit(1);
}

principal().catch((error) => {
  console.error('Falló el cotejo:', error instanceof Error ? error.message : error);
  process.exit(1);
});
