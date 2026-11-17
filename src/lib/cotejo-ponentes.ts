import { normalizarTexto } from '@/lib/asistencia';
import { calzaNombre, type Calce } from '@/lib/ponentes';
import { PAISES, type Mesa } from '@/lib/programa';

/**
 * El cotejo de los ponentes: quién figura en la agenda del Congreso y cómo está registrado.
 *
 * Los autores de las ponencias del programa (`MESAS`, verificado contra el PDF de la agenda) se buscan entre los registros por
 * su nombre —con las reglas prudentes de `ponentes.ts`: un registro dudoso se deja para que lo decida una persona— y a cada uno
 * le toca una de estas cosas (`ResultadoDeCotejo`):
 *  - ya es ponente;
 *  - se registró como **público general**: es el caso que se corrige, pasándolo a ponente (`cambios`);
 *  - se registró con otro perfil (conferencista, moderador…): se dice, y no se cambia, porque perdería ese otro papel;
 *  - su registro está cancelado;
 *  - podría ser más de un registro y no se puede elegir: se enseñan los candidatos;
 *  - no está registrado.
 * Y al revés: los registros de ponente que no corresponden a ningún autor de la agenda (`soloRegistrados`), con la ponencia de la
 * agenda a la que se parece su título, si la hay: puede ser un coautor, o alguien que escribió su nombre de otro modo.
 *
 * Se cotejan también los temas: el título que cada quien puso al registrarse contra el que lleva su ponencia en la agenda.
 */

export interface RegistroParaCotejo {
  id: string;
  folio: string;
  /** Nombres y apellidos, como se leen. */
  nombre: string;
  correo: string;
  perfil: string;
  estado: string;
  titulo_ponencia: string | null;
  eje_tematico: string | null;
}

export const PERFIL_DE_PONENTE = 'ponente';
/**
 * Los perfiles que se cambian a «ponente» al cotejar: sólo quien se registró como público general. Quien tiene otro perfil
 * (conferencista, coordinador, moderador, dictaminador) tiene también otro papel en el Congreso, y un registro lleva un solo perfil.
 */
export const PERFILES_QUE_SE_CAMBIAN: readonly string[] = ['publico_general'];

export type ResultadoDeCotejo = 'ya_ponente' | 'cambiar' | 'otro_perfil' | 'cancelado' | 'dudoso' | 'sin_registro';
export type CoincidenciaDeTitulo = 'si' | 'parecido' | 'no' | 'sin_titulo';

/** Una fila por cada autor de cada ponencia de la agenda (un autor con dos ponencias sale dos veces). */
export interface FilaDeCotejo {
  mesa: number;
  ponencia: string;
  autor: string;
  pais: string;
  participacion: string;
  resultado: ResultadoDeCotejo;
  /** El registro que se reconoció, si se reconoció uno. */
  registro: RegistroParaCotejo | null;
  calce: Calce | null;
  /** Si hay varios registros posibles y no se puede elegir, cuáles. */
  candidatos: RegistroParaCotejo[];
  /** El título que puso en su registro frente al de la agenda; nada si no hay registro. */
  titulo: CoincidenciaDeTitulo | null;
  /** Otros registros de la misma persona (un duplicado), si los hay. */
  otros: RegistroParaCotejo[];
}

export interface SoloRegistrado {
  registro: RegistroParaCotejo;
  /** Ponencias de la agenda a las que se parece el título que registró. */
  parecidas: { mesa: number; titulo: string; autores: string[]; coincidencia: 'si' | 'parecido' }[];
}

export interface ResumenDeCotejo {
  mesas: number;
  ponencias: number;
  /** Los autores distintos de la agenda. */
  autores: number;
  yaPonentes: number;
  porCambiar: number;
  otroPerfil: number;
  cancelados: number;
  dudosos: number;
  sinRegistro: number;
  /** Todos los registros con perfil de ponente, tengan o no ponencia en la agenda. */
  ponentesRegistrados: number;
  ponentesFueraDeAgenda: number;
  /** Cuántos ponentes habrá cuando se cambien los que se registraron como público general. */
  ponentesDespues: number;
  /** De las filas con registro, qué tan de acuerdo están los títulos. */
  titulos: Record<CoincidenciaDeTitulo, number>;
}

export interface Cotejo {
  filas: FilaDeCotejo[];
  soloRegistrados: SoloRegistrado[];
  /** Los registros que hay que pasar a ponente (uno por persona), con el autor de la agenda que los pide. */
  cambios: { registro: RegistroParaCotejo; autor: string }[];
  resumen: ResumenDeCotejo;
}

