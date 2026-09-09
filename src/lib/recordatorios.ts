/**
 * Recordatorios antes del congreso.
 *
 * Cada recordatorio se define por los días de antelación. El cron corre a
 * diario y envía sólo el que corresponde al día de hoy, con una tolerancia
 * de un día para que una ejecución fallida no pierda la ventana.
 */
export interface Recordatorio {
  clave: string;
  dias_antes: number;
  activo: boolean;
}

export const RECORDATORIOS_POR_DEFECTO: Recordatorio[] = [
  { clave: 't_30', dias_antes: 30, activo: true },
  { clave: 't_7', dias_antes: 7, activo: true },
  { clave: 't_1', dias_antes: 1, activo: true },
];

/** Días completos entre hoy y el primer día del congreso. */
export function diasHasta(fechaInicio: string, hoy: Date = new Date()): number | null {
  const inicio = Date.parse(`${fechaInicio}T00:00:00Z`);
  if (!Number.isFinite(inicio)) return null;
  const referencia = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return Math.round((inicio - referencia) / 86_400_000);
}

/**
 * Recordatorio que toca enviar hoy, si alguno.
 *
 * La ventana admite un día de retraso: si el cron no corrió ayer, el envío
 * sale hoy en lugar de perderse. Nunca se adelanta, para no avisar antes de
 * tiempo.
 */
export function recordatorioDeHoy(
  recordatorios: Recordatorio[],
  fechaInicio: string,
  hoy: Date = new Date(),
): Recordatorio | null {
  const restantes = diasHasta(fechaInicio, hoy);
  if (restantes === null || restantes < 0) return null;

  const activos = recordatorios
    .filter((r) => r.activo)
    .sort((a, b) => a.dias_antes - b.dias_antes);

  // Se recorre de menor a mayor antelación para que, si dos ventanas se
  // solapan, gane el recordatorio más cercano al congreso.
  return (
    activos.find((r) => restantes === r.dias_antes || restantes === r.dias_antes - 1) ?? null
  );
}

/** Estados de registro a los que tiene sentido escribir un recordatorio. */
export function debeRecibirRecordatorio(estado: string): boolean {
  return estado === 'confirmado' || estado === 'en_proceso';
}

export function normalizarRecordatorios(valor: unknown): Recordatorio[] {
  if (!Array.isArray(valor)) return RECORDATORIOS_POR_DEFECTO;
  const filas = valor
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({
      clave: String(r.clave ?? ''),
      dias_antes: Number(r.dias_antes),
      activo: r.activo !== false,
    }))
    .filter((r) => r.clave !== '' && Number.isInteger(r.dias_antes) && r.dias_antes >= 0);

  return filas.length > 0 ? filas : RECORDATORIOS_POR_DEFECTO;
}
