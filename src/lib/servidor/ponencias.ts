import 'server-only';
import { consultar } from '@/lib/bd/conexion';
import type { EstadoPonencia } from '@/lib/dictamen';

/** Una propuesta recibida, tal como la muestra la pantalla de dictamen. */
export interface Ponencia {
  id: string;
  folio: string;
  creado_en: string;
  nombres: string;
  apellidos: string;
  correo: string;
  institucion: string | null;
  pais_residencia: string | null;
  perfil: string;
  idioma: string;
  estado: string;
  modalidad_participacion: string | null;
  eje_tematico: string | null;
  titulo_ponencia: string | null;
  resumen_ponencia: string | null;
  palabras_clave: string | null;
  coautoria: string | null;
  semblanza: string | null;
  semblanza_palabras: number | null;
  estado_ponencia: EstadoPonencia;
  dictamen_comentarios: string | null;
  dictamen_en: string | null;
  dictamen_por_correo: string | null;
}

/**
 * Propuestas que hay que dictaminar, en orden de llegada.
 *
 * La vista ya excluye los registros cancelados y los que no traen ponencia.
 * Sin base configurada devuelve una lista vacía para que el panel siga
 * abriendo en entornos sin credenciales.
 */
export async function leerPonencias(): Promise<Ponencia[]> {
  try {
    return await consultar<Ponencia>('select * from v_ponencias');
  } catch {
    return [];
  }
}

