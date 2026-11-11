import 'server-only';
import type { DatosDePantalla } from '@/lib/recepcion';
import { armarDatosDePantalla, type OpcionesDePantalla } from '@/lib/servidor/recepcion';
import { usuarioActual } from '@/lib/servidor/sesion';

/**
 * Lo mismo que `armarDatosDePantalla`, para una petición de verdad: `?dia=` y `?hora=` (otro día u otra hora, para revisar
 * el diseño) sólo se atienden a quien tiene sesión en el panel. La sesión se consulta sólo si piden ese día: la pantalla
 * pública, que es la que se pide cada minuto, no toca la tabla de sesiones.
 */
export async function armarParaPeticion(opciones: Omit<OpcionesDePantalla, 'vistaPrevia'>): Promise<DatosDePantalla | null> {
  const vistaPrevia = Boolean(opciones.dia) && Boolean(await usuarioActual());
  return armarDatosDePantalla({ ...opciones, vistaPrevia });
}
