/**
 * Reglas de los estados de un registro.
 *
 * `lista_espera` y `cancelado` no ocupan lugar: quien está en espera todavía
 * no tiene asiento asignado, y por eso pasar a un estado que sí ocupa exige
 * comprobar el cupo presencial.
 */
export const ESTADOS = ['en_proceso', 'confirmado', 'lista_espera', 'cancelado'] as const;
export type EstadoRegistro = (typeof ESTADOS)[number];

export function esEstadoValido(valor: unknown): valor is EstadoRegistro {
  return typeof valor === 'string' && (ESTADOS as readonly string[]).includes(valor);
}

/** ¿Este estado consume un lugar del cupo? */
export function ocupaLugar(estado: EstadoRegistro): boolean {
  return estado !== 'cancelado' && estado !== 'lista_espera';
}

/** Transiciones que tienen sentido desde cada estado. */
const TRANSICIONES: Record<EstadoRegistro, EstadoRegistro[]> = {
  en_proceso: ['confirmado', 'lista_espera', 'cancelado'],
  lista_espera: ['confirmado', 'en_proceso', 'cancelado'],
  confirmado: ['en_proceso', 'cancelado'],
  cancelado: ['en_proceso', 'lista_espera'],
};

export function transicionesDesde(estado: EstadoRegistro): EstadoRegistro[] {
  return TRANSICIONES[estado] ?? [];
}

export function transicionPermitida(desde: EstadoRegistro, hasta: EstadoRegistro): boolean {
  return transicionesDesde(desde).includes(hasta);
}

/** Plantilla de correo que corresponde avisar al entrar en cada estado. */
export function plantillaDeEstado(estado: EstadoRegistro): string | null {
  if (estado === 'confirmado') return 'registro_confirmado';
  if (estado === 'cancelado') return 'registro_cancelado';
  if (estado === 'lista_espera') return 'lista_espera';
  // `en_proceso` es el estado de trabajo del comité: no se avisa.
  return null;
}

export interface ResultadoCambio {
  permitido: boolean;
  /** Motivo por el que no se permite, listo para mostrar. */
  motivo?: string;
  /** El cambio libera o consume un lugar presencial. */
  variacionCupo: -1 | 0 | 1;
}

/**
 * Evalúa un cambio de estado contra las transiciones válidas y el cupo
 * presencial disponible.
 */
export function evaluarCambio({
  desde,
  hasta,
  modalidad,
  lugaresLibres,
}: {
  desde: EstadoRegistro;
  hasta: EstadoRegistro;
  modalidad: 'presencial' | 'en_linea';
  /** Lugares presenciales libres; null si no hay límite configurado. */
  lugaresLibres: number | null;
}): ResultadoCambio {
  if (desde === hasta) {
    return { permitido: false, motivo: 'El registro ya está en ese estado.', variacionCupo: 0 };
  }
  if (!transicionPermitida(desde, hasta)) {
    return { permitido: false, motivo: 'Ese cambio de estado no está permitido.', variacionCupo: 0 };
  }

  const antes = ocupaLugar(desde);
  const despues = ocupaLugar(hasta);
  const variacionCupo: -1 | 0 | 1 = antes === despues ? 0 : despues ? 1 : -1;

  if (
    modalidad === 'presencial' &&
    variacionCupo === 1 &&
    lugaresLibres !== null &&
    lugaresLibres <= 0
  ) {
    return {
      permitido: false,
      motivo: 'No quedan lugares presenciales. Amplíe el cupo o cancele otro registro primero.',
      variacionCupo,
    };
  }

  return { permitido: true, variacionCupo };
}
