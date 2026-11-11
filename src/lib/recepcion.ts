/**
 * Lo que enseña la pantalla de recepción (`/qr`) además de los QR: qué está pasando en el Congreso en este momento y qué
 * sigue. Sale de la agenda (`programa.ts`), no de nada que haya que teclear: si el comité corrige un horario o una sala
 * en la agenda, la pantalla lo recoge sola.
 *
 * Es lógica pura —no lee el reloj: recibe la hora— para poder probarla con cualquier instante. La pantalla le pasa la
 * hora del servidor corregida, de modo que un monitor con el reloj desajustado no cambia lo que se ve.
 *
 * Lo que la agenda no sabe es si una sesión se retrasó. Para eso está el aviso: un mensaje que el comité escribe en el
 * panel y que la pantalla enseña en los tres idiomas (`avisoDeRecepcion`).
 */
import type { Idioma } from '@/i18n';
import { horasDelHorario, instanteEnMexico } from '@/lib/asistencia';
import { HUSO_CONGRESO } from '@/lib/fechas';
import { MESA_POR_NUMERO, PROGRAMA, SALAS, TEXTOS_PROGRAMA, type DiaPrograma } from '@/lib/programa';
import type { RelacionConHoy } from '@/lib/asistencia';

export type Texto = Record<Idioma, string>;

const IDIOMAS: readonly Idioma[] = ['es', 'en', 'pt'];

const t = (es: string, en: string, pt: string): Texto => ({ es, en, pt });
const porIdioma = (f: (idioma: Idioma) => string): Texto => ({ es: f('es'), en: f('en'), pt: f('pt') });

// ---------------------------------------------------------------------------
// La agenda de un día, lista para la pantalla
// ---------------------------------------------------------------------------

/**
 * `sesion`: lo que se sigue en una sala (la apertura, una mesa, una conferencia, la clausura). `registro`: el trámite en
 * la entrada. `receso`: el almuerzo. La pantalla las trata distinto: sólo lo primero está «en vivo».
 */
export type NaturalezaDeBloque = 'sesion' | 'registro' | 'receso';

export interface BloqueDeAgenda {
  /** 'registro', 'apertura', 'mesa-4'… Estable: sirve de llave. */
  clave: string;
  naturaleza: NaturalezaDeBloque;
  /** El instante en que empieza y en que termina, en ISO (UTC): viajan como texto de la página al navegador. */
  inicio: string;
  fin: string;
  /** '15:30–17:30', tal como está en la agenda. */
  horario: string;
  /** Lo que se lee grande: el título de la mesa, el de la conferencia, «Registro de participantes»… */
  titulo: Texto;
  /** Lo que va encima, chico: «Mesa temática 4», «Conferencia magistral». */
  etiqueta: Texto | null;
  /** Cómo se nombra en una lista corta: la etiqueta si la tiene (una mesa) y si no, el título. */
  corto: Texto;
  /** Quien da la conferencia magistral. */
  ponente: string | null;
  /** La sala con su planta: «Sala de comisiones, planta baja». Sin sala, el almuerzo. */
  sala: Texto | null;
}

export function bloquesDelDia(dia: DiaPrograma): BloqueDeAgenda[] {
  const salida: BloqueDeAgenda[] = [];
  for (const s of dia.sesiones) {
    const horas = horasDelHorario(s.horario);
    if (!horas) continue;

    const mesa = s.tipo === 'mesa' && s.mesa !== undefined ? MESA_POR_NUMERO.get(s.mesa) : undefined;
    let etiqueta: Texto | null = null;
    let titulo: Texto = s.actividad ?? t('', '', '');
    if (s.tipo === 'mesa' && s.mesa !== undefined) {
      etiqueta = porIdioma((i) => `${TEXTOS_PROGRAMA[i].mesa} ${s.mesa}`);
      titulo = mesa?.titulo ?? etiqueta;
    } else if (s.tipo === 'conferencia') {
      etiqueta = porIdioma((i) => TEXTOS_PROGRAMA[i].conferencia);
    }

    salida.push({
      clave: s.tipo === 'mesa' ? `mesa-${s.mesa}` : s.tipo === 'trabajo' ? `trabajo-${horas.desde}` : s.tipo,
      naturaleza: s.tipo === 'registro' ? 'registro' : s.tipo === 'pausa' ? 'receso' : 'sesion',
      inicio: instanteEnMexico(dia.iso, horas.desde).toISOString(),
      fin: instanteEnMexico(dia.iso, horas.hasta).toISOString(),
      horario: s.horario,
      titulo,
      etiqueta,
      corto: etiqueta ?? titulo,
      ponente: s.ponente?.nombre ?? null,
      sala: s.sala ? SALAS[s.sala] : null,
    });
  }
  // Por hora y, a la misma hora, por número de mesa: la 3 antes que la 4.
  return salida.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.clave.localeCompare(b.clave, 'es', { numeric: true }));
}

