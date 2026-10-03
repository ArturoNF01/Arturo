import { es } from '@/i18n/es';
import { etiquetaEs, etiquetasEs } from './opciones';

/**
 * Normalización de un registro hacia las pestañas del libro de seguimiento
 * (REG, PAR, PSE), con la misma forma que producía el script de Google Apps
 * Script original.
 *
 * Eran seis pestañas. ALO, TRA y ALI se retiraron cuando el formulario dejó
 * de preguntar hospedaje, recepción en el aeropuerto y régimen alimentario:
 * sin esos campos no había de dónde sacar una sola fila, y una pestaña que
 * nunca se llena es peor que no tenerla —el comité la abre, la ve vacía y no
 * sabe si es que nadie lo pidió o es que el sistema dejó de escribirla.
 *
 * Es lógica pura y sin dependencias del servidor, para poder probarla.
 */
export const HOJAS: Record<string, string[]> = {
  REG_Respuestas: [
    'Folio', 'ID', 'Marca temporal', 'Perfil', 'Grupo', 'Modalidad', 'Idioma',
    'Apellidos', 'Nombre(s)', 'Nombre para constancia', 'Correo', 'Teléfono',
    'Institución', 'Cargo', 'Procedencia', 'País',
    'Título', 'Resumen', 'Palabras clave',
    'Autoriza grabación',
    'Requerimientos técnicos', 'Zona horaria',
    'Requiere hospedaje', 'Entrada hotel', 'Salida hotel',
    'Ciudad de origen', 'Fecha de llegada', 'Fecha de salida',
    'Consentimiento', 'Estado',
  ],
  PAR_Participantes: [
    'ID', 'Marca temporal', 'Apellidos y nombre', 'Institución', 'Procedencia',
    'Estado o país de origen', 'Rol', 'Correo', 'Teléfono / WhatsApp',
    'Llegada', 'Salida', 'Requiere hospedaje', 'Estado confirmación',
  ],
  PSE_Personificadores_Semblanzas: [
    'ID', 'Día', 'Bloque', 'Apellidos y nombre', 'Cargo o función', 'Institución', 'País',
    'Fotografía', 'Semblanza', 'Semblanza recibida', 'Personificador impreso',
    'Responsable de edición', 'Responsable de impresión', 'Plazo recomendado',
  ],
};

type Registro = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Un enlace de Drive, como «Descargar» en azul y subrayado.
 *
 * Sheets pinta así cualquier HYPERLINK, sin que haya que dar formato a la
 * columna. La celda queda legible: una dirección de Drive son setenta
 * caracteres de ruido que además tapan la columna siguiente.
 *
 * Las comillas de la dirección se doblan porque van dentro de una fórmula;
 * sin eso, una URL con comillas la partiría en dos.
 */
export function enlaceDescarga(url: unknown): string {
  const direccion = String(url ?? '').trim();
  if (!direccion.startsWith('https://')) return '';
  return `=HYPERLINK("${direccion.replace(/"/g, '""')}";"Descargar")`;
}

/**
 * Perfiles cuyo nombre y semblanza salen en el programa, y que por tanto
 * llevan personificador en la mesa.
 *
 * Incluye las claves retiradas: el libro se sigue leyendo durante meses y una
 * ficha hecha cuando había seis perfiles tiene que seguir produciendo su fila.
 */
const PERFILES_EN_PROGRAMA = new Set([
  'ponente', 'conferencista', 'coordinador', 'moderador', 'panelista',
]);

/** El nombre del perfil en español, para un libro que se lleva en español. */
function nombreDePerfil(clave: unknown): string {
  const nombres = es.perfiles as unknown as Record<string, string>;
  const texto = String(clave ?? '');
  return nombres[texto] ?? texto;
}

/** Igual con la modalidad: en la celda se leía «en_linea», con guion bajo. */
function nombreDeModalidad(clave: unknown): string {
  const texto = String(clave ?? '');
  if (texto === 'en_linea') return es.modalidad.en_linea;
  if (texto === 'presencial') return es.modalidad.presencial;
  return texto;
}

/** Ámbito derivado de la procedencia canónica. */
function ambitoDe(procedencia: string): 'Internacional' | 'Nacional' | 'Local' {
  if (procedencia === 'internacional') return 'Internacional';
  if (procedencia === 'nacional') return 'Nacional';
  return 'Local';
}

export function contarPalabras(texto: string | null | undefined): number {
  if (!texto) return 0;
  const limpio = texto.replace(/\s+/g, ' ').trim();
  return limpio ? limpio.split(' ').length : 0;
}

/** Filas normalizadas que corresponden a un registro. */
export function filasDeRegistro(r: Registro): Record<string, (string | number)[][]> {
  const persona = `${r.apellidos ?? ''}, ${r.nombres ?? ''}`;
  const marca = new Date(r.creado_en ?? Date.now()).toISOString();
  const ambito = ambitoDe(r.procedencia ?? '');
  const rol = nombreDePerfil(r.perfil);
  // La entidad federativa dejó de pedirse: de quien vive en México queda el
  // país, que es lo que hay. Sigue leyéndose de las fichas que la traen.
  const origen =
    ambito === 'Internacional'
      ? r.pais_residencia ?? ''
      : r.entidad_federativa || r.pais_residencia || '';
  const filas: Record<string, (string | number)[][]> = {};
  const s = (v: unknown) => (v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : String(v));

  filas.REG_Respuestas = [[
    s(r.folio), s(r.id), marca, rol, s(r.grupo), nombreDeModalidad(r.modalidad), s(r.idioma),
    s(r.apellidos), s(r.nombres), s(r.nombre_constancia), s(r.correo), s(r.telefono_whatsapp),
    s(r.institucion), s(r.cargo), etiquetaEs('procedencia', r.procedencia), s(r.pais_residencia),
    s(r.titulo_ponencia), s(r.resumen_ponencia), s(r.palabras_clave),
    r.autoriza_grabacion ? 'Sí' : 'No',
    etiquetasEs('tecnicos', r.requerimientos_tecnicos), s(r.zona_horaria),
    r.requiere_alojamiento ? 'Sí' : 'No',
    s(r.fecha_entrada_hotel), s(r.fecha_salida_hotel),
    s(r.ciudad_origen), s(r.fecha_llegada), s(r.fecha_salida),
    r.consentimiento_datos ? 'Sí' : 'No', s(r.estado),
  ]];

  filas.PAR_Participantes = [[
    s(r.folio), marca, persona, s(r.institucion), ambito, origen, rol, s(r.correo),
    s(r.telefono_whatsapp), s(r.fecha_llegada), s(r.fecha_salida),
    r.requiere_alojamiento ? 'Sí' : 'No', 'En proceso',
  ]];

  // El personificador lo lleva quien sale en el programa. Antes esto miraba
  // `modalidad_participacion`, un campo que el formulario dejó de pedir al
  // reducirse a dos perfiles: desde entonces la pestaña no recibía una sola
  // fila, y nadie lo notó porque no falla, simplemente no escribe.
  if (PERFILES_EN_PROGRAMA.has(String(r.perfil))) {
    filas.PSE_Personificadores_Semblanzas = [[
      s(r.folio), '', '', persona,
      r.cargo || rol, s(r.institucion), s(r.pais_residencia),
      enlaceDescarga(r.foto_url), enlaceDescarga(r.semblanza_url),
      r.semblanza_url ? marca : '', 'No iniciado', '', '',
      'Semblanza recibida T-4 sem · personificador impreso T-1 sem',
    ]];
  }

  return filas;
}