// ---------------------------------------------------------------------------
// Títulos
// ---------------------------------------------------------------------------

/** Palabras que no dicen de qué trata un título: sin ellas se compara lo que importa. */
const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'en', 'y', 'e', 'a', 'al', 'un', 'una', 'por', 'para', 'con', 'sin', 'su', 'sus', 'que', 'o', 'u', 'se', 'the', 'of', 'and']);
const palabrasDeTitulo = (titulo: string): string[] => normalizarTexto(titulo).split(' ').filter((p) => p !== '' && !PALABRAS_VACIAS.has(p));

/**
 * Si el título que alguien puso al registrarse es el de su ponencia en la agenda: `si` si es el mismo (sin acentos, signos ni
 * mayúsculas), `parecido` si comparten casi todo lo que dicen —lo corrigió el comité, o lo escribió abreviado—, `no`, o
 * `sin_titulo` si no puso ninguno.
 */
export function coincidenciaDeTitulos(registrado: string | null | undefined, agenda: string): CoincidenciaDeTitulo {
  const a = palabrasDeTitulo(registrado ?? '');
  if (a.length === 0) return 'sin_titulo';
  const b = palabrasDeTitulo(agenda);
  if (a.join(' ') === b.join(' ')) return 'si';
  const A = new Set(a);
  const B = new Set(b);
  const comunes = [...A].filter((p) => B.has(p)).length;
  const union = new Set([...A, ...B]).size;
  const menor = Math.min(A.size, B.size);
  if (union > 0 && comunes / union >= 0.6) return 'parecido';
  if (menor >= 4 && comunes / menor >= 0.9) return 'parecido';
  return 'no';
}

// ---------------------------------------------------------------------------
// Reconocer a cada autor entre los registros
// ---------------------------------------------------------------------------

interface Reconocido {
  registro: RegistroParaCotejo | null;
  calce: Calce | null;
  candidatos: RegistroParaCotejo[];
  otros: RegistroParaCotejo[];
}

/**
 * El registro de un autor de la agenda. Entre los que se le parecen manda, en este orden: un registro vigente antes que uno
 * cancelado, el nombre igual antes que el parecido y, si queda más de uno, el que ya es de ponente (los demás serán un duplicado
 * de la misma persona). Si aun así quedan varios y ninguno es de ponente, no se elige: se devuelven como candidatos.
 */
function reconocer(autor: string, registros: readonly RegistroParaCotejo[]): Reconocido {
  const candidatos = registros
    .map((registro) => ({ registro, calce: calzaNombre(autor, registro.nombre) }))
    .filter((c): c is { registro: RegistroParaCotejo; calce: Calce } => c.calce !== null)
    .map((c) => ({ ...c, rango: (c.registro.estado === 'cancelado' ? 2 : 0) + (c.calce === 'igual' ? 0 : 1) }));
  if (candidatos.length === 0) return { registro: null, calce: null, candidatos: [], otros: [] };

  const mejor = Math.min(...candidatos.map((c) => c.rango));
  const pool = candidatos.filter((c) => c.rango === mejor);
  const ponentes = pool.filter((c) => c.registro.perfil === PERFIL_DE_PONENTE);
  if (ponentes.length > 0) {
    return { registro: ponentes[0].registro, calce: ponentes[0].calce, candidatos: [], otros: pool.filter((c) => c !== ponentes[0]).map((c) => c.registro) };
  }
  if (pool.length === 1) return { registro: pool[0].registro, calce: pool[0].calce, candidatos: [], otros: [] };
  return { registro: null, calce: null, candidatos: pool.map((c) => c.registro), otros: [] };
}

function resultadoDe(r: Reconocido): ResultadoDeCotejo {
  if (r.registro === null) return r.candidatos.length > 0 ? 'dudoso' : 'sin_registro';
  if (r.registro.estado === 'cancelado') return 'cancelado';
  if (r.registro.perfil === PERFIL_DE_PONENTE) return 'ya_ponente';
  return PERFILES_QUE_SE_CAMBIAN.includes(r.registro.perfil) ? 'cambiar' : 'otro_perfil';
}

/** La clave de un autor, igual aunque lo escriban con otros acentos o en otro orden. */
const claveDeAutor = (autor: string) => normalizarTexto(autor).split(' ').sort().join(' ');