// ---------------------------------------------------------------------------
// Qué pasa ahora y qué sigue
// ---------------------------------------------------------------------------

/**
 * `antes`: el día no ha empezado. `en_curso`: hay algo en marcha. `receso`: el almuerzo (o un hueco entre sesiones).
 * `despues`: el día ya terminó.
 */
export type FaseDelDia = 'antes' | 'en_curso' | 'receso' | 'despues';

export interface MomentoDelDia {
  fase: FaseDelDia;
  /**
   * Lo que ocurre ahora. En `en_curso`, las sesiones en marcha —dos a la vez cuando hay dos salas— o el registro; en
   * `receso`, el receso. Vacío en `antes` y `despues`.
   */
  actuales: BloqueDeAgenda[];
  /** Lo que sigue: todo lo que empieza en el próximo instante en que algo empieza (las dos salas juntas). */
  siguientes: BloqueDeAgenda[];
}

const ms = (iso: string) => Date.parse(iso);

export function momentoDelDia(bloques: readonly BloqueDeAgenda[], ahora: number): MomentoDelDia {
  const enMarcha = bloques.filter((b) => ms(b.inicio) <= ahora && ahora < ms(b.fin));
  const futuros = bloques.filter((b) => ms(b.inicio) > ahora);
  const proximo = futuros.length ? Math.min(...futuros.map((b) => ms(b.inicio))) : null;
  const siguientes = proximo === null ? [] : futuros.filter((b) => ms(b.inicio) === proximo);

  const vivos = enMarcha.filter((b) => b.naturaleza !== 'receso');
  if (vivos.length > 0) return { fase: 'en_curso', actuales: vivos, siguientes };

  const receso = enMarcha.filter((b) => b.naturaleza === 'receso');
  if (receso.length > 0) return { fase: 'receso', actuales: receso, siguientes };

  if (bloques.length === 0) return { fase: 'despues', actuales: [], siguientes: [] };
  if (ahora < Math.min(...bloques.map((b) => ms(b.inicio)))) return { fase: 'antes', actuales: [], siguientes };
  if (ahora >= Math.max(...bloques.map((b) => ms(b.fin)))) return { fase: 'despues', actuales: [], siguientes: [] };
  // Un hueco entre dos sesiones: no lo hay en el programa de hoy, pero si el comité lo deja, se dice «receso».
  return { fase: 'receso', actuales: [], siguientes };
}

/** Cuánto lleva de su duración un bloque, de 0 a 1. */
export function avance(bloque: Pick<BloqueDeAgenda, 'inicio' | 'fin'>, ahora: number): number {
  const total = ms(bloque.fin) - ms(bloque.inicio);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (ahora - ms(bloque.inicio)) / total));
}

/** Minutos que faltan para un instante, redondeados hacia arriba: a 30 segundos todavía son «1 min». */
export function minutosPara(instante: string, ahora: number): number {
  return Math.max(0, Math.ceil((ms(instante) - ahora) / 60_000));
}

/** «45 min», «1 h 20 min», «2 h». */
export function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const formatoHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: HUSO_CONGRESO });

/** «09:30» en hora de la Ciudad de México. */
export function horaDeMexico(instante: number | string | Date): string {
  return formatoHora.format(typeof instante === 'string' ? new Date(instante) : instante);
}

// ---------------------------------------------------------------------------
// La agenda del día que se enseña, con su «mañana»
// ---------------------------------------------------------------------------

export interface ProgramaDePantalla {
  dia: Texto;
  relacion: RelacionConHoy;
  bloques: BloqueDeAgenda[];
  /** Lo primero que pasa el día siguiente, para cuando el de hoy ya terminó. Nulo el último día. */
  manana: { dia: Texto; bloque: BloqueDeAgenda } | null;
}

