import 'server-only';
import { crearClienteAdmin } from '@/lib/supabase/admin';
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
  /** Sin CRON_SECRET el cron de Vercel no puede autenticarse. */
  cronConfigurado: boolean;
}

/** Configuración de los recordatorios y avance de los envíos, para el panel. */
export async function leerEstadoRecordatorios(): Promise<EstadoRecordatorios> {
  const cronConfigurado = Boolean(process.env.CRON_SECRET);
  try {
    const supabase = crearClienteAdmin();
    const [{ data: fila }, { data: envios }] = await Promise.all([
      supabase.from('configuracion').select('valor').eq('clave', 'recordatorios').maybeSingle(),
      supabase.from('v_recordatorios_enviados').select('*'),
    ]);

    return {
      recordatorios: normalizarRecordatorios(fila?.valor),
      envios: (envios ?? []) as EnvioRecordatorio[],
      cronConfigurado,
    };
  } catch {
    return { recordatorios: RECORDATORIOS_POR_DEFECTO, envios: [], cronConfigurado };
  }
}
