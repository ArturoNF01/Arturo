/**
 * Reglas para frenar envíos automatizados y duplicados en el formulario
 * público, sin estorbar a quien se registra de buena fe.
 *
 * Ninguna de estas comprobaciones ve la dirección de origen: el servidor le
 * pasa una huella ya derivada.
 */

/** Segundos que, como mínimo, tarda una persona en llenar el formulario. */
export const SEGUNDOS_MINIMOS = 4;

/** Registros que se aceptan en 24 h desde una misma huella. */
export const LIMITE_POR_HUELLA = 20;

export type MotivoRechazo = 'senuelo' | 'demasiado_rapido' | 'limite_huella' | 'correo_repetido';

export interface Veredicto {
  aceptado: boolean;
  motivo?: MotivoRechazo;
  /** Código HTTP que corresponde al motivo. */
  codigo?: number;
}

const ACEPTADO: Veredicto = { aceptado: true };

/**
 * El señuelo es un campo oculto que ninguna persona ve ni llena. Si viene con
 * algo, quien envió el formulario fue un programa.
 */
export function senueloLleno(valor: unknown): boolean {
  return typeof valor === 'string' && valor.trim() !== '';
}

/**
 * Un envío instantáneo no lo hizo una persona. Se compara contra el momento en
 * que el formulario se abrió, que viaja en el propio envío; un valor ausente o
 * imposible no basta para rechazar, porque puede venir de un navegador con el
 * reloj mal puesto.
 */
export function demasiadoRapido(
  abiertoEn: unknown,
  ahora: number = Date.now(),
  segundosMinimos: number = SEGUNDOS_MINIMOS,
): boolean {
  if (typeof abiertoEn !== 'number' || !Number.isFinite(abiertoEn)) return false;
  const transcurrido = (ahora - abiertoEn) / 1000;
  // Un reloj adelantado da un valor negativo: se deja pasar, no se castiga.
  if (transcurrido < 0) return false;
  return transcurrido < segundosMinimos;
}

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

/** Comprobaciones que no necesitan tocar la base. */
export function revisarEnvio({
  senuelo,
  abiertoEn,
  ahora = Date.now(),
  segundosMinimos = SEGUNDOS_MINIMOS,
}: {
  senuelo: unknown;
  abiertoEn: unknown;
  ahora?: number;
  segundosMinimos?: number;
}): Veredicto {
  if (senueloLleno(senuelo)) return { aceptado: false, motivo: 'senuelo', codigo: 422 };
  if (demasiadoRapido(abiertoEn, ahora, segundosMinimos)) {
    return { aceptado: false, motivo: 'demasiado_rapido', codigo: 429 };
  }
  return ACEPTADO;
}

/** ¿Cuántos registros más admite esta huella? */
export function dentroDelLimite(intentosRecientes: number, limite: number): boolean {
  if (!Number.isFinite(limite) || limite <= 0) return true; // sin límite configurado
  return intentosRecientes < limite;
}

export function normalizarLimite(valor: unknown): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : LIMITE_POR_HUELLA;
}
