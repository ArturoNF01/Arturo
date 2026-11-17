/**
 * La asistencia al Congreso: qué cuenta como una asistencia, cuándo vale cada código y cómo se reconoce a
 * quien escanea.
 *
 * **Una asistencia por día.** El comité pidió que el registro no fuera tan riguroso: hay un QR por día
 * (miércoles, jueves y viernes) y una persona registra su asistencia una vez al día, no una vez por mesa. Por
 * eso lo que aquí se llama «sesión» es una jornada: tres en total. (El nombre se conserva —las tablas, los
 * códigos y las pantallas ya hablan de «sesión»—, pero cada una es un día completo.)
 *
 * Es lógica pura, sin dependencias del servidor, para poder probarla. Las sesiones no se guardan
 * en la base: salen de la agenda (`programa.ts`), que es donde el comité las cambia. Lo único que
 * se guarda es la clave estable de cada una ('mesa-4', 'apertura'…), de modo que mover un horario en
 * la agenda no deja huérfana ninguna asistencia ya registrada.
 */
import type { Idioma } from '@/i18n';
import { HUSO_CONGRESO, diaEnMexico } from '@/lib/fechas';
import { PROGRAMA, SALAS, type ClaveSala, type TipoSesion } from '@/lib/programa';

type Texto = Record<Idioma, string>;

/** Por dónde asistió: el QR impreso en la sede, o el enlace que se pega en el chat de Zoom o Meet. */
export type ViaAsistencia = 'presencial' | 'en_linea';
export const VIAS: readonly ViaAsistencia[] = ['presencial', 'en_linea'];

export function esVia(valor: unknown): valor is ViaAsistencia {
  return valor === 'presencial' || valor === 'en_linea';
}

export interface SesionDeAsistencia {
  /** Estable aunque cambie el horario: 'miercoles', 'jueves', 'viernes'. */
  clave: string;
  /** El día, 'AAAA-MM-DD'. */
  dia: string;
  diaTexto: Texto;
  /** De cuándo a cuándo es la jornada, por la agenda: '08:30–17:00'. */
  horario: string;
  inicio: Date;
  fin: Date;
  tipo: TipoSesion | 'dia';
  sala?: ClaveSala;
  mesa?: number;
  /** Lo que se dice de un vistazo: «Jueves 12 de noviembre». */
  corto: Texto;
  /** De qué trata la jornada: «Inauguración y mesas temáticas 1 a 4». */
  titulo?: Texto;
}

// ---------------------------------------------------------------------------
// La ventana de cada código
// ---------------------------------------------------------------------------

/**
 * El código de un día abre 20 minutos antes de que empiece la primera actividad del día y cierra 30 minutos
 * después de que termine la última. Dentro de ese margen se puede escanear a cualquier hora —quien llega
 * tarde o escanea al salir cuenta—; fuera de él una foto del QR ya no sirve.
 */
export const MINUTOS_ANTES = 20;
export const MINUTOS_DESPUES = 30;

/**
 * El instante que corresponde a una hora de reloj en la Ciudad de México. Se calcula con el huso y
 * no con un desfase fijo, para que no dependa de que México tenga o no horario de verano.
 */
export function instanteEnMexico(dia: string, hora: string): Date {
  const [anio, mes, diaDelMes] = dia.split('-').map(Number);
  const [horas, minutos] = hora.split(':').map(Number);
  const supuesto = Date.UTC(anio, mes - 1, diaDelMes, horas, minutos);
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: HUSO_CONGRESO, hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(new Date(supuesto));
  const dePartes = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  const enMexico = Date.UTC(dePartes('year'), dePartes('month') - 1, dePartes('day'), dePartes('hour'), dePartes('minute'));
  return new Date(supuesto - (enMexico - supuesto));
}

/** «09:00–10:30» → { desde: '09:00', hasta: '10:30' }; null si el texto no trae dos horas. */
export function horasDelHorario(horario: string): { desde: string; hasta: string } | null {
  const m = /(\d{1,2}):(\d{2})\s*\D+\s*(\d{1,2}):(\d{2})/.exec(horario);
  if (!m) return null;
  return { desde: `${m[1].padStart(2, '0')}:${m[2]}`, hasta: `${m[3].padStart(2, '0')}:${m[4]}` };
}

export interface Ventana {
  abre: Date;
  cierra: Date;
}

