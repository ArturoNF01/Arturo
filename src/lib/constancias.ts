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
  /** Lo que hay en la columna «Constancia», tal como se ve. */
  texto: string;
  /** El enlace de descarga, si lo que hay es un enlace válido. */
  enlace: string | null;
}

const comoTexto = (celda: CeldaDeLaHoja | undefined) => String(celda?.texto ?? '').trim();

/**
 * Las filas de la pestaña con lo que hace falta para mandar su constancia. La primera fila son los títulos: las columnas se buscan
 * por su título («Nombre», «Correo», «Con registro», «Constancia»), porque quien hace las constancias puede moverlas. Si falta
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
  const cRegistro = columna('Con registro');
  const cConstancia = columna(COLUMNA_DE_CONSTANCIA);
  const cNumero = titulos.indexOf('N.º');

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
  /** Lo que se guarda con su envío y se manda: su enlace, el nombre con que se le saluda y su fila. */
  datos: { enlace: string; nombre: string; numero: string };
}

export interface FaltaConstancia {
  numero: string;
  nombre: string;
}

export interface SeleccionDeConstancias {
  destinatarios: DestinatarioDeConstancia[];
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
  /** Las filas que tienen enlace pero cuyo correo no es de ningún registro: se les manda en español. */
  sinRegistroDeCorreo: number;
}

const IDIOMAS: readonly IdiomaEnvio[] = ['es', 'en', 'pt'];
const esIdioma = (valor: string): valor is IdiomaEnvio => (IDIOMAS as readonly string[]).includes(valor);
const correoValido = (correo: string) => /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/.test(correo);

/**
 * A quién le toca su constancia ahora. Cada persona, una sola vez: por su correo, y con el enlace de su propia fila.
 *
 *  - Sin la casilla «Con registro» no hay constancia, aunque haya un enlace.
 *  - Quien ya la recibió con el mismo enlace queda fuera: repetir el envío sólo alcanza a quienes faltan. Si el enlace cambió
 *    (se corrigió una constancia), sí se manda otra vez, y se cuenta aparte para que quien envía lo sepa.
 *  - Cada quien la recibe en el idioma con que se registró; quien no está registrado con ese correo, en español.
 */
export function elegirDestinatariosDeConstancias({
  filas, registros, yaEnviadas,
}: {
  filas: readonly FilaDeConstancia[];
  registros: readonly RegistroParaConstancia[];
  /** Los enlaces que ya se mandaron, por correo (en minúsculas). */
  yaEnviadas: ReadonlyMap<string, ReadonlySet<string>>;
}): SeleccionDeConstancias {
  const registroPorCorreo = new Map<string, RegistroParaConstancia>();
  for (const r of registros) registroPorCorreo.set(r.correo.trim().toLowerCase(), r);

  const excluidos = { sinRegistro: 0, sinConstancia: 0, enlaceInvalido: 0, sinCorreo: 0, correoRepetido: 0, yaRecibieron: 0 };
  const porIdioma: Record<IdiomaEnvio, number> = { es: 0, en: 0, pt: 0 };
  const destinatarios: DestinatarioDeConstancia[] = [];
  const faltan: FaltaConstancia[] = [];
  const vistos = new Set<string>();
  let enlaceNuevo = 0;
  let sinRegistroDeCorreo = 0;

  for (const f of filas) {
    if (!f.conRegistro) { excluidos.sinRegistro += 1; continue; }
    if (!f.enlace) {
      if (f.texto === '') { excluidos.sinConstancia += 1; faltan.push({ numero: f.numero, nombre: f.nombre }); }
      else excluidos.enlaceInvalido += 1;
      continue;
    }
    if (!correoValido(f.correo)) { excluidos.sinCorreo += 1; continue; }
    if (vistos.has(f.correo)) { excluidos.correoRepetido += 1; continue; }
    vistos.add(f.correo);

    const antes = yaEnviadas.get(f.correo);
    if (antes?.has(f.enlace)) { excluidos.yaRecibieron += 1; continue; }
    if (antes && antes.size > 0) enlaceNuevo += 1;

    const registro = registroPorCorreo.get(f.correo);
    if (!registro) sinRegistroDeCorreo += 1;
    const idioma: IdiomaEnvio = registro && esIdioma(registro.idioma) ? registro.idioma : 'es';
    porIdioma[idioma] += 1;
    destinatarios.push({
      correo: f.correo,
      registro_id: registro?.id ?? null,
      idioma,
      datos: { enlace: f.enlace, nombre: f.nombre, numero: f.numero },
    });
  }
  return { destinatarios, enlaceNuevo, excluidos, porIdioma, faltan, sinRegistroDeCorreo };
}
