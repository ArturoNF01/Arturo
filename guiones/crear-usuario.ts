/**
 * Da de alta una cuenta del panel desde la línea de comandos.
 *
 * Es la única forma de crear la primera: sin ninguna cuenta no hay con quién
 * entrar al panel, y desde el panel es donde se crean las demás.
 *
 *   npm run crear-usuario -- correo@ciess.org "Nombre" superadmin
 *
 * La contraseña se pide por teclado —sin que se vea al escribirla— y no queda
 * en el historial del intérprete de comandos. Si se deja vacía, la cuenta entra
 * por enlace de acceso.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';
import { cifrarClave } from '../src/lib/bd/claves';
import { consultar } from '../src/lib/bd/conexion';

const ROLES = ['superadmin', 'organizador', 'cientifico_datos', 'lector'] as const;

/**
 * Lector de teclado que no refleja en pantalla lo que se escribe.
 *
 * Estas cuentas se crean por consola remota, a menudo con alguien mirando o
 * compartiendo pantalla, y lo tecleado queda además en el desplazamiento de la
 * terminal y en cualquier captura. Una contraseña visible al escribirla nace
 * comprometida.
 *
 * readline va escribiendo en su salida cada tecla que recibe; si esa salida no
 * lleva a ninguna parte, no queda nada a la vista. Los avisos los imprimimos
 * aparte, directo a la pantalla. Es un solo lector para todas las preguntas:
 * abrir uno por pregunta hace que el primero se quede con lo que venía detrás
 * y el segundo espere para siempre.
 */
function lectorSilencioso() {
  const interactivo = Boolean(stdin.isTTY);
  const sumidero = new Writable({ write(_trozo, _codificacion, listo) { listo(); } });
  const consola = createInterface({
    input: stdin,
    // Sin terminal (tuberías, automatizaciones) no hay eco que ocultar.
    output: interactivo ? sumidero : stdout,
    terminal: interactivo,
  });

  return {
    async preguntar(mensaje: string): Promise<string> {
      stdout.write(mensaje);
      const valor = await consola.question('');
      if (interactivo) stdout.write('\n');
      return valor;
    },
    cerrar: () => consola.close(),
  };
}

async function principal() {
  const [correo, nombre, rol = 'superadmin'] = process.argv.slice(2);

  if (!correo || !correo.includes('@')) {
    console.error('Uso: npx tsx guiones/crear-usuario.ts <correo> "<nombre>" [rol]');
    console.error(`Roles: ${ROLES.join(', ')}`);
    process.exit(1);
  }
  if (!(ROLES as readonly string[]).includes(rol)) {
    console.error(`Rol no válido: ${rol}. Use uno de: ${ROLES.join(', ')}`);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL.');
    process.exit(1);
  }

  const teclado = lectorSilencioso();
  const clave = await teclado.preguntar('Contraseña (vacío para que entre por enlace de acceso): ');

  if (clave && clave.length < 10) {
    teclado.cerrar();
    console.error('La contraseña va de 10 caracteres en adelante.');
    process.exit(1);
  }
  if (clave) {
    // Como no se ve al teclearla, se pide dos veces: no hay forma de revisarla.
    const confirmacion = await teclado.preguntar('Repítala: ');
    if (confirmacion !== clave) {
      teclado.cerrar();
      console.error('No coinciden. No se creó nada; vuelva a intentarlo.');
      process.exit(1);
    }
  }
  teclado.cerrar();

  const claveHash = clave ? await cifrarClave(clave) : null;

  const filas = await consultar<{ id: string }>(
    `insert into usuarios_panel (correo, nombre, rol, clave_hash)
     values ($1, $2, $3, $4)
     on conflict (lower(correo)) do update
       set nombre = excluded.nombre,
           rol = excluded.rol,
           clave_hash = coalesce(excluded.clave_hash, usuarios_panel.clave_hash),
           activo = true
     returning id`,
    [correo.trim(), nombre ?? null, rol, claveHash],
  );

  console.log(`Cuenta lista: ${correo} · ${rol} · ${filas[0]?.id}`);
  if (!clave) {
    console.log('Sin contraseña: entre pidiendo un enlace de acceso desde /login.');
  }
  process.exit(0);
}

principal().catch((error) => {
  console.error('No se pudo crear la cuenta:', error instanceof Error ? error.message : error);
  process.exit(1);
});