/**
 * El cotejo completo de las mesas con los registros.
 */
export function cotejarPonentes(mesas: readonly Pick<Mesa, 'numero' | 'ponencias'>[], registros: readonly RegistroParaCotejo[]): Cotejo {
  const reconocidos = new Map<string, Reconocido>();
  const filas: FilaDeCotejo[] = [];
  for (const mesa of mesas) {
    for (const ponencia of mesa.ponencias) {
      for (const autor of ponencia.autores) {
        const clave = claveDeAutor(autor);
        const r = reconocidos.get(clave) ?? reconocer(autor, registros);
        reconocidos.set(clave, r);
        filas.push({
          mesa: mesa.numero,
          ponencia: ponencia.titulo,
          autor,
          pais: PAISES[ponencia.pais]?.es ?? '',
          participacion: ponencia.participacion ?? '',
          resultado: resultadoDe(r),
          registro: r.registro,
          calce: r.calce,
          candidatos: r.candidatos,
          titulo: r.registro ? coincidenciaDeTitulos(r.registro.titulo_ponencia, ponencia.titulo) : null,
          otros: r.otros,
        });
      }
    }
  }

  // Un mismo registro no puede ser de dos autores distintos: si dos autores lo piden y todavía no es de ponente, no se cambia a ninguno.
  const autoresPorRegistro = new Map<string, Set<string>>();
  for (const f of filas) {
    if (f.registro && f.resultado === 'cambiar') {
      const autores = autoresPorRegistro.get(f.registro.id) ?? new Set<string>();
      autores.add(claveDeAutor(f.autor));
      autoresPorRegistro.set(f.registro.id, autores);
    }
  }
  for (const f of filas) {
    if (f.registro && f.resultado === 'cambiar' && (autoresPorRegistro.get(f.registro.id)?.size ?? 0) > 1) {
      f.candidatos = [f.registro];
      f.registro = null;
      f.calce = null;
      f.titulo = null;
      f.resultado = 'dudoso';
    }
  }

  const cambios: Cotejo['cambios'] = [];
  const yaEnCambios = new Set<string>();
  for (const f of filas) {
    if (f.resultado === 'cambiar' && f.registro && !yaEnCambios.has(f.registro.id)) {
      yaEnCambios.add(f.registro.id);
      cambios.push({ registro: f.registro, autor: f.autor });
    }
  }

  // Los registros de ponente que ningún autor de la agenda reclama.
  const reclamados = new Set<string>();
  for (const f of filas) {
    if (f.registro) reclamados.add(f.registro.id);
    for (const c of f.candidatos) reclamados.add(c.id);
    for (const o of f.otros) reclamados.add(o.id);
  }
  const ponencias = mesas.flatMap((m) => m.ponencias.map((p) => ({ mesa: m.numero, ...p })));
  const soloRegistrados: SoloRegistrado[] = registros
    .filter((r) => r.perfil === PERFIL_DE_PONENTE && !reclamados.has(r.id))
    .map((registro) => ({
      registro,
      parecidas: ponencias
        .map((p) => ({ mesa: p.mesa, titulo: p.titulo, autores: p.autores, coincidencia: coincidenciaDeTitulos(registro.titulo_ponencia, p.titulo) }))
        .filter((p): p is SoloRegistrado['parecidas'][number] => p.coincidencia === 'si' || p.coincidencia === 'parecido'),
    }));

  // Un resultado por autor (y no por fila: quien tiene dos ponencias cuenta una vez).
  const porAutor = new Map<string, FilaDeCotejo>();
  for (const f of filas) if (!porAutor.has(claveDeAutor(f.autor))) porAutor.set(claveDeAutor(f.autor), f);
  const cuantos = (r: ResultadoDeCotejo) => [...porAutor.values()].filter((f) => f.resultado === r).length;
  const titulos: ResumenDeCotejo['titulos'] = { si: 0, parecido: 0, no: 0, sin_titulo: 0 };
  for (const f of filas) if (f.titulo) titulos[f.titulo] += 1;
  const ponentesRegistrados = registros.filter((r) => r.perfil === PERFIL_DE_PONENTE).length;

  return {
    filas,
    soloRegistrados,
    cambios,
    resumen: {
      mesas: mesas.length,
      ponencias: ponencias.length,
      autores: porAutor.size,
      yaPonentes: cuantos('ya_ponente'),
      porCambiar: cuantos('cambiar'),
      otroPerfil: cuantos('otro_perfil'),
      cancelados: cuantos('cancelado'),
      dudosos: cuantos('dudoso'),
      sinRegistro: cuantos('sin_registro'),
      ponentesRegistrados,
      ponentesFueraDeAgenda: soloRegistrados.length,
      ponentesDespues: ponentesRegistrados + cambios.length,
      titulos,
    },
  };
}