export function ventanaDe(sesion: Pick<SesionDeAsistencia, 'inicio' | 'fin'>): Ventana {
  return {
    abre: new Date(sesion.inicio.getTime() - MINUTOS_ANTES * 60_000),
    cierra: new Date(sesion.fin.getTime() + MINUTOS_DESPUES * 60_000),
  };
}

export type EstadoDeVentana = 'antes' | 'abierta' | 'cerrada';

export function estadoDeVentana(
  sesion: Pick<SesionDeAsistencia, 'inicio' | 'fin'>,
  ahora: Date = new Date(),
): EstadoDeVentana {
  const { abre, cierra } = ventanaDe(sesion);
  if (ahora < abre) return 'antes';
  if (ahora > cierra) return 'cerrada';
  return 'abierta';
}

// ---------------------------------------------------------------------------
// Las sesiones, sacadas de la agenda
// ---------------------------------------------------------------------------

/**
 * Las claves de los días. Van fijas —no salen del texto de la agenda— para que una corrección al programa no
 * deje huérfana ninguna asistencia ya registrada. Un día que se añadiera a la agenda tomaría `dia-AAAA-MM-DD`.
 */
const CLAVES_DE_DIA: Record<string, string> = {
  '2026-11-11': 'miercoles',
  '2026-11-12': 'jueves',
  '2026-11-13': 'viernes',
};

/**
 * Las jornadas a las que se pasa asistencia: una por día de la agenda, con el horario que va de la primera
 * actividad (el registro de participantes, si lo hay) al final de la última. Sólo se descarta el almuerzo,
 * que no abre ni cierra el día.
 */
function sesionesDeLaAgenda(): SesionDeAsistencia[] {
  const salida: SesionDeAsistencia[] = [];
  for (const dia of PROGRAMA) {
    const horas = dia.sesiones
      .filter((s) => s.tipo !== 'pausa')
      .map((s) => horasDelHorario(s.horario))
      .filter((h): h is { desde: string; hasta: string } => h !== null);
    if (horas.length === 0) continue;
    // «HH:MM» ordena bien como texto.
    const desde = horas.map((h) => h.desde).sort()[0];
    const hasta = horas.map((h) => h.hasta).sort().at(-1)!;

    salida.push({
      clave: CLAVES_DE_DIA[dia.iso] ?? `dia-${dia.iso}`,
      dia: dia.iso, diaTexto: dia.fecha, horario: `${desde}–${hasta}`,
      inicio: instanteEnMexico(dia.iso, desde), fin: instanteEnMexico(dia.iso, hasta),
      tipo: 'dia', corto: dia.fecha, titulo: dia.titulo,
    });
  }
  return salida;
}

export const SESIONES_DE_ASISTENCIA: readonly SesionDeAsistencia[] = sesionesDeLaAgenda();

/**
 * La sesión de prueba: para que el comité vea cómo se captura una asistencia —en el celular y en el panel—
 * antes del Congreso. No es de la agenda: está siempre abierta, sólo existe mientras alguien del panel la
 * activa (sus códigos se crean entonces y se borran al borrar la prueba), no cuenta para la asistencia de nadie
 * (ni la vista por persona ni la hoja de Google la llevan) y se quita con un clic.
 */
export const CLAVE_DE_PRUEBA = 'prueba';
export const SESION_DE_PRUEBA: SesionDeAsistencia = {
  clave: CLAVE_DE_PRUEBA,
  dia: 'prueba',
  diaTexto: { es: 'Prueba', en: 'Test', pt: 'Teste' },
  horario: '—',
  // Un rango tan ancho que la ventana nunca se cierra.
  inicio: new Date('2000-01-01T00:00:00Z'),
  fin: new Date('2100-01-01T00:00:00Z'),
  tipo: 'dia',
  corto: { es: 'Sesión de prueba', en: 'Test session', pt: 'Sessão de teste' },
};

export function esSesionDePrueba(clave: string): boolean {
  return clave === CLAVE_DE_PRUEBA;
}

export function sesionPorClave(clave: string): SesionDeAsistencia | undefined {
  return esSesionDePrueba(clave) ? SESION_DE_PRUEBA : SESIONES_DE_ASISTENCIA.find((s) => s.clave === clave);
}

