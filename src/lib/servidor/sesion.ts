import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { bdConfigurada, consultar, unaFila } from '@/lib/bd/conexion';
import { claveCoincide, generarToken, huellaToken } from '@/lib/bd/claves';

export type RolPanel = 'superadmin' | 'organizador' | 'cientifico_datos' | 'lector';

export interface UsuarioPanel {
  id: string;
  correo: string;
  nombre: string | null;
  rol: RolPanel;
  idioma: string;
}

export const GALLETA_SESION = 'congreso.sesion';

/** Duración de una sesión del panel. */
const DIAS_SESION = 7;
/** Un enlace de acceso caduca pronto: es un correo que puede reenviarse. */
const MINUTOS_ENLACE = 30;

const JERARQUIA: Record<RolPanel, number> = {
  superadmin: 4,
  organizador: 3,
  cientifico_datos: 2,
  lector: 1,
};

export function alMenos(rol: RolPanel | undefined, minimo: RolPanel): boolean {
  if (!rol) return false;
  return JERARQUIA[rol] >= JERARQUIA[minimo];
}

/**
 * Permisos derivados del rol.
 *
 * Antes esto vivía dos veces: aquí y en las políticas RLS de la base. Ahora
 * es la única fuente, y toda ruta que escriba tiene que consultarla.
 */
export function permisos(rol: RolPanel | undefined) {
  return {
    verRegistros: alMenos(rol, 'lector'),
    exportar: alMenos(rol, 'cientifico_datos'),
    consultarSql: alMenos(rol, 'cientifico_datos'),
    editarRegistros: alMenos(rol, 'organizador'),
    editarPlantillas: alMenos(rol, 'organizador'),
    editarConfiguracion: alMenos(rol, 'organizador'),
    verAuditoria: alMenos(rol, 'organizador'),
    eliminarRegistros: alMenos(rol, 'superadmin'),
    gestionarUsuarios: alMenos(rol, 'superadmin'),
  };
}

export type Permisos = ReturnType<typeof permisos>;

interface FilaUsuario {
  id: string;
  correo: string;
  nombre: string | null;
  rol: RolPanel;
  idioma: string;
  activo: boolean;
}

/** Usuario del panel de la sesión actual, o null si no tiene acceso. */
export async function usuarioActual(): Promise<UsuarioPanel | null> {
  if (!bdConfigurada()) return null;

  const token = (await cookies()).get(GALLETA_SESION)?.value;
  if (!token) return null;

  try {
    const fila = await unaFila<FilaUsuario>(
      `update sesiones s
          set ultimo_uso = now()
         from usuarios_panel u
        where s.token_hash = $1
          and s.expira_en > now()
          and u.id = s.usuario_id
      returning u.id, u.correo, u.nombre, u.rol, u.idioma, u.activo`,
      [huellaToken(token)],
    );
    if (!fila?.activo) return null;

    await consultar('update usuarios_panel set ultimo_acceso = now() where id = $1', [fila.id]);

    return {
      id: fila.id,
      correo: fila.correo,
      nombre: fila.nombre,
      rol: fila.rol,
      idioma: fila.idioma,
    };
  } catch (error) {
    // Una base caída no debe romper el panel entero: se trata como sin sesión.
    console.error('No se pudo leer la sesión:', error);
    return null;
  }
}

/** Exige sesión con acceso al panel; redirige al login si no la hay. */
export async function exigirUsuario(minimo: RolPanel = 'lector'): Promise<UsuarioPanel> {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/login');
  if (!alMenos(usuario.rol, minimo)) redirect('/panel');
  return usuario;
}

/** Comprueba correo y contraseña. Devuelve el usuario, o null. */
export async function verificarClave(
  correo: string,
  clave: string,
): Promise<UsuarioPanel | null> {
  const fila = await unaFila<FilaUsuario & { clave_hash: string | null }>(
    `select id, correo, nombre, rol, idioma, activo, clave_hash
       from usuarios_panel where lower(correo) = lower($1)`,
    [correo.trim()],
  );

  // Se comprueba la contraseña aunque el usuario no exista o esté inactivo:
  // si no, el tiempo de respuesta delata qué correos están dados de alta.
  const coincide = await claveCoincide(clave, fila?.clave_hash ?? null);
  if (!fila || !fila.activo || !coincide) return null;

  return { id: fila.id, correo: fila.correo, nombre: fila.nombre, rol: fila.rol, idioma: fila.idioma };
}

/** Abre sesión y deja la galleta puesta. */
export async function abrirSesion(usuarioId: string, agente?: string | null): Promise<void> {
  const token = generarToken();
  const expira = new Date(Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000);

  await consultar(
    `insert into sesiones (usuario_id, token_hash, expira_en, agente)
     values ($1, $2, $3, $4)`,
    [usuarioId, huellaToken(token), expira.toISOString(), agente?.slice(0, 300) ?? null],
  );

  (await cookies()).set(GALLETA_SESION, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expira,
  });
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  const token = almacen.get(GALLETA_SESION)?.value;
  if (token) {
    await consultar('delete from sesiones where token_hash = $1', [huellaToken(token)]).catch(
      () => {},
    );
  }
  almacen.delete(GALLETA_SESION);
}

/**
 * Crea un enlace de acceso de un solo uso.
 *
 * Devuelve el testigo en claro, que sólo existe en el correo que se envía:
 * en la base queda su huella.
 */
export async function crearEnlaceAcceso(correo: string): Promise<string | null> {
  const fila = await unaFila<{ id: string }>(
    'select id from usuarios_panel where lower(correo) = lower($1) and activo',
    [correo.trim()],
  );
  if (!fila) return null;

  const token = generarToken();
  await consultar(
    `insert into enlaces_acceso (correo, token_hash, expira_en)
     values ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [correo.trim().toLowerCase(), huellaToken(token), String(MINUTOS_ENLACE)],
  );
  return token;
}

/** Consume un enlace de acceso y abre la sesión. Devuelve el usuario. */
export async function canjearEnlaceAcceso(token: string): Promise<UsuarioPanel | null> {
  const enlace = await unaFila<{ correo: string }>(
    `update enlaces_acceso set usado_en = now()
      where token_hash = $1 and usado_en is null and expira_en > now()
      returning correo`,
    [huellaToken(token)],
  );
  if (!enlace) return null;

  const fila = await unaFila<FilaUsuario>(
    `select id, correo, nombre, rol, idioma, activo
       from usuarios_panel where lower(correo) = lower($1)`,
    [enlace.correo],
  );
  if (!fila?.activo) return null;

  await abrirSesion(fila.id);
  return { id: fila.id, correo: fila.correo, nombre: fila.nombre, rol: fila.rol, idioma: fila.idioma };
}
