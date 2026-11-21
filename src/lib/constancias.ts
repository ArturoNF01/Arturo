import type { IdiomaEnvio } from '@/lib/comunicados';

/**
 * El envío de constancias: a quién le toca el correo y con qué enlace. Es lógica pura, aparte de la hoja y de Resend, para
 * poder probarla sin mandar nada: un enlace cambiado de persona es la constancia de alguien en la bandeja de otro.
 *
 * Las constancias las genera quien las hace y quedan en la columna «Constancia» de la pestaña «Asistencia por persona» de la hoja de
 * Google, una por fila. Se manda a quien tiene la casilla «Con registro» marcada, un correo y un enlace en esa columna.
 */

/** El título de la columna de la hoja que lleva el enlace. Se busca por su título, no por su letra. */
export const COLUMNA_DE_CONSTANCIA = 'Constancia';

/** A quiénes se manda por separado: las constancias de público general y las de ponentes salen en envíos distintos. */
export type GrupoDeConstancia = 'publico_general' | 'ponente';
export const GRUPOS_DE_CONSTANCIA: readonly GrupoDeConstancia[] = ['publico_general', 'ponente'];

const sinAcentos = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
/**
 * Quienes suben al programa: además de «Ponente», los perfiles con que alguien se registró antes de que quedaran dos (conferencista,
 * coordinador o coordinadora de mesa, moderador o moderadora) y los que se escriban a mano en la hoja con esas palabras («Coordinadora
 * de mesa»). Las constancias de todos ellos salen juntas, con las de ponentes. Un dictaminador no entra: no sube al programa.
 */
const PERFIL_DE_PONENTES = /\b(ponentes?|conferencistas?|coordinador(?:a|es|as)?|moderador(?:a|es|as)?|panelistas?)\b/;

/**
 * El grupo de una fila según su «Perfil» tal como se lee en la hoja: «Público general», o «Ponente» y quienes participan en el programa
 * con otro papel (coordinación de mesa, moderación, conferencia). Nada si no es ninguno: esa fila no entra en ningún envío por grupo,
 * y el panel lo dice.
 */
export function grupoDePerfil(texto: string): GrupoDeConstancia | null {
  const limpio = sinAcentos(texto);
  if (limpio === 'publico general' || limpio === 'publico_general') return 'publico_general';
  return PERFIL_DE_PONENTES.test(limpio) ? 'ponente' : null;
}

/** Una celda de la hoja: lo que se ve y, si la celda es un hipervínculo (una fórmula HYPERLINK, un texto con enlace), a dónde lleva. */
export interface CeldaDeLaHoja {
  texto: string;
  enlace?: string | null;
}

/**
 * El enlace como se manda: sólo https (nada de `javascript:` ni de `http` suelto) y sin espacios. Devuelve nada si no lo es.
 */
