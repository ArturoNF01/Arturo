import { normalizarTexto } from '@/lib/asistencia';
import { MESAS, type Mesa } from '@/lib/programa';

/**
 * Qué ponencias del programa son de una persona, por su nombre.
 *
 * El programa publicado (`MESAS`) es lo que de verdad se presentó en el Congreso: ahí están los títulos como se leyeron
 * y todos los autores, no sólo quien mandó la propuesta. Pero los autores del programa son texto, no registros: para
 * saber cuál es una persona de la hoja hay que reconocerla por su nombre, y la gente se escribe de varias maneras —con o sin
 * acentos, con uno o dos apellidos, con el nombre de en medio como inicial («L. Alberto» y «Luis Alberto»)—.
 *
 * Reconocerla mal es peor que no reconocerla: un título equivocado sale impreso en una constancia, y una celda en blanco
 * se ve y se llena a mano. Por eso sólo se da por buena una coincidencia clara:
 *  - hacen falta al menos dos palabras de verdad en el nombre más corto («María» o «J. Pérez» no bastan para distinguir a nadie);
 *  - todas las palabras del nombre más corto tienen que estar en el más largo (una inicial vale por una palabra que empiece con
 *    ella, y una partícula —«de», «del», «y»…— no cuenta);
 *  - si quien se registró escribió menos palabras que el programa, tiene que haber escrito al menos tres: «María López» cabe
 *    en «María Luisa Mussot López», pero hay muchas Marías López; en cambio quien escribió de más (los dos apellidos donde el
 *    programa pone uno) sí coincide;
 *  - si el nombre coincide por completo con un autor, es ése; si coincide a medias con dos autores distintos, no se adivina.
 */

/** Palabras que no distinguen a una persona de otra: «Paulo Henrique de Almeida» y «Paulo Henrique Almeida» son el mismo nombre. */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'da', 'das', 'do', 'dos', 'di']);

/** Las palabras de un nombre para compararlo: sin acentos, mayúsculas ni signos («García-Hernández» son dos), sin partículas. */
const palabrasDe = (nombre: string): string[] => normalizarTexto(nombre).split(' ').filter((p) => p !== '' && !PARTICULAS.has(p));

/** ¿Es `a` la misma palabra que `b`, o su inicial? «l» es «luis»; «lu» no es «luis»: sólo vale una letra. */
const mismaPalabra = (a: string, b: string) => a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));

/** ¿Está cada palabra de `menor` en `mayor`, sin gastar dos veces la misma? Prefiere la igual a la que sólo coincide por la inicial. */
function cabeEn(menor: readonly string[], mayor: readonly string[]): boolean {
  const libres = [...mayor];
  for (const palabra of menor) {
    let i = libres.findIndex((p) => p === palabra);
    if (i < 0) i = libres.findIndex((p) => mismaPalabra(palabra, p));
    if (i < 0) return false;
    libres.splice(i, 1);
  }
  return true;
}

type Calce = 'igual' | 'parcial';

/** Cómo se parecen dos nombres: `igual` si son las mismas palabras, `parcial` si uno trae de más o una inicial, nada si no. */
function calce(autor: readonly string[], persona: readonly string[]): Calce | null {
  const [menor, mayor] = autor.length <= persona.length ? [autor, persona] : [persona, autor];
  if (menor.filter((p) => p.length > 1).length < 2) return null;
  if (!cabeEn(menor, mayor)) return null;
  const mismas = autor.length === persona.length && [...autor].sort().join(' ') === [...persona].sort().join(' ');
  if (mismas) return 'igual';
  if (persona.length < autor.length && persona.filter((p) => p.length > 1).length < 3) return null;
  return 'parcial';
}

export interface PonenciaDeUnAutor {
  titulo: string;
  mesa: number;
}

export interface AutorDelPrograma {
  palabras: string[];
  /** Todas las ponencias en las que figura, en el orden del programa. */
  ponencias: PonenciaDeUnAutor[];
}

/**
 * Los autores de unas mesas, una vez cada uno aunque figuren en varias ponencias («Héctor García-Hernández» lleva dos): se
 * reconocen por sus palabras, así que escrito con o sin acentos es el mismo.
 */
export function autoresDe(mesas: readonly Pick<Mesa, 'numero' | 'ponencias'>[]): AutorDelPrograma[] {
  const porClave = new Map<string, AutorDelPrograma>();
  for (const mesa of mesas) {
    for (const ponencia of mesa.ponencias) {
      for (const nombre of ponencia.autores) {
        const palabras = palabrasDe(nombre);
        const clave = [...palabras].sort().join(' ');
        const autor = porClave.get(clave) ?? { palabras, ponencias: [] };
        autor.ponencias.push({ titulo: ponencia.titulo, mesa: mesa.numero });
        porClave.set(clave, autor);
      }
    }
  }
  return [...porClave.values()];
}

const AUTORES = autoresDe(MESAS);

/**
 * Las ponencias del programa en las que figura la persona, en el orden del programa; ninguna si no se la reconoce con
 * claridad. (`autores` es el programa de verdad; sólo cambia en las pruebas.)
 */
export function ponenciasDeLaPersona(nombre: string, autores: readonly AutorDelPrograma[] = AUTORES): PonenciaDeUnAutor[] {
  const persona = palabrasDe(nombre);
  const candidatos = autores.map((autor) => ({ autor, calce: calce(autor.palabras, persona) })).filter((c) => c.calce !== null);
  const iguales = candidatos.filter((c) => c.calce === 'igual');
  const elegidos = iguales.length > 0 ? iguales : candidatos;
  return elegidos.length === 1 ? elegidos[0].autor.ponencias : [];
}

/** Entre un título y otro, cuando una persona tiene más de una ponencia: cabe en una celda y no se parece a la puntuación de un título. */
export const SEPARADOR_DE_PONENCIAS = ' | ';

/** Lo que va en la celda «Ponencia» de la hoja: los títulos, tal como los trae el programa; vacío si la persona no figura. */
export function ponenciasParaLaHoja(nombre: string): string {
  return ponenciasDeLaPersona(nombre).map((p) => p.titulo).join(SEPARADOR_DE_PONENCIAS);
}
