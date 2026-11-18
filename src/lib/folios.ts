/**
 * Los folios de las constancias: el de quien asistió como público general es CONG-EISS-RIUSS-A01, A02, A03…; el de los ponentes,
 * CONG-EISS-RIUSS-P01, P02, P03… Cada serie cuenta por su cuenta, de uno en uno, en el orden de las filas de «Asistencia por persona».
 *
 * Un folio es de quien lo recibió: una vez puesto no se cambia ni se reutiliza. Por eso esto sólo llena lo que está vacío —nunca
 * pisa un folio que ya esté— y sigue la serie desde el número más alto que ya haya.
 */

export type SerieDeFolio = 'publico_general' | 'ponente';

export const PREFIJOS_DE_FOLIO: Record<SerieDeFolio, string> = {
  publico_general: 'CONG-EISS-RIUSS-A',
  ponente: 'CONG-EISS-RIUSS-P',
};

/** «CONG-EISS-RIUSS-A01»: el número con dos cifras como mínimo (A01 … A99, y A100 si hiciera falta). */
export const folioDe = (serie: SerieDeFolio, numero: number): string => `${PREFIJOS_DE_FOLIO[serie]}${String(numero).padStart(2, '0')}`;

/** La fila de la pestaña, con lo que hace falta para decidir su folio. */
export interface FilaParaFolio {
  /** Su serie, según el perfil de la fila; nada si no es de ninguna de las dos (sin perfil, porque asistió sin registro). */
  serie: SerieDeFolio | null;
  /** Lleva la casilla «Con registro» marcada: sin registro vigente no hay constancia, así que tampoco folio. */
  conRegistro: boolean;
  /** Lo que ya tiene en la columna «Folio», si algo. */
  folio: string;
}

export interface ResumenDeSerie {
  /** Cuántos de esa serie ya tenían folio, y cuántos se asignan ahora. */
  yaTenian: number;
  nuevos: number;
  /** Del primero y el último que se asignan ahora; nada si no se asigna ninguno. */
  primero: string | null;
  ultimo: string | null;
}

export interface PlanDeFolios {
  /** Qué folio va en qué fila (el índice cuenta desde 0 entre las filas de datos). Sólo las filas que no tenían. */
  asignaciones: { indice: number; folio: string }[];
  porSerie: Record<SerieDeFolio, ResumenDeSerie>;
  /** Filas sin folio y sin que se les asigne: sin registro vigente, o sin un perfil de los dos. */
  sinRegistro: number;
  sinSerie: number;
  /** Folios que ya estaban en más de una fila: un folio es de una sola persona, hay que revisarlos. */
  repetidos: string[];
  /** Filas cuyo folio ya escrito no es de la serie de su perfil (un ponente con folio «A…»): se dejan como están. */
  incoherentes: number;
}

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Qué folio le toca a cada fila que no lo tiene. Se recorren las filas en orden: a cada una con registro vigente y de una de las
 * dos series se le da el siguiente número de su serie, después del más alto que ya esté escrito en la columna.
 */
export function asignarFolios(filas: readonly FilaParaFolio[]): PlanDeFolios {
  const series = Object.keys(PREFIJOS_DE_FOLIO) as SerieDeFolio[];
  const patron = (serie: SerieDeFolio) => new RegExp(`^${escapar(PREFIJOS_DE_FOLIO[serie])}(\\d+)$`);

  // El número más alto ya usado de cada serie, aunque esté en una fila que hoy no recibiría folio: no se reutiliza.
  const ultimo: Record<SerieDeFolio, number> = { publico_general: 0, ponente: 0 };
  const cuentas = new Map<string, number>();
  let incoherentes = 0;
  filas.forEach((f) => {
    const folio = f.folio.trim();
    if (folio === '') return;
    cuentas.set(folio, (cuentas.get(folio) ?? 0) + 1);
    for (const serie of series) {
      const m = patron(serie).exec(folio);
      if (m) ultimo[serie] = Math.max(ultimo[serie], Number(m[1]));
    }
    if (f.serie && !patron(f.serie).test(folio) && series.some((s) => patron(s).test(folio))) incoherentes += 1;
  });

  const porSerie: Record<SerieDeFolio, ResumenDeSerie> = {
    publico_general: { yaTenian: 0, nuevos: 0, primero: null, ultimo: null },
    ponente: { yaTenian: 0, nuevos: 0, primero: null, ultimo: null },
  };
  const asignaciones: PlanDeFolios['asignaciones'] = [];
  let sinRegistro = 0;
  let sinSerie = 0;
  filas.forEach((f, indice) => {
    if (f.serie && f.folio.trim() !== '') porSerie[f.serie].yaTenian += 1;
    if (f.folio.trim() !== '') return;
    if (!f.serie) { sinSerie += 1; return; }
    if (!f.conRegistro) { sinRegistro += 1; return; }
    ultimo[f.serie] += 1;
    const folio = folioDe(f.serie, ultimo[f.serie]);
    asignaciones.push({ indice, folio });
    const resumen = porSerie[f.serie];
    resumen.nuevos += 1;
    resumen.primero ??= folio;
    resumen.ultimo = folio;
  });

  return {
    asignaciones,
    porSerie,
    sinRegistro,
    sinSerie,
    repetidos: [...cuentas].filter(([, veces]) => veces > 1).map(([folio]) => folio),
    incoherentes,
  };
}