// ---------------------------------------------------------------------------
// Para la hoja
// ---------------------------------------------------------------------------

export const ENCABEZADOS_DE_COTEJO = [
  'Mesa', 'Ponencia (agenda)', 'Autor (agenda)', 'País', 'Participación', 'Resultado', 'Registro', 'Correo', 'Folio', 'Perfil',
  'Estado', 'Título registrado', '¿Coincide el título?', 'Nota',
] as const;

const TEXTO_DE_COINCIDENCIA: Record<CoincidenciaDeTitulo, string> = { si: 'Sí', parecido: 'Parecido', no: 'No', sin_titulo: 'Sin título registrado' };

/**
 * Las filas de la pestaña «Cotejo de ponentes»: primero cada autor de la agenda, en el orden del programa, y después los ponentes
 * registrados que la agenda no menciona. `cambiados` son los registros que acaban de pasar a ponente en esta misma corrida: salen
 * ya como ponentes, pero con la nota de que se cambiaron.
 */
export function filasDeCotejoParaLaHoja(
  cotejo: Cotejo,
  etiquetaDePerfil: (clave: string) => string,
  cambiados: ReadonlySet<string> = new Set(),
): (string | number)[][] {
  const resultado = (f: FilaDeCotejo): string => {
    if (f.registro && cambiados.has(f.registro.id)) return 'Se registró como público general: ya se cambió a ponente';
    switch (f.resultado) {
      case 'ya_ponente': return 'Ya es ponente';
      case 'cambiar': return 'Se registró como público general: cambiar a ponente';
      case 'otro_perfil': return `Registrado como ${etiquetaDePerfil(f.registro!.perfil)}: no se cambia`;
      case 'cancelado': return 'Su registro está cancelado';
      case 'dudoso': return 'Podría ser más de un registro: revisar';
      case 'sin_registro': return 'No está registrado';
    }
  };
  const nota = (f: FilaDeCotejo): string => {
    const partes: string[] = [];
    if (f.calce === 'parcial') partes.push('El nombre se parece pero no es igual al de la agenda: confirmar que es la misma persona.');
    if (f.candidatos.length > 0) partes.push(`Candidatos: ${f.candidatos.map((c) => `${c.nombre} (${c.folio}, ${etiquetaDePerfil(c.perfil)})`).join('; ')}.`);
    if (f.otros.length > 0) partes.push(`También tiene otro registro: ${f.otros.map((o) => `${o.folio} (${etiquetaDePerfil(o.perfil)})`).join(', ')}: posible duplicado.`);
    return partes.join(' ');
  };

  const delasAgenda = cotejo.filas.map((f): (string | number)[] => [
    f.mesa, f.ponencia, f.autor, f.pais, f.participacion, resultado(f),
    f.registro?.nombre ?? '', f.registro?.correo ?? '', f.registro?.folio ?? '',
    f.registro ? etiquetaDePerfil(cambiados.has(f.registro.id) ? PERFIL_DE_PONENTE : f.registro.perfil) : '',
    f.registro?.estado ?? '', f.registro?.titulo_ponencia ?? '', f.titulo ? TEXTO_DE_COINCIDENCIA[f.titulo] : '', nota(f),
  ]);
  const solo = cotejo.soloRegistrados.map(({ registro: r, parecidas }): (string | number)[] => [
    '', '', '', '', '', 'Ponente registrado que no figura en la agenda',
    r.nombre, r.correo, r.folio, etiquetaDePerfil(r.perfil), r.estado, r.titulo_ponencia ?? '',
    parecidas.length > 0 ? TEXTO_DE_COINCIDENCIA[parecidas[0].coincidencia] : r.titulo_ponencia ? 'No' : 'Sin título registrado',
    parecidas.length > 0
      ? `Su título se parece al de la mesa ${parecidas[0].mesa}: «${parecidas[0].titulo}» (${parecidas[0].autores.join(', ')}). Puede ser un coautor, o alguien que escribió su nombre de otro modo.`
      : '',
  ]);
  return [...delasAgenda, ...solo];
}
