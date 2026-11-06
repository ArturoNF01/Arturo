import 'server-only';
import { createHash } from 'node:crypto';
import { Resend } from 'resend';
import { consultar, enTransaccion } from '@/lib/bd/conexion';
import {
  MAXIMO_LISTA, TAMANO_TANDA, clasificarErrorDeEnvio, confirmacionValida, elegirDestinatarios,
  esPlantillaMasiva, faltaPorEnviar,
  type Audiencia, type CausaDeError, type Destinatario, type IdiomaEnvio, type Progreso,
  type RegistroParaEnvio,
} from '@/lib/comunicados';
import { destinatariosDePrueba } from '@/lib/plantillas';
import { leerConfiguracion } from './configuracion';
import { armarCorreoConPlantilla, type ClavePlantilla } from './correo';

/**
 * Envíos masivos de comunicados.
 *
 * Tres ideas lo sostienen:
 *
 *  1. **Nunca dos veces lo mismo a la misma persona.** Cada destinatario es una fila con su
 *     estado; sólo se manda lo que está «pendiente», y se manda tras «reclamarlo» en la base,
 *     de modo que dos pestañas del panel abiertas a la vez no se pisan. Además cada llamada a
 *     Resend lleva una llave de idempotencia derivada de a quiénes va: si la respuesta se pierde
 *     y se reintenta, Resend reconoce el envío y no lo repite.
 *  2. **Se puede parar y seguir.** Se envía por tandas; si algo corta —Resend por límite, el
 *     navegador que se cierra—, lo que no salió queda pendiente y se reanuda donde iba.
 *  3. **Lo que salió es lo que se aprobó.** La plantilla viaja congelada en la campaña.
 *
 * La orquestación (`procesarTanda`) no sabe de PostgreSQL ni de Resend: recibe un repositorio y
 * un enviador. Así se prueba entera —incluidos los cortes y los errores— sin mandar un solo correo.
 */

type ErrorDeEnvio = { name?: string; message: string; statusCode?: number };

export interface CorreoListo {
  to: string;
  subject: string;
  html: string;
}

export interface FilaDeEnvio {
  correo: string;
  registro_id: string | null;
  idioma: IdiomaEnvio;
}

export interface Repositorio {
  /** Toma hasta `n` pendientes y los marca «enviando». Quien los toma es el único que los manda. */
  reclamar(campanaId: string, n: number): Promise<FilaDeEnvio[]>;
  marcarEnviados(campanaId: string, correos: string[]): Promise<void>;
  marcarError(campanaId: string, correo: string, error: string): Promise<void>;
  /** Devuelve a «pendiente» lo que se reclamó y no llegó a mandarse. */
  devolverAPendientes(campanaId: string, correos: string[]): Promise<void>;
  progreso(campanaId: string): Promise<Progreso>;
  cerrarSiTermino(campanaId: string): Promise<void>;
}

export interface Enviador {
  lote(correos: CorreoListo[], llave: string): Promise<{ error: ErrorDeEnvio | null }>;
  uno(correo: CorreoListo, llave: string): Promise<{ error: ErrorDeEnvio | null }>;
}

export interface ResultadoTanda {
  progreso: Progreso;
  /** Por qué se paró antes de terminar la tanda, si se paró. */
  detenido?: Exclude<CausaDeError, 'direccion'>;
  mensaje?: string;
}

/** Una llave estable para un grupo de destinatarios: el mismo grupo en la misma campaña, la misma llave. */
export function llaveDeLote(campanaId: string, correos: readonly string[]): string {
  const huella = createHash('sha256').update([...correos].sort().join('\n')).digest('hex').slice(0, 24);
  return `comunicado-${campanaId}-${huella}`;
}

/**
 * Manda una tanda de la campaña y deja el estado de cada persona al día.
 *
 * Qué hace según lo que conteste Resend:
 *  - Todo bien: la tanda queda «enviada».
 *  - Límite de velocidad o de cuota: nada se marca como enviado ni como error; todo vuelve a
 *    «pendiente» y se avisa para que se espere o se siga otro día.
 *  - Una dirección rechazada: un lote con una dirección mala se rechaza entero, así que se
 *    reintenta de a una, y sólo la mala queda en «error».
 *  - Falla de Resend o de la red, o algo desconocido: todo vuelve a «pendiente» y se avisa. No se
 *    marca a nadie como fallido por un problema que no es suyo.
 */
