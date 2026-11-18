import {
  conRegistro, huellaDeNombre, personasDeLaHoja, type FilaDeAsistencia, type RegistroDePonente,
} from '@/lib/asistencia';

/**
 * La revisión de los repetidos de «Asistencia por persona». Cada fila de esa pestaña con la casilla «Con registro» marcada es una
 * constancia, así que una misma persona en dos filas es, o dos constancias, o una constancia con los días de asistencia partidos
 * entre dos filas (y el total de horas mal). Antes de emitirlas hay que saber quién sale más de una vez.
 *
 * Se mira lo que se vería en la pestaña —las mismas filas, con el mismo N.º— y se juntan las que comparten **nombre** (como en el
 * cotejo de ponentes: sin acentos, sin mayúsculas y sin importar el orden de las palabras) o **correo** (sin mayúsculas). Si una
 * fila comparte el nombre con otra y el correo con una tercera, las tres son un solo caso: es lo que alguien tiene que mirar junto.
 *
 * Esto sólo avisa y aconseja: dos filas con el mismo nombre pueden ser dos personas (hay nombres muy comunes), y juntarlas es
 * decisión de quien conoce a la gente. Lo que se hace con ellas —ligar una asistencia suelta a su registro, cancelar el registro de
 * sobra— se hace en el panel, y la hoja lo recoge sola en la siguiente pasada.
 */

export type MotivoDeRepetido = 'nombre' | 'correo';

/**
 * Qué tanto importa para las constancias que esas filas sean la misma persona:
 *  - `dos_constancias`: dos o más filas con la casilla «Con registro» marcada: saldrían dos constancias;
 *  - `dias_repartidos`: sólo una con la casilla marcada, pero la asistencia de la persona está también en otra: la constancia
 *    saldría una vez, con menos días de los que tiene;
 *  - `sin_registro`: ninguna tiene la casilla marcada: nadie recibiría constancia (y quizá alguien sí debería);
 *  - `sin_riesgo`: sólo una con la casilla marcada y las otras no llevan asistencia (el registro cancelado de un ponente, por ejemplo).
 */
export type RiesgoDeRepetido = 'dos_constancias' | 'dias_repartidos' | 'sin_registro' | 'sin_riesgo';

/** De más a menos urgente: es el orden en que salen los casos. */
const ORDEN_DE_RIESGO: readonly RiesgoDeRepetido[] = ['dos_constancias', 'dias_repartidos', 'sin_registro', 'sin_riesgo'];

export interface FilaRepetida {
  /** El N.º de la fila en «Asistencia por persona». */
  numero: number;
  nombre: string;
  correo: string;
  perfil: string | null;
  folio: string | null;
  /** Lleva la casilla «Con registro» marcada: su registro vale. */
  conRegistro: boolean;
  /** Su asistencia está ligada a un registro, aunque ese registro esté cancelado. */
  ligada: boolean;
  /** Días de asistencia que lleva la fila. */
  total: number;
  /** La ponencia del programa en que participó, si presentó una. */
  ponencia: string;
  /** Qué hacer con esta fila. */
  accion: string;
}

export interface CasoDeRepetidos {
  /** 1, 2, 3…: el orden en que se revisan (primero lo más urgente). */
  numero: number;
  motivos: MotivoDeRepetido[];
  riesgo: RiesgoDeRepetido;
  /** Las filas del caso, por N.º. */
  filas: FilaRepetida[];
  /** Qué hacer con el caso, en una línea. */
  sugerencia: string;
}

export interface ResumenDeRepetidos {
  /** Cuántas filas tiene la pestaña. */
  filas: number;
  /** Cuántos nombres distintos salen en más de una fila, y cuántos correos. */
  nombresRepetidos: number;
  correosRepetidos: number;
  /** Los casos a revisar (un mismo caso puede juntar nombres y correos) y cuántos hay de cada riesgo. */
  casos: number;
  dosConstancias: number;
  diasRepartidos: number;
  sinRegistro: number;
  sinRiesgo: number;
}

export interface RevisionDeRepetidos {
  resumen: ResumenDeRepetidos;
  casos: CasoDeRepetidos[];
}

/** «12», «12 y 70», «12, 70 y 81»: los N.º de las filas, para decirlos en una frase. */
const listaDeNumeros = (numeros: readonly number[]): string =>
  numeros.length <= 1 ? String(numeros[0] ?? '') : `${numeros.slice(0, -1).join(', ')} y ${numeros[numeros.length - 1]}`;
/** «la fila 3» o «las filas 3 y 4». */
const laFila = (filas: readonly { numero: number }[]): string =>
  `${filas.length === 1 ? 'la fila' : 'las filas'} ${listaDeNumeros(filas.map((f) => f.numero))}`;

