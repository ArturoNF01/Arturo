import type { Diccionario } from '@/i18n';

/**
 * Los dos perfiles con los que se participa en el congreso.
 *
 * Fueron seis. Se redujeron a dos al preparar la apertura al público: la
 * diferencia que de verdad cambia lo que hay que preguntar es si la persona
 * sube al programa o viene a escuchar. Conferencistas, coordinadores,
 * moderadores y dictaminadores son invitación del comité, se resuelven por
 * correo entre pocas personas, y sostener cuatro ramas de formulario para
 * ellas costaba más de lo que ahorraba.
 *
 * Las claves viejas siguen existiendo en la base y en los registros ya
 * hechos: `nombrePerfil` las sabe leer, y el panel las sigue mostrando.
 * Lo que desaparece es la posibilidad de elegirlas al registrarse.
 *
 * La convocatoria ya cerró: esto no recoge propuestas, sino el registro de
 * quien asiste. Por eso a la persona ponente no se le pide su trabajo, que
 * el comité dictaminador ya revisó, sino los datos con los que su ponencia
 * aparecerá en el programa y saldrá bien el día del congreso.
 */
export const CLAVES_PERFIL = ['ponente', 'publico_general'] as const;

/**
 * Las que hubo alguna vez, para lo que ya está guardado.
 *
 * El formulario sólo ofrece las dos de arriba, pero un registro hecho antes
 * del recorte trae una de éstas, y su dueño puede volver a su ficha a
 * corregir un teléfono. Si la validación sólo aceptara las dos nuevas, ese
 * registro quedaría congelado: cualquier cambio lo rechazaría el servidor por
 * un campo que la persona no eligió ni puede cambiar.
 */
export const CLAVES_PERFIL_HISTORICAS = [
  ...CLAVES_PERFIL,
  'conferencista',
  'coordinador',
  'moderador',
  'dictaminador',
] as const;

export type ClavePerfil = (typeof CLAVES_PERFIL)[number];
export type Modalidad = 'presencial' | 'en_linea';

export interface DefinicionPerfil {
  clave: ClavePerfil;
  /** Su nombre y su semblanza salen en el programa. */
  enPrograma: boolean;
  /** Presenta una ponencia ya aceptada por el comité dictaminador. */
  presentaPonencia: boolean;
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
  { clave: 'ponente',         enPrograma: true,  presentaPonencia: true,  invitado: true,  llevaFotografia: true,  recibeTraslado: true  },
  { clave: 'publico_general', enPrograma: false, presentaPonencia: false, invitado: false, llevaFotografia: false, recibeTraslado: false },
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
  | 'perfil' | 'identificacion' | 'ponencia' | 'semblanza'
  | 'conexion' | 'documentacion' | 'sala' | 'alojamiento' | 'traslados'
  | 'privacidad';

/**
 * ¿A esta persona sólo se le pide el nombre y el correo?
 *
 * Es el caso del público que sigue la transmisión: no pisa la sede, no sale
 * en el programa y el enlace se lo da Zoom, no nosotros. Pedirle institución,
 * cargo, país y teléfono era cobrarle diez campos por ver un video, y cada
 * campo de más es gente que abandona el formulario a medias.
 */
export function registroMinimo(
  perfil: DefinicionPerfil | undefined,
  modalidad: Modalidad,
): boolean {
  return perfil?.clave === 'publico_general' && modalidad === 'en_linea';
}

export function pasosVisibles(
  perfil: DefinicionPerfil | undefined,
  modalidad: Modalidad,
): PasoFormulario[] {
  const pasos: PasoFormulario[] = ['perfil'];
  if (!perfil) return pasos;

  const presencial = modalidad === 'presencial';
  pasos.push('identificacion');

  if (perfil.presentaPonencia) pasos.push('ponencia');
  if (perfil.enPrograma) pasos.push('semblanza');

  // Nada de lo que viene debajo —sala, hotel, traslados, comida,
  // estacionamiento— tiene sentido para quien sigue el congreso desde su
  // casa. Y el huso horario sólo se le pregunta a quien tiene una hora
  // asignada en el programa: el público se conecta cuando quiere, al mismo
  // enlace que todos.
  if (!presencial && perfil.clave !== 'publico_general') pasos.push('conexion');
  if (presencial) {
    if (perfil.invitado) pasos.push('documentacion');
    // Los requerimientos de sala —proyector, micrófono— son de quien expone,
    // no de quien viene a escuchar.
    if (perfil.enPrograma) pasos.push('sala');
    // Hospedaje y viaje se le preguntan a todo el que pisa la sede, no sólo a
    // quien viene invitado: el comité necesita saber cuánta gente llega, de
    // dónde y qué días, y eso no depende de quién pague el vuelo.
    pasos.push('alojamiento');
    pasos.push('traslados');
  }

  pasos.push('privacidad');
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

  // Tres campos y ya —pero sólo dentro de la identificación. El recorte no
  // puede alcanzar al consentimiento de datos, que vive en otro paso y es lo
  // único sin lo cual no se puede guardar a nadie.
  if (registroMinimo(perfil, modalidad) && PASO_DE_CAMPO[campo] === 'identificacion') {
    return campo === 'apellidos' || campo === 'nombres' || campo === 'correo';
  }

  switch (campo) {
    case 'nombre_constancia':
      return true;
    case 'orcid':
      return perfil.presentaPonencia;
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
    case 'requerimientos_tecnicos':
      return perfil.enPrograma;
    case 'requiere_traslado':
      // Los datos del vuelo se le piden a todo el que viene; la recepción en
      // el aeropuerto es un servicio que el CIESS presta sólo a quien sube al
      // programa. Preguntarle a los demás si la quieren sería ofrecerla.
      return perfil.recibeTraslado && presencial;
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

  consentimiento_datos: 'privacidad',
  consentimiento_comunicaciones: 'privacidad',
};
