import 'server-only';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import {
  CONGRESO_POR_DEFECTO, EJES_POR_DEFECTO, avisoPorDefecto, faqsPorDefecto,
  type BloqueAvisoPrivacidad, type DatosCongreso, type EjeTematico, type Faq, type Multilingue,
} from '@/lib/contenido';

/**
 * Lectura del contenido editable. Si la tabla está vacía —o Supabase no está
 * configurado todavía— se devuelven las propuestas del código, de modo que el
 * sitio funcione desde el primer arranque y el panel pueda sembrarlas después.
 */

export interface ContenidoConfiguracion {
  congreso: DatosCongreso;
  /** true cuando los valores vienen del código y no de la base. */
  desdeRespaldo: boolean;
}

async function consultar<T>(
  tabla: string,
  columnas: string,
  respaldo: T[],
): Promise<{ filas: T[]; desdeRespaldo: boolean }> {
  try {
    const supabase = crearClienteAdmin();
    const { data, error } = await supabase.from(tabla).select(columnas).order('orden');
    if (error || !data || data.length === 0) return { filas: respaldo, desdeRespaldo: true };
    return { filas: data as T[], desdeRespaldo: false };
  } catch {
    return { filas: respaldo, desdeRespaldo: true };
  }
}

export async function leerEjes(): Promise<{ filas: EjeTematico[]; desdeRespaldo: boolean }> {
  const resultado = await consultar<EjeTematico>(
    'ejes_tematicos',
    'clave, nombre, descripcion, orden, activo',
    EJES_POR_DEFECTO,
  );
  return { ...resultado, filas: resultado.filas.filter((e) => e.activo) };
}

export async function leerFaqs(): Promise<{ filas: Faq[]; desdeRespaldo: boolean }> {
  const resultado = await consultar<Faq>(
    'faqs',
    'clave, categoria, pregunta, respuesta, orden, activa, provisional',
    faqsPorDefecto(),
  );
  return { ...resultado, filas: resultado.filas.filter((f) => f.activa) };
}

export async function leerAvisoPrivacidad(): Promise<{
  filas: BloqueAvisoPrivacidad[];
  desdeRespaldo: boolean;
}> {
  const resultado = await consultar<BloqueAvisoPrivacidad>(
    'aviso_privacidad',
    'clave, titulo, parrafos, orden, activo',
    avisoPorDefecto(),
  );
  return { ...resultado, filas: resultado.filas.filter((b) => b.activo) };
}

/** Datos del congreso guardados en la tabla `configuracion`. */
export async function leerDatosCongreso(): Promise<DatosCongreso> {
  try {
    const supabase = crearClienteAdmin();
    const { data } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .like('clave', 'congreso_%');

    const limites = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', [
        'limite_semblanza_palabras', 'limite_semblanza_caracteres',
        'limite_resumen_caracteres', 'foto_megabytes_maximo',
      ]);

    const mapa = new Map(
      [...(data ?? []), ...(limites.data ?? [])].map((f: { clave: string; valor: unknown }) => [
        f.clave,
        f.valor,
      ]),
    );
    if (mapa.size === 0) return CONGRESO_POR_DEFECTO;

    const texto = (clave: string, respaldo: Multilingue): Multilingue =>
      (mapa.get(clave) as Multilingue | undefined) ?? respaldo;
    const numero = (clave: string, respaldo: number): number =>
      typeof mapa.get(clave) === 'number' ? (mapa.get(clave) as number) : respaldo;
    const cadena = (clave: string, respaldo: string): string =>
      typeof mapa.get(clave) === 'string' ? (mapa.get(clave) as string) : respaldo;

    return {
      nombre: texto('congreso_nombre', CONGRESO_POR_DEFECTO.nombre),
      nombre_corto: texto('congreso_nombre_corto', CONGRESO_POR_DEFECTO.nombre_corto),
      sede: texto('congreso_sede', CONGRESO_POR_DEFECTO.sede),
      fechas: texto('congreso_fechas', CONGRESO_POR_DEFECTO.fechas),
      fecha_inicio: cadena('congreso_fecha_inicio', CONGRESO_POR_DEFECTO.fecha_inicio),
      fecha_fin: cadena('congreso_fecha_fin', CONGRESO_POR_DEFECTO.fecha_fin),
      limite_semblanza_palabras: numero('limite_semblanza_palabras', CONGRESO_POR_DEFECTO.limite_semblanza_palabras),
      limite_semblanza_caracteres: numero('limite_semblanza_caracteres', CONGRESO_POR_DEFECTO.limite_semblanza_caracteres),
      limite_resumen_caracteres: numero('limite_resumen_caracteres', CONGRESO_POR_DEFECTO.limite_resumen_caracteres),
      foto_megabytes_maximo: numero('foto_megabytes_maximo', CONGRESO_POR_DEFECTO.foto_megabytes_maximo),
    };
  } catch {
    return CONGRESO_POR_DEFECTO;
  }
}

/**
 * Copia las propuestas del código a la base para que queden editables.
 * Es idempotente: no toca las filas que ya existan.
 */
export async function sembrarContenido(): Promise<{
  ejes: number;
  faqs: number;
  aviso: number;
}> {
  const supabase = crearClienteAdmin();

  const insertar = async (tabla: string, filas: Record<string, unknown>[]) => {
    if (filas.length === 0) return 0;
    const { data, error } = await supabase
      .from(tabla)
      .upsert(filas, { onConflict: 'clave', ignoreDuplicates: true })
      .select('clave');
    if (error) throw new Error(`${tabla}: ${error.message}`);
    return data?.length ?? 0;
  };

  return {
    ejes: await insertar('ejes_tematicos', EJES_POR_DEFECTO as unknown as Record<string, unknown>[]),
    faqs: await insertar('faqs', faqsPorDefecto() as unknown as Record<string, unknown>[]),
    aviso: await insertar('aviso_privacidad', avisoPorDefecto() as unknown as Record<string, unknown>[]),
  };
}
