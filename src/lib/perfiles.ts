import type { Diccionario } from '@/i18n';

/**
 * Los seis perfiles con los que se participa en el congreso.
 *
 * La convocatoria ya cerró: esto no recoge propuestas, sino el registro de
 * quien asiste. Por eso a la persona ponente no se le pide su trabajo, que
 * el comité dictaminador ya revisó, sino los datos con los que su ponencia
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
  /** Su nombre y su semblanza salen en el programa. */
  enPrograma: boolean;
  /** Presenta una ponencia ya aceptada por el comité dictaminador. */
  presentaPonencia: boolean;
  /** Tiene a su cargo una mesa o un eje temático. */
  tieneSesion: boolean;
  /** Dictamina trabajos para el comité dictaminador. */
  dictamina: boolean;
  /** El CIESS lo invita: se le tramitan oficio y alojamiento. */
  invitado: boolean;
  /** Su fotografía sale en el programa. Sólo a quien preside o da una charla. */
  llevaFotografia: boolean;
  /** El CIESS le paga los traslados. Es un servicio acotado, no un trámite. */
  recibeTraslado: boolean;
}

/**
 * Todos los perfiles pueden asistir presencialmente o en línea; el congreso
 * se transmite completo. Lo que cambia entre perfiles es qué se les pregunta.
 */
export const PERFILES: DefinicionPerfil[] = [
  { clave: 'ponente',         enPrograma: true,  presentaPonencia: true,  tieneSesion: false, dictamina: false, invitado: true,  llevaFotografia: false, recibeTraslado: false },
  { clave: 'conferencista',   enPrograma: true,  presentaPonencia: false, tieneSesion: false, dictamina: false, invitado: true,  llevaFotografia: true,  recibeTraslado: true  },
  { clave: 'coordinador',     enPrograma: true,  presentaPonencia: false, tieneSesion: true,  dictamina: false, invitado: true,  llevaFotografia: false, recibeTraslado: false },
  { clave: 'moderador',       enPrograma: true,  presentaPonencia: false, tieneSesion: true,  dictamina: false, invitado: true,  llevaFotografia: true,  recibeTraslado: false },
  { clave: 'dictaminador',    enPrograma: true,  presentaPonencia: false, tieneSesion: false, dictamina: true,  invitado: false, llevaFotografia: false, recibeTraslado: false },
  { clave: 'publico_general', enPrograma: false, presentaPonencia: false, tieneSesion: false, dictamina: false, invitado: false, llevaFotografia: false, recibeTraslado: false },
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
  | 'estacionamiento' | 'cierre' | 'privacidad';

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
  // quien viene en persona, la logística de la sede. Nada de lo que hay
  // debajo —sala, hotel, traslados, comida, estacionamiento— tiene sentido
  // para quien sigue el congreso desde su casa.
  if (!presencial) pasos.push('conexion');
  if (presencial) {
    if (perfil.invitado) pasos.push('documentacion');
    // Los requerimientos de sala —proyector, micrófono— son de quien expone,
    // no de quien viene a escuchar.
    if (perfil.enPrograma) pasos.push('sala');
    if (perfil.invitado) pasos.push('alojamiento');
    // El traslado es un servicio que el CIESS presta, no un trámite que
    // cualquiera pueda pedir: sólo a quien da una conferencia magistral.
    if (perfil.recibeTraslado) pasos.push('traslados');
    // El estacionamiento sí es de todos los que vienen: quien llega en coche
    // necesita el lugar, venga a exponer o a escuchar.
    pasos.push('estacionamiento');
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
    case 'nombre_constancia':
      return true;
    case 'orcid':
      return perfil.presentaPonencia || perfil.dictamina;
    case 'foto':
      // La fotografía sale en el programa junto a quien preside o da una
      // charla; a nadie más se le pide su retrato.
      return perfil.llevaFotografia;
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
    case 'condicion_alimentaria':
    case 'contacto_emergencia':
      return presencial;
    case 'requerimientos_tecnicos':
      return perfil.enPrograma;
    case 'apoyo_traslado':
    case 'datos_viatico':
      // Quien viene invitado ya tiene su viaje resuelto por el CIESS. El
      // apoyo es para quien asiste por su cuenta y lo necesita.
      return perfil.clave === 'publico_general' && presencial;
    default:
      return true;
  }
}

