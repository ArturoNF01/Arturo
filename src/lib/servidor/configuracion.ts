import 'server-only';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { CONFIG } from '@/lib/config';

export interface ConfiguracionPublica {
  cupos_presenciales: number | null;
  cupos_en_linea: number | null;
  registro_abierto: boolean;
  fecha_limite_registro: string;
  url_agenda: string;
  url_video_login: string;
  correo_contacto: string;
  ocupado_presencial: number;
  ocupado_en_linea: number;
}

const RESPALDO: ConfiguracionPublica = {
  cupos_presenciales: 300,
  cupos_en_linea: null,
  registro_abierto: true,
  fecha_limite_registro: CONFIG.fechaLimiteRegistro,
  url_agenda: CONFIG.urlConvocatoria,
  url_video_login: CONFIG.urlVideoLogin,
  correo_contacto: process.env.CORREO_CONTACTO ?? 'congreso@ciess.org',
  ocupado_presencial: 0,
  ocupado_en_linea: 0,
};

/**
 * Lee la configuración editable y la ocupación actual de cupos.
 * Si Supabase no está disponible devuelve valores de respaldo para que el
 * formulario siga funcionando en entornos sin credenciales.
 */
export async function leerConfiguracion(): Promise<ConfiguracionPublica> {
  try {
    const supabase = crearClienteAdmin();
    const [{ data: filas }, { data: cupos }] = await Promise.all([
      supabase.from('configuracion').select('clave, valor'),
      supabase.from('cupos_estado').select('*').single(),
    ]);

    const mapa = new Map((filas ?? []).map((f: { clave: string; valor: unknown }) => [f.clave, f.valor]));
    const leer = <T,>(clave: string, respaldo: T): T => {
      const valor = mapa.get(clave);
      return valor === undefined || valor === null ? respaldo : (valor as T);
    };

    return {
      cupos_presenciales: leer<number | null>('cupos_presenciales', RESPALDO.cupos_presenciales),
      cupos_en_linea: leer<number | null>('cupos_en_linea', RESPALDO.cupos_en_linea),
      registro_abierto: leer<boolean>('registro_abierto', RESPALDO.registro_abierto),
      fecha_limite_registro: leer<string>('fecha_limite_registro', RESPALDO.fecha_limite_registro),
      url_agenda: leer<string>('url_agenda', RESPALDO.url_agenda),
      url_video_login: leer<string>('url_video_login', RESPALDO.url_video_login),
      correo_contacto: leer<string>('correo_contacto', RESPALDO.correo_contacto),
      ocupado_presencial: Number(cupos?.ocupado_presencial ?? 0),
      ocupado_en_linea: Number(cupos?.ocupado_en_linea ?? 0),
    };
  } catch {
    return RESPALDO;
  }
}

export function lugaresPresencialesRestantes(config: ConfiguracionPublica): number | null {
  if (config.cupos_presenciales === null) return null;
  return Math.max(0, config.cupos_presenciales - config.ocupado_presencial);
}
