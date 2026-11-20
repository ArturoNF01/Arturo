/**
 * Cierra (o vuelve a abrir) el registro al congreso: es el interruptor «Registro abierto» de Cupos y configuración del panel.
 *
 *   npm run cerrar-registro                  # cierra el registro
 *   npm run cerrar-registro -- --abrir       # lo vuelve a abrir
 *   npm run cerrar-registro -- --estado      # sólo dice cómo está; no cambia nada
 *
 * Con el registro cerrado el sitio no recibe registros nuevos y dice «El periodo de registro está cerrado»; no toca los registros
 * que ya hay, ni la edición de cada uno (esa la limita la fecha límite, que no se mueve aquí), ni la asistencia.
 * El cambio queda en la auditoría como hecho por el sistema.
 *
 * Desde el servidor:  sudo bash /opt/congreso/guiones/servidor/cerrar-registro.sh [--abrir | --estado]
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

async function principal() {
  if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL.'); process.exit(1); }
  const { conActor, consultar } = await import('../src/lib/bd/conexion');

  const leer = async () => {
    const filas = await consultar<{ valor: unknown }>("select valor from configuracion where clave = 'registro_abierto'");
    // Sin la fila, el sitio trata el registro como abierto (es el valor de respaldo).
    return filas.length === 0 ? true : filas[0].valor === true;
  };

  const abrir = process.argv.includes('--abrir');
  const soloEstado = process.argv.includes('--estado');
  const hoy = await leer();
  const texto = (abierto: boolean) => (abierto ? 'ABIERTO' : 'CERRADO');
  console.log(`Registro al congreso, ahora: ${texto(hoy)}.`);
  if (soloEstado) return;

  if (hoy === abrir) {
    console.log(`Ya estaba ${texto(abrir).toLowerCase()}: no hay nada que cambiar.`);
    return;
  }
  // Se escribe la fila entera (por si faltara), como lo hace el panel: un jsonb booleano.
  await conActor(
    null,
    `insert into configuracion (clave, valor, descripcion)
     values ('registro_abierto', $1::jsonb, 'Permite recibir nuevos registros')
     on conflict (clave) do update set valor = excluded.valor`,
    [JSON.stringify(abrir)],
  );
  const despues = await leer();
  if (despues !== abrir) {
    console.error(`\x1b[31mNo quedó: el registro sigue ${texto(despues)}.\x1b[0m`);
    process.exit(1);
  }
  console.log(`\x1b[32mListo: el registro quedó ${texto(despues)}.\x1b[0m`);
  console.log(abrir
    ? 'El sitio vuelve a recibir registros.'
    : 'El sitio ya no recibe registros nuevos. Para volver a abrirlo: --abrir (o desde Cupos en el panel).');
}

// Termina en cuanto acaba: la conexión a la base se queda abierta 30 s por inactividad y el guion esperaría ese rato de balde.
principal().then(() => process.exit(0)).catch((error) => {
  console.error('Falló el cambio del registro:', error instanceof Error ? error.message : error);
  process.exit(1);
});