export function programaDeLaPantalla(dia: string, relacion: RelacionConHoy): ProgramaDePantalla | null {
  const indice = PROGRAMA.findIndex((d) => d.iso === dia);
  if (indice < 0) return null;
  const siguienteDia = PROGRAMA[indice + 1];
  const primero = siguienteDia ? bloquesDelDia(siguienteDia)[0] : undefined;
  return {
    dia: PROGRAMA[indice].fecha,
    relacion,
    bloques: bloquesDelDia(PROGRAMA[indice]),
    manana: siguienteDia && primero ? { dia: siguienteDia.fecha, bloque: primero } : null,
  };
}

// ---------------------------------------------------------------------------
// Lo que la página le da a la pantalla
// ---------------------------------------------------------------------------

/**
 * Todo lo que necesita la pantalla de recepción, como texto plano: lo arma el servidor (`armarDatosDePantalla`), viaja
 * por `/api/recepcion` cada minuto y la pantalla lo pinta. Cabe en JSON a propósito.
 */
export interface DatosDePantalla {
  /** El instante del servidor al armarlo: el reloj del monitor puede estar mal; el del servidor no. */
  ahora: string;
  /** Identifica la compilación del servidor: si cambia, la pantalla se recarga para recoger el código nuevo. */
  version: string;
  /** `?ligero=1`: sin video, sin desenfoque y sin luces, para un equipo que no puede con tanto efecto. */
  ligero: boolean;
  urlVideo: string;
  nombre: Partial<Texto>;
  /** Fechas y sede ya no se enseñan en la pantalla; se siguen mandando para no romper una pantalla abierta con la versión anterior. */
  fechas: Partial<Texto>;
  sede: Partial<Texto>;
  /** SVG del QR de la agenda del sitio; nulo si el comité aún no da el programa por publicado. */
  qrAgenda: string | null;
  asistencia: {
    /** SVG del QR presencial del día, o null si todavía no hay código. */
    qr: string | null;
    dia: Texto;
    relacion: RelacionConHoy;
    abre: string;
    cierra: string;
    previa: boolean;
  } | null;
  /** La agenda del día para «En vivo ahora»; nula si el programa no está publicado. */
  programa: ProgramaDePantalla | null;
  /** El aviso del comité, ya con los tres idiomas; nulo si no hay. */
  aviso: Texto | null;
}

// ---------------------------------------------------------------------------
// El aviso que el comité escribe en el panel
// ---------------------------------------------------------------------------

/**
 * Lo más largo que puede ser un aviso: se lee de lejos y cabe en tres renglones de la pantalla. Más largo se cortaría a mitad
 * de una frase, y un aviso cortado es peor que uno corto.
 */
export const LARGO_MAXIMO_DE_AVISO = 140;

const recortar = (valor: unknown): string => (typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim().slice(0, LARGO_MAXIMO_DE_AVISO) : '');

/** Lo que hay guardado, con los tres idiomas presentes (vacíos si no hay nada). Es lo que edita el panel. */
export function avisoGuardado(valor: unknown): Texto {
  const bruto = valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : {};
  return t(recortar(bruto.es), recortar(bruto.en), recortar(bruto.pt));
}

/**
 * Lo que enseña la pantalla: nulo si no hay aviso; si falta un idioma, se usa el español (o, si ése falta, el primero
 * que haya): mejor un aviso en otro idioma que ninguno.
 */
export function avisoDeRecepcion(valor: unknown): Texto | null {
  const guardado = avisoGuardado(valor);
  const base = guardado.es || guardado.en || guardado.pt;
  if (!base) return null;
  return porIdioma((i) => guardado[i] || base);
}

// ---------------------------------------------------------------------------
// Los textos de la pantalla
// ---------------------------------------------------------------------------