/**
 * La jornada que toca mostrar en la pantalla de recepción (`/qr`): la de hoy, contado el día en hora de México. Es el
 * día entero, no la ventana del código: el QR de un día se queda en pantalla hasta que cambia la fecha, y lo que cambia
 * con la hora es el aviso de si ya abrió o ya cerró (`estadoDeVentana`).
 *
 * Fuera de los días del Congreso la pantalla no se queda vacía: antes del primero enseña el primero («próximo») y
 * después del último enseña el último («terminó»). En ambos casos el código está fuera de ventana, así que escanearlo
 * sólo dice que no está abierto.
 */
export type RelacionConHoy = 'hoy' | 'proximo' | 'termino';

export function jornadaDeHoy(
  ahora: Date = new Date(),
  sesiones: readonly SesionDeAsistencia[] = SESIONES_DE_ASISTENCIA,
): { sesion: SesionDeAsistencia; relacion: RelacionConHoy } | null {
  if (sesiones.length === 0) return null;
  const orden = [...sesiones].sort((a, b) => a.dia.localeCompare(b.dia));
  const hoy = diaEnMexico(ahora);
  const deHoy = orden.find((s) => s.dia === hoy);
  if (deHoy) return { sesion: deHoy, relacion: 'hoy' };
  const siguiente = orden.find((s) => s.dia > hoy);
  if (siguiente) return { sesion: siguiente, relacion: 'proximo' };
  return { sesion: orden[orden.length - 1], relacion: 'termino' };
}

/** Las sesiones de un día, en orden de horario (las simultáneas, por número de mesa). */
export function sesionesDelDia(dia: string): SesionDeAsistencia[] {
  return SESIONES_DE_ASISTENCIA.filter((s) => s.dia === dia);
}

export const DIAS_DE_ASISTENCIA: readonly { iso: string; texto: Texto }[] = PROGRAMA.map((d) => ({
  iso: d.iso, texto: d.fecha,
}));

/** Cómo se nombra una jornada en una lista: «Jueves 12 de noviembre · Inauguración y mesas temáticas 1 a 4». */
export function etiquetaDeSesion(sesion: SesionDeAsistencia, idioma: Idioma = 'es'): string {
  const corto = sesion.corto[idioma];
  return sesion.tipo === 'dia' && sesion.titulo && sesion.clave !== CLAVE_DE_PRUEBA ? `${corto} · ${sesion.titulo[idioma]}` : corto;
}

/** Lo mismo, desde la clave guardada; si ya no existe en la agenda, la clave tal cual. */
export function etiquetaDeClave(clave: string, idioma: Idioma = 'es'): string {
  const sesion = sesionPorClave(clave);
  return sesion ? etiquetaDeSesion(sesion, idioma) : clave;
}

export function diaDeClave(clave: string, idioma: Idioma = 'es'): string {
  const sesion = sesionPorClave(clave);
  return sesion ? sesion.diaTexto[idioma] : '';
}

export function nombreDeSala(sala: ClaveSala | undefined, idioma: Idioma = 'es'): string {
  return sala ? SALAS[sala][idioma] : '';
}

// ---------------------------------------------------------------------------
// Reconocer a quien escanea
// ---------------------------------------------------------------------------

/** Minúsculas, sin acentos ni signos y con los espacios normalizados: «José  Pérez-Ruiz» → «jose perez ruiz». */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * El nombre como una bolsa de palabras ordenada: «Ruiz Pérez, José» y «José Pérez Ruiz» dan lo mismo.
 * La gente teclea el nombre en el orden que le sale, y lo que importa es que sean las mismas palabras.
 */
export function huellaDeNombre(nombre: string): string {
  return normalizarTexto(nombre).split(' ').filter(Boolean).sort().join(' ');
}

export function correoValido(correo: string): boolean {
  return /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/.test(correo.trim());
}

export interface CandidatoPorNombre {
  id: string;
  nombres: string;
  apellidos: string;
}

/**
 * Quién es, por su nombre, cuando su correo no apareció.
 *
 * Sólo vale si el nombre coincide con exactamente un registro: dos personas con el mismo nombre no se
 * pueden distinguir sin el correo, y atribuirle la asistencia a la equivocada es peor que dejarla «sin
 * registro» para que el comité la concilie. Exige al menos dos palabras: un nombre suelto no identifica.
 */
