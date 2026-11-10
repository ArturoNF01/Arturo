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
import { HUSO_CONGRESO } from '@/lib/fechas';
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

function horasDelHorario(horario: string): { desde: string; hasta: string } | null {
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
 * La sesión de prueba: para que el comité vea cómo se captura una asistencia —en el celular, en el panel y en
 * la hoja— antes del Congreso. No es de la agenda: está siempre abierta, sólo existe mientras alguien del
 * panel la activa (sus códigos se crean entonces y se borran al borrar la prueba), no cuenta para la
 * asistencia de nadie (`agruparPorPersona` la deja fuera) y se quita con un clic.
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
  /** Cuántas sesiones, en total y por día ('2026-11-12' → 3). */
  total: number;
  porDia: Record<string, number>;
  sesiones: { sesion: string; via: ViaAsistencia; creada_en: string }[];
}

/**
 * La asistencia vista por persona: una fila por quien asistió a algo, con cuántas sesiones y a
 * cuáles. Quien está «sin registro» se agrupa por su correo, para que dos escaneos suyos sean una
 * sola persona. Primero quien más sesiones suma, y a igualdad, por nombre.
 */
export function agruparPorPersona(filas: readonly FilaDeAsistencia[]): PersonaConAsistencia[] {
  const personas = new Map<string, PersonaConAsistencia>();
  for (const f of filas) {
    // La sesión de prueba no cuenta para la asistencia de nadie.
    if (esSesionDePrueba(f.sesion)) continue;
    const clave = f.registro_id ?? `correo:${f.correo.toLowerCase()}`;
    let p = personas.get(clave);
    if (!p) {
      p = {
        clave, registroId: f.registro_id, nombre: f.nombre, correo: f.correo, perfil: f.perfil, folio: f.folio,
        sinRegistro: f.registro_id === null, total: 0, porDia: {}, sesiones: [],
      };
      personas.set(clave, p);
    }
    p.total += 1;
    const dia = sesionPorClave(f.sesion)?.dia;
    if (dia) p.porDia[dia] = (p.porDia[dia] ?? 0) + 1;
    p.sesiones.push({ sesion: f.sesion, via: f.via, creada_en: f.creada_en });
  }
  return [...personas.values()].sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));
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
// La pestaña «Asistencias» de la hoja de Google
// ---------------------------------------------------------------------------

export const HOJA_ASISTENCIAS = 'Asistencias';

/**
 * Lo que se pidió —nombre, correo y día—, más el número de orden, como las demás pestañas, y la modalidad
 * (presencial o en línea). La columna «Mesa» se quitó: con un QR por día ya no se sabe a qué mesa fue cada quien.
 */
export const ENCABEZADOS_ASISTENCIAS = ['N.º', 'Nombre', 'Correo', 'Día', 'Modalidad'] as const;

/**
 * Los títulos que tuvo la pestaña cuando la asistencia era por mesa (con una columna «Mesa»). Sirven para
 * reconocerla y rehacerla con el diseño de ahora: una asistencia por día ya no tiene mesa.
 */
export const ENCABEZADOS_ANTERIORES = ['N.º', 'Nombre', 'Correo', 'Día', 'Mesa', 'Modalidad'] as const;

export type FilaDeHoja = (string | number)[];

/**
 * Las filas que debe tener la pestaña, en orden de llegada y con el N.º seguido (1, 2, 3…), igual que
 * las demás: una asistencia quitada no deja un hueco en la numeración.
 */
export function filasDeAsistencias(
  asistentes: readonly Pick<FilaDeAsistencia, 'sesion' | 'via' | 'nombre' | 'correo'>[],
): FilaDeHoja[] {
  return asistentes.map((a, i) => [
    i + 1,
    a.nombre,
    a.correo,
    diaDeClave(a.sesion, 'es'),
    a.via === 'presencial' ? 'Presencial' : 'En línea',
  ]);
}

const celdaComoTexto = (valor: unknown) => String(valor ?? '').trim();

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
 * La pestaña es una copia, así que no hace falta saber qué fila es de qué asistencia: se compara fila
 * por fila, y desde la primera que difiere se reescribe lo demás. Lo normal —llegan asistencias nuevas—
 * es sólo añadir al final; si el comité concilia o quita una a mitad de lista, se corrige desde ahí.
 * Sólo se miran las seis columnas propias: lo que alguien anote a la derecha no se toca.
 */
export function planDeHoja(deseadas: readonly FilaDeHoja[], enLaHoja: readonly (readonly unknown[])[]): PlanDeHoja {
  const columnas = ENCABEZADOS_ASISTENCIAS.length;
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
