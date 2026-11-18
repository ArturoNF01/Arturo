import 'server-only';
import { conActor, consultar } from '@/lib/bd/conexion';
import { CLAVE_DE_PRUEBA, ENCABEZADOS_PERSONAS, HOJA_PERSONAS } from '@/lib/asistencia';
import {
  filasConDatosPropios, type AsistenciaSueltaConNombre, type CambioDeAsistencia, type CambioDeRegistro, type FusionPlanificada,
  type RegistroConNombre,
} from '@/lib/limpieza';
import { rangoDe } from '@/lib/normalizacion';
import { conciliarAsistencia } from './asistencia';
import { clienteSheets, googleConfigurado } from './google';
import { conEspera, resincronizarRegistro } from './sheets';

/**
 * La limpieza de «Asistencia por persona», del lado del servidor (las reglas están en `@/lib/limpieza`): ligar a su registro las
 * asistencias sueltas que repiten a alguien, y pasar a altas y bajas los nombres escritos todo en mayúsculas. No borra ningún
 * registro ni ninguna asistencia: ligar es lo que hace el panel con «Ligar a un registro», y de lo único que se deshace es de una
 * asistencia suelta que repite un día que esa persona ya tenía.
 */

export const leerRegistrosConNombre = (): Promise<RegistroConNombre[]> =>
  consultar<RegistroConNombre>('select id, folio, nombres, apellidos from registros order by creado_en, id');

export const leerSueltasConNombre = (): Promise<AsistenciaSueltaConNombre[]> =>
  consultar<AsistenciaSueltaConNombre>(
    'select id, nombre, correo from asistencias where registro_id is null and sesion <> $1 order by creada_en, id',
    [CLAVE_DE_PRUEBA],
  );

export interface FusionHecha {
  /** Cuántas asistencias pasaron a ser del registro, cuántas se descartaron por repetir un día que ya tenía y cuántas no se pudieron. */
  ligadas: number;
  descartadas: number;
  fallidas: string[];
}

/** Liga a su registro las asistencias sueltas de una fusión, una por una, con las mismas reglas que el panel. */
export async function aplicarFusion(f: FusionPlanificada): Promise<FusionHecha> {
  const hecha: FusionHecha = { ligadas: 0, descartadas: 0, fallidas: [] };
  for (const { asistencias } of f.sueltas) {
    for (const id of asistencias) {
      const r = await conciliarAsistencia(id, f.destino.registroId!);
      if (!r.ok) hecha.fallidas.push(r.mensaje);
      else if (r.resultado === 'ligada') hecha.ligadas += 1;
      else hecha.descartadas += 1;
    }
  }
  return hecha;
}

export interface NombreCambiado {
  id: string;
  /** Si no se aplicó, por qué (alguien lo editó mientras tanto). */
  omitido?: string;
  hoja: 'al_dia' | 'fallo' | 'sin_google' | 'no_aplica';
  errorDeLaHoja?: string;
}

/**
 * Pasa a altas y bajas el nombre de los registros. Sólo cambia el nombre y los apellidos, y sólo si siguen como se leyeron: si
 * alguien los editó entre el cálculo y el cambio, se deja lo suyo («el panel manda»). La auditoría lo asienta como del sistema,
 * con el valor de antes, y se pone al día la copia de ese registro en la hoja, como lo hace el panel al editarlo.
 */
export async function aplicarNombresDeRegistros(cambios: readonly CambioDeRegistro[]): Promise<NombreCambiado[]> {
  const hayGoogle = googleConfigurado() && Boolean(process.env.GOOGLE_SHEETS_ID);
  const resultados: NombreCambiado[] = [];
  for (const c of cambios) {
    const filas = await conActor<Record<string, unknown> & { id: string }>(
      null,
      'update registros set nombres = $2, apellidos = $3 where id = $1 and nombres = $4 and apellidos = $5 returning *',
      [c.id, c.despues.nombres, c.despues.apellidos, c.antes.nombres, c.antes.apellidos],
    );
    if (filas.length === 0) { resultados.push({ id: c.id, omitido: 'ya no estaba como se leyó (lo editaron): se dejó como está', hoja: 'no_aplica' }); continue; }
    if (!hayGoogle) { resultados.push({ id: c.id, hoja: 'sin_google' }); continue; }
    try {
      await resincronizarRegistro(filas[0] as Parameters<typeof resincronizarRegistro>[0]);
      await consultar('update registros set sheets_sincronizado_en = now(), sheets_error = null where id = $1', [c.id]);
      resultados.push({ id: c.id, hoja: 'al_dia' });
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      await consultar('update registros set sheets_error = $2 where id = $1', [c.id, motivo]);
      resultados.push({ id: c.id, hoja: 'fallo', errorDeLaHoja: motivo });
    }
  }
  return resultados;
}

/** Lo mismo para el nombre de las asistencias «sin registro»: sólo si sigue como se leyó. Devuelve cuántas cambió. */
export async function aplicarNombresDeSueltas(cambios: readonly CambioDeAsistencia[]): Promise<number> {
  let cambiadas = 0;
  for (const c of cambios) {
    const filas = await consultar<{ id: string }>(
      'update asistencias set nombre = $2 where id = $1 and registro_id is null and nombre = $3 returning id',
      [c.id, c.despues, c.antes],
    );
    cambiadas += filas.length;
  }
  return cambiadas;
}

/**
 * Las filas de la pestaña, desde `desdeFila` (de datos, desde 0), con algo escrito a la derecha de las columnas del sistema. Si no
 * hay Google, no hay nada que mirar.
 */
export async function filasConDatosPropiosEnLaHoja(desdeFila: number): Promise<number[]> {
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) return [];
  const tabla = (await conEspera(() =>
    clienteSheets().spreadsheets.values.get({ spreadsheetId: idLibro, range: rangoDe(HOJA_PERSONAS, 'A2:Z') }),
  )).data.values ?? [];
  return filasConDatosPropios(tabla, ENCABEZADOS_PERSONAS.length, desdeFila);
}