export async function procesarTanda({
  repo, enviador, armar, campanaId, tamano = TAMANO_TANDA, esperar = async () => {},
}: {
  repo: Repositorio;
  enviador: Enviador;
  armar: (filas: FilaDeEnvio[]) => Promise<CorreoListo[]>;
  campanaId: string;
  tamano?: number;
  /** Pausa entre envíos sueltos, para no pasar de las 2 llamadas por segundo que admite Resend. */
  esperar?: (ms: number) => Promise<void>;
}): Promise<ResultadoTanda> {
  const filas = (await repo.reclamar(campanaId, tamano)).sort((a, b) => a.correo.localeCompare(b.correo));
  if (filas.length === 0) {
    await repo.cerrarSiTermino(campanaId);
    return { progreso: await repo.progreso(campanaId) };
  }
  const correos = filas.map((f) => f.correo);

  let listos: CorreoListo[];
  try {
    listos = await armar(filas);
  } catch (error) {
    // No se pudo ni armar (plantilla ausente, configuración): nada salió, nada se marca.
    await repo.devolverAPendientes(campanaId, correos);
    return {
      progreso: await repo.progreso(campanaId),
      detenido: 'otro',
      mensaje: error instanceof Error ? error.message : String(error),
    };
  }

  const detener = async (causa: ResultadoTanda['detenido'], error: ErrorDeEnvio, devolver: string[]) => {
    await repo.devolverAPendientes(campanaId, devolver);
    return { progreso: await repo.progreso(campanaId), detenido: causa, mensaje: error.message } satisfies ResultadoTanda;
  };

  const { error } = await enviador.lote(listos, llaveDeLote(campanaId, correos));
  if (!error) {
    await repo.marcarEnviados(campanaId, correos);
    await repo.cerrarSiTermino(campanaId);
    return { progreso: await repo.progreso(campanaId) };
  }

  const causa = clasificarErrorDeEnvio(error);
  if (causa !== 'direccion') return detener(causa as ResultadoTanda['detenido'], error, correos);

  // Una dirección mala tumbó el lote: de a una, para saber cuál.
  const enviados: string[] = [];
  for (let i = 0; i < listos.length; i += 1) {
    if (i > 0) await esperar(600);
    const { error: errorUno } = await enviador.uno(listos[i], llaveDeLote(campanaId, [correos[i]]));
    if (!errorUno) {
      enviados.push(correos[i]);
      continue;
    }
    const causaUno = clasificarErrorDeEnvio(errorUno);
    if (causaUno === 'direccion') {
      await repo.marcarError(campanaId, correos[i], errorUno.message);
    } else {
      // Se acabó la cuota, la velocidad o falló algo ajeno: lo enviado hasta aquí se asienta, y lo que
      // queda —esta persona y las siguientes— vuelve a pendiente.
      if (enviados.length > 0) await repo.marcarEnviados(campanaId, enviados);
      return detener(causaUno as ResultadoTanda['detenido'], errorUno, correos.slice(i));
    }
  }
  if (enviados.length > 0) await repo.marcarEnviados(campanaId, enviados);
  await repo.cerrarSiTermino(campanaId);
  return { progreso: await repo.progreso(campanaId) };
}

// ---------------------------------------------------------------------------
// Las piezas de verdad: PostgreSQL y Resend
// ---------------------------------------------------------------------------

/** Cuánto tarda una persona «enviando» en considerarse perdida (el proceso que la tomó murió). */
const MINUTOS_PARA_DAR_POR_PERDIDO = 5;