export function elegirRegistroPorNombre(nombre: string, candidatos: readonly CandidatoPorNombre[]): string | null {
  const buscado = huellaDeNombre(nombre);
  if (buscado.split(' ').filter(Boolean).length < 2) return null;
  const coinciden = candidatos.filter((c) => huellaDeNombre(`${c.nombres} ${c.apellidos}`) === buscado);
  return coinciden.length === 1 ? coinciden[0].id : null;
}

export type DecisionDeIdentidad =
  | { accion: 'registrar'; registroId: string; por: 'correo' | 'nombre' }
  /** El correo no apareció y todavía no se le pidió el nombre: hay que pedírselo. */
  | { accion: 'pedir_datos' }
  /** Ni así apareció: se guarda tal como lo escribió, marcada «sin registro», para que el comité la concilie. */
  | { accion: 'sin_registro' };

/**
 * Qué hacer con quien escanea, en dos pasos.
 *
 *  1. Sólo con el correo: si es de un registro, listo. Si no, no se guarda nada todavía: se le dice que
 *     escriba su nombre y su correo tal como los puso al registrarse (casi siempre es un dedazo).
 *  2. Con nombre y correo: se vuelve a buscar por el correo y, si sigue sin aparecer, por el nombre
 *     (sólo si coincide con un único registro). Si aun así no aparece, se guarda «sin registro»: es
 *     mejor una asistencia por conciliar que una asistencia perdida.
 *
 * Que venga el nombre es lo que distingue el segundo paso del primero.
 */
export function decidirIdentidad({
  registroPorCorreo, nombre, candidatosPorNombre,
}: {
  /** El registro vigente con ese correo, si lo hay. */
  registroPorCorreo: string | null;
  /** Lo que tecleó; vacío en el primer paso. */
  nombre: string;
  candidatosPorNombre: readonly CandidatoPorNombre[];
}): DecisionDeIdentidad {
  if (registroPorCorreo) return { accion: 'registrar', registroId: registroPorCorreo, por: 'correo' };
  if (nombre.trim().length === 0) return { accion: 'pedir_datos' };
  const porNombre = elegirRegistroPorNombre(nombre, candidatosPorNombre);
  return porNombre ? { accion: 'registrar', registroId: porNombre, por: 'nombre' } : { accion: 'sin_registro' };
}

/** El nombre de pila para saludar sin enseñar el nombre completo de nadie. */
export function nombreDePila(nombres: string): string {
  return nombres.trim().split(/\s+/)[0] ?? '';
}

// ---------------------------------------------------------------------------
// Lo que se contesta a quien escanea
// ---------------------------------------------------------------------------

export type RespuestaDeAsistencia =
  /** Quedó registrada (o ya lo estaba). `sinRegistro`: no se halló su registro y quedó para que el comité la concilie. */
  | { ok: true; estado: 'registrada' | 'ya_registrada'; sinRegistro: boolean; nombre: string; via: ViaAsistencia; sesion: string }
  /** El correo no apareció: hay que pedir el nombre y el correo tal como se registraron. */
  | { ok: false; motivo: 'no_encontrado' }
  | { ok: false; motivo: 'fuera_de_horario'; estado: 'antes' | 'cerrada'; abre: string; cierra: string }
  | { ok: false; motivo: 'codigo_invalido' | 'datos_invalidos' | 'limite' | 'error'; mensaje?: string };

/** De dónde viene una asistencia: la persona escaneó (`qr`) o la anotó alguien del comité desde el panel (`manual`). */
export type OrigenDeAsistencia = 'qr' | 'manual';

/**
 * Lo que contesta el registro a mano, en el panel. A diferencia de lo que ve quien escanea, aquí sí va el nombre completo
 * —quien lo anota es del comité y tiene que ver a quién anotó— y el id de la asistencia, para poder deshacerla.
 */
export type RespuestaManual =
  /** Quedó registrada (o ya lo estaba). `sinRegistro`: no se halló su registro y queda para que el comité la concilie. */
  | { ok: true; estado: 'registrada' | 'ya_registrada'; id: string | null; nombre: string; correo: string; sinRegistro: boolean; via: ViaAsistencia; sesion: string }
  /** El correo no apareció y no se escribió el nombre: hay que pedirlo. */
  | { ok: false; motivo: 'no_encontrado' }
  | { ok: false; motivo: 'datos_invalidos' | 'sesion_invalida' | 'registro_invalido' | 'error'; mensaje?: string };

