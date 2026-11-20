/**
 * Congela (o descongela) la pestaña «Asistencia por persona»: mientras está congelada el sistema no la escribe ni la mueve, y lo que
 * está en la hoja es lo que vale. Es lo que conviene cuando quien hace las constancias la edita a mano.
 *
 *   npm run congelar-hoja                    # la congela
 *   npm run congelar-hoja -- --descongelar   # vuelve a ser una copia de la base (la próxima pasada reescribe sus diez columnas)
 *   npm run congelar-hoja -- --estado        # sólo dice cómo está; no cambia nada
 *
 * Es el mismo interruptor que el del panel (Asistencia). Nace congelada. Queda en la auditoría como hecho por el sistema.
 *
 * Desde el servidor:  sudo bash /opt/congreso/guiones/servidor/congelar-hoja.sh [--descongelar | --estado]
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

async function principal() {
  if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL.'); process.exit(1); }
  const { hojaCongelada, ponerHojaCongelada } = await import('../src/lib/servidor/hoja-congelada');

  const descongelar = process.argv.includes('--descongelar');
  const soloEstado = process.argv.includes('--estado');
  const texto = (congelada: boolean) => (congelada ? 'CONGELADA' : 'LIBRE (el sistema la escribe)');
  const antes = await hojaCongelada();
  console.log(`«Asistencia por persona», ahora: ${texto(antes)}.`);
  if (soloEstado) return;

  const quiere = !descongelar;
  if (antes === quiere) { console.log('Ya estaba así: no hay nada que cambiar.'); return; }
  await ponerHojaCongelada(quiere, null);
  const despues = await hojaCongelada();
  if (despues !== quiere) { console.error(`\x1b[31mNo quedó: sigue ${texto(despues)}.\x1b[0m`); process.exit(1); }
  console.log(`\x1b[32mListo: quedó ${texto(despues)}.\x1b[0m`);
  console.log(quiere
    ? 'El sistema ya no escribe en la pestaña: puede editarla a mano sin que nada se deshaga.'
    : 'Ojo: la próxima pasada (en minutos) deja las diez primeras columnas como están en la base; lo que haya cambiado a mano ahí se pierde.');
}

// Termina en cuanto acaba: la conexión a la base se quedaría 30 s abierta por inactividad.
principal().then(() => process.exit(0)).catch((error) => {
  console.error('Falló el cambio:', error instanceof Error ? error.message : error);
  process.exit(1);
});
