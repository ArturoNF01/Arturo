/**
 * Parámetros de visualización. Los ocho tonos categóricos se asignan en orden
 * fijo y nunca se reciclan: a partir del noveno valor la serie se pliega en
 * «Otros». La paleta fue validada con el verificador de la guía de datos
 * (banda de luminosidad, croma, separación para daltonismo y contraste).
 */
export const SERIES = [
  'var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-4)',
  'var(--serie-5)', 'var(--serie-6)', 'var(--serie-7)', 'var(--serie-8)',
] as const;

/** Rampa secuencial de un solo tono para magnitudes (mapa y heatmap). */
export const SECUENCIAL = [
  'var(--sec-1)', 'var(--sec-2)', 'var(--sec-3)', 'var(--sec-4)',
  'var(--sec-5)', 'var(--sec-6)', 'var(--sec-7)',
] as const;

export const MAX_SERIES = 8;

export function colorSerie(indice: number): string {
  return SERIES[Math.min(indice, SERIES.length - 1)];
}

/** Paso de la rampa secuencial para un valor normalizado entre 0 y 1. */
export function pasoSecuencial(fraccion: number): string {
  if (!Number.isFinite(fraccion) || fraccion <= 0) return 'var(--rejilla)';
  const indice = Math.min(SECUENCIAL.length - 1, Math.floor(fraccion * SECUENCIAL.length));
  return SECUENCIAL[indice];
}

export interface Conteo { nombre: string; clave: string; total: number }

/**
 * Cuenta ocurrencias y pliega la cola en «Otros» para no salir de los ocho
 * tonos disponibles.
 */
export function contarPor<T>(
  filas: T[],
  clave: (fila: T) => string | null | undefined,
  etiqueta: (valor: string) => string,
  opciones: { maximo?: number; etiquetaOtros?: string; etiquetaVacio?: string } = {},
): Conteo[] {
  const { maximo = MAX_SERIES, etiquetaOtros = 'Otros', etiquetaVacio = '—' } = opciones;
  const cuenta = new Map<string, number>();

  for (const fila of filas) {
    const valor = (clave(fila) ?? '').toString().trim() || '__vacio__';
    cuenta.set(valor, (cuenta.get(valor) ?? 0) + 1);
  }

  const ordenados = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  const principales = ordenados.slice(0, maximo).map(([valor, total]) => ({
    clave: valor,
    nombre: valor === '__vacio__' ? etiquetaVacio : etiqueta(valor),
    total,
  }));

  const resto = ordenados.slice(maximo).reduce((suma, [, total]) => suma + total, 0);
  if (resto > 0) principales.push({ clave: '__otros__', nombre: etiquetaOtros, total: resto });

  return principales;
}

/** Regresión lineal simple por mínimos cuadrados sobre pares (x, y). */
export interface Regresion {
  pendiente: number;
  interseccion: number;
  r2: number;
  /** Error estándar de la estimación, para la banda de confianza. */
  error: number;
}

export function regresionLineal(puntos: { x: number; y: number }[]): Regresion | null {
  const n = puntos.length;
  if (n < 3) return null;

  const sumaX = puntos.reduce((s, p) => s + p.x, 0);
  const sumaY = puntos.reduce((s, p) => s + p.y, 0);
  const mediaX = sumaX / n;
  const mediaY = sumaY / n;

  let sxy = 0;
  let sxx = 0;
  for (const p of puntos) {
    sxy += (p.x - mediaX) * (p.y - mediaY);
    sxx += (p.x - mediaX) ** 2;
  }
  if (sxx === 0) return null;

  const pendiente = sxy / sxx;
  const interseccion = mediaY - pendiente * mediaX;

  let ssTotal = 0;
  let ssResiduo = 0;
  for (const p of puntos) {
    const estimado = pendiente * p.x + interseccion;
    ssTotal += (p.y - mediaY) ** 2;
    ssResiduo += (p.y - estimado) ** 2;
  }

  return {
    pendiente,
    interseccion,
    r2: ssTotal === 0 ? 0 : 1 - ssResiduo / ssTotal,
    error: Math.sqrt(ssResiduo / Math.max(1, n - 2)),
  };
}