/** ¿Es un día de la agenda? La sesión de prueba no: sólo los días del Congreso se anotan a mano. */
export function esSesionDeLaAgenda(clave: string): boolean {
  return SESIONES_DE_ASISTENCIA.some((s) => s.clave === clave);
}

/**
 * El resultado de buscar el correo antes de registrar: con él se rellena el nombre completo en la pantalla, para
 * que quien escanea vea que es su registro. Sólo se contesta con un código vigente y dentro de su horario.
 */
export type RespuestaDeBusqueda =
  | { ok: true; encontrado: true; nombre: string }
  | { ok: true; encontrado: false }
  | { ok: false; motivo: 'fuera_de_horario'; estado: 'antes' | 'cerrada'; abre: string; cierra: string }
  | { ok: false; motivo: 'codigo_invalido' | 'datos_invalidos' | 'limite' | 'error' };

/** Un código nuevo: legible, sin letras que se confunden (0/O, 1/l/I) y sin adivinarse. */
export const ALFABETO_DE_CODIGOS = 'abcdefghjkmnpqrstuvwxyz23456789';
export const LARGO_DE_CODIGO = 10;

export function esCodigoPosible(codigo: string): boolean {
  return new RegExp(`^[${ALFABETO_DE_CODIGOS}]{${LARGO_DE_CODIGO}}$`).test(codigo);
}

// ---------------------------------------------------------------------------
// Vistas del panel
// ---------------------------------------------------------------------------

/** Lo mínimo de una asistencia para agruparla por persona o volcarla a una tabla. */
export interface FilaDeAsistencia {
  id: string;
  sesion: string;
  via: ViaAsistencia;
  registro_id: string | null;
  nombre: string;
  correo: string;
  perfil: string | null;
  folio: string | null;
  creada_en: string;
  /** El estado del registro al que está ligada («confirmado», «cancelado»…); nada si no está ligada a ninguno. */
  estado_registro?: string | null;
}

export interface PersonaConAsistencia {
  /** El registro, o «correo:…» para quien está «sin registro». */
  clave: string;
  registroId: string | null;
  nombre: string;
  correo: string;
  perfil: string | null;
  folio: string | null;
  sinRegistro: boolean;
  /** El estado de su registro, si lo tiene: un registro cancelado después de asistir sigue ligado, pero ya no vale. */
  estadoDelRegistro: string | null;
  /** Cuántas sesiones, en total y por día ('2026-11-12' → 3). */
  total: number;
  porDia: Record<string, number>;
  sesiones: { sesion: string; via: ViaAsistencia; creada_en: string }[];
}

/**
 * Junta las asistencias por persona, en el orden en que cada una llegó por primera vez (las filas vienen en
 * orden de llegada). Quien está «sin registro» se agrupa por su correo, para que dos escaneos suyos sean una
 * sola persona.
 */
function reunirPorPersona(filas: readonly FilaDeAsistencia[]): PersonaConAsistencia[] {
  const personas = new Map<string, PersonaConAsistencia>();
  for (const f of filas) {
    // La sesión de prueba no cuenta para la asistencia de nadie.
    if (esSesionDePrueba(f.sesion)) continue;
    const clave = f.registro_id ?? `correo:${f.correo.toLowerCase()}`;
    let p = personas.get(clave);
    if (!p) {
      p = {
        clave, registroId: f.registro_id, nombre: f.nombre, correo: f.correo, perfil: f.perfil, folio: f.folio,
        sinRegistro: f.registro_id === null, estadoDelRegistro: f.registro_id === null ? null : (f.estado_registro ?? null),
        total: 0, porDia: {}, sesiones: [],
      };
      personas.set(clave, p);
    }
    p.total += 1;
    const dia = sesionPorClave(f.sesion)?.dia;
    if (dia) p.porDia[dia] = (p.porDia[dia] ?? 0) + 1;
    p.sesiones.push({ sesion: f.sesion, via: f.via, creada_en: f.creada_en });
  }
  return [...personas.values()];
}

/**
 * La asistencia vista por persona: una fila por quien asistió a algo, con cuántas sesiones y a
 * cuáles. Primero quien más sesiones suma, y a igualdad, por nombre.
 */
