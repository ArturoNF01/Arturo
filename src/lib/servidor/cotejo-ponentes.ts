import 'server-only';
import { conActor, consultar } from '@/lib/bd/conexion';
import {
  ENCABEZADOS_DE_COTEJO, PERFIL_DE_PONENTE, PERFILES_QUE_SE_CAMBIAN, filasDeCotejoParaLaHoja, type Cotejo, type RegistroParaCotejo,
} from '@/lib/cotejo-ponentes';
import { nombreDePerfil } from '@/lib/normalizacion';
import { googleConfigurado } from './google';
import { escribirPestanaDeRevision } from './pestana-de-revision';
import { resincronizarRegistro } from './sheets';

/**
 * El cotejo de los ponentes de la agenda con los registros, del lado del servidor: leer los registros, pasar a ponente a
 * quien se registró como público general y dejar el resultado en una pestaña de la hoja para revisarlo. Las reglas están en
 * `@/lib/cotejo-ponentes`; esto sólo toca la base y la hoja.
 */

export const HOJA_COTEJO = 'Cotejo de ponentes';

/** Todos los registros, con lo necesario para reconocer a quien figura en la agenda y comparar su título. */
export async function leerRegistrosParaCotejo(): Promise<RegistroParaCotejo[]> {
  return consultar<RegistroParaCotejo>(
    `select id, folio, btrim(nombres || ' ' || apellidos) as nombre, correo, perfil, estado::text as estado,
            titulo_ponencia, eje_tematico
       from registros
      order by creado_en, id`,
  );
}

export interface CambioAplicado {
  id: string;
  folio: string;
  nombre: string;
  /** El autor de la agenda por el que se cambió. */
  autor: string;
  /** Si no se aplicó, por qué (el registro ya no era de público general, o se canceló mientras tanto). */
  omitido?: string;
  /** Qué pasó con la copia de ese registro en la hoja de Google. */
  hoja: 'al_dia' | 'fallo' | 'sin_google' | 'no_aplica';
  errorDeLaHoja?: string;
}

/**
 * Pasa a ponente a los registros del cotejo. Sólo cambia el perfil, y sólo si el registro sigue siendo de uno de los perfiles que
 * se cambian y no está cancelado: si alguien lo tocó entre el cotejo y el cambio, se deja como esté. No toca ningún otro dato, no
 * manda correo (nadie tiene que enterarse de que se corrigió su perfil) y deja la auditoría como del sistema, con el perfil de antes
 * y el de después. Y pone al día la copia de ese registro en la hoja de Google, como lo hace el panel al editarlo.
 */
export async function aplicarCambiosDePerfil(cambios: Cotejo['cambios']): Promise<CambioAplicado[]> {
  const resultados: CambioAplicado[] = [];
  const hayGoogle = googleConfigurado() && Boolean(process.env.GOOGLE_SHEETS_ID);
  for (const { registro, autor } of cambios) {
    const base = { id: registro.id, folio: registro.folio, nombre: registro.nombre, autor };
    const filas = await conActor<Record<string, unknown> & { id: string }>(
      null,
      `update registros set perfil = $2
        where id = $1 and perfil = any($3::text[]) and estado <> 'cancelado'
        returning *`,
      [registro.id, PERFIL_DE_PONENTE, [...PERFILES_QUE_SE_CAMBIAN]],
    );
    if (filas.length === 0) {
      resultados.push({ ...base, omitido: 'ya no era de público general (o se canceló): se dejó como estaba', hoja: 'no_aplica' });
      continue;
    }
    if (!hayGoogle) {
      resultados.push({ ...base, hoja: 'sin_google' });
      continue;
    }
    try {
      await resincronizarRegistro(filas[0]);
      await consultar('update registros set sheets_sincronizado_en = now(), sheets_error = null where id = $1', [registro.id]);
      resultados.push({ ...base, hoja: 'al_dia' });
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      await consultar('update registros set sheets_error = $2 where id = $1', [registro.id, motivo]);
      resultados.push({ ...base, hoja: 'fallo', errorDeLaHoja: motivo });
    }
  }
  return resultados;
}

/** Anchos de las columnas de la pestaña, en píxeles: las de texto largo, anchas; las demás, a la medida. */
const ANCHOS = [55, 380, 210, 110, 100, 330, 220, 220, 110, 120, 100, 380, 150, 420];

/**
 * Escribe el cotejo en la pestaña «Cotejo de ponentes» (`escribirPestanaDeRevision`): la crea al final si no existe y la vuelve a
 * escribir entera cada vez, porque es una vista del cotejo, no un dato. Fuera de la pasada de la hoja de asistencia: sólo se
 * escribe cuando se corre el cotejo.
 */
export async function escribirCotejoEnLaHoja(cotejo: Cotejo, cambiados: ReadonlySet<string> = new Set()): Promise<{ filas: number }> {
  return escribirPestanaDeRevision({
    titulo: HOJA_COTEJO,
    encabezados: ENCABEZADOS_DE_COTEJO,
    filas: filasDeCotejoParaLaHoja(cotejo, nombreDePerfil, cambiados),
    anchos: ANCHOS,
  });
}