export const repositorioPg: Repositorio = {
  async reclamar(campanaId, n) {
    return consultar<FilaDeEnvio>(
      `with candidatas as (
         select correo from envios_campana
          where campana_id = $1
            and (estado = 'pendiente'
                 or (estado = 'enviando'
                     and reclamado_en < now() - make_interval(mins => $3)))
          order by correo
          limit $2
            for update skip locked
       )
       update envios_campana e
          set estado = 'enviando', reclamado_en = now()
         from candidatas c
        where e.campana_id = $1 and e.correo = c.correo
       returning e.correo, e.registro_id, e.idioma`,
      [campanaId, n, MINUTOS_PARA_DAR_POR_PERDIDO],
    );
  },
  async marcarEnviados(campanaId, correos) {
    if (correos.length === 0) return;
    await consultar(
      `update envios_campana
          set estado = 'enviado', enviado_en = now(), error = null, reclamado_en = null
        where campana_id = $1 and correo = any($2::text[])`,
      [campanaId, correos],
    );
  },
  async marcarError(campanaId, correo, error) {
    await consultar(
      `update envios_campana
          set estado = 'error', error = $3, reclamado_en = null
        where campana_id = $1 and correo = $2`,
      [campanaId, correo, error.slice(0, 500)],
    );
  },
  async devolverAPendientes(campanaId, correos) {
    if (correos.length === 0) return;
    await consultar(
      `update envios_campana
          set estado = 'pendiente', reclamado_en = null
        where campana_id = $1 and correo = any($2::text[]) and estado = 'enviando'`,
      [campanaId, correos],
    );
  },
  async progreso(campanaId) {
    const filas = await consultar<{ total: number; enviados: string; errores: string; pendientes: string; enviando: string }>(
      `select c.total,
              count(*) filter (where e.estado = 'enviado')   as enviados,
              count(*) filter (where e.estado = 'error')     as errores,
              count(*) filter (where e.estado = 'pendiente') as pendientes,
              count(*) filter (where e.estado = 'enviando')  as enviando
         from campanas_correo c
         left join envios_campana e on e.campana_id = c.id
        where c.id = $1
        group by c.id`,
      [campanaId],
    );
    const f = filas[0];
    return {
      total: Number(f?.total ?? 0),
      enviados: Number(f?.enviados ?? 0),
      errores: Number(f?.errores ?? 0),
      pendientes: Number(f?.pendientes ?? 0),
      enviando: Number(f?.enviando ?? 0),
    };
  },
  async cerrarSiTermino(campanaId) {
    await consultar(
      `update campanas_correo set estado = 'terminada'
        where id = $1 and estado = 'en_curso'
          and not exists (
            select 1 from envios_campana
             where campana_id = $1 and estado in ('pendiente', 'enviando'))`,
      [campanaId],
    );
  },
};

/** El envío de verdad, por Resend. */
export function enviadorResend(clave: string, remitente: string, replyTo: string): Enviador {
  const resend = new Resend(clave);
  const completo = (c: CorreoListo) => ({ from: remitente, to: c.to, replyTo, subject: c.subject, html: c.html });
  return {
    async lote(correos, llave) {
      const { error } = await resend.batch.send(correos.map(completo), { idempotencyKey: llave });
      return { error };
    },
    async uno(correo, llave) {
      const { error } = await resend.emails.send(completo(correo), { idempotencyKey: llave });
      return { error };
    },
  };
}

interface PlantillaCongelada {
  es: { asunto: string; cuerpo_html: string };
  en?: { asunto: string; cuerpo_html: string };
  pt?: { asunto: string; cuerpo_html: string };
}

/** Arma, para cada persona de la tanda, el correo con la plantilla congelada en su campaña. */
export async function armarDeLaCampana(campanaId: string, filas: FilaDeEnvio[]): Promise<CorreoListo[]> {
  const campana = (await consultar<{ clave: string; plantilla: PlantillaCongelada }>(
    'select clave, plantilla from campanas_correo where id = $1',
    [campanaId],
  ))[0];
  if (!campana) throw new Error('La campaña ya no existe.');

  const ids = filas.map((f) => f.registro_id).filter((id): id is string => Boolean(id));
  const registros = ids.length > 0
    ? await consultar<Record<string, unknown> & { id: string }>('select * from registros where id = any($1::uuid[])', [ids])
    : [];
  const porId = new Map(registros.map((r) => [r.id, r]));
  const configuracion = await leerConfiguracion();

  return filas.map((fila) => {
    const registro = (fila.registro_id ? porId.get(fila.registro_id) : undefined) ?? {
      correo: fila.correo, folio: '', nombres: '', apellidos: '', perfil: '', modalidad: 'en_linea',
    };
    const plantilla = campana.plantilla[fila.idioma] ?? campana.plantilla.es;
    const correo = armarCorreoConPlantilla(
      {
        clave: campana.clave as ClavePlantilla,
        registro: { ...registro, correo: fila.correo, idioma: fila.idioma },
        correoContacto: configuracion.correo_contacto,
        fechaLimite: configuracion.fecha_limite_registro,
        urlAgenda: configuracion.url_agenda,
        urlAgendaPt: configuracion.url_agenda_pt,
        urlAgendaEn: configuracion.url_agenda_en,
        urlSesionZoom: configuracion.url_sesion_zoom,
        programaPublicado: configuracion.programa_publicado,
      },
      plantilla,
    );
    return { to: fila.correo, subject: correo.asunto, html: correo.html };
  });
}