/**
 * En qué paso vive cada campo.
 *
 * Sirve para lo mismo en los dos sentidos: al validar, para no dejar avanzar
 * con un hueco; y cuando el servidor rechaza el envío, para llevar a quien se
 * registra hasta el paso donde está el problema. Sin esto, el aviso «revise
 * los campos marcados» aparecía en el último paso y los campos marcados
 * estaban siete pantallas atrás, invisibles.
 */
export const PASO_DE_CAMPO: Record<string, PasoFormulario> = {
  perfil: 'perfil',
  modalidad: 'perfil',

  apellidos: 'identificacion',
  nombres: 'identificacion',
  nombre_constancia: 'identificacion',
  genero: 'identificacion',
  correo: 'identificacion',
  telefono_whatsapp: 'identificacion',
  institucion: 'identificacion',
  cargo: 'identificacion',
  procedencia: 'identificacion',
  pais_residencia: 'identificacion',
  entidad_federativa: 'identificacion',
  ciudad_residencia: 'identificacion',
  nacionalidad: 'identificacion',
  orcid: 'identificacion',

  titulo_ponencia: 'ponencia',
  resumen_ponencia: 'ponencia',
  idioma_ponencia: 'ponencia',
  palabras_clave: 'ponencia',
  coautoria: 'ponencia',
  autoriza_publicacion: 'ponencia',

  sesion_asignada: 'sesion',
  disponibilidad_dias: 'sesion',

  ejes_dictamen: 'dictamen',
  ponencias_maximas: 'dictamen',
  conflicto_interes: 'dictamen',

  semblanza_url: 'semblanza',
  foto_url: 'semblanza',
  autorizaciones: 'semblanza',
  autoriza_grabacion: 'semblanza',

  zona_horaria: 'conexion',
  prueba_conexion: 'conexion',

  documentacion_solicitada: 'documentacion',
  documentacion_otra: 'documentacion',
  nombre_pasaporte: 'documentacion',
  destinatario_oficio: 'documentacion',
  boleto_url: 'documentacion',

  requerimientos_tecnicos: 'sala',

  requiere_alojamiento: 'alojamiento',
  fecha_entrada_hotel: 'alojamiento',
  fecha_salida_hotel: 'alojamiento',

  requiere_traslado: 'traslados',
  medio_arribo: 'traslados',
  ciudad_origen: 'traslados',
  terminal_origen: 'traslados',
  fecha_llegada: 'traslados',
  hora_llegada: 'traslados',
  aerolinea_llegada: 'traslados',
  vuelo_llegada: 'traslados',
  fecha_salida: 'traslados',
  hora_salida: 'traslados',
  aerolinea_salida: 'traslados',
  vuelo_salida: 'traslados',
  observaciones_traslado: 'traslados',

  placa_vehiculo: 'estacionamiento',
  modelo_vehiculo: 'estacionamiento',
  color_vehiculo: 'estacionamiento',
  requerimientos_accesibilidad: 'estacionamiento',

  regimen_alimentario: 'cierre',
  condicion_alimentaria: 'cierre',
  condicion_alimentaria_detalle: 'cierre',
  contacto_emergencia: 'cierre',
  apoyo_traslado: 'cierre',
  datos_viatico: 'cierre',
  requiere_factura: 'cierre',
  datos_facturacion: 'cierre',
  comentarios: 'cierre',

  consentimiento_datos: 'privacidad',
  consentimiento_comunicaciones: 'privacidad',
};
