/**
 * Envíos masivos de comunicados: las reglas que no dependen del servidor.
 *
 * Es lógica pura, aparte de la base y de Resend, para poder probarla sin enviar nada:
 * un error aquí es un correo a cientos de personas que no se puede recoger.
 */

/** Las plantillas que se pueden mandar en masa. Las demás son acuses de un solo registro. */
export const PLANTILLAS_MASIVAS = ['comunicado'] as const;
export type PlantillaMasiva = (typeof PLANTILLAS_MASIVAS)[number];

export function esPlantillaMasiva(clave: string): clave is PlantillaMasiva {
  return (PLANTILLAS_MASIVAS as readonly string[]).includes(clave);
}

export const AUDIENCIAS = ['todos', 'ponentes', 'lista'] as const;
export type Audiencia = (typeof AUDIENCIAS)[number];

/**
 * La audiencia de los envíos que salen solos, tras el correo de confirmación de cada registro. No se elige
 * en el panel (por eso no está en `AUDIENCIAS`): es la campaña donde quedan asentados.
 */
export const AUDIENCIA_AUTOMATICA = 'automatico';
export type AudienciaGuardada = Audiencia | typeof AUDIENCIA_AUTOMATICA;

/**
 * ¿A este registro le toca el comunicado automático? A quien está vigente y tiene correo: no a quien canceló ni a
 * quien está en lista de espera —igual que en el envío masivo, que a la lista de espera sólo llega si se pide—.
 */
export function correspondeComunicadoAutomatico(estado: string | null | undefined, correo: string | null | undefined): boolean {
  return Boolean(String(correo ?? '').trim()) && estadosDeLaAudiencia(false).includes(String(estado));
}

/** Cuántos correos salen en cada llamada a Resend (admite 100; 50 deja holgura y respuestas cortas). */
export const TAMANO_TANDA = 50;

/** Cuántas direcciones se aceptan en una lista escrita a mano. */
export const MAXIMO_LISTA = 200;

/** Los estados de registro a los que se escribe: igual que los recordatorios. */
export function estadosDeLaAudiencia(incluirListaEspera: boolean): string[] {
  return incluirListaEspera ? ['confirmado', 'en_proceso', 'lista_espera'] : ['confirmado', 'en_proceso'];
}

/** Perfiles que cuentan como «ponentes». */
export const PERFILES_PONENTES = ['ponente'] as const;

/**
 * Qué pasó con una llamada a Resend, dicho para decidir qué hacer:
 *
 *  - `cuota`: se acabó el límite diario o mensual del plan. Seguir hoy no tiene caso.
 *  - `limite`: vamos demasiado rápido. Se cura esperando unos segundos.
 *  - `direccion`: Resend rechazó lo que se le mandó (una dirección mal escrita, un campo
 *    inválido). Con un lote, una sola dirección mala lo rechaza entero.
 *  - `transitorio`: Resend o la red fallaron. Se puede volver a intentar.
 *  - `otro`: cualquier otra cosa.
 */
export type CausaDeError = 'cuota' | 'limite' | 'direccion' | 'transitorio' | 'otro';

export function clasificarErrorDeEnvio(
  error: { name?: string | null; message?: string | null; statusCode?: number | null } | null | undefined,
): CausaDeError {
  const nombre = String(error?.name ?? '').toLowerCase();
  const mensaje = String(error?.message ?? '').toLowerCase();
  const estado = Number(error?.statusCode ?? 0);

  // La cuota va antes que el límite de velocidad: las dos llegan como 429.
  if (/quota/.test(nombre) || /(daily|monthly).{0,20}(limit|quota)|quota/.test(mensaje)) return 'cuota';
  if (nombre === 'rate_limit_exceeded' || estado === 429 || /rate.?limit|too many requests/.test(mensaje)) {
    return 'limite';
  }
  if (
    ['validation_error', 'invalid_parameter', 'missing_required_field', 'invalid_access'].includes(nombre) ||
    estado === 422
  ) {
    return 'direccion';
  }
  if (
    ['application_error', 'internal_server_error'].includes(nombre) ||
    estado >= 500 ||
    /fetch failed|network|timeout|econn|etimedout|socket/.test(mensaje)
  ) {
    return 'transitorio';
  }
  return 'otro';
}