/** Procesa la siguiente tanda de una campaña, con las piezas de verdad. */
export async function enviarSiguienteTanda(campanaId: string): Promise<ResultadoTanda> {
  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;
  if (!clave || !remitente) {
    return { progreso: await repositorioPg.progreso(campanaId), detenido: 'otro', mensaje: 'Resend no está configurado.' };
  }
  const configuracion = await leerConfiguracion();
  return procesarTanda({
    repo: repositorioPg,
    enviador: enviadorResend(clave, remitente, configuracion.correo_contacto),
    armar: (filas) => armarDeLaCampana(campanaId, filas),
    campanaId,
    esperar: (ms) => new Promise((seguir) => setTimeout(seguir, ms)),
  });
}

// ---------------------------------------------------------------------------
// Audiencia y campañas
// ---------------------------------------------------------------------------

export interface PeticionDeAudiencia {
  clave: string;
  audiencia: Audiencia;
  /** Direcciones escritas a mano, sólo con la audiencia «lista». */
  lista?: string;
  incluirListaEspera?: boolean;
  /** El idioma de las direcciones que no son de ningún registro. */
  idioma?: IdiomaEnvio;
}

export type ResultadoDeAudiencia =
  | ({ ok: true } & ReturnType<typeof elegirDestinatarios> & { total: number })
  | { ok: false; mensaje: string };

/** A quiénes iría un envío, calculado ahora. No escribe nada. */
export async function calcularAudiencia(p: PeticionDeAudiencia): Promise<ResultadoDeAudiencia> {
  if (!esPlantillaMasiva(p.clave)) return { ok: false, mensaje: 'Esa plantilla no se envía en masa.' };

  let lista: string[] = [];
  if (p.audiencia === 'lista') {
    const analisis = destinatariosDePrueba(p.lista ?? '', MAXIMO_LISTA);
    if (analisis.invalidos.length > 0) {
      return { ok: false, mensaje: `Dirección no válida: ${analisis.invalidos.slice(0, 5).join(', ')}` };
    }
    if (analisis.excede) return { ok: false, mensaje: `Como máximo ${MAXIMO_LISTA} direcciones por lista.` };
    if (analisis.validos.length === 0) return { ok: false, mensaje: 'Escriba al menos una dirección.' };
    lista = analisis.validos;
  }

  const [registros, ya] = await Promise.all([
    consultar<RegistroParaEnvio>('select id, correo, idioma, estado, perfil from registros order by creado_en'),
    consultar<{ correo: string }>(
      `select distinct e.correo
         from envios_campana e join campanas_correo c on c.id = e.campana_id
        where c.clave = $1 and e.estado = 'enviado'`,
      [p.clave],
    ),
  ]);

  const seleccion = elegirDestinatarios({
    audiencia: p.audiencia,
    registros,
    yaRecibieron: new Set(ya.map((f) => f.correo.toLowerCase())),
    lista,
    incluirListaEspera: p.incluirListaEspera,
    idiomaPorOmision: p.idioma ?? 'es',
  });
  return { ok: true, ...seleccion, total: seleccion.destinatarios.length };
}

export type ResultadoDeCreacion =
  | { ok: true; id: string; total: number }
  | { ok: false; mensaje: string; codigo: 'cifra' | 'en_curso' | 'sin_plantilla' | 'invalido'; campanaEnCurso?: string };

/**
 * Crea el envío: congela la plantilla y deja a cada persona «pendiente». No manda nada todavía;
 * eso lo hace `enviarSiguienteTanda`, tanda a tanda.
 *
 * Se niega si la cifra que escribió quien confirma no coincide con la que sale ahora (la audiencia
 * cambió entre que se miró y que se confirmó) y si ya hay un envío de esta plantilla sin terminar
 * (para que un doble clic no lance dos).
 */
