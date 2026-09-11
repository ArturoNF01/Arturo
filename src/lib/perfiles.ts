import type { Diccionario } from '@/i18n';

/**
 * Los seis perfiles con los que se participa en el congreso.
 *
 * La convocatoria ya cerró: esto no recoge propuestas, sino el registro de
 * quien asiste. Por eso a la persona ponente no se le pide su trabajo, que
 * el comité científico ya dictaminó, sino los datos con los que su ponencia
 * aparecerá en el programa y saldrá bien el día del congreso.
 *
 * No hay grupos internos ni externos: lo que cambia el formulario es lo que
 * cada quien viene a hacer, no de dónde viene.
 */
export const CLAVES_PERFIL = [
  'ponente',
  'conferencista',
  'coordinador',
  'moderador',
  'dictaminador',
  'publico_general',
] as const;

export type ClavePerfil = (typeof CLAVES_PERFIL)[number];
export type Modalidad = 'presencial' | 'en_linea';

export interface DefinicionPerfil {
  clave: ClavePerfil;
  /** Su nombre y su semblanza salen en el programa: hacen falta foto y reseña. */
  enPrograma: boolean;
  /** Presenta una ponencia ya aceptada por el comité científico. */
  presentaPonencia: boolean;
  /** Tiene a su cargo una mesa o un eje temático. */
  tieneSesion: boolean;
  /** Dictamina trabajos para el comité científico. */
  dictamina: boolean;
  /** El CIESS lo invita: se le tramitan oficio, alojamiento y traslados. */
  invitado: boolean;
}

/**
 * Todos los perfiles pueden asistir presencialmente o en línea; el congreso
 * se transmite completo. Lo que cambia entre perfiles es qué se les pregunta.
 */
export const PERFILES: DefinicionPerfil[] = [
  { clave: 'ponente',         enPrograma: true,  presentaPonencia: true,  tieneSesion: false, dictamina: false, invitado: true  },
  { clave: 'conferencista',   enPrograma: true,  presentaPonencia: false, tieneSesion: false, dictamina: false, invitado: true  },
  { clave: 'coordinador',     enPrograma: true,  presentaPonencia: false, tieneSesion: true,  dictamina: false, invitado: true  },
  { clave: 'moderador',       enPrograma: true,  presentaPonencia: false, tieneSesion: true,  dictamina: false, invitado: true  },
  { clave: 'dictaminador',    enPrograma: true,  presentaPonencia: false, tieneSesion: false, dictamina: true,  invitado: false },
  { clave: 'publico_general', enPrograma: false, presentaPonencia: false, tieneSesion: false, dictamina: false, invitado: false },
];

export function perfilPorClave(clave: string | null | undefined): DefinicionPerfil | undefined {
  return PERFILES.find((p) => p.clave === clave);
}

export function nombrePerfil(clave: string, t: Diccionario): string {
  const nombres = t.perfiles as unknown as Record<string, string>;
  if (nombres[clave]) return nombres[clave];
  // Un registro de antes del cambio de perfiles apunta a una clave que ya no
  // se traduce. En el panel eso se sigue leyendo durante años, así que en vez
  // de mostrar «espectador_presencial» se muestra algo legible.
  return clave.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** Pasos visibles del formulario según el perfil y la modalidad elegidos. */
export type PasoFormulario =
  | 'perfil' | 'identificacion' | 'ponencia' | 'sesion' | 'dictamen' | 'semblanza'
  | 'conexion' | 'documentacion' | 'sala' | 'alojamiento' | 'traslados'
  | 'cierre' | 'privacidad';

export function pasosVisibles(
  perfil: DefinicionPerfil | undefined,
  modalidad: Modalidad,
): PasoFormulario[] {
  const pasos: PasoFormulario[] = ['perfil'];
  if (!perfil) return pasos;

  const presencial = modalidad === 'presencial';
  pasos.push('identificacion');

  if (perfil.presentaPonencia) pasos.push('ponencia');
  if (perfil.tieneSesion) pasos.push('sesion');
  if (perfil.dictamina) pasos.push('dictamen');
  if (perfil.enPrograma) pasos.push('semblanza');

  // Quien participa a distancia necesita acordar huso horario y conexión;
  // quien viene en persona, la logística de la sede.
  if (!presencial) pasos.push('conexion');
  if (presencial) {
    if (perfil.invitado) pasos.push('documentacion');
    pasos.push('sala');
    if (perfil.invitado) pasos.push('alojamiento', 'traslados');
  }

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
      // El letrero de la mesa sólo existe para quien se sienta en ella.
      return perfil.enPrograma && presencial;
    case 'nombre_constancia':
      return true;
    case 'orcid':
    case 'linea_investigacion':
      return perfil.presentaPonencia || perfil.dictamina;
    case 'autoriza_publicacion':
      return perfil.presentaPonencia;
    case 'autoriza_grabacion':
      // Quien aparece ante cámara o en la transmisión tiene que autorizarlo.
      return perfil.enPrograma;
    case 'prueba_conexion':
      return perfil.enPrograma && !presencial;
    case 'nacionalidad':
    case 'procedencia':
      return perfil.invitado || presencial;
    case 'entidad_federativa':
      return true;
    case 'regimen_alimentario':
    case 'alergias':
    case 'contacto_emergencia':
      return presencial;
    case 'apoyo_traslado':
    case 'datos_viatico':
      return perfil.invitado && presencial;
    default:
      return true;
  }
}