export function agruparPorPersona(filas: readonly FilaDeAsistencia[]): PersonaConAsistencia[] {
  return reunirPorPersona(filas).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * Una tabla como CSV para abrir en Excel. Una celda que empieza por «=», «+», «-» o «@» se abriría como
 * fórmula, y los nombres los escribe cualquiera desde el formulario público: se les pone un apóstrofo.
 */
export function aCsv(filas: readonly (readonly (string | number)[])[]): string {
  const celda = (valor: string | number) => {
    let texto = String(valor ?? '');
    if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
    return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  return filas.map((f) => f.map(celda).join(',')).join('\r\n');
}

// ---------------------------------------------------------------------------
// La hoja de Google: la pestaña «Asistencia por persona», de donde se hacen las constancias
// ---------------------------------------------------------------------------

export const HOJA_PERSONAS = 'Asistencia por persona';

/** «Miércoles 11»: el día como lo rotula el panel en su tabla «Por persona». */
const diaCortoEnEspanol = (texto: Texto) => texto.es.split(' ').slice(0, 2).join(' ');

/**
 * Los títulos: los de la tabla «Por persona» del panel —nombre, correo, perfil, un día por columna y el total— y dos más que
 * el panel no tiene, para hacer las constancias desde la hoja:
 *  - «Con registro»: quien asistió sin estar registrado no recibe constancia, y tiene que verse de un vistazo;
 *  - «Ponencia»: para los ponentes, la ponencia del programa en la que participaron (el título que lleva su constancia).
 * Los días salen de la agenda: si ésta cambia, los títulos la siguen.
 *
 * Las columnas nuevas se añaden siempre a la derecha, para que las de antes no cambien de letra.
 */
export const ENCABEZADOS_PERSONAS: readonly string[] = [
  'N.º', 'Nombre', 'Correo', 'Perfil', ...DIAS_DE_ASISTENCIA.map((d) => diaCortoEnEspanol(d.texto)), 'Total', 'Con registro', 'Ponencia',
];

/** Dónde está «Con registro» (contando desde 0): la columna que se muestra con casillas de verificación. */
export const COLUMNA_CON_REGISTRO = ENCABEZADOS_PERSONAS.indexOf('Con registro');

/**
 * Las columnas para hacer las constancias, a la derecha de las que llena el sistema (de la A a la J). Son de quien hace las
 * constancias, o de su automatización: el sistema las crea una vez, con su formato, y no escribe nunca en ellas.
 *  - los datos del registro de cada constancia: «Total de horas», «N° de constancia», «Folio», «Libro», «Foja» y «Fecha de registro»;
 *  - los de la automatización: «✨Generar Constancia» (una casilla que la dispara), «Constancia» (el archivo), «Fecha de
 *    elaboración» y «Estado automatización».
 * Se llaman como los campos de la constancia (documentos/constancias/constancia.html): lo de una fila cae en su lugar.
 */
export const ENCABEZADOS_DE_CONSTANCIAS: readonly string[] = [
  'Total de horas', 'N° de constancia', 'Folio', 'Libro', 'Foja', 'Fecha de registro',
  '✨Generar Constancia', 'Constancia', 'Fecha de elaboración', 'Estado automatización',
];
/** La que se muestra con casillas de verificación. */
export const ENCABEZADO_DE_GENERAR = '✨Generar Constancia';
/** Las que llevan fechas: se les da formato de fecha, para que lo que se escriba ahí se lea y se ordene como tal. */
export const ENCABEZADOS_DE_FECHAS: readonly string[] = ['Fecha de registro', 'Fecha de elaboración'];

/**
 * La pestaña «Asistencias» que tuvo la hoja —una fila por asistencia, con el día y la modalidad— y que se retiró: sólo
 * quedó «Asistencia por persona». Estos son los títulos con que la ponía el sistema (los de ahora y los del diseño por
 * mesa, que llevaba una columna «Mesa»). Sirven para reconocerla al quitarla y no borrar una pestaña con ese nombre que
 * alguien haya hecho a mano, con otros títulos o con columnas de más.
 */
export const HOJA_RETIRADA = 'Asistencias';
export const ENCABEZADOS_DE_LA_HOJA_RETIRADA: readonly (readonly string[])[] = [
  ['N.º', 'Nombre', 'Correo', 'Día', 'Modalidad'],
  ['N.º', 'Nombre', 'Correo', 'Día', 'Mesa', 'Modalidad'],
];

/** Una celda de la hoja: texto, número o —en las casillas de verificación— verdadero o falso. */
export type FilaDeHoja = (string | number | boolean)[];

/**
 * Un registro de ponente. Los ponentes no tenían que registrar asistencia, pero tienen constancia: van en la hoja aunque no
 * hayan escaneado, y de ellos sale el registro (no una asistencia) —su nombre, su correo, su folio y el estado de su registro.
 */
export interface RegistroDePonente {
  id: string;
  nombre: string;
  correo: string;
  perfil: string;
  folio: string | null;
  estado: string | null;
}

/**
 * Lo que dice la casilla «Con registro»: marcada si su asistencia está ligada a un registro que vale; sin marcar si quedó
 * «sin registro» (el comité aún no la concilió con ninguno) o si su registro se canceló después de asistir. En lista de
 * espera o en proceso sí es un registro. Quien se cancela y luego se reactiva en el panel vuelve a quedar marcado.
 */
export function conRegistro(p: Pick<PersonaConAsistencia, 'sinRegistro' | 'estadoDelRegistro'>): boolean {
  return !p.sinRegistro && p.estadoDelRegistro !== 'cancelado';
}

/**
 * Las personas de la pestaña, en el orden de sus filas: primero quienes asistieron, en orden de llegada, y después, en
 * el orden en que se registraron, los ponentes que no registraron asistencia (con cero días). Cada registro de ponente sale
 * una sola vez: quien asistió y está ligado a su registro ya tiene su fila arriba, y no se repite abajo.
 *
 * Los ponentes sin asistencia van al final, no mezclados, para que las filas de quienes ya estaban no se muevan.
 */
function personasDeLaHoja(asistentes: readonly FilaDeAsistencia[], ponentes: readonly RegistroDePonente[]): PersonaConAsistencia[] {
  const personas = reunirPorPersona(asistentes);
  const yaEstan = new Set(personas.map((p) => p.registroId).filter((id): id is string => id !== null));
  for (const r of ponentes) {
    if (yaEstan.has(r.id)) continue;
    yaEstan.add(r.id);
    personas.push({
      clave: r.id, registroId: r.id, nombre: r.nombre, correo: r.correo, perfil: r.perfil, folio: r.folio,
      sinRegistro: false, estadoDelRegistro: r.estado, total: 0, porDia: {}, sesiones: [],
    });
  }
  return personas;
}

/**
 * Las filas de la pestaña por persona: una por quien asistió a algo y una por cada ponente que no, con cuántas sesiones
 * tuvo cada día y en total (como en el panel: 1 o 0 por día), si tenía registro (la casilla) y, si presentó una ponencia, cuál.
 *
 * **En orden de llegada** (quien escaneó primero, primero), no por nombre ni por total como en el panel: la pestaña es una
 * copia que se reescribe, y con un orden que se mueve cada vez que alguien suma un día, lo que se anote o genere a la derecha
 * de una fila (las constancias, un «enviada») quedaría apuntando a otra persona. Así quien llega después se añade al final
 * y las filas de antes no se mueven. Para verla por nombre, una vista de filtro de Sheets ordena sin mover filas.
 *
 * Los ponentes que no registraron asistencia van detrás de todos los demás (ver `personasDeLaHoja`).
 */
export function filasDePersonas(
  asistentes: readonly FilaDeAsistencia[],
  /** El perfil como se lee en la hoja («Público general»), no como se guarda («publico_general»). */
  etiquetaDePerfil: (clave: string) => string = (clave) => clave,
  /** La ponencia que presentó quien tiene ese nombre, como va en la celda; vacía si no presentó ninguna. */
  ponenciaDe: (nombre: string) => string = () => '',
  /** Todos los registros de ponente, tengan o no asistencia. */
  ponentes: readonly RegistroDePonente[] = [],
): FilaDeHoja[] {
  return personasDeLaHoja(asistentes, ponentes).map((p, i) => [
    i + 1,
    p.nombre,
    p.correo,
    p.perfil ? etiquetaDePerfil(p.perfil) : '',
    ...DIAS_DE_ASISTENCIA.map((d) => p.porDia[d.iso] ?? 0),
    p.total,
    conRegistro(p),
    ponenciaDe(p.nombre),
  ]);
}

/** Cuántos ponentes lleva la hoja (todos los registros de ponente, una vez cada uno) y cuántos de ellos no registraron asistencia. */
export function resumenDePonentes(
  asistentes: readonly FilaDeAsistencia[],
  ponentes: readonly RegistroDePonente[],
): { total: number; sinAsistencia: number } {
  const conAsistencia = new Set(asistentes.filter((a) => !esSesionDePrueba(a.sesion)).map((a) => a.registro_id));
  const ids = new Set(ponentes.map((r) => r.id));
  return { total: ids.size, sinAsistencia: [...ids].filter((id) => !conAsistencia.has(id)).length };
}

export interface PosibleRepetido {
  nombre: string;
  /** Las filas que se llaman igual: su N.º en la hoja y qué son. */
  filas: { numero: number; perfil: string | null; sinRegistro: boolean; total: number }[];
}

/**
 * El cotejo: quiénes salen más de una vez con el mismo nombre en la hoja y alguno de ellos es ponente. Por su registro no
 * puede haber un ponente repetido (cada registro sale una vez), pero una persona puede estar dos veces con otra identidad:
 * escaneó con un correo que no era el suyo y quedó «sin registro» aparte de su fila de ponente, o se registró dos veces. Se
 * reconoce por el nombre (sin acentos, mayúsculas ni orden). Sólo se avisa: juntarlas es decisión del comité, ligando la
 * asistencia a su registro desde el panel, y la hoja las junta sola cuando eso pasa.
 */
export function posiblesRepetidos(asistentes: readonly FilaDeAsistencia[], ponentes: readonly RegistroDePonente[]): PosibleRepetido[] {
  const grupos = new Map<string, PosibleRepetido>();
  personasDeLaHoja(asistentes, ponentes).forEach((p, i) => {
    const huella = huellaDeNombre(p.nombre);
    if (huella === '') return;
    const grupo = grupos.get(huella) ?? { nombre: p.nombre, filas: [] };
    grupo.filas.push({ numero: i + 1, perfil: p.perfil, sinRegistro: p.sinRegistro, total: p.total });
    grupos.set(huella, grupo);
  });
  return [...grupos.values()].filter((g) => g.filas.length > 1 && g.filas.some((f) => f.perfil === 'ponente'));
}

/**
 * Una celda como texto, para comparar la que se quiere escribir con la que la hoja devuelve: un número vuelve como «1»
 * y una casilla como «TRUE» o «FALSE».
 */
const celdaComoTexto = (valor: unknown) => (typeof valor === 'boolean' ? (valor ? 'TRUE' : 'FALSE') : String(valor ?? '').trim());

export interface PlanDeHoja {
  /** Desde qué fila (de datos, empezando en 0) hay que escribir. */
  desde: number;
  /** Lo que hay que escribir desde ahí: las filas que faltan o que cambiaron. */
  escribir: FilaDeHoja[];
  /** Cuántas filas sobran al final de la hoja y hay que vaciar. */
  sobran: number;
  /** Cuántas de las que ya estaban cambian (se conciliaron o se renumeraron). */
  cambian: number;
  /** Cuántas son nuevas. */
  nuevas: number;
}

/**
 * Qué hay que hacerle a la pestaña para que quede como la base.
 *
 * La pestaña es una copia, así que no hace falta saber qué fila es de qué persona: se compara fila por fila, y desde la
 * primera que difiere se reescribe lo demás. Lo normal —llegan asistencias nuevas— es sólo añadir al final; si alguien suma
 * un día, o el comité concilia o quita una asistencia, se corrige desde ahí. Sólo se miran las columnas propias de la
 * pestaña (`columnas`): lo que alguien anote a la derecha no se toca.
 */
export function planDeHoja(
  deseadas: readonly FilaDeHoja[],
  enLaHoja: readonly (readonly unknown[])[],
  columnas: number = ENCABEZADOS_PERSONAS.length,
): PlanDeHoja {
  const igual = (a: readonly unknown[], b: readonly unknown[]) =>
    Array.from({ length: columnas }).every((_, i) => celdaComoTexto(a[i]) === celdaComoTexto(b[i]));

  let desde = 0;
  while (desde < deseadas.length && desde < enLaHoja.length && igual(deseadas[desde], enLaHoja[desde])) desde += 1;

  const escribir = deseadas.slice(desde) as FilaDeHoja[];
  const yaEstaban = Math.max(0, Math.min(deseadas.length, enLaHoja.length) - desde);
  return {
    desde,
    escribir,
    sobran: Math.max(0, enLaHoja.length - deseadas.length),
    cambian: yaEstaban,
    nuevas: Math.max(0, deseadas.length - Math.max(enLaHoja.length, desde)),
  };
}
