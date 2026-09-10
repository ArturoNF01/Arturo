/**
 * Da de alta una cuenta del panel desde la línea de comandos.
 *
 * Es la única forma de crear la primera: sin ninguna cuenta no hay con quién
 * entrar al panel, y desde el panel es donde se crean las demás.
 *
 *   npm run crear-usuario -- correo@ciess.org "Nombre" superadmin
 *
 * La contraseña se pide por teclado y no queda en el historial del intérprete
 * de comandos. Si se deja vacía, la cuenta entra por enlace de acceso.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { cifrarClave } from '../src/lib/bd/claves';
import { consultar } from '../src/lib/bd/conexion';

const ROLES = ['superadmin', 'organizador', 'cientifico_datos', 'lector'] as const;

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

  const consola = createInterface({ input: stdin, output: stdout });
  const clave = await consola.question(
    'Contraseña (vacío para que entre por enlace de acceso): ',
  );
  consola.close();

  if (clave && clave.length < 10) {
    console.error('La contraseña va de 10 caracteres en adelante.');
    process.exit(1);
  }

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
