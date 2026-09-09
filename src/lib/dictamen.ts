/**
 * Dictamen de las ponencias por el comité científico.
 *
 * El dictamen es independiente del estado del registro: alguien con la
 * ponencia rechazada sigue inscrito y puede asistir, y por eso rechazar
 * nunca cancela el registro.
 */
export const ESTADOS_PONENCIA = [
  'sin_dictamen',
  'en_revision',
  'aceptada',
  'aceptada_con_cambios',
  'rechazada',
] as const;

export type EstadoPonencia = (typeof ESTADOS_PONENCIA)[number];

export function esEstadoPonenciaValido(valor: unknown): valor is EstadoPonencia {
  return typeof valor === 'string' && (ESTADOS_PONENCIA as readonly string[]).includes(valor);
}

/** ¿El dictamen ya está resuelto, o sigue en trámite? */
export function dictamenResuelto(estado: EstadoPonencia): boolean {
  return estado === 'aceptada' || estado === 'aceptada_con_cambios' || estado === 'rechazada';
}

/** Plantilla que corresponde avisar. Los estados en trámite no se comunican. */
export function plantillaDeDictamen(estado: EstadoPonencia): string | null {
  if (estado === 'aceptada') return 'ponencia_aceptada';
  if (estado === 'aceptada_con_cambios') return 'ponencia_aceptada_con_cambios';
  if (estado === 'rechazada') return 'ponencia_rechazada';
  return null;
}

/**
 * Un dictamen que pide cambios o rechaza sin decir por qué deja a la persona
 * autora sin nada que hacer con la respuesta.
 */
export function comentariosObligatorios(estado: EstadoPonencia): boolean {
  return estado === 'aceptada_con_cambios' || estado === 'rechazada';
}

export interface ResultadoDictamen {
  permitido: boolean;
  motivo?: string;
}

export function evaluarDictamen({
  estado,
  comentarios,
  tienePonencia,
}: {
  estado: EstadoPonencia;
  comentarios: string;
  /** Sin título ni resumen no hay nada que dictaminar. */
  tienePonencia: boolean;
}): ResultadoDictamen {
  if (!tienePonencia) {
    return { permitido: false, motivo: 'Este registro no incluye ponencia que dictaminar.' };
  }
  if (comentariosObligatorios(estado) && !comentarios.trim()) {
    return {
      permitido: false,
      motivo: 'Explique el dictamen: sin comentarios, la persona autora no sabe qué corregir.',
    };
  }
  return { permitido: true };
}

/** Resumen de avance para la cabecera de la pantalla de dictamen. */
export interface AvanceDictamen {
  total: number;
  resueltas: number;
  pendientes: number;
  porEstado: Record<EstadoPonencia, number>;
}

export function calcularAvance(estados: EstadoPonencia[]): AvanceDictamen {
  const porEstado = Object.fromEntries(
    ESTADOS_PONENCIA.map((e) => [e, 0]),
  ) as Record<EstadoPonencia, number>;

  for (const estado of estados) porEstado[estado] += 1;

  const resueltas = estados.filter(dictamenResuelto).length;
  return { total: estados.length, resueltas, pendientes: estados.length - resueltas, porEstado };
}
