import 'server-only';
import { consultar } from '@/lib/bd/conexion';

/**
 * Qué le falta a este despliegue para funcionar del todo.
 *
 * Sólo se informa si cada variable está puesta o no: **nunca su valor**. El
 * informe está pensado para leerse mientras se configura el sitio, no para
 * auditar credenciales.
 */

export type Estado = 'listo' | 'incompleto' | 'falta';

export interface Variable {
  nombre: string;
  presente: boolean;
  /** Sin ella la pieza no funciona; las demás son afinado. */
  obligatoria: boolean;
}

export interface Pieza {
  clave: string;
  titulo: string;
  estado: Estado;
  resumen: string;
  siguiente: string;
  variables: Variable[];
}

export interface Informe {
  piezas: Pieza[];
  migraciones: { archivo: string; aplicada: boolean; prueba: string }[];
  usuariosPanel: number | null;
  registros: number | null;
  /** true cuando el sitio público está completo aunque falte lo demás. */
  sitioEnPie: boolean;
}

const hay = (nombre: string) => Boolean(process.env[nombre]?.trim());

function evaluar(variables: Variable[]): Estado {
  const obligatorias = variables.filter((v) => v.obligatoria);
  const puestas = obligatorias.filter((v) => v.presente).length;
  if (puestas === 0) return 'falta';
  return puestas === obligatorias.length ? 'listo' : 'incompleto';
}

/**
 * Cada pieza del esquema se reconoce por algo que crea. Si la tabla o la
 * vista existe, esa parte se ejecutó.
 */
const HUELLAS: { archivo: string; prueba: string; tabla: string }[] = [
  { archivo: 'Registros', tabla: 'registros', prueba: 'tabla registros' },
  { archivo: 'Acceso al panel', tabla: 'sesiones', prueba: 'tabla sesiones' },
  { archivo: 'Plantillas de correo', tabla: 'plantillas_correo', prueba: 'tabla plantillas_correo' },
  { archivo: 'Contenido editable', tabla: 'ejes_tematicos', prueba: 'tabla ejes_tematicos' },
  { archivo: 'Lista de espera', tabla: 'v_lista_espera', prueba: 'vista v_lista_espera' },
  { archivo: 'Dictamen de ponencias', tabla: 'v_ponencias', prueba: 'vista v_ponencias' },
  { archivo: 'Recordatorios', tabla: 'envios_recordatorio', prueba: 'tabla envios_recordatorio' },
  { archivo: 'Protección del formulario', tabla: 'intentos_registro', prueba: 'tabla intentos_registro' },
];

async function existe(tabla: string): Promise<boolean> {
  try {
    const filas = await consultar<{ existe: boolean }>(
      `select to_regclass($1) is not null as existe`,
      [`public.${tabla}`],
    );
    return Boolean(filas[0]?.existe);
  } catch {
    return false;
  }
}

async function contar(tabla: string): Promise<number | null> {
  try {
    // `tabla` es un literal del propio código, nunca entrada del usuario.
    const filas = await consultar<{ total: string }>(`select count(*)::text as total from ${tabla}`);
    return Number(filas[0]?.total ?? 0);
  } catch {
    return null;
  }
}

