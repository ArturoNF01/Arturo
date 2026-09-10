import { es } from '@/i18n/es';
import type { Diccionario } from '@/i18n';

/**
 * Valores canónicos que se guardan en la base. Las etiquetas visibles salen
 * del diccionario del idioma activo, en el mismo orden que estas listas, de
 * modo que un registro hecho en portugués sea comparable con uno en español.
 */
export const OPCIONES = {
  genero: ['mujer', 'hombre', 'otro', 'no_indica'],
  procedencia: ['internacional', 'nacional', 'local'],
  roles: [
    'conferencia_magistral', 'ponencia_mesa', 'moderacion_mesa', 'comite_cientifico',
    'comite_organizador', 'cartel', 'asistente', 'prensa',
  ],
  documentacion: ['carta_visa', 'carta_ingles', 'oficio_institucion', 'constancia_anticipada', 'ninguna'],
  autorizaciones: ['publicar_semblanza_foto', 'grabar_intervencion', 'publicar_memoria'],
  tecnicos: ['proyeccion', 'audio', 'video', 'internet', 'interpretacion', 'videoconferencia', 'ninguno'],
  alojamiento: ['si', 'no'],
  habitacion: ['sencilla', 'doble_compartida', 'doble_uso_sencillo'],
  traslado: ['llegada_y_salida', 'solo_llegada', 'solo_salida', 'no'],
  medioArribo: ['aereo', 'terrestre', 'vehiculo_propio'],
  regimen: ['sin_restriccion', 'vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'],
} as const;

export type GrupoOpciones = keyof typeof OPCIONES;
export interface Opcion { valor: string; etiqueta: string }

/** Pares valor canónico / etiqueta traducida para pintar el formulario. */
export function opciones(grupo: GrupoOpciones, t: Diccionario): Opcion[] {
  const etiquetas = t.formulario.opciones[grupo] as string[];
  return OPCIONES[grupo].map((valor, i) => ({ valor, etiqueta: etiquetas[i] ?? valor }));
}

/** Etiqueta traducida de un valor canónico. */
export function etiquetaDe(grupo: GrupoOpciones, valor: string | null | undefined, t: Diccionario): string {
  if (!valor) return '';
  const indice = (OPCIONES[grupo] as readonly string[]).indexOf(valor);
  const etiquetas = t.formulario.opciones[grupo] as string[];
  return indice >= 0 ? etiquetas[indice] ?? valor : valor;
}

/** Etiqueta en español, para el libro de seguimiento en Google Sheets. */
export function etiquetaEs(grupo: GrupoOpciones, valor: string | null | undefined): string {
  return etiquetaDe(grupo, valor, es);
}

export function etiquetasEs(grupo: GrupoOpciones, valores: string[] | null | undefined): string {
  return (valores ?? []).map((v) => etiquetaEs(grupo, v)).join('; ');
}