/** Parte una lista en tandas de a lo más `tamano`. */
export function tandasDe<T>(lista: readonly T[], tamano: number = TAMANO_TANDA): T[][] {
  const salida: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) salida.push(lista.slice(i, i + tamano));
  return salida;
}

export interface Progreso {
  total: number;
  enviados: number;
  errores: number;
  pendientes: number;
  enviando: number;
}

/** Cuánto va de una campaña, en porcentaje entero. Lo que falló también cuenta como «ya atendido». */
export function porcentajeAtendido(p: Progreso): number {
  if (p.total <= 0) return 100;
  return Math.min(100, Math.floor(((p.enviados + p.errores) / p.total) * 100));
}

/** ¿Quedó algo por hacer? Lo pendiente y lo que se quedó «enviando» sin confirmar. */
export function faltaPorEnviar(p: Progreso): boolean {
  return p.pendientes + p.enviando > 0;
}

/**
 * La confirmación que se pide antes de enviar: escribir la cifra de destinatarios.
 *
 * Un botón de «Aceptar» se pulsa sin mirar; una cifra hay que leerla. Y comparar contra la
 * cifra que calcula el servidor al crear el envío frena el caso de que la audiencia haya
 * cambiado entre que se miró y que se confirmó.
 */
export function confirmacionValida(escrita: unknown, total: number): boolean {
  return String(escrita ?? '').trim() === String(total) && total > 0;
}

export type IdiomaEnvio = 'es' | 'en' | 'pt';

export interface RegistroParaEnvio {
  id: string;
  correo: string | null;
  idioma: string | null;
  estado: string;
  perfil: string | null;
}

export interface Destinatario {
  correo: string;
  registro_id: string | null;
  idioma: IdiomaEnvio;
}

export interface SeleccionDeAudiencia {
  destinatarios: Destinatario[];
  /** Cuántos quedan fuera, y por qué: para que quien envía vea que no se olvidó a nadie sin saberlo. */
  excluidos: { cancelados: number; listaEspera: number; sinCorreo: number; yaRecibieron: number; noPonentes: number; otroIdioma: number };
  porIdioma: Record<IdiomaEnvio, number>;
  /** Con lista escrita a mano: cuántas de esas direcciones ya habían recibido este comunicado. */
  repetidosEnLista: number;
}

const IDIOMAS_VALIDOS: readonly string[] = ['es', 'en', 'pt'];

export function idiomaDeEnvio(idioma: string | null | undefined, porOmision: IdiomaEnvio = 'es'): IdiomaEnvio {
  return IDIOMAS_VALIDOS.includes(String(idioma)) ? (idioma as IdiomaEnvio) : porOmision;
}

/**
 * Quiénes reciben un envío masivo.
 *
 *  - `todos`: toda persona registrada con correo, menos quien canceló y —salvo que se pida— quien
 *    está en lista de espera, y menos quien ya recibió este mismo comunicado en un envío anterior:
 *    así, repetir el botón sólo alcanza a quien falta, y nadie recibe el mismo correo dos veces.
 *  - `ponentes`: lo mismo, restringido a ese perfil.
 *  - `lista`: las direcciones que se escribieron, tal cual, estén o no registradas. Es una orden
 *    expresa de quien envía, así que aquí no se filtra a quien ya lo recibió: sólo se avisa.
 *
 * Una dirección repetida entre registros cuenta una vez, sin distinguir mayúsculas.
 */
