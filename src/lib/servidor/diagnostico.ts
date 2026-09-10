import 'server-only';
import { crearClienteAdmin } from '@/lib/supabase/admin';

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
 * Cada migración se reconoce por algo que crea. Si la consulta responde, la
 * migración corrió; si la tabla no existe, no.
 */
const HUELLAS: { archivo: string; prueba: string; tabla: string }[] = [
  { archivo: '0001_esquema_inicial.sql', tabla: 'registros', prueba: 'tabla registros' },
  { archivo: '0002_plantillas_y_sql_lectura.sql', tabla: 'plantillas_correo', prueba: 'tabla plantillas_correo' },
  { archivo: '0003_contenido_editable.sql', tabla: 'ejes_tematicos', prueba: 'tabla ejes_tematicos' },
  { archivo: '0004_estados_y_lista_espera.sql', tabla: 'v_lista_espera', prueba: 'vista v_lista_espera' },
  { archivo: '0005_dictamen_ponencias.sql', tabla: 'v_ponencias', prueba: 'vista v_ponencias' },
  { archivo: '0006_recordatorios.sql', tabla: 'envios_recordatorio', prueba: 'tabla envios_recordatorio' },
  { archivo: '0007_antiabuso.sql', tabla: 'intentos_registro', prueba: 'tabla intentos_registro' },
];

async function existe(tabla: string): Promise<boolean> {
  try {
    const { error } = await crearClienteAdmin()
      .from(tabla)
      .select('*', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}

async function contar(tabla: string): Promise<number | null> {
  try {
    const { count, error } = await crearClienteAdmin()
      .from(tabla)
      .select('*', { count: 'exact', head: true });
    return error ? null : count ?? 0;
  } catch {
    return null;
  }
}

export async function diagnosticar(): Promise<Informe> {
  const supabase: Variable[] = [
    { nombre: 'NEXT_PUBLIC_SUPABASE_URL', presente: hay('NEXT_PUBLIC_SUPABASE_URL'), obligatoria: true },
    { nombre: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', presente: hay('NEXT_PUBLIC_SUPABASE_ANON_KEY'), obligatoria: true },
    { nombre: 'SUPABASE_SERVICE_ROLE_KEY', presente: hay('SUPABASE_SERVICE_ROLE_KEY'), obligatoria: true },
  ];
  const estadoSupabase = evaluar(supabase);

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

  if (estadoSupabase === 'listo') {
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
      clave: 'supabase',
      titulo: 'Supabase · base de datos y acceso al panel',
      estado:
        estadoSupabase !== 'listo' ? estadoSupabase
        : faltanMigraciones > 0 ? 'incompleto'
        : usuariosPanel === 0 ? 'incompleto'
        : 'listo',
      resumen:
        estadoSupabase === 'falta'
          ? 'Sin conectar. El formulario funciona, pero nada se guarda todavía.'
          : estadoSupabase === 'incompleto'
          ? 'Faltan variables. Las tres son necesarias.'
          : faltanMigraciones > 0
          ? `Conectado, pero faltan ${faltanMigraciones} migraciones por ejecutar.`
          : usuariosPanel === 0
          ? 'Todo listo, pero no hay ninguna cuenta dada de alta en usuarios_panel.'
          : 'Conectado, con el esquema completo.',
      siguiente:
        estadoSupabase !== 'listo'
          ? 'Crear el proyecto en supabase.com y copiar las tres claves de Settings → API.'
          : faltanMigraciones > 0
          ? 'Pegar supabase/todas-las-migraciones.sql en el editor SQL de Supabase y ejecutarlo.'
          : usuariosPanel === 0
          ? 'Crear el usuario en Authentication → Users y darlo de alta en usuarios_panel con su rol.'
          : 'Nada pendiente.',
      variables: supabase,
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
          : 'Sin configurar. Los registros viven sólo en Supabase; se pueden exportar desde el panel.',
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