export async function diagnosticar(): Promise<Informe> {
  const baseDeDatos: Variable[] = [
    { nombre: 'DATABASE_URL', presente: hay('DATABASE_URL'), obligatoria: true },
  ];
  const estadoBd = evaluar(baseDeDatos);

  const correo: Variable[] = [
    { nombre: 'RESEND_API_KEY', presente: hay('RESEND_API_KEY'), obligatoria: true },
    { nombre: 'CORREO_REMITENTE', presente: hay('CORREO_REMITENTE'), obligatoria: true },
    { nombre: 'CORREO_CONTACTO', presente: hay('CORREO_CONTACTO'), obligatoria: false },
  ];

  const google: Variable[] = [
    { nombre: 'GOOGLE_SERVICE_ACCOUNT_EMAIL', presente: hay('GOOGLE_SERVICE_ACCOUNT_EMAIL'), obligatoria: true },
    { nombre: 'GOOGLE_PRIVATE_KEY', presente: hay('GOOGLE_PRIVATE_KEY'), obligatoria: true },
    { nombre: 'GOOGLE_SHEETS_ID', presente: hay('GOOGLE_SHEETS_ID'), obligatoria: true },
    { nombre: 'GOOGLE_DRIVE_FOLDER_ID', presente: hay('GOOGLE_DRIVE_FOLDER_ID'), obligatoria: false },
  ];

  const recordatorios: Variable[] = [
    { nombre: 'CRON_SECRET', presente: hay('CRON_SECRET'), obligatoria: true },
  ];

  const sitio: Variable[] = [
    { nombre: 'NEXT_PUBLIC_URL_SITIO', presente: hay('NEXT_PUBLIC_URL_SITIO'), obligatoria: true },
    { nombre: 'ANTIABUSO_SAL', presente: hay('ANTIABUSO_SAL'), obligatoria: false },
  ];

  // Sólo se consulta la base si hay con qué. Si no, no se inventa un fallo.
  let migraciones = HUELLAS.map((h) => ({ archivo: h.archivo, prueba: h.prueba, aplicada: false }));
  let usuariosPanel: number | null = null;
  let registros: number | null = null;

  if (estadoBd === 'listo') {
    const aplicadas = await Promise.all(HUELLAS.map((h) => existe(h.tabla)));
    migraciones = HUELLAS.map((h, i) => ({
      archivo: h.archivo,
      prueba: h.prueba,
      aplicada: aplicadas[i],
    }));
    usuariosPanel = await contar('usuarios_panel');
    registros = await contar('registros');
  }

  const faltanMigraciones = migraciones.filter((m) => !m.aplicada).length;

  const piezas: Pieza[] = [
    {
      clave: 'base',
      titulo: 'PostgreSQL · base de datos y acceso al panel',
      estado:
        estadoBd !== 'listo' ? estadoBd
        : faltanMigraciones > 0 ? 'incompleto'
        : usuariosPanel === 0 ? 'incompleto'
        : 'listo',
      resumen:
        estadoBd === 'falta'
          ? 'Sin conectar. El formulario funciona, pero nada se guarda todavía.'
          : estadoBd === 'incompleto'
          ? 'Falta la cadena de conexión.'
          : faltanMigraciones > 0
          ? `Conectado, pero el esquema está incompleto: faltan ${faltanMigraciones} piezas.`
          : usuariosPanel === 0
          ? 'Todo listo, pero no hay ninguna cuenta dada de alta en usuarios_panel.'
          : 'Conectado, con el esquema completo.',
      siguiente:
        estadoBd !== 'listo'
          ? 'Crear la base en DigitalOcean y copiar su cadena de conexión a DATABASE_URL.'
          : faltanMigraciones > 0
          ? 'Ejecutar basedatos/esquema.sql contra la base.'
          : usuariosPanel === 0
          ? 'Dar de alta la primera cuenta del panel con el guion de arranque.'
          : 'Nada pendiente.',
      variables: baseDeDatos,
    },
    {
      clave: 'correo',
      titulo: 'Resend · correos de confirmación y recordatorio',
      estado: evaluar(correo),
      resumen:
        evaluar(correo) === 'listo'
          ? 'Configurado. Los correos salen en el idioma de cada participante.'
          : 'Sin configurar. Los registros se guardan igual, pero nadie recibe acuse.',
      siguiente: 'Verificar el dominio en resend.com y poner RESEND_API_KEY y CORREO_REMITENTE.',
      variables: correo,
    },
    {
      clave: 'google',
      titulo: 'Google · réplica en Sheets y fotos en Drive',
      estado: evaluar(google),
      resumen:
        evaluar(google) === 'listo'
          ? 'Configurado. Cada registro se replica en el libro de seguimiento.'
          : 'Sin configurar. Los registros viven sólo en la base; se pueden exportar desde el panel.',
      siguiente:
        'Crear la cuenta de servicio, y compartir la hoja y la carpeta como editor con su correo.',
      variables: google,
    },
    {
      clave: 'recordatorios',
      titulo: 'Recordatorios automáticos',
      estado: evaluar(recordatorios),
      resumen:
        evaluar(recordatorios) === 'listo'
          ? 'El cron puede autenticarse. Envía a diario el recordatorio que toque.'
          : 'Sin CRON_SECRET el envío automático responde 503 y no escribe a nadie.',
      siguiente: 'Poner CRON_SECRET con una cadena larga al azar y volver a desplegar.',
      variables: recordatorios,
    },
    {
      clave: 'sitio',
      titulo: 'Sitio',
      estado: evaluar(sitio),
      resumen:
        hay('NEXT_PUBLIC_URL_SITIO')
          ? 'Los enlaces de edición de los correos apuntan al dominio configurado.'
          : 'Sin NEXT_PUBLIC_URL_SITIO los enlaces de los correos pueden apuntar a localhost.',
      siguiente: 'Poner NEXT_PUBLIC_URL_SITIO con el dominio definitivo del congreso.',
      variables: sitio,
    },
  ];

  return { piezas, migraciones, usuariosPanel, registros, sitioEnPie: true };
}
