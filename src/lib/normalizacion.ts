import { CONFIG } from './config';
import { etiquetaEs, etiquetasEs } from './opciones';

/**
 * Normalización de un registro hacia las pestañas del libro de seguimiento
 * (PAR, ALO, TRA, PSE, ALI) más una pestaña con la respuesta completa, con la
 * misma forma que producía el script de Google Apps Script original.
 *
 * Es lógica pura y sin dependencias del servidor, para poder probarla.
 */
export const HOJAS: Record<string, string[]> = {
  REG_Respuestas: [
    'Folio', 'ID', 'Marca temporal', 'Perfil', 'Grupo', 'Modalidad', 'Idioma',
    'Apellidos', 'Nombre(s)', 'Correo', 'Teléfono', 'Institución', 'Cargo',
    'Procedencia', 'País', 'Entidad', 'Ciudad', 'Nacionalidad', 'ORCID',
    'Modalidad de participación', 'Eje temático', 'Título', 'Resumen', 'Palabras clave',
    'Coautoría', 'Semblanza', 'Línea de investigación', 'Fotografía',
    'Documentación solicitada', 'Nombre en pasaporte', 'Destinatario del oficio',
    'Autorizaciones', 'Requerimientos técnicos', 'Accesibilidad',
    'Requiere alojamiento', 'Entrada hotel', 'Salida hotel', 'Tipo de habitación', 'Comparte con',
    'Requiere traslado', 'Medio de arribo', 'Ciudad de origen', 'Terminal de origen',
    'Fecha de llegada', 'Hora de llegada', 'Aerolínea de llegada', 'Vuelo de llegada',
    'Fecha de salida', 'Hora de salida', 'Aerolínea de salida', 'Vuelo de salida',
    'Observaciones de traslado', 'Régimen alimentario', 'Alergias', 'Contacto de emergencia',
    'Apoyo de traslado', 'Datos de viático', 'Requiere factura', 'Datos de facturación',
    'Comentarios', 'Consentimiento', 'Estado',
  ],
  PAR_Participantes: [
    'ID', 'Marca temporal', 'Apellidos y nombre', 'Institución', 'Procedencia',
    'Estado o país de origen', 'Rol', 'Correo', 'Teléfono / WhatsApp',
    'Requiere alojamiento', 'Requiere traslado', 'Medio de arribo',
    'Restricción alimentaria', 'Estado confirmación',
  ],
  ALO_Alojamiento: [
    'ID', 'Persona', 'Rol', 'Procedencia', 'Hotel', 'Tipo de habitación', 'Entrada',
    'Salida', 'Noches', 'Tarifa por noche', 'Costo total', 'Estado reserva', 'Observaciones',
  ],
  TRA_Traslados: [
    'ID', 'Persona', 'Ámbito', 'Movimiento', 'Medio', 'Fecha', 'Aerolínea / línea',
    'Vuelo / corrida', 'Origen / destino', 'Terminal o punto de encuentro',
    'Hora programada', 'Hora de presentación', 'Responsable de recepción',
    'Vehículo / placas', 'Estado', 'Observaciones',
  ],
  PSE_Personificadores_Semblanzas: [
    'ID', 'Día', 'Bloque', 'Apellidos y nombre', 'Nombre para personificador',
    'Cargo o función', 'Institución', 'País', 'Fotografía (enlace)', 'Semblanza recibida',
    'Texto de semblanza', 'Palabras', 'Límite (palabras)', 'Ajuste requerido',
    'Semblanza editada', 'Personificador impreso', 'Responsable de edición',
    'Responsable de impresión', 'Plazo recomendado',
  ],
  ALI_Restricciones: [
    'ID', 'Persona', 'Régimen alimentario', 'Alergias', 'Días de asistencia', 'Observaciones',
  ],
};

type Registro = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Roles que ocupan lugar en mesa o presídium y requieren personificador. */
const ROLES_CON_PERSONIFICADOR = [
  'conferencia_magistral', 'ponencia_mesa', 'moderacion_mesa', 'comite_cientifico',
];

