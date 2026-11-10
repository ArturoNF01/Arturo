import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { urlSitio } from '@/lib/config';
import { SESIONES_DE_ASISTENCIA, jornadaDeHoy, ventanaDe } from '@/lib/asistencia';
import { asegurarCodigos, leerCodigos } from '@/lib/servidor/asistencia';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { leerDatosCongreso } from '@/lib/servidor/contenido';
import { usuarioActual } from '@/lib/servidor/sesion';
import { PantallaRecepcion, type DatosDePantalla } from './pantalla-recepcion';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Recepción · QR',
  // Una página que no enlaza nadie: que ningún buscador la guarde.
  robots: { index: false, follow: false },
};

const qrSvg = (enlace: string) =>
  QRCode.toString(enlace, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });

/**
 * La pantalla vertical de la mesa de recepción: arriba el QR para descargar la agenda y abajo el de la asistencia
 * del día, que cambia solo —miércoles, jueves o viernes— según la fecha de México.
 *
 * No pide sesión: es una pantalla que se deja abierta en un monitor sin nadie que la maneje. Lo que enseña es lo
 * mismo que está impreso en la sede (el QR presencial), no datos de nadie. La pantalla se vuelve a pedir sola cada
 * minuto (ver `PantallaRecepcion`), y por eso aquí un fallo de la base no tira la página: devuelve `datos: null` y
 * la pantalla se queda con lo último que enseñó.
 *
 * `?dia=miercoles|jueves|viernes` enseña ese día en lugar del de hoy, para revisar el diseño antes del Congreso;
 * sólo lo atiende a quien tiene sesión en el panel.
 */
export default async function Recepcion({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { dia } = await searchParams;
  const ahora = new Date();

  let datos: DatosDePantalla | null = null;
  try {
    const [configuracion, congreso] = await Promise.all([leerConfiguracion(), leerDatosCongreso()]);
    const base = urlSitio().replace(/\/+$/, '');

    let jornada = jornadaDeHoy(ahora);
    let previa = false;
    if (dia) {
      const pedida = SESIONES_DE_ASISTENCIA.find((s) => s.clave === dia);
      if (pedida && (await usuarioActual())) {
        jornada = { sesion: pedida, relacion: 'hoy' };
        previa = true;
      }
    }

    let qrAsistencia: string | null = null;
    if (jornada) {
      let codigos = await leerCodigos();
      // Si nadie ha abierto todavía el panel de asistencia, los códigos no existen: se crean, sin tocar los que ya
      // hay (pueden estar impresos).
      if (!codigos[jornada.sesion.clave]?.presencial) codigos = await asegurarCodigos();
      const codigo = codigos[jornada.sesion.clave]?.presencial;
      if (codigo) qrAsistencia = await qrSvg(`${base}/a/${codigo}`);
    }

    datos = {
      ahora: ahora.toISOString(),
      urlVideo: configuracion.url_video_login,
      nombre: congreso.nombre,
      fechas: congreso.fechas,
      sede: congreso.sede,
      qrAgenda: await qrSvg(`${base}/api/agenda`),
      asistencia: jornada && {
        qr: qrAsistencia,
        dia: jornada.sesion.diaTexto,
        relacion: jornada.relacion,
        abre: ventanaDe(jornada.sesion).abre.toISOString(),
        cierra: ventanaDe(jornada.sesion).cierra.toISOString(),
        previa,
      },
    };
  } catch (error) {
    console.error('No se pudo armar la pantalla de recepción:', error);
  }

  return <PantallaRecepcion datos={datos} />;
}
