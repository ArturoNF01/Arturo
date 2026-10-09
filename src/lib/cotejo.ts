import { HOJAS } from './normalizacion';

/**
 * Comparar lo que hay en la base con lo que hay en la hoja.
 *
 * Es lógica pura y aparte del guion que la usa para poder probarla: un
 * cotejo que se equivoca es peor que no cotejar, porque da por bueno un
 * descuadre o inventa uno que no existe, y en los dos casos se actúa mal.
 */

export interface DesfaseEncabezados {
  pestana: string;
  faltan: string[];
  sobran: string[];
  /** Cuántas columnas tiene la hoja frente a las que el sistema espera. */
  tiene: number;
  espera: number;
}

/** Qué pestañas llevan los encabezados de otra versión, y en qué se nota. */
export function cotejarEncabezados(
  enLaHoja: Record<string, string[]>,
): DesfaseEncabezados[] {
  const desfases: DesfaseEncabezados[] = [];
  for (const [pestana, espera] of Object.entries(HOJAS)) {
    const tiene = enLaHoja[pestana];
    // Una pestaña vacía no está desfasada: aún no se le han escrito los
    // encabezados, y el sistema se los pone solo la primera vez.
    if (!tiene || tiene.length === 0) continue;
    const faltan = espera.filter((c) => !tiene.includes(c));
    const sobran = tiene.filter((c) => !espera.includes(c));
    if (faltan.length || sobran.length || tiene.length !== espera.length) {
      desfases.push({ pestana, faltan, sobran, tiene: tiene.length, espera: espera.length });
    }
  }
  return desfases;
}

export interface DescuadreFilas {
  faltanEnHoja: string[];
  sobranEnHoja: string[];
  repetidosEnHoja: { folio: string; veces: number }[];
}

/** Qué folios están en un sitio y no en el otro, y cuáles están dos veces. */
export function cotejarFolios(
  foliosBase: string[],
  foliosHoja: string[],
): DescuadreFilas {
  const cuenta = new Map<string, number>();
  for (const f of foliosHoja) {
    const limpio = f.trim();
    if (limpio) cuenta.set(limpio, (cuenta.get(limpio) ?? 0) + 1);
  }
  const enBase = new Set(foliosBase.map((f) => f.trim()).filter(Boolean));

  return {
    faltanEnHoja: [...enBase].filter((f) => !cuenta.has(f)),
    sobranEnHoja: [...cuenta.keys()].filter((f) => !enBase.has(f)),
    repetidosEnHoja: [...cuenta.entries()]
      .filter(([, veces]) => veces > 1)
      .map(([folio, veces]) => ({ folio, veces })),
  };
}

/**
 * En qué columnas difiere una fila de la hoja respecto de la que el sistema
 * produciría hoy.
 *
 * Dos columnas no se comparan nunca. La marca temporal, porque la hoja la
 * reescribe con su propio formato en cuanto alguien toca la celda. Y los
 * enlaces de descarga, porque van como fórmula y vuelven leídos como su
 * resultado: compararlos marcaría como distinta cada fila que lleva un
 * archivo.
 */
export function cotejarCeldas(
  esperada: (string | number)[],
  enLaHoja: string[],
  pestana: keyof typeof HOJAS | string = 'REG_Respuestas',
): string[] {
  const cabeceras = HOJAS[pestana] ?? [];
  const distintas: string[] = [];
  esperada.forEach((valor, i) => {
    const cabecera = cabeceras[i] ?? `columna ${i + 1}`;
    const texto = String(valor ?? '');
    if (cabecera === 'Marca temporal' || texto.startsWith('=HYPERLINK')) return;
    if (texto !== String(enLaHoja[i] ?? '')) distintas.push(cabecera);
  });
  return distintas;
}
