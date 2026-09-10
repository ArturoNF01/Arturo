import 'server-only';
import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { consultar, unaFila } from '@/lib/bd/conexion';
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
    const fila = await unaFila<{ valor: unknown }>(
      `select valor from configuracion where clave = 'limite_registros_por_huella'`,
    );
    return normalizarLimite(fila?.valor);
  } catch {
    return normalizarLimite(undefined);
  }
}

/** Registros aceptados desde esta huella en las últimas 24 horas. */
export async function contarIntentos(huella: string): Promise<number> {
  try {
    const fila = await unaFila<{ total: string }>(
      `select count(*)::text as total from intentos_registro
        where huella = $1 and creado_en > now() - interval '24 hours'`,
      [huella],
    );
    return Number(fila?.total ?? 0);
  } catch {
    // Si no se puede contar, no se bloquea a nadie: el formulario pesa más
    // que el límite.
    return 0;
  }
}

export async function asentarIntento(huella: string): Promise<void> {
  try {
    await consultar('insert into intentos_registro (huella) values ($1)', [huella]);
  } catch {
    // El asiento es para contar, no para autorizar: si falla, se sigue.
  }
}

/** ¿Ya existe un registro vigente con este correo? Devuelve su folio. */
export async function registroVigenteCon(correo: string): Promise<string | null> {
  try {
    const fila = await unaFila<{ folio: string }>(
      `select folio from registros
        where lower(correo) = lower($1) and estado <> 'cancelado'
        limit 1`,
      [correo],
    );
    return fila?.folio ?? null;
  } catch {
    return null;
  }
}

/** Purga los intentos que ya no cuentan. La llama el cron diario. */
export async function purgarIntentos(): Promise<void> {
  try {
    await consultar('select purgar_intentos_registro()');
  } catch {
    // Si la purga falla, las filas viejas sólo ocupan espacio; no afectan al
    // conteo, que ya filtra por fecha.
  }
}
