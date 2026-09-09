import type { Diccionario } from '@/i18n';

export const CLAVES_PERFIL = [
  'funcionario_ciess',
  'funcionario_ciss',
  'espectador_presencial',
  'espectador_linea',
  'participante_externo',
  'panelista',
  'conferencista',
] as const;

export type ClavePerfil = (typeof CLAVES_PERFIL)[number];
export type Grupo = 'interno' | 'externo';
export type Modalidad = 'presencial' | 'en_linea';

export interface DefinicionPerfil {
  clave: ClavePerfil;
  grupo: Grupo;
  modalidadDefault: Modalidad;
  permitePresencial: boolean;
  permiteEnLinea: boolean;
  /** Ponencia, resumen, eje temático, coautoría, ORCID. */
  requiereAcademico: boolean;
  /** Semblanza, personificador, fotografía, autorizaciones. */
  requiereSemblanza: boolean;
  /** Alojamiento, traslados, documentación de invitación, viáticos. */
  requiereLogistica: boolean;
}

export const PERFILES: DefinicionPerfil[] = [
  { clave: 'funcionario_ciess',     grupo: 'interno', modalidadDefault: 'presencial', permitePresencial: true,  permiteEnLinea: true,  requiereAcademico: false, requiereSemblanza: false, requiereLogistica: false },
  { clave: 'funcionario_ciss',      grupo: 'interno', modalidadDefault: 'presencial', permitePresencial: true,  permiteEnLinea: true,  requiereAcademico: false, requiereSemblanza: false, requiereLogistica: false },
  { clave: 'espectador_presencial', grupo: 'interno', modalidadDefault: 'presencial', permitePresencial: true,  permiteEnLinea: false, requiereAcademico: false, requiereSemblanza: false, requiereLogistica: false },
  { clave: 'espectador_linea',      grupo: 'externo', modalidadDefault: 'en_linea',   permitePresencial: false, permiteEnLinea: true,  requiereAcademico: false, requiereSemblanza: false, requiereLogistica: false },
  { clave: 'participante_externo',  grupo: 'externo', modalidadDefault: 'presencial', permitePresencial: true,  permiteEnLinea: true,  requiereAcademico: true,  requiereSemblanza: false, requiereLogistica: true },
  { clave: 'panelista',             grupo: 'externo', modalidadDefault: 'presencial', permitePresencial: true,  permiteEnLinea: true,  requiereAcademico: true,  requiereSemblanza: true,  requiereLogistica: true },
  { clave: 'conferencista',         grupo: 'externo', modalidadDefault: 'presencial', permitePresencial: true,  permiteEnLinea: true,  requiereAcademico: true,  requiereSemblanza: true,  requiereLogistica: true },
];

export function perfilPorClave(clave: string | null | undefined): DefinicionPerfil | undefined {
  return PERFILES.find((p) => p.clave === clave);
}

export function nombrePerfil(clave: string, t: Diccionario): string {
  const nombres = t.perfiles as unknown as Record<string, string>;
  return nombres[clave] ?? clave;
}

/** Pasos visibles del formulario según el perfil y la modalidad elegidos. */
export type PasoFormulario =
  | 'perfil' | 'identificacion' | 'academico' | 'semblanza' | 'documentacion'
  | 'sala' | 'alojamiento' | 'traslados' | 'cierre' | 'privacidad';

export function pasosVisibles(
  perfil: DefinicionPerfil | undefined,
  modalidad: Modalidad,
): PasoFormulario[] {
  const pasos: PasoFormulario[] = ['perfil'];
  if (!perfil) return pasos;

  const presencial = modalidad === 'presencial';
  pasos.push('identificacion');
  if (perfil.requiereAcademico) pasos.push('academico');
  if (perfil.requiereSemblanza) pasos.push('semblanza');
  if (perfil.requiereLogistica) pasos.push('documentacion');
  if (presencial || perfil.requiereAcademico) pasos.push('sala');
  if (perfil.requiereLogistica && presencial) pasos.push('alojamiento', 'traslados');
  pasos.push('cierre', 'privacidad');
  return pasos;
}

/** Visibilidad de campos individuales dentro de un paso. */
export function campoVisible(
  campo: string,
  perfil: DefinicionPerfil | undefined,
  modalidad: Modalidad,
): boolean {
  if (!perfil) return false;
  const presencial = modalidad === 'presencial';
  switch (campo) {
    case 'nombre_personificador':
    case 'nombre_constancia':
      return perfil.requiereSemblanza;
    case 'orcid':
      return perfil.requiereAcademico;
    case 'nacionalidad':
    case 'procedencia':
      return perfil.requiereLogistica || presencial;
    case 'entidad_federativa':
      return true;
    case 'regimen_alimentario':
    case 'alergias':
      return presencial;
    case 'contacto_emergencia':
      return presencial;
    case 'apoyo_traslado':
    case 'datos_viatico':
      return perfil.requiereLogistica && presencial;
    default:
      return true;
  }
}
