import 'server-only';
import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { crearClienteAdmin, supabaseConfigurado } from '@/lib/supabase/admin';

export type RolPanel = 'superadmin' | 'organizador' | 'cientifico_datos' | 'lector';

export interface UsuarioPanel {
  id: string;
  correo: string;
  nombre: string | null;
  rol: RolPanel;
  idioma: string;
}

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

/** Permisos derivados del rol, usados por el panel y las rutas de API. */
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

/** Usuario del panel de la sesión actual, o null si no tiene acceso. */
export async function usuarioActual(): Promise<UsuarioPanel | null> {
  if (!supabaseConfigurado()) return null;

  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const admin = crearClienteAdmin();
  const { data: usuario } = await admin
    .from('usuarios_panel')
    .select('id, correo, nombre, rol, idioma, activo')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!usuario?.activo) return null;

  await admin
    .from('usuarios_panel')
    .update({ ultimo_acceso: new Date().toISOString() })
    .eq('id', usuario.id);

  return {
    id: usuario.id,
    correo: usuario.correo,
    nombre: usuario.nombre,
    rol: usuario.rol as RolPanel,
    idioma: usuario.idioma,
  };
}

/** Exige sesión con acceso al panel; redirige al login si no la hay. */
export async function exigirUsuario(minimo: RolPanel = 'lector'): Promise<UsuarioPanel> {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/login');
  if (!alMenos(usuario.rol, minimo)) redirect('/panel');
  return usuario;
}