/** Todo lo que dice la pantalla, en los tres idiomas. Los que llevan un dato son funciones. */
export const TEXTOS_RECEPCION = {
  agendaTitulo: t('Ver agenda', 'View agenda', 'Ver agenda'),
  agendaAyuda: t(
    'Escanea y consulta salas y horarios',
    'Scan to see rooms and times',
    'Escaneie e consulte salas e horários',
  ),
  // La pantalla no es táctil: el idioma de la agenda no se elige aquí, se cambia en el sitio, desde el celular.
  agendaIdioma: t(
    'En el sitio puedes cambiar el idioma',
    'On the site you can change the language',
    'No site você pode mudar o idioma',
  ),
  asistenciaTitulo: t('Registra tu asistencia', 'Check in', 'Registre sua presença'),
  asistenciaAyuda: t(
    'Escanea con tu cámara y escribe tu correo',
    'Scan with your camera and enter your email',
    'Escaneie com a câmera e informe seu e-mail',
  ),
  constancia: t(
    'Tu asistencia de cada día cuenta para la constancia (mínimo 80 %)',
    'Each day’s attendance counts toward your certificate (minimum 80%)',
    'A presença de cada dia conta para o certificado (mínimo de 80%)',
  ),
  sinCodigo: t('Código no disponible', 'Code not available', 'Código indisponível'),
  reconectando: t('Reconectando…', 'Reconnecting…', 'Reconectando…'),

  // El estado del registro de asistencia
  registroAbierto: (hasta: string) =>
    t(`Registro abierto hasta las ${hasta}`, `Check-in open until ${hasta}`, `Registro aberto até às ${hasta}`),
  registroAbre: (hora: string) => t(`Abre a las ${hora}`, `Opens at ${hora}`, `Abre às ${hora}`),
  registroDisponible: (dia: Texto) =>
    t(`Disponible el ${dia.es}`, `Available ${dia.en}`, `Disponível ${dia.pt}`),
  registroCerrado: t('Registro cerrado por hoy', 'Check-in closed for today', 'Registro encerrado por hoje'),
  gracias: t('Gracias por acompañarnos', 'Thank you for joining us', 'Obrigado por nos acompanhar'),

  // «En vivo»
  enVivo: t('En vivo ahora', 'Live now', 'Ao vivo agora'),
  ahora: t('Ahora', 'Now', 'Agora'),
  receso: t('Receso', 'Break', 'Intervalo'),
  proximamente: t('Próximamente', 'Coming up', 'Em breve'),
  hastaManana: t('Hasta mañana', 'See you tomorrow', 'Até amanhã'),
  hastaPronto: t('Hasta pronto', 'See you soon', 'Até breve'),
  manana: t('Mañana', 'Tomorrow', 'Amanhã'),
  aContinuacion: t('A continuación', 'Up next', 'A seguir'),
  hoyIniciamos: (hora: string) => t(`Hoy iniciamos a las ${hora}`, `We start today at ${hora}`, `Começamos hoje às ${hora}`),
  iniciaElDia: (dia: Texto, hora: string) => t(`${dia.es} · ${hora}`, `${dia.en} · ${hora}`, `${dia.pt} · ${hora}`),
  mananaA: (hora: string) => t(`Mañana a las ${hora}`, `Tomorrow at ${hora}`, `Amanhã às ${hora}`),
  regresamos: (hora: string) => t(`Regresamos a las ${hora}`, `Back at ${hora}`, `Voltamos às ${hora}`),
  quedan: (minutos: number) => {
    const d = duracion(minutos);
    return t(`Quedan ${d}`, `${d} left`, `Faltam ${d}`);
  },
  en: (minutos: number) => {
    const d = duracion(minutos);
    return t(`en ${d}`, `in ${d}`, `em ${d}`);
  },
  ponente: t('Ponente', 'Speaker', 'Palestrante'),
  aviso: t('Aviso', 'Notice', 'Aviso'),
};

/**
 * A dónde llevan los dos QR de la pantalla.
 *
 * El de la agenda va a la agenda del sitio (la sección «Ver agenda», que se abre en el día de hoy y deja cambiar de
 * idioma) y no al PDF: el PDF es un solo idioma y un archivo que se baja; la sección es la versión vigente.
 * El de asistencia, al código presencial del día.
 */
export function enlacesDeRecepcion(base: string, codigoPresencial: string | null): { agenda: string; asistencia: string | null } {
  const raiz = base.replace(/\/+$/, '');
  return { agenda: `${raiz}/#agenda`, asistencia: codigoPresencial ? `${raiz}/a/${codigoPresencial}` : null };
}

/** Dos textos en uno, «A · B», idioma por idioma: la sala junto a la sesión en las listas cortas. */
export function unir(a: Texto, b: Texto | null, separador = ' · '): Texto {
  return b ? porIdioma((i) => `${a[i]}${separador}${b[i]}`) : a;
}

export const TODOS_LOS_IDIOMAS = IDIOMAS;
