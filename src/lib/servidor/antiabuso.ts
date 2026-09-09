import 'server-only';
import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { normalizarLimite } from '@/lib/antiabuso';

/**
 * Huella de la dirección de origen: SHA-256 de la dirección con una sal del
 * servidor. No se guarda la dirección en ningún momento, y sin la sal la
 * huella no se puede revertir a una dirección concreta.
 */
export function huellaDePeticion(peticion: NextRequest): string {
  const reenviada = peticion.headers.get('x-forwarded-for') ?? '';
  const origen =
    reenviada.split(',')[0]?.trim() || peticion.headers.get('x-real-ip') || 'desconocido';

  const sal = process.env.ANTIABUSO_SAL ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'sal-local';
  return createHash('sha256').update(`${sal}:${origen}`).digest('hex');
}

/** Límite vigente, editable desde el panel. */
export async function limitePorHuella(): Promise<number> {
  try {
    const { data } = await crearClienteAdmin()
      .from('configuracion')
      .select('valor')
      .eq('clave', 'limite_registros_por_huella')
      .maybeSingle();
    return normalizarLimite(data?.valor);
  } catch {
    return normalizarLimite(undefined);
  }
}

/** Registros aceptados desde esta huella en las últimas 24 horas. */
export async function contarIntentos(huella: string): Promise<number> {
  try {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await crearClienteAdmin()
      .from('intentos_registro')
      .select('id', { count: 'exact', head: true })
      .eq('huella', huella)
      .gte('creado_en', desde);
    return count ?? 0;
  } catch {
    // Si no se puede contar, no se bloquea a nadie: el formulario pesa más
    // que el límite.
    return 0;
  }
}

export async function asentarIntento(huella: string): Promise<void> {
  try {
    await crearClienteAdmin().from('intentos_registro').insert({ huella });
  } catch {
    // El asiento es para contar, no para autorizar: si falla, se sigue.
  }
}

/** ¿Ya existe un registro vigente con este correo? Devuelve su folio. */
export async function registroVigenteCon(correo: string): Promise<string | null> {
  try {
    const { data } = await crearClienteAdmin()
      .from('registros')
      .select('folio, estado')
      .ilike('correo', correo)
      .neq('estado', 'cancelado')
      .limit(1)
      .maybeSingle();
    return data?.folio ?? null;
  } catch {
    return null;
  }
}

/** Purga los intentos que ya no cuentan. La llama el cron diario. */
export async function purgarIntentos(): Promise<void> {
  try {
    await crearClienteAdmin().rpc('purgar_intentos_registro');
  } catch {
    // Si la purga falla, las filas viejas sólo ocupan espacio; no afectan al
    // conteo, que ya filtra por fecha.
  }
}
