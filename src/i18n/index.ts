import { es, type Diccionario } from './es';
import { en } from './en';
import { pt } from './pt';

export const IDIOMAS = ['es', 'en', 'pt'] as const;
export type Idioma = (typeof IDIOMAS)[number];
export const IDIOMA_POR_DEFECTO: Idioma = 'es';

export const diccionarios: Record<Idioma, Diccionario> = { es, en, pt };

export function obtenerDiccionario(idioma: string | undefined | null): Diccionario {
  return diccionarios[(idioma ?? '') as Idioma] ?? diccionarios[IDIOMA_POR_DEFECTO];
}

export function esIdiomaValido(valor: unknown): valor is Idioma {
  return typeof valor === 'string' && (IDIOMAS as readonly string[]).includes(valor);
}

/** Sustituye marcadores {clave} por su valor. */
export function interpolar(plantilla: string, valores: Record<string, string | number>): string {
  return plantilla.replace(/\{(\w+)\}/g, (coincidencia, clave: string) =>
    clave in valores ? String(valores[clave]) : coincidencia,
  );
}

export type { Diccionario };