export function enlaceHttps(texto: string | null | undefined): string | null {
  const limpio = String(texto ?? '').trim();
  if (limpio === '' || /\s/.test(limpio)) return null;
  try {
    const url = new URL(limpio);
    return url.protocol === 'https:' && url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Convierte el enlace de **ver** un archivo de Google en el de **descargarlo**: lo que la persona espera de un botón «Descargar
 * constancia». Un archivo de Drive (`…/file/d/ID/view`, `…/open?id=ID`) pasa a `uc?export=download&id=ID`, y un documento de Google
 * (Documentos, Presentaciones), a su exportación en PDF. Cualquier otro enlace se deja como está: puede ser un archivo en el sitio del
 * CIESS, y ahí quien lo puso sabe a dónde lleva.
 */
export function enlaceDeDescarga(enlace: string): string {
  const url = enlaceHttps(enlace);
  if (!url) return enlace;
  const u = new URL(url);
  if (u.hostname === 'drive.google.com') {
    const id = /^\/file\/d\/([\w-]+)/.exec(u.pathname)?.[1] ?? u.searchParams.get('id');
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  if (u.hostname === 'docs.google.com') {
    const m = /^\/(document|presentation)\/d\/([\w-]+)/.exec(u.pathname);
    if (m) return m[1] === 'document'
      ? `https://docs.google.com/document/d/${m[2]}/export?format=pdf`
      : `https://docs.google.com/presentation/d/${m[2]}/export/pdf`;
  }
  return url;
}

/** Lo que se escribe entre comillas en un atributo HTML (`href="…"`): el enlace puede traer `&` y, mal puesto, comillas. */
export const escaparAtributo = (texto: string): string =>
  texto.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
// Leer la pestaña
// ---------------------------------------------------------------------------

export interface FilaDeConstancia {
  /** El N.º de la fila en la pestaña. */
  numero: string;
  nombre: string;
  correo: string;
  conRegistro: boolean;
  /** Público general o ponentes, según su «Perfil»; nada si la celda no dice ninguno de los dos. */
  grupo: GrupoDeConstancia | null;
  /** Su «Perfil» tal como está en la hoja (para decir qué perfiles entran en cada grupo). */
  perfil: string;
  /** La «Ponencia» de su fila, si la hoja tiene esa columna: dice de qué participación es la constancia. */
  ponencia: string;
  /** Lo que hay en la columna «Constancia», tal como se ve. */
  texto: string;
  /** El enlace de descarga, si lo que hay es un enlace válido. */
  enlace: string | null;
}

const comoTexto = (celda: CeldaDeLaHoja | undefined) => String(celda?.texto ?? '').trim();

/**
 * Las filas de la pestaña con lo que hace falta para mandar su constancia. La primera fila son los títulos: las columnas se buscan
 * por su título («Nombre», «Correo», «Perfil», «Con registro», «Constancia»), porque quien hace las constancias puede moverlas. Si falta
 * alguna, se dice cuál: no se adivina de dónde sacar un enlace.
 */
export function filasDeConstancias(tabla: readonly (readonly CeldaDeLaHoja[])[]): FilaDeConstancia[] {
  const titulos = (tabla[0] ?? []).map(comoTexto);
  const columna = (titulo: string) => {
    const i = titulos.indexOf(titulo);
    if (i < 0) throw new Error(`La pestaña no tiene la columna «${titulo}»: no se sabe de dónde sacar ese dato.`);
    return i;
  };
  const cNombre = columna('Nombre');
  const cCorreo = columna('Correo');
  const cPerfil = columna('Perfil');
  const cRegistro = columna('Con registro');
  const cConstancia = columna(COLUMNA_DE_CONSTANCIA);
  const cNumero = titulos.indexOf('N.º');
  const cPonencia = titulos.indexOf('Ponencia');

  return tabla.slice(1).flatMap((fila, i) => {
    if (fila.every((c) => comoTexto(c) === '')) return [];
    const celda = fila[cConstancia];
    const texto = comoTexto(celda);
    // El hipervínculo de la celda manda sobre lo que se lee en ella (un nombre de archivo, «Descargar»…).
    const enlace = enlaceHttps(celda?.enlace) ?? enlaceHttps(texto);
    return [{
      numero: cNumero >= 0 ? comoTexto(fila[cNumero]) : String(i + 1),
      nombre: comoTexto(fila[cNombre]),
      correo: comoTexto(fila[cCorreo]).toLowerCase(),
      conRegistro: comoTexto(fila[cRegistro]).toUpperCase() === 'TRUE',
      grupo: grupoDePerfil(comoTexto(fila[cPerfil])),
      perfil: comoTexto(fila[cPerfil]),
      ponencia: cPonencia >= 0 ? comoTexto(fila[cPonencia]) : '',
      texto: texto || String(celda?.enlace ?? '').trim(),
      enlace: enlace ? enlaceDeDescarga(enlace) : null,
    }];
  });
}

// ---------------------------------------------------------------------------
// A quién se manda
// ---------------------------------------------------------------------------

export interface RegistroParaConstancia {
  id: string;
  correo: string;
  idioma: string;
}

export interface DestinatarioDeConstancia {
  correo: string;
  registro_id: string | null;
  idioma: IdiomaEnvio;
  /** Su grupo según la hoja; no se guarda con el envío, sirve para enseñarlo. */
  grupo: GrupoDeConstancia | null;
  /**
   * Lo que se guarda con su envío y se manda: su enlace, el nombre con que se le saluda y su fila. Un ponente con más de una
   * participación tiene una constancia por cada una, y todas van en el mismo correo: la primera en `enlace` y las demás en `otros`;
   * `ponencia` dice de cuál participación es cada una.
   */
  datos: { enlace: string; nombre: string; numero: string; ponencia?: string; otros?: ParticipacionDeConstancia[] };
}

/** Una constancia de una participación: su enlace, su fila y la ponencia que ampara. */
export interface ParticipacionDeConstancia { enlace: string; numero: string; ponencia: string }

/** Cuántas constancias lleva un correo: la suya y las de sus otras participaciones. */
export const constanciasDe = (d: DestinatarioDeConstancia): number => 1 + (d.datos.otros?.length ?? 0);

export interface FaltaConstancia {
  numero: string;
  nombre: string;
  /** Su correo: ayuda a ubicar la fila en la hoja cuando hay nombres parecidos. */
  correo: string;
}

export interface SeleccionDeConstancias {
  destinatarios: DestinatarioDeConstancia[];
  /** Cuántas constancias salen en esos correos (más que los correos si algún ponente tiene dos participaciones), y a cuántas personas les tocan varias. */
  constancias: number;
  conVariasParticipaciones: number;
  /** Cuántas personas llevan un enlace que ya recibieron, y cuántas recibirán uno nuevo después de otro distinto. */
  enlaceNuevo: number;
  excluidos: {
    /** Filas sin la casilla «Con registro»: no reciben constancia. */
    sinRegistro: number;
    /** Con registro y sin nada en «Constancia». */
    sinConstancia: number;
    /** Con registro y algo en «Constancia» que no es un enlace https. */
    enlaceInvalido: number;
    sinCorreo: number;
    /** Un correo que ya salió en una fila de arriba: se manda una sola vez. */
    correoRepetido: number;
    /** Con el mismo enlace, ya se les mandó. */
    yaRecibieron: number;
  };
  porIdioma: Record<IdiomaEnvio, number>;
  /** Quiénes tienen registro y todavía no tienen enlace (para ir a buscarlos), con su fila. */
  faltan: FaltaConstancia[];
  /** Las filas del grupo que no tienen la casilla «Con registro» marcada, con su fila: si deben recibirla, se marca en la hoja. */
  sinRegistroFilas: FaltaConstancia[];
  /** Las filas que tienen enlace pero cuyo correo no es de ningún registro: se les manda en español. */
  sinRegistroDeCorreo: number;
}

const IDIOMAS: readonly IdiomaEnvio[] = ['es', 'en', 'pt'];
const esIdioma = (valor: string): valor is IdiomaEnvio => (IDIOMAS as readonly string[]).includes(valor);
const correoValido = (correo: string) => /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/.test(correo);

/**
 * Las filas de un mismo correo que se mandan juntas: la primera con enlace y, si es de un ponente, también las demás filas de ponente
 * del mismo correo con otro enlace —un ponente con dos participaciones tiene una constancia por participación, y las dos van en el
 * mismo correo—. Con cualquier otro perfil, un correo en dos filas es una persona repetida: sólo cuenta la primera.
 */
const sumarParticipacion = (previas: FilaDeConstancia[], f: FilaDeConstancia): boolean => {
  if (previas[0].grupo !== 'ponente' || f.grupo !== 'ponente') return false;
  return !previas.some((x) => x.enlace === f.enlace);
};

const participacionDe = (f: FilaDeConstancia): ParticipacionDeConstancia => ({ enlace: f.enlace ?? '', numero: f.numero, ponencia: f.ponencia });

/**
 * El destinatario de un correo a partir de las constancias que le tocan ahora (las filas con su enlace, la primera es la principal).
 * Con una sola, el correo es el de siempre; con varias, las demás van en `otros` y cada una lleva su ponencia, para rotular su botón.
 */
function destinatarioDe(
  correo: string, filas: readonly FilaDeConstancia[], registro: RegistroParaConstancia | undefined,
): DestinatarioDeConstancia {
  const [primera, ...resto] = filas;
  const idioma: IdiomaEnvio = registro && esIdioma(registro.idioma) ? registro.idioma : 'es';
  return {
    correo,
    registro_id: registro?.id ?? null,
    idioma,
    grupo: primera.grupo,
    datos: {
      enlace: primera.enlace ?? '', nombre: primera.nombre, numero: primera.numero,
      ...(resto.length > 0 ? { ponencia: primera.ponencia, otros: resto.map(participacionDe) } : {}),
    },
  };
}

/**
 * A quién le toca su constancia ahora. Cada persona, un solo correo: por su correo, y con el enlace de su propia fila.
 *
 *  - Sin la casilla «Con registro» no hay constancia, aunque haya un enlace.
 *  - Quien ya la recibió con el mismo enlace queda fuera: repetir el envío sólo alcanza a quienes faltan. Si el enlace cambió
 *    (se corrigió una constancia), sí se manda otra vez, y se cuenta aparte para que quien envía lo sepa.
 *  - Cada quien la recibe en el idioma con que se registró; quien no está registrado con ese correo, en español.
 *  - Con `grupo`, sólo se cuentan y se eligen las filas de ese grupo (público general o ponentes). Un correo que sale en dos filas,
 *    aunque sean de grupos distintos, es una sola persona: se manda una sola vez, con la primera fila que tenga enlace.
 *  - Excepción: un ponente que sale en dos filas de ponente con enlaces distintos (dos participaciones, una constancia por cada una)
 *    recibe un solo correo con sus dos constancias. Si ya recibió una, el correo lleva sólo la que le falta.
 */
export function elegirDestinatariosDeConstancias({
  filas, registros, yaEnviadas, grupo,
}: {
  filas: readonly FilaDeConstancia[];
  registros: readonly RegistroParaConstancia[];
  /** Los enlaces que ya se mandaron, por correo (en minúsculas). */
  yaEnviadas: ReadonlyMap<string, ReadonlySet<string>>;
  /** Sólo este grupo; sin él, todos (cualquiera que sea su perfil). */
  grupo?: GrupoDeConstancia;
}): SeleccionDeConstancias {
  const registroPorCorreo = new Map<string, RegistroParaConstancia>();
  for (const r of registros) registroPorCorreo.set(r.correo.trim().toLowerCase(), r);

  const excluidos = { sinRegistro: 0, sinConstancia: 0, enlaceInvalido: 0, sinCorreo: 0, correoRepetido: 0, yaRecibieron: 0 };
  const porIdioma: Record<IdiomaEnvio, number> = { es: 0, en: 0, pt: 0 };
  const destinatarios: DestinatarioDeConstancia[] = [];
  const faltan: FaltaConstancia[] = [];
  const sinRegistroFilas: FaltaConstancia[] = [];
  // Las filas de cada correo, en el orden en que aparecen: la primera con enlace y, si son de ponente, sus otras participaciones.
  const porCorreo = new Map<string, FilaDeConstancia[]>();
  let enlaceNuevo = 0;
  let sinRegistroDeCorreo = 0;

  for (const f of filas) {
    // Las filas de otro grupo no se cuentan, pero sí cuentan para saber si un correo ya salió: es una persona, no una fila.
    const delGrupo = grupo === undefined || f.grupo === grupo;
    const contar = (motivo: keyof typeof excluidos) => { if (delGrupo) excluidos[motivo] += 1; };
    if (!f.conRegistro) {
      contar('sinRegistro');
      if (delGrupo) sinRegistroFilas.push({ numero: f.numero, nombre: f.nombre, correo: f.correo });
      continue;
    }
    if (!f.enlace) {
      if (!delGrupo) continue;
      if (f.texto === '') { excluidos.sinConstancia += 1; faltan.push({ numero: f.numero, nombre: f.nombre, correo: f.correo }); }
      else excluidos.enlaceInvalido += 1;
      continue;
    }
    if (!correoValido(f.correo)) { contar('sinCorreo'); continue; }
    const previas = porCorreo.get(f.correo);
    if (!previas) { porCorreo.set(f.correo, [f]); continue; }
    if (sumarParticipacion(previas, f)) previas.push(f);
    else contar('correoRepetido');
  }

  for (const [correo, suyas] of porCorreo) {
    if (grupo !== undefined && suyas[0].grupo !== grupo) continue;
    const antes = yaEnviadas.get(correo);
    const pendientes = suyas.filter((x) => !antes?.has(x.enlace ?? ''));
    if (pendientes.length === 0) { excluidos.yaRecibieron += 1; continue; }
    // «Enlace nuevo» es que una constancia ya enviada cambió de enlace; que le falte la de otra participación no lo es.
    if (antes && [...antes].some((e) => !suyas.some((x) => x.enlace === e))) enlaceNuevo += 1;

    const registro = registroPorCorreo.get(correo);
    if (!registro) sinRegistroDeCorreo += 1;
    const d = destinatarioDe(correo, pendientes, registro);
    porIdioma[d.idioma] += 1;
    destinatarios.push(d);
  }
  return {
    destinatarios,
    constancias: destinatarios.reduce((n, d) => n + constanciasDe(d), 0),
    conVariasParticipaciones: destinatarios.filter((d) => constanciasDe(d) > 1).length,
    enlaceNuevo, excluidos, porIdioma, faltan, sinRegistroFilas, sinRegistroDeCorreo,
  };
}

// ---------------------------------------------------------------------------
// Una lista de personas
// ---------------------------------------------------------------------------

/** A quiénes sale un envío: a un grupo, a una lista de correos o (sólo para quien lo pida por código) a todos los que tienen enlace. */
export type AlcanceDeConstancias =
  | { tipo: 'todos' }
  | { tipo: 'grupo'; grupo: GrupoDeConstancia }
  | { tipo: 'lista'; correos: readonly string[]; reenviar: boolean };

/** Cuántos correos admite una lista: para un par de personas o para un puñado; más se manda por grupo. */
export const MAXIMO_DE_LA_LISTA = 200;

const CORREO_EN_UN_TEXTO = /[^\s<>,;"'()[\]]+@[^\s<>,;"'()[\]]+/g;

/**
 * Los correos de lo que se pegó o escribió: separados por comas, punto y coma, saltos de línea o espacios, o dentro de un
 * «Nombre <correo@dominio>». En minúsculas y sin repetir, en el orden en que se escribieron. Un pedazo que no trae ningún correo
 * se conserva tal cual para decirlo («no es un correo»), no se descarta en silencio.
 */
export function correosDeUnTexto(texto: string): string[] {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  const poner = (valor: string) => {
    if (valor !== '' && !vistos.has(valor)) { vistos.add(valor); resultado.push(valor); }
  };
  for (const pedazo of texto.split(/[\n;,]+/)) {
    const hallados = pedazo.match(CORREO_EN_UN_TEXTO);
    if (hallados) for (const h of hallados) poner(h.toLowerCase().replace(/[.:]+$/, ''));
    else poner(pedazo.trim().slice(0, 80));
  }
  return resultado;
}

/** Qué pasa con cada correo de una lista. */
export type EstadoDeCorreo =
  | 'enviar'
  | 'yaRecibio'
  | 'sinRegistro'
  | 'sinConstancia'
  | 'enlaceInvalido'
  | 'noEstaEnLaHoja'
  | 'correoInvalido';

export interface VerificacionDeCorreo {
  correo: string;
  estado: EstadoDeCorreo;
  /** De su fila en la hoja, si está. */
  numero?: string;
  nombre?: string;
  grupo?: GrupoDeConstancia | null;
  /** Sólo con `enviar`: ya la había recibido con este mismo enlace y se vuelve a mandar porque se pidió. */
  reenvio?: boolean;
  /** Sólo con `enviar`: cuántas constancias lleva su correo (más de una si es un ponente con varias participaciones). */
  constancias?: number;
}

export interface SeleccionDeLista {
  verificacion: VerificacionDeCorreo[];
  destinatarios: DestinatarioDeConstancia[];
  /** Cuántos recibirán otra vez el mismo enlace (se pidió reenviar), y cuántos recibirán uno nuevo después de otro distinto. */
  reenvios: number;
  enlaceNuevo: number;
  porIdioma: Record<IdiomaEnvio, number>;
}

/**
 * Comprueba, correo por correo, que a cada persona de la lista le toca su constancia: que esté en la hoja, con «Con registro»
 * marcado y un enlace válido en «Constancia». A quien no, se le dice por qué, y no se le manda nada. Quien ya la recibió con el
 * mismo enlace queda fuera, salvo que se pida `reenviar` (alguien que la perdió o no le llegó).
 *
 * Es la misma regla que la del envío por grupo: el mismo enlace de su fila, el mismo idioma. Un correo que sale en dos filas usa
 * la primera con registro y enlace válido.
 */
export function elegirDeUnaLista({
  correos, filas, registros, yaEnviadas, reenviar = false,
}: {
  correos: readonly string[];
  filas: readonly FilaDeConstancia[];
  registros: readonly RegistroParaConstancia[];
  yaEnviadas: ReadonlyMap<string, ReadonlySet<string>>;
  reenviar?: boolean;
}): SeleccionDeLista {
  const registroPorCorreo = new Map<string, RegistroParaConstancia>();
  for (const r of registros) registroPorCorreo.set(r.correo.trim().toLowerCase(), r);

  const verificacion: VerificacionDeCorreo[] = [];
  const destinatarios: DestinatarioDeConstancia[] = [];
  const porIdioma: Record<IdiomaEnvio, number> = { es: 0, en: 0, pt: 0 };
  let reenvios = 0;
  let enlaceNuevo = 0;

  for (const correo of correos) {
    if (!correoValido(correo)) { verificacion.push({ correo, estado: 'correoInvalido' }); continue; }
    const suyas = filas.filter((f) => f.correo === correo);
    if (suyas.length === 0) { verificacion.push({ correo, estado: 'noEstaEnLaHoja' }); continue; }
    const conRegistro = suyas.filter((f) => f.conRegistro);
    const datosDe = (f: FilaDeConstancia) => ({ numero: f.numero, nombre: f.nombre, grupo: f.grupo });
    if (conRegistro.length === 0) { verificacion.push({ correo, estado: 'sinRegistro', ...datosDe(suyas[0]) }); continue; }
    // Sus constancias: la de la primera fila con enlace y, si es ponente, la de cada una de sus otras participaciones.
    const suyasConEnlace: FilaDeConstancia[] = [];
    for (const f of conRegistro) {
      if (!f.enlace) continue;
      if (suyasConEnlace.length === 0 || sumarParticipacion(suyasConEnlace, f)) suyasConEnlace.push(f);
    }
    if (suyasConEnlace.length === 0) {
      const conAlgo = conRegistro.some((f) => f.texto !== '');
      verificacion.push({ correo, estado: conAlgo ? 'enlaceInvalido' : 'sinConstancia', ...datosDe(conRegistro[0]) });
      continue;
    }

    const antes = yaEnviadas.get(correo);
    const pendientes = suyasConEnlace.filter((x) => !antes?.has(x.enlace ?? ''));
    // Con «reenviar», todas sus constancias salen otra vez, aunque ya las tenga.
    const aMandar = reenviar ? suyasConEnlace : pendientes;
    if (aMandar.length === 0) { verificacion.push({ correo, estado: 'yaRecibio', ...datosDe(suyasConEnlace[0]) }); continue; }
    const reenvio = reenviar && pendientes.length < suyasConEnlace.length;
    if (reenvio) reenvios += 1;
    if (antes && [...antes].some((e) => !suyasConEnlace.some((x) => x.enlace === e))) enlaceNuevo += 1;

    const d = destinatarioDe(correo, aMandar, registroPorCorreo.get(correo));
    porIdioma[d.idioma] += 1;
    verificacion.push({ correo, estado: 'enviar', ...datosDe(aMandar[0]), constancias: constanciasDe(d), ...(reenvio ? { reenvio: true } : {}) });
    destinatarios.push(d);
  }
  return { verificacion, destinatarios, reenvios, enlaceNuevo, porIdioma };
}