export function elegirDestinatarios({
  audiencia, registros, yaRecibieron, lista = [], incluirListaEspera = false, idiomaPorOmision = 'es', soloIdioma,
}: {
  audiencia: Audiencia;
  registros: readonly RegistroParaEnvio[];
  /** Direcciones (en minúsculas) que ya recibieron este comunicado. */
  yaRecibieron: ReadonlySet<string>;
  lista?: readonly string[];
  incluirListaEspera?: boolean;
  /** El idioma de las direcciones de la lista que no son de ningún registro. */
  idiomaPorOmision?: IdiomaEnvio;
  /**
   * Sólo las personas registradas en este idioma: para mandar el comunicado por etapas (por ejemplo
   * primero en español, mientras el comité revisa la traducción). No aplica a una lista escrita a
   * mano, que es una orden expresa. Quien se salta aquí no queda marcado como enviado: se alcanza
   * después, con el idioma que falte, sin repetir a nadie.
   */
  soloIdioma?: IdiomaEnvio;
}): SeleccionDeAudiencia {
  const excluidos = { cancelados: 0, listaEspera: 0, sinCorreo: 0, yaRecibieron: 0, noPonentes: 0, otroIdioma: 0 };
  const porIdioma: Record<IdiomaEnvio, number> = { es: 0, en: 0, pt: 0 };
  const destinatarios: Destinatario[] = [];
  const vistos = new Set<string>();
  const deOtroIdioma = new Set<string>();
  let repetidosEnLista = 0;

  const agregar = (d: Destinatario) => {
    destinatarios.push(d);
    porIdioma[d.idioma] += 1;
  };

  if (audiencia === 'lista') {
    const porCorreo = new Map<string, RegistroParaEnvio>();
    for (const r of registros) {
      const c = String(r.correo ?? '').trim().toLowerCase();
      if (c && !porCorreo.has(c)) porCorreo.set(c, r);
    }
    for (const bruto of lista) {
      const correo = bruto.trim().toLowerCase();
      if (!correo || vistos.has(correo)) continue;
      vistos.add(correo);
      const registro = porCorreo.get(correo);
      if (yaRecibieron.has(correo)) repetidosEnLista += 1;
      agregar({
        correo,
        registro_id: registro?.id ?? null,
        // Quien está registrada recibe el correo en su idioma; el elegido en pantalla sólo vale
        // para las direcciones que no son de ningún registro.
        idioma: registro ? idiomaDeEnvio(registro.idioma) : idiomaPorOmision,
      });
    }
    return { destinatarios, excluidos, porIdioma, repetidosEnLista };
  }

  const estadosValidos = new Set(estadosDeLaAudiencia(incluirListaEspera));
  for (const r of registros) {
    const correo = String(r.correo ?? '').trim().toLowerCase();
    if (!correo) {
      excluidos.sinCorreo += 1;
      continue;
    }
    if (r.estado === 'cancelado') {
      excluidos.cancelados += 1;
      continue;
    }
    if (!estadosValidos.has(r.estado)) {
      excluidos.listaEspera += 1;
      continue;
    }
    if (audiencia === 'ponentes' && !(PERFILES_PONENTES as readonly string[]).includes(String(r.perfil))) {
      excluidos.noPonentes += 1;
      continue;
    }
    // Quien se registró con un idioma que no tenemos, lo recibe en español.
    const idioma = idiomaDeEnvio(r.idioma);
    if (vistos.has(correo)) continue;
    if (soloIdioma && idioma !== soloIdioma) {
      // Una dirección repetida entre registros se cuenta una sola vez.
      if (!deOtroIdioma.has(correo)) excluidos.otroIdioma += 1;
      deOtroIdioma.add(correo);
      continue;
    }
    vistos.add(correo);
    if (yaRecibieron.has(correo)) {
      excluidos.yaRecibieron += 1;
      continue;
    }
    agregar({ correo, registro_id: r.id, idioma });
  }
  return { destinatarios, excluidos, porIdioma, repetidosEnLista };
}