export async function crearCampana(
  p: PeticionDeAudiencia & { confirmacion: unknown; usuarioId: string },
): Promise<ResultadoDeCreacion> {
  const audiencia = await calcularAudiencia(p);
  if (!audiencia.ok) return { ok: false, mensaje: audiencia.mensaje, codigo: 'invalido' };

  if (!confirmacionValida(p.confirmacion, audiencia.total)) {
    return {
      ok: false, codigo: 'cifra',
      mensaje: `La cifra no coincide: ahora corresponden ${audiencia.total} personas. Revise y confirme de nuevo.`,
    };
  }

  const enCurso = await consultar<{ id: string }>(
    `select c.id from campanas_correo c
      where c.clave = $1 and c.estado = 'en_curso'
        and exists (select 1 from envios_campana e where e.campana_id = c.id and e.estado in ('pendiente', 'enviando'))
      limit 1`,
    [p.clave],
  );
  if (enCurso[0]) {
    return {
      ok: false, codigo: 'en_curso', campanaEnCurso: enCurso[0].id,
      mensaje: 'Ya hay un envío de este comunicado sin terminar. Continúelo o espere a que termine.',
    };
  }

  const plantillas = await consultar<{ idioma: IdiomaEnvio; asunto: string; cuerpo_html: string }>(
    'select idioma, asunto, cuerpo_html from plantillas_correo where clave = $1 and activa',
    [p.clave],
  );
  const congelada: Partial<PlantillaCongelada> = {};
  for (const fila of plantillas) congelada[fila.idioma] = { asunto: fila.asunto, cuerpo_html: fila.cuerpo_html };
  const faltan = [...new Set(audiencia.destinatarios.map((d) => d.idioma))].filter((i) => !congelada[i]);
  if (!congelada.es || faltan.length > 0) {
    return { ok: false, codigo: 'sin_plantilla', mensaje: `Falta la plantilla en ${(faltan.length ? faltan : ['es']).join(', ')}.` };
  }

  const id = await enTransaccion(async (cliente) => {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into campanas_correo (clave, audiencia, plantilla, creada_por, total)
       values ($1, $2, $3::jsonb, $4, $5) returning id`,
      [p.clave, p.audiencia, JSON.stringify(congelada), p.usuarioId, audiencia.total],
    );
    const campana = rows[0].id;
    const d: Destinatario[] = audiencia.destinatarios;
    await cliente.query(
      `insert into envios_campana (campana_id, correo, registro_id, idioma)
       select $1, correo, registro_id, idioma
         from unnest($2::text[], $3::uuid[], $4::text[]) as t(correo, registro_id, idioma)`,
      [campana, d.map((x) => x.correo), d.map((x) => x.registro_id), d.map((x) => x.idioma)],
    );
    return campana;
  }, p.usuarioId);

  return { ok: true, id, total: audiencia.total };
}

export interface ResumenDeCampana {
  id: string;
  clave: string;
  audiencia: Audiencia;
  creada_en: string;
  creada_por: string | null;
  estado: 'en_curso' | 'terminada';
  progreso: Progreso;
  faltaPorEnviar: boolean;
}

export async function listarCampanas(clave: string, limite = 10): Promise<ResumenDeCampana[]> {
  const filas = await consultar<{
    id: string; clave: string; audiencia: Audiencia; creada_en: string; estado: 'en_curso' | 'terminada';
    nombre: string | null; total: number; enviados: string; errores: string; pendientes: string; enviando: string;
  }>(
    `select c.id, c.clave, c.audiencia, c.creada_en, c.estado, c.total,
            coalesce(u.nombre, u.correo) as nombre,
            count(*) filter (where e.estado = 'enviado')   as enviados,
            count(*) filter (where e.estado = 'error')     as errores,
            count(*) filter (where e.estado = 'pendiente') as pendientes,
            count(*) filter (where e.estado = 'enviando')  as enviando
       from campanas_correo c
       left join usuarios_panel u on u.id = c.creada_por
       left join envios_campana e on e.campana_id = c.id
      where c.clave = $1
      group by c.id, u.nombre, u.correo
      order by c.creada_en desc
      limit $2`,
    [clave, limite],
  );
  return filas.map((f) => {
    const progreso: Progreso = {
      total: Number(f.total), enviados: Number(f.enviados), errores: Number(f.errores),
      pendientes: Number(f.pendientes), enviando: Number(f.enviando),
    };
    return {
      id: f.id, clave: f.clave, audiencia: f.audiencia, creada_en: f.creada_en, creada_por: f.nombre,
      estado: f.estado, progreso, faltaPorEnviar: faltaPorEnviar(progreso),
    };
  });
}

/** Las personas a las que no se pudo escribir en una campaña, con el motivo. */
export async function erroresDeCampana(campanaId: string): Promise<{ correo: string; error: string | null }[]> {
  return consultar(
    `select correo, error from envios_campana
      where campana_id = $1 and estado = 'error' order by correo limit 100`,
    [campanaId],
  );
}
