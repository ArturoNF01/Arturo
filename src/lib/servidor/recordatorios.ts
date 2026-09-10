import 'server-only';
import { consultar, unaFila } from '@/lib/bd/conexion';
import {
  RECORDATORIOS_POR_DEFECTO, normalizarRecordatorios, type Recordatorio,
} from '@/lib/recordatorios';

export interface EnvioRecordatorio {
  clave: string;
  enviados: number;
  con_error: number;
  ultimo_envio: string | null;
}

export interface EstadoRecordatorios {
  recordatorios: Recordatorio[];
  envios: EnvioRecordatorio[];
  /** Sin CRON_SECRET el trabajo programado no puede autenticarse. */
  cronConfigurado: boolean;
}

/** Configuración de los recordatorios y avance de los envíos, para el panel. */
export async function leerEstadoRecordatorios(): Promise<EstadoRecordatorios> {
  const cronConfigurado = Boolean(process.env.CRON_SECRET);
  try {
    const [fila, envios] = await Promise.all([
      unaFila<{ valor: unknown }>(
        `select valor from configuracion where clave = 'recordatorios'`,
      ),
      consultar<EnvioRecordatorio>('select * from v_recordatorios_enviados'),
    ]);

    return {
      recordatorios: normalizarRecordatorios(fila?.valor),
      envios,
      cronConfigurado,
    };
  } catch {
    return { recordatorios: RECORDATORIOS_POR_DEFECTO, envios: [], cronConfigurado };
  }
}
