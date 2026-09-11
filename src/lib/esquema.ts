import { z } from 'zod';
import { CONGRESO_POR_DEFECTO } from './contenido';
import { CLAVES_PERFIL, perfilPorClave } from './perfiles';

/** Límites que el panel puede cambiar y que la validación debe respetar. */
export interface LimitesFormulario {
  semblanzaCaracteres: number;
  resumenCaracteres: number;
}

export const LIMITES_POR_DEFECTO: LimitesFormulario = {
  semblanzaCaracteres: CONGRESO_POR_DEFECTO.limite_semblanza_caracteres,
  resumenCaracteres: CONGRESO_POR_DEFECTO.limite_resumen_caracteres,
};

/**
 * ¿Este identificador tiene forma de UUID?
 *
 * Los identificadores viajan en la dirección, así que llegan enlaces rotos y
 * sondeos automáticos. Sin esta comprobación, PostgreSQL rechaza el valor y
 * la respuesta acaba siendo un 500: un error del servidor por algo que en
 * realidad es una petición mal formada.
 */
export function esUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}

const textoOpcional = z.string().trim().max(500).optional().or(z.literal(''));
const parrafoOpcional = z.string().trim().max(5000).optional().or(z.literal(''));
/**
 * Una fecha o una hora en blanco significan «no se dio», y eso en la base es
 * null: PostgreSQL rechaza la cadena vacía en una columna de fecha. El
 * formulario manda '' porque es lo que tiene un campo vacío en el navegador,
 * así que la conversión se hace aquí, en la frontera.
 */
const fechaOpcional = z
  .union([
    z.literal(''),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha no válido'),
  ])
  .optional()
  .transform((valor) => (valor ? valor : null));
const horaOpcional = z
  .union([
    z.literal(''),
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora no válido'),
  ])
  .optional()
  .transform((valor) => (valor ? valor : null));

/**
 * El esquema se construye con los límites vigentes: si el comité los cambia
 * desde el panel, la validación del servidor cambia con ellos.
 */