function describirCaso(numero: number, motivos: MotivoDeRepetido[], filas: Omit<FilaRepetida, 'accion'>[]): CasoDeRepetidos {
  const vigentes = filas.filter((f) => f.conRegistro);
  const todas = listaDeNumeros(filas.map((f) => f.numero));
  const riesgo: RiesgoDeRepetido =
    vigentes.length >= 2 ? 'dos_constancias'
    : vigentes.length === 1 ? (filas.some((f) => f !== vigentes[0] && f.total > 0) ? 'dias_repartidos' : 'sin_riesgo')
    : 'sin_registro';
  // Con un solo registro vigente, a él se ligan las asistencias sueltas.
  const unico = vigentes.length === 1 ? vigentes[0] : null;
  // Los días que están fuera del registro vigente: en asistencias sueltas (que se ligan) o en un registro cancelado (que no se
  // puede ligar: se anotan a mano en el vigente).
  const otrasConDias = filas.filter((f) => f !== unico && f.total > 0);
  const sueltas = otrasConDias.filter((f) => !f.ligada);
  const deCancelados = otrasConDias.filter((f) => f.ligada);
  const pasos = unico
    ? [
        ...(sueltas.length > 0
          ? [`ligue en el panel (Asistencia → Por día → «Ligar a un registro») la asistencia suelta de ${laFila(sueltas)} al registro de la fila ${unico.numero}`]
          : []),
        ...(deCancelados.length > 0
          ? [`los días de ${laFila(deCancelados)}, de un registro cancelado, no se suman: anótelos a mano en el registro de la fila ${unico.numero} (panel → «Registrar a mano»)`]
          : []),
      ]
    : [];

  const accion = (f: Omit<FilaRepetida, 'accion'>): string => {
    if (f.conRegistro) {
      return riesgo === 'dos_constancias'
        ? 'Registro vigente: si es la misma persona y sobra, cancelarlo en el panel'
        : 'Registro vigente: es la que lleva la constancia';
    }
    if (!f.ligada) {
      return unico
        ? `Asistencia sin registro: si es la misma persona, ligarla al registro de la fila ${unico.numero}`
        : 'Asistencia sin registro: si la persona está registrada, ligarla a su registro';
    }
    return unico && f.total > 0
      ? `Registro cancelado: no recibe constancia, y sus días no se suman a la fila ${unico.numero}`
      : 'Registro cancelado: no recibe constancia';
  };

  const sugerencia = {
    dos_constancias:
      `Las filas ${listaDeNumeros(vigentes.map((f) => f.numero))} llevan «Con registro» marcado: si es la misma persona saldrían dos constancias. ` +
      'Deje un solo registro vigente (cancele el que sobre en el panel); si son personas distintas, no hay nada que hacer.',
    dias_repartidos:
      `La asistencia de esta persona está repartida entre las filas ${todas}: el total de la fila ${unico?.numero} no la suma toda. ` +
      `Si es la misma persona, ${pasos.join(', y ')}; si son personas distintas, no hay nada que hacer.`,
    sin_registro:
      `Ninguna de las filas ${todas} tiene registro vigente: no recibirían constancia. ` +
      'Si es alguien registrado con otro nombre o correo, ligue su asistencia a su registro en el panel.',
    sin_riesgo:
      `Sólo la fila ${unico?.numero} tiene registro vigente y las demás no llevan asistencia: no sale más de una constancia.`,
  }[riesgo];

  return { numero, motivos, riesgo, filas: filas.map((f) => ({ ...f, accion: accion(f) })), sugerencia };
}

/**
 * Los repetidos de «Asistencia por persona»: de las mismas filas que la hoja (la asistencia y, además, todos los registros de
 * ponente, hayan asistido o no), cuáles comparten nombre o correo. Cada caso trae sus filas y qué hacer; los casos van de más a
 * menos urgente (primero los que dan dos constancias) y, entre iguales, por el N.º de su primera fila.
 */
