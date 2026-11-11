import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';
import { unaFila } from '@/lib/bd/conexion';
import { urlSitio } from '@/lib/config';
import { SESIONES_DE_ASISTENCIA, instanteEnMexico, jornadaDeHoy, ventanaDe } from '@/lib/asistencia';
import {
  avisoDeRecepcion, avisoGuardado, enlacesDeRecepcion, programaDeLaPantalla, type DatosDePantalla, type Texto,
} from '@/lib/recepcion';
import { asegurarCodigos, leerCodigos } from '@/lib/servidor/asistencia';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { leerDatosCongreso } from '@/lib/servidor/contenido';

/** La clave de `configuracion` donde el comité deja el aviso de la pantalla de recepción. */
export const CLAVE_AVISO_RECEPCION = 'aviso_recepcion';

/**
 * Lo que hay guardado como aviso, con los tres idiomas (vacíos si no hay). Si la base no responde se devuelve vacío: la
 * pantalla de recepción no se cae por un aviso que no pudo leer.
 */
export async function leerAvisoGuardado(): Promise<Texto> {
  try {
    const fila = await unaFila<{ valor: unknown }>('select valor from configuracion where clave = $1', [CLAVE_AVISO_RECEPCION]);
    return avisoGuardado(fila?.valor);
  } catch (error) {
    console.error('No se pudo leer el aviso de la pantalla de recepción:', error);
    return avisoGuardado(null);
  }
}

let versionEnMemoria: string | undefined;

/**
 * Qué compilación del sitio está sirviendo: cambia en cada despliegue. La pantalla de recepción la compara con la que
 * tenía al abrirse y, si cambió, se recarga para no quedarse con código viejo durante tres días. Vacía —y entonces la
 * pantalla no se recarga nunca— si no se puede leer (en desarrollo no hay compilación).
 */
export function versionDeLaCompilacion(): string {
  if (versionEnMemoria === undefined) {
    try {
      versionEnMemoria = readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim();
    } catch {
      versionEnMemoria = '';
    }
  }
  return versionEnMemoria;
}

const qrSvg = (enlace: string) =>
  QRCode.toString(enlace, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });

export interface OpcionesDePantalla {
  /** 'miercoles' | 'jueves' | 'viernes': enseñar ese día en lugar de hoy. Sólo se atiende con `vistaPrevia`. */
  dia?: string;
  /** 'HH:MM': a esa hora, con `dia`. */
  hora?: string;
  ligero?: boolean;
  /** Cuánto se queda cada idioma, fijo (5 a 30); sin esto, la pantalla lo calcula según lo que haya que leer. */
  segundos?: number;
  /**
   * Quien pide tiene sesión en el panel y puede ver otro día u otra hora. Lo decide quien llama (`armarParaPeticion`) y
   * no esta función, que no sabe de sesiones: así se puede probar contra la base sin montar una petición.
   */
  vistaPrevia?: boolean;
}

/**
 * Arma lo que enseña la pantalla de recepción: los dos QR, la agenda del día, el aviso y la hora del servidor. Lo piden la
 * página (la primera vez) y `/api/recepcion` (cada minuto).
 *
 * No pide sesión: es una pantalla que se deja abierta en un monitor sin nadie que la maneje. Lo que enseña es lo mismo que
 * está impreso en la sede (el QR presencial) y lo que ya es público en el sitio (la agenda), no datos de nadie.
 *
 * La agenda y el QR de la agenda sólo salen cuando el comité da el programa por publicado, igual que en el sitio: una
 * agenda a medias a la vista manda gente a la sala equivocada.
 *
 * Si algo falla (la base, sobre todo) devuelve nulo en lugar de lanzar: la pantalla se queda con lo último que enseñó.
 */
export async function armarDatosDePantalla({ dia, hora, ligero = false, segundos, vistaPrevia = false }: OpcionesDePantalla = {}): Promise<DatosDePantalla | null> {
  let ahora = new Date();
  try {
    const [configuracion, congreso, guardado] = await Promise.all([leerConfiguracion(), leerDatosCongreso(), leerAvisoGuardado()]);
    const base = urlSitio().replace(/\/+$/, '');

    let jornada = jornadaDeHoy(ahora);
    let previa = false;
    if (dia && vistaPrevia) {
      const pedida = SESIONES_DE_ASISTENCIA.find((s) => s.clave === dia);
      if (pedida) {
        jornada = { sesion: pedida, relacion: 'hoy' };
        previa = true;
        if (hora && /^\d{1,2}:\d{2}$/.test(hora)) ahora = instanteEnMexico(pedida.dia, hora);
      }
    }

    let codigoPresencial: string | null = null;
    if (jornada) {
      let codigos = await leerCodigos();
      // Si nadie ha abierto todavía el panel de asistencia, los códigos no existen: se crean, sin tocar los que ya
      // hay (pueden estar impresos).
      if (!codigos[jornada.sesion.clave]?.presencial) codigos = await asegurarCodigos();
      codigoPresencial = codigos[jornada.sesion.clave]?.presencial ?? null;
    }
    const enlaces = enlacesDeRecepcion(base, codigoPresencial);
    const publicado = configuracion.programa_publicado;

    return {
      ahora: ahora.toISOString(),
      version: versionDeLaCompilacion(),
      ligero,
      segundos: segundos ?? null,
      urlVideo: ligero ? '' : configuracion.url_video_login,
      nombre: congreso.nombre,
      fechas: congreso.fechas,
      sede: congreso.sede,
      qrAgenda: publicado ? await qrSvg(enlaces.agenda) : null,
      asistencia: jornada && {
        qr: enlaces.asistencia ? await qrSvg(enlaces.asistencia) : null,
        dia: jornada.sesion.diaTexto,
        relacion: jornada.relacion,
        abre: ventanaDe(jornada.sesion).abre.toISOString(),
        cierra: ventanaDe(jornada.sesion).cierra.toISOString(),
        previa,
      },
      programa: publicado && jornada ? programaDeLaPantalla(jornada.sesion.dia, jornada.relacion) : null,
      aviso: avisoDeRecepcion(guardado),
    };
  } catch (error) {
    console.error('No se pudo armar la pantalla de recepción:', error);
    return null;
  }
}
