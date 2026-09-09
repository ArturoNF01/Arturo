import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente con clave de servicio: ignora RLS. Se usa únicamente en rutas de
 * API del servidor (alta pública de registros, sincronizaciones, correos).
 */
export function crearClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