export function revisarRepetidos(
  asistentes: readonly FilaDeAsistencia[],
  ponentes: readonly RegistroDePonente[],
  /** La ponencia que presentó quien tiene ese nombre, como va en la celda; vacía si no presentó ninguna. */
  ponenciaDe: (nombre: string) => string = () => '',
): RevisionDeRepetidos {
  const filas: Omit<FilaRepetida, 'accion'>[] = personasDeLaHoja(asistentes, ponentes).map((p, i) => ({
    numero: i + 1, nombre: p.nombre, correo: p.correo, perfil: p.perfil, folio: p.folio, conRegistro: conRegistro(p),
    ligada: !p.sinRegistro, total: p.total, ponencia: ponenciaDe(p.nombre),
  }));

  const porNombre = new Map<string, number[]>();
  const porCorreo = new Map<string, number[]>();
  const apuntar = (mapa: Map<string, number[]>, clave: string, i: number) => {
    if (clave === '') return;
    const indices = mapa.get(clave);
    if (indices) indices.push(i);
    else mapa.set(clave, [i]);
  };
  filas.forEach((f, i) => {
    apuntar(porNombre, huellaDeNombre(f.nombre), i);
    apuntar(porCorreo, f.correo.trim().toLowerCase(), i);
  });
  const nombresRepetidos = [...porNombre.values()].filter((g) => g.length > 1);
  const correosRepetidos = [...porCorreo.values()].filter((g) => g.length > 1);

  // Las filas que comparten nombre o correo, transitivamente, son un solo caso (unión de conjuntos).
  const raiz = filas.map((_, i) => i);
  const buscar = (i: number): number => {
    while (raiz[i] !== i) { raiz[i] = raiz[raiz[i]]; i = raiz[i]; }
    return i;
  };
  for (const grupo of [...nombresRepetidos, ...correosRepetidos]) {
    for (const i of grupo.slice(1)) raiz[buscar(i)] = buscar(grupo[0]);
  }
  const casos = new Map<number, { indices: number[]; motivos: Set<MotivoDeRepetido> }>();
  const delCaso = (i: number) => {
    const r = buscar(i);
    let c = casos.get(r);
    if (!c) { c = { indices: [], motivos: new Set() }; casos.set(r, c); }
    return c;
  };
  for (const g of nombresRepetidos) { const c = delCaso(g[0]); c.motivos.add('nombre'); }
  for (const g of correosRepetidos) { const c = delCaso(g[0]); c.motivos.add('correo'); }
  for (const g of [...nombresRepetidos, ...correosRepetidos]) {
    const c = delCaso(g[0]);
    for (const i of g) if (!c.indices.includes(i)) c.indices.push(i);
  }

  const ordenados = [...casos.values()]
    .map((c) => ({ indices: [...c.indices].sort((a, b) => a - b), motivos: (['nombre', 'correo'] as const).filter((m) => c.motivos.has(m)) }))
    .map((c) => describirCaso(0, c.motivos, c.indices.map((i) => filas[i])))
    .sort((a, b) =>
      ORDEN_DE_RIESGO.indexOf(a.riesgo) - ORDEN_DE_RIESGO.indexOf(b.riesgo) || a.filas[0].numero - b.filas[0].numero)
    .map((c, i) => ({ ...c, numero: i + 1 }));

  const cuantos = (riesgo: RiesgoDeRepetido) => ordenados.filter((c) => c.riesgo === riesgo).length;
  return {
    casos: ordenados,
    resumen: {
      filas: filas.length,
      nombresRepetidos: nombresRepetidos.length,
      correosRepetidos: correosRepetidos.length,
      casos: ordenados.length,
      dosConstancias: cuantos('dos_constancias'),
      diasRepartidos: cuantos('dias_repartidos'),
      sinRegistro: cuantos('sin_registro'),
      sinRiesgo: cuantos('sin_riesgo'),
    },
  };
}

// ---------------------------------------------------------------------------
// Para la hoja
// ---------------------------------------------------------------------------

export const ENCABEZADOS_DE_REPETIDOS = [
  'Caso', 'Motivo', 'Riesgo', 'N.º', 'Nombre', 'Correo', 'Perfil', 'Con registro', 'Días', 'Ponencia', 'Folio', 'Qué hacer con esta fila', 'Qué hacer con el caso',
] as const;

const TEXTO_DE_RIESGO: Record<RiesgoDeRepetido, string> = {
  dos_constancias: 'Dos constancias',
  dias_repartidos: 'Días repartidos',
  sin_registro: 'Sin registro',
  sin_riesgo: 'Sin riesgo',
};

const TEXTO_DE_MOTIVO = (motivos: readonly MotivoDeRepetido[]): string =>
  motivos.length === 2 ? 'Mismo nombre y correo' : motivos[0] === 'correo' ? 'Mismo correo' : 'Mismo nombre';

/**
 * Las filas de la pestaña «Repetidos por revisar»: cada caso junto, con una fila en blanco entre uno y otro, y lo que hay que
 * hacer con el caso en la primera de sus filas.
 */
export function filasDeRepetidosParaLaHoja(
  revision: RevisionDeRepetidos,
  etiquetaDePerfil: (clave: string) => string = (clave) => clave,
): (string | number)[][] {
  const separador = (): (string | number)[] => ENCABEZADOS_DE_REPETIDOS.map(() => '');
  const filas: (string | number)[][] = [];
  for (const caso of revision.casos) {
    if (filas.length > 0) filas.push(separador());
    caso.filas.forEach((f, i) => {
      filas.push([
        caso.numero, i === 0 ? TEXTO_DE_MOTIVO(caso.motivos) : '', i === 0 ? TEXTO_DE_RIESGO[caso.riesgo] : '',
        f.numero, f.nombre, f.correo, f.perfil ? etiquetaDePerfil(f.perfil) : '', f.conRegistro ? 'Sí' : 'No', f.total,
        f.ponencia, f.folio ?? '', f.accion, i === 0 ? caso.sugerencia : '',
      ]);
    });
  }
  return filas;
}
