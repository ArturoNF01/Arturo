/**
 * Revisión de los repetidos de «Asistencia por persona»: quién sale más de una vez, con el mismo nombre o el mismo correo.
 *
 *   npm run revisar-repetidos              # cuenta, dice qué hacer y llena la pestaña «Repetidos por revisar»
 *   npm run revisar-repetidos -- --sin-hoja   # no toca la hoja de Google: sólo el resumen en pantalla
 *
 * Cada fila de «Asistencia por persona» con «Con registro» marcado es una constancia: una misma persona en dos filas es, o dos
 * constancias, o una sola con los días de asistencia partidos entre dos filas. Esto sólo mira y aconseja: no cambia ningún
 * registro ni ninguna asistencia. Dos filas con el mismo nombre pueden ser dos personas; lo que se hace con las que no —ligar una
 * asistencia suelta a su registro, cancelar el registro que sobra— se hace en el panel, y la hoja lo recoge sola en unos minutos.
 * Se vuelve a correr para ver cuántos quedan.
 *
 * Desde el servidor:  sudo bash /opt/congreso/guiones/servidor/revisar-repetidos.sh
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

/** Cuántos casos se enseñan en pantalla; los demás están en la pestaña. */
const MAXIMO_EN_PANTALLA = 40;

async function principal() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL.');
    process.exit(1);
  }
  // Se importan aquí, ya cargado el entorno: el módulo de la base abre la conexión con lo que encuentre al cargarse.
  const { escribirRepetidosEnLaHoja, HOJA_REPETIDOS, leerRevisionDeRepetidos } = await import('../src/lib/servidor/repetidos');
  const { nombreDePerfil } = await import('../src/lib/normalizacion');
  const { googleConfigurado } = await import('../src/lib/servidor/google');

  const conHoja = !process.argv.includes('--sin-hoja') && googleConfigurado() && Boolean(process.env.GOOGLE_SHEETS_ID);
  const revision = await leerRevisionDeRepetidos();
  const r = revision.resumen;

  const en = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  console.log(`«Asistencia por persona»: ${r.filas} filas.`);
  console.log(`  ${en(r.nombresRepetidos, 'nombre repetido', 'nombres repetidos')} (sin acentos, mayúsculas ni orden de palabras).`);
  console.log(`  ${en(r.correosRepetidos, 'correo repetido', 'correos repetidos')}.`);

  if (r.casos === 0) {
    console.log('\nNo hay nadie repetido: no se emitiría más de una constancia a la misma persona.');
  } else {
    console.log(`\n${en(r.casos, 'caso', 'casos')} a revisar (un caso junta las filas que comparten nombre o correo):`);
    console.log(`  ${String(r.dosConstancias).padStart(3)} con dos o más registros vigentes: saldrían dos constancias`);
    console.log(`  ${String(r.diasRepartidos).padStart(3)} con los días de asistencia repartidos entre filas: la constancia saldría con menos días`);
    console.log(`  ${String(r.sinRegistro).padStart(3)} sin ningún registro vigente: no recibirían constancia`);
    console.log(`  ${String(r.sinRiesgo).padStart(3)} sin riesgo: sólo una fila tiene registro y las demás no llevan asistencia`);

    const etiquetaDeRiesgo = {
      dos_constancias: '\x1b[31mDOS CONSTANCIAS\x1b[0m', dias_repartidos: '\x1b[33mDÍAS REPARTIDOS\x1b[0m',
      sin_registro: 'sin registro', sin_riesgo: 'sin riesgo',
    } as const;
    for (const caso of revision.casos.slice(0, MAXIMO_EN_PANTALLA)) {
      const motivo = caso.motivos.length === 2 ? 'mismo nombre y correo' : caso.motivos[0] === 'correo' ? 'mismo correo' : 'mismo nombre';
      console.log(`\nCaso ${caso.numero} — ${motivo} — ${etiquetaDeRiesgo[caso.riesgo]}`);
      for (const f of caso.filas) {
        const perfil = f.perfil ? nombreDePerfil(f.perfil) : 'sin perfil';
        const dias = `${f.total} ${f.total === 1 ? 'día' : 'días'}`;
        const ponencia = f.ponencia ? `  «${f.ponencia.length > 60 ? `${f.ponencia.slice(0, 57)}…` : f.ponencia}»` : '';
        console.log(`  N.º ${String(f.numero).padEnd(4)} ${f.nombre} <${f.correo}> · ${perfil} · ${f.conRegistro ? 'con registro' : 'sin registro vigente'} · ${dias}${ponencia}`);
      }
      console.log(`  → ${caso.sugerencia}`);
    }
    if (revision.casos.length > MAXIMO_EN_PANTALLA) {
      console.log(`\n… y ${revision.casos.length - MAXIMO_EN_PANTALLA} casos más (están en la pestaña).`);
    }
  }

  // ---- La pestaña de la hoja. Si falla se dice y se sale con error: lo de arriba ya se vio.
  let fallo = false;
  if (conHoja) {
    try {
      const { filas } = await escribirRepetidosEnLaHoja(revision);
      console.log(`\nLa pestaña «${HOJA_REPETIDOS}» quedó con ${filas} filas${r.casos === 0 ? ' (sólo los títulos)' : ''}.`);
    } catch (error) {
      fallo = true;
      console.error(`\nNo se pudo escribir la pestaña «${HOJA_REPETIDOS}»: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (!process.argv.includes('--sin-hoja')) {
    console.log('\nGoogle no está conectado: no se escribió la pestaña.');
  }

  if (r.casos > 0) {
    console.log('\nCuando resuelva algunos en el panel, vuelva a correr esto para ver cuántos quedan:');
    console.log('  sudo bash /opt/congreso/guiones/servidor/revisar-repetidos.sh');
  }
  if (fallo) process.exit(1);
}

principal().catch((error) => {
  console.error('Falló la revisión de repetidos:', error instanceof Error ? error.message : error);
  process.exit(1);
});