/** Ámbito derivado de la procedencia canónica. */
function ambitoDe(procedencia: string): 'Internacional' | 'Nacional' | 'Local' {
  if (procedencia === 'internacional') return 'Internacional';
  if (procedencia === 'nacional') return 'Nacional';
  return 'Local';
}

function medioDe(medio: string): string {
  if (!medio) return '';
  if (medio === 'terrestre') return 'Terrestre';
  if (medio === 'vehiculo_propio') return 'Vehículo propio';
  return 'Aéreo';
}

/**
 * Hora de presentación del vehículo a partir de la hora programada, el
 * movimiento, el ámbito y el medio, con los márgenes de CONFIG.
 */
export function horaPresentacion(
  hora: string | null | undefined,
  movimiento: 'Llegada' | 'Salida',
  ambito: string,
  medio: string,
): string {
  if (!hora) return '';
  const [h, m] = hora.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';

  const g = CONFIG.margenes;
  const delta =
    movimiento === 'Llegada'
      ? medio === 'Terrestre'
        ? g.llegadaTerrestre
        : ambito === 'Internacional'
          ? g.llegadaAereaInternacional
          : g.llegadaAereaNacional
      : -(medio === 'Terrestre'
          ? g.salidaTerrestre
          : ambito === 'Internacional'
            ? g.salidaAereaInternacional
            : g.salidaAereaNacional);

  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function contarPalabras(texto: string | null | undefined): number {
  if (!texto) return 0;
  const limpio = texto.replace(/\s+/g, ' ').trim();
  return limpio ? limpio.split(' ').length : 0;
}

function noches(entrada?: string | null, salida?: string | null): string {
  if (!entrada || !salida) return '';
  const dias = (Date.parse(salida) - Date.parse(entrada)) / 86_400_000;
  return Number.isFinite(dias) && dias > 0 ? String(Math.round(dias)) : '';
}

/** Filas normalizadas que corresponden a un registro. */
export function filasDeRegistro(r: Registro): Record<string, (string | number)[][]> {
  const persona = `${r.apellidos ?? ''}, ${r.nombres ?? ''}`;
  const marca = new Date(r.creado_en ?? Date.now()).toISOString();
  const ambito = ambitoDe(r.procedencia ?? '');
  const medio = medioDe(r.medio_arribo ?? '');
  const rolCanonico: string = r.modalidad_participacion || '';
  const rol = rolCanonico ? etiquetaEs('roles', rolCanonico) : String(r.perfil ?? '');
  const origen =
    ambito === 'Internacional'
      ? r.pais_residencia ?? ''
      : r.entidad_federativa || r.pais_residencia || '';
  const traslado: string = r.requiere_traslado ?? 'no';
  const filas: Record<string, (string | number)[][]> = {};
  const s = (v: unknown) => (v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : String(v));

  filas.REG_Respuestas = [[
    s(r.folio), s(r.id), marca, s(r.perfil), s(r.grupo), s(r.modalidad), s(r.idioma),
    s(r.apellidos), s(r.nombres), s(r.correo), s(r.telefono_whatsapp), s(r.institucion), s(r.cargo),
    etiquetaEs('procedencia', r.procedencia), s(r.pais_residencia), s(r.entidad_federativa), s(r.ciudad_residencia),
    s(r.nacionalidad), s(r.orcid),
    rol, s(r.eje_tematico), s(r.titulo_ponencia), s(r.resumen_ponencia),
    s(r.palabras_clave), s(r.coautoria), s(r.semblanza), s(r.linea_investigacion), s(r.foto_url),
    etiquetasEs('documentacion', r.documentacion_solicitada), s(r.nombre_pasaporte),
    s(r.destinatario_oficio), etiquetasEs('autorizaciones', r.autorizaciones),
    etiquetasEs('tecnicos', r.requerimientos_tecnicos), s(r.requerimientos_accesibilidad),
    r.requiere_alojamiento ? 'Sí' : 'No', s(r.fecha_entrada_hotel), s(r.fecha_salida_hotel),
    etiquetaEs('habitacion', r.tipo_habitacion), s(r.comparte_habitacion_con),
    etiquetaEs('traslado', traslado), etiquetaEs('medioArribo', r.medio_arribo),
    s(r.ciudad_origen), s(r.terminal_origen),
    s(r.fecha_llegada), s(r.hora_llegada), s(r.aerolinea_llegada), s(r.vuelo_llegada),
    s(r.fecha_salida), s(r.hora_salida), s(r.aerolinea_salida), s(r.vuelo_salida),
    s(r.observaciones_traslado), etiquetaEs('regimen', r.regimen_alimentario), s(r.alergias),
    s(r.contacto_emergencia),
    r.apoyo_traslado ? 'Sí' : 'No', s(r.datos_viatico), r.requiere_factura ? 'Sí' : 'No',
    s(r.datos_facturacion), s(r.comentarios), r.consentimiento_datos ? 'Sí' : 'No', s(r.estado),
  ]];

  filas.PAR_Participantes = [[
    s(r.folio), marca, persona, s(r.institucion), ambito, origen, rol, s(r.correo),
    s(r.telefono_whatsapp), r.requiere_alojamiento ? 'Sí' : 'No',
    traslado === 'no' ? 'No' : 'Sí', medio || 'No aplica',
    etiquetaEs('regimen', r.regimen_alimentario), 'En proceso',
  ]];

  if (r.requiere_alojamiento) {
    filas.ALO_Alojamiento = [[
      s(r.folio), persona, rol, ambito, '', etiquetaEs('habitacion', r.tipo_habitacion),
      s(r.fecha_entrada_hotel), s(r.fecha_salida_hotel),
      noches(r.fecha_entrada_hotel, r.fecha_salida_hotel), '', '', 'No iniciado',
      s(r.comparte_habitacion_con),
    ]];
  }

  const trasladoFilas: (string | number)[][] = [];
  const ciudadOrigen = r.ciudad_origen || origen;
  if (traslado === 'llegada_y_salida' || traslado === 'solo_llegada') {
    trasladoFilas.push([
      s(r.folio), persona, ambito, 'Llegada', medio, s(r.fecha_llegada),
      s(r.aerolinea_llegada), s(r.vuelo_llegada), s(ciudadOrigen), s(r.terminal_origen),
      s(r.hora_llegada), horaPresentacion(r.hora_llegada, 'Llegada', ambito, medio),
      '', '', 'No iniciado', s(r.observaciones_traslado),
    ]);
  }
  if (traslado === 'llegada_y_salida' || traslado === 'solo_salida') {
    trasladoFilas.push([
      s(r.folio), persona, ambito, 'Salida', medio, s(r.fecha_salida),
      s(r.aerolinea_salida), s(r.vuelo_salida), s(ciudadOrigen), s(r.terminal_origen),
      s(r.hora_salida), horaPresentacion(r.hora_salida, 'Salida', ambito, medio),
      '', '', 'No iniciado', s(r.observaciones_traslado),
    ]);
  }
  if (trasladoFilas.length) filas.TRA_Traslados = trasladoFilas;

  const requierePersonificador =
    ROLES_CON_PERSONIFICADOR.includes(rolCanonico) ||
    r.perfil === 'panelista' ||
    r.perfil === 'conferencista';

  if (requierePersonificador) {
    const semblanza = s(r.semblanza);
    filas.PSE_Personificadores_Semblanzas = [[
      s(r.folio), '', '', persona, r.nombre_personificador || persona,
      r.cargo || rol, s(r.institucion), s(r.pais_residencia), s(r.foto_url),
      semblanza ? marca : '', semblanza, contarPalabras(semblanza),
      CONFIG.limiteSemblanzaPalabras, '', 'No iniciado', 'No iniciado', '', '',
      'Semblanza recibida T-4 sem · editada T-2 sem · impresa T-1 sem',
    ]];
  }

  const alergias = s(r.alergias);
  if ((r.regimen_alimentario && r.regimen_alimentario !== 'sin_restriccion') || alergias) {
    filas.ALI_Restricciones = [[
      s(r.folio), persona, etiquetaEs('regimen', r.regimen_alimentario), alergias, 'Días 1 a 3',
      s(r.requerimientos_accesibilidad),
    ]];
  }

  return filas;
}