export function crearEsquemaRegistro(limites: LimitesFormulario = LIMITES_POR_DEFECTO) {
  return z
  .object({
    perfil: z.enum(CLAVES_PERFIL),
    modalidad: z.enum(['presencial', 'en_linea']),
    idioma: z.enum(['es', 'en', 'pt']).default('es'),

    // 1. Identificación
    apellidos: z.string().trim().min(1).max(150),
    nombres: z.string().trim().min(1).max(150),
    nombre_personificador: textoOpcional,
    nombre_constancia: textoOpcional,
    genero: textoOpcional,
    correo: z.string().trim().email().max(200),
    // Los institucionales rebotan o filtran; con el congreso encima, un
    // correo que no llega es una baja.
    correo_alterno: z.string().trim().email('Correo no válido').optional().or(z.literal('')),
    telefono_whatsapp: z.string().trim().max(60).optional().or(z.literal('')),
    institucion: z.string().trim().min(1).max(250),
    cargo: z.string().trim().max(250).optional().or(z.literal('')),
    procedencia: textoOpcional,
    pais_residencia: z.string().trim().min(1).max(100),
    entidad_federativa: textoOpcional,
    ciudad_residencia: z.string().trim().max(120).optional().or(z.literal('')),
    nacionalidad: textoOpcional,
    orcid: z
      .string()
      .trim()
      .regex(/^$|^\d{4}-\d{4}-\d{4}-\d{3}[\dXx]$/, 'Formato ORCID no válido')
      .optional()
      .or(z.literal('')),

    // 2. La ponencia ya aceptada, tal como debe salir en el programa
    modalidad_participacion: textoOpcional,
    eje_tematico: textoOpcional,
    titulo_ponencia: textoOpcional,
    // El congreso es trilingüe: hay que saber en qué idioma se presenta.
    idioma_ponencia: z.enum(['es', 'en', 'pt']).optional(),
    // La convocatoria pregunta si el trabajo puede ir en la publicación
    // conmemorativa que editará el CIESS.
    autoriza_publicacion: z.boolean().optional(),
    resumen_ponencia: z
      .string()
      .trim()
      .max(limites.resumenCaracteres, `El resumen excede ${limites.resumenCaracteres} caracteres`)
      .optional()
      .or(z.literal('')),
    palabras_clave: textoOpcional,
    coautoria: parrafoOpcional,

    // 2.1 Sesión a cargo de quien coordina o modera
    sesion_asignada: textoOpcional,
    disponibilidad_dias: z.array(z.string().max(40)).max(10).default([]),

    // 2.2 Comité científico
    ejes_dictamen: z.array(z.string().max(80)).max(20).default([]),
    ponencias_maximas: z.coerce.number().int().min(0).max(50).optional(),
    // Sin declararlo, un dictamen es impugnable.
    conflicto_interes: parrafoOpcional,

    // 3. Semblanza
    semblanza: z
      .string()
      .trim()
      .max(limites.semblanzaCaracteres, `La semblanza excede ${limites.semblanzaCaracteres} caracteres`)
      .optional()
      .or(z.literal('')),
    linea_investigacion: textoOpcional,
    foto_url: textoOpcional,
    foto_drive_id: textoOpcional,

    // 3.1 Documentación de invitación
    documentacion_solicitada: z.array(z.string().max(200)).max(10).default([]),
    nombre_pasaporte: textoOpcional,
    destinatario_oficio: parrafoOpcional,
    autorizaciones: z.array(z.string().max(300)).max(10).default([]),

    // 3.2 Participación a distancia
    // Un congreso continental se transmite a husos horarios distintos: sin
    // esto, un recordatorio «a las 9:00» llega mal a media región.
    zona_horaria: textoOpcional,
    // A quien expone en línea se le agenda un ensayo previo.
    prueba_conexion: z.boolean().optional(),
    // Quien aparece en la transmisión tiene que autorizarlo por escrito.
    autoriza_grabacion: z.boolean().optional(),

    // 4. Requerimientos en sala
    requerimientos_tecnicos: z.array(z.string().max(200)).max(10).default([]),
    requerimientos_accesibilidad: parrafoOpcional,

    // 5. Alojamiento
    requiere_alojamiento: z.boolean().default(false),
    fecha_entrada_hotel: fechaOpcional,
    fecha_salida_hotel: fechaOpcional,
    tipo_habitacion: textoOpcional,
    comparte_habitacion_con: textoOpcional,

    // 6. Traslados
    requiere_traslado: textoOpcional,
    medio_arribo: textoOpcional,
    ciudad_origen: textoOpcional,
    terminal_origen: textoOpcional,
    fecha_llegada: fechaOpcional,
    hora_llegada: horaOpcional,
    aerolinea_llegada: textoOpcional,
    vuelo_llegada: textoOpcional,
    fecha_salida: fechaOpcional,
    hora_salida: horaOpcional,
    aerolinea_salida: textoOpcional,
    vuelo_salida: textoOpcional,
    observaciones_traslado: parrafoOpcional,

    // 7. Alimentación, facturación y cierre
    regimen_alimentario: textoOpcional,
    alergias: parrafoOpcional,
    contacto_emergencia: textoOpcional,
    apoyo_traslado: z.boolean().default(false),
    datos_viatico: parrafoOpcional,
    requiere_factura: z.boolean().default(false),
    datos_facturacion: parrafoOpcional,
    comentarios: parrafoOpcional,

    // Protección de datos
    consentimiento_datos: z.literal(true, {
      errorMap: () => ({ message: 'Debe aceptar el aviso de privacidad para continuar' }),
    }),
    consentimiento_comunicaciones: z.boolean().default(false),
  })
  .superRefine((datos, ctx) => {
    const perfil = perfilPorClave(datos.perfil);
    if (!perfil) return;

    // Todos los perfiles admiten las dos modalidades: el congreso se
    // transmite completo, así que no hay combinación que rechazar.

    // La ponencia ya fue dictaminada; lo que falta es su título tal como
    // debe salir en el programa.
    if (perfil.presentaPonencia && !datos.titulo_ponencia) {
      ctx.addIssue({
        code: 'custom',
        path: ['titulo_ponencia'],
        message: 'Indique el título de su ponencia tal como debe aparecer en el programa',
      });
    }
    if (perfil.presentaPonencia && !datos.eje_tematico) {
      ctx.addIssue({
        code: 'custom',
        path: ['eje_tematico'],
        message: 'Indique el eje temático en el que fue aceptado su trabajo',
      });
    }
    if (perfil.tieneSesion && !datos.sesion_asignada) {
      ctx.addIssue({
        code: 'custom',
        path: ['sesion_asignada'],
        message: 'Indique la mesa o el eje que tiene a su cargo',
      });
    }
    // Un dictamen sin ejes declarados no se puede repartir.
    if (perfil.dictamina && !(datos.ejes_dictamen && datos.ejes_dictamen.length)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ejes_dictamen'],
        message: 'Indique al menos un eje temático que pueda dictaminar',
      });
    }
    // Quien sale en la transmisión tiene que autorizarlo por escrito.
    if (perfil.enPrograma && datos.autoriza_grabacion !== true) {
      ctx.addIssue({
        code: 'custom',
        path: ['autoriza_grabacion'],
        message: 'Su participación se transmite y se graba: hace falta su autorización',
      });
    }
    // El letrero de la mesa sólo existe para quien se sienta en ella.
    if (perfil.enPrograma && datos.modalidad === 'presencial' && !datos.nombre_personificador) {
      ctx.addIssue({
        code: 'custom',
        path: ['nombre_personificador'],
        message: 'El nombre para el personificador es obligatorio para este perfil',
      });
    }
    // Sin huso horario no se le puede avisar a qué hora conectarse.
    if (datos.modalidad === 'en_linea' && !datos.zona_horaria) {
      ctx.addIssue({
        code: 'custom',
        path: ['zona_horaria'],
        message: 'Indique su zona horaria para enviarle el enlace a la hora correcta',
      });
    }
    if (datos.requiere_alojamiento && datos.fecha_entrada_hotel && datos.fecha_salida_hotel) {
      if (datos.fecha_salida_hotel < datos.fecha_entrada_hotel) {
        ctx.addIssue({
          code: 'custom',
          path: ['fecha_salida_hotel'],
          message: 'La fecha de salida no puede ser anterior a la de entrada',
        });
      }
    }
  });
}

export const esquemaRegistro = crearEsquemaRegistro();

export type DatosRegistro = z.infer<ReturnType<typeof crearEsquemaRegistro>>;

export const esquemaConsultaSql = z.object({
  consulta: z.string().trim().min(5).max(10000),
  limite: z.number().int().min(1).max(10000).default(1000),
});

export const esquemaPlantilla = z.object({
  clave: z.string().trim().min(1).max(60),
  idioma: z.enum(['es', 'en', 'pt']),
  asunto: z.string().trim().min(1).max(300),
  cuerpo_html: z.string().trim().min(1).max(50000),
});

const multilingueTexto = z.record(z.enum(['es', 'en', 'pt']), z.string().max(500));

export const esquemaConfiguracion = z.object({
  cupos_presenciales: z.number().int().min(0).nullable().optional(),
  cupos_en_linea: z.number().int().min(0).nullable().optional(),
  registro_abierto: z.boolean().optional(),
  fecha_limite_registro: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  url_agenda: z.string().url().optional(),
  url_video_login: z.string().url().optional().or(z.literal('')),
  correo_contacto: z.string().email().optional(),

  // Datos del congreso
  congreso_nombre: multilingueTexto.optional(),
  congreso_nombre_corto: multilingueTexto.optional(),
  congreso_sede: multilingueTexto.optional(),
  congreso_fechas: multilingueTexto.optional(),
  congreso_fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  congreso_fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // Límites del formulario
  limite_semblanza_palabras: z.number().int().min(10).max(500).optional(),
  limite_semblanza_caracteres: z.number().int().min(50).max(5000).optional(),
  limite_resumen_caracteres: z.number().int().min(100).max(20000).optional(),
  foto_megabytes_maximo: z.number().int().min(1).max(50).optional(),

  // Protección del formulario público
  limite_registros_por_huella: z.number().int().min(1).max(1000).optional(),

  // Recordatorios antes del congreso
  recordatorios: z
    .array(
      z.object({
        clave: z.string().trim().min(1).max(40),
        dias_antes: z.number().int().min(0).max(365),
        activo: z.boolean(),
      }),
    )
    .max(12)
    .optional(),
});
