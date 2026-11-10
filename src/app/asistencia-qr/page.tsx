import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { urlSitio } from '@/lib/config';
import { SESIONES_DE_ASISTENCIA, nombreDeSala, ventanaDe, type SesionDeAsistencia } from '@/lib/asistencia';
import { asegurarCodigos } from '@/lib/servidor/asistencia';
import { exigirUsuario } from '@/lib/servidor/sesion';
import { BarraImpresion } from './barra-impresion';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'QR de asistencia', robots: { index: false, follow: false } };

const MARINO = '#001b57';
const DORADO = '#c7ae6f';

const hora = (d: Date) =>
  d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });

/** Cada hoja dice lo mismo en los tres idiomas: la sala es de todos. */
const LLAMADA = ['Registra tu asistencia', 'Check in', 'Registre sua presença'] as const;

function Hoja({ sesion, qr, enlace }: { sesion: SesionDeAsistencia; qr: string; enlace: string }) {
  const { abre, cierra } = ventanaDe(sesion);
  return (
    <section className="aqr-hoja">
      <p className="aqr-encabezado">1er Congreso de Estudios Interamericanos de Seguridad Social</p>
      <div className="aqr-regla" />

      <h2 className="aqr-llamada">
        {LLAMADA.map((l, i) => <span key={l} className={i === 0 ? 'aqr-principal' : 'aqr-otras'}>{l}</span>)}
      </h2>

      <div className="aqr-qr" dangerouslySetInnerHTML={{ __html: qr }} />
      <p className="aqr-enlace">{enlace.replace(/^https?:\/\//, '')}</p>

      <h1 className="aqr-sesion">{sesion.corto.es}</h1>
      {sesion.titulo && (
        <div className="aqr-titulo">
          <p>{sesion.titulo.es}</p>
          <p className="aqr-traduccion">{sesion.titulo.en}</p>
          <p className="aqr-traduccion">{sesion.titulo.pt}</p>
        </div>
      )}
      <p className="aqr-datos">
        {sesion.tipo === 'dia'
          ? `Horario del día: ${sesion.horario}`
          : `${sesion.diaTexto.es} · ${sesion.horario}${sesion.sala ? ` · ${nombreDeSala(sesion.sala, 'es')}` : ''}`}
      </p>
      <p className="aqr-vale">Disponible de {hora(abre)} a {hora(cierra)} (hora de la Ciudad de México)</p>
    </section>
  );
}

function Ficha({ sesion, qr }: { sesion: SesionDeAsistencia; qr: string }) {
  return (
    <div className="aqr-ficha">
      <div className="aqr-qr" dangerouslySetInnerHTML={{ __html: qr }} />
      <p className="aqr-sesion">{sesion.corto.es}</p>
      <p className="aqr-datos">{sesion.tipo === 'dia' ? sesion.horario : `${sesion.diaTexto.es.split(' de ')[0]} · ${sesion.horario}`}</p>
    </div>
  );
}

/**
 * Los QR de asistencia listos para imprimir: una hoja por día (para pegar en la entrada de las salas) o una tira de
 * tarjetas para recortar y poner en el programa impreso. Son tres: miércoles, jueves y viernes. Sólo los QR presenciales: el
 * enlace en línea se pega en el chat, no se imprime.
 */
export default async function AsistenciaQr({ searchParams }: { searchParams: Promise<{ formato?: string }> }) {
  await exigirUsuario('organizador');
  const { formato: pedido } = await searchParams;
  const formato = pedido === 'tira' ? 'tira' : 'hojas';
  const base = urlSitio().replace(/\/+$/, '');

  const codigos = await asegurarCodigos();
  const elementos = await Promise.all(
    SESIONES_DE_ASISTENCIA.map(async (sesion) => {
      const enlace = `${base}/a/${codigos[sesion.clave].presencial}`;
      const qr = await QRCode.toString(enlace, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
      return { sesion, qr, enlace };
    }),
  );

  return (
    <>
      <style>{`
        @page { size: letter portrait; margin: 12mm; }
        @media print {
          html, body { background: #fff !important; }
          .sin-impresion { display: none !important; }
        }
        .aqr-hoja { box-sizing: border-box; width: 100%; max-width: 190mm; margin: 0 auto; padding: 8mm 6mm; text-align: center; color: ${MARINO}; background: #fff; break-after: page; page-break-after: always; min-height: 250mm; display: flex; flex-direction: column; align-items: center; }
        .aqr-hoja:last-child { break-after: auto; page-break-after: auto; }
        .aqr-hoja .aqr-encabezado { font-size: 13pt; font-weight: 600; margin: 0; }
        .aqr-hoja .aqr-regla { width: 40mm; height: 1.2mm; background: ${DORADO}; margin: 4mm 0 6mm; }
        .aqr-hoja .aqr-llamada { margin: 0 0 5mm; display: flex; flex-direction: column; gap: 1mm; }
        .aqr-hoja .aqr-llamada .aqr-principal { font-size: 26pt; font-weight: 700; line-height: 1.1; }
        .aqr-hoja .aqr-llamada .aqr-otras { font-size: 14pt; font-weight: 500; opacity: .85; }
        .aqr-hoja .aqr-qr { width: 105mm; height: 105mm; background: #fff; }
        .aqr-hoja .aqr-qr svg { width: 100%; height: 100%; display: block; }
        .aqr-hoja .aqr-enlace { margin: 2mm 0 6mm; font-size: 10pt; color: #333; word-break: break-all; }
        .aqr-hoja .aqr-sesion { font-size: 24pt; font-weight: 700; margin: 0 0 2mm; }
        .aqr-hoja .aqr-titulo p { margin: 0 0 1mm; font-size: 13pt; line-height: 1.25; }
        .aqr-hoja .aqr-titulo .aqr-traduccion { font-size: 10pt; color: #444; }
        .aqr-hoja .aqr-datos { margin: 4mm 0 1mm; font-size: 13pt; font-weight: 600; }
        .aqr-hoja .aqr-vale { margin: 0; font-size: 9.5pt; color: #444; }
        .aqr-tira { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; max-width: 190mm; margin: 0 auto; background: #fff; }
        .aqr-ficha { box-sizing: border-box; border: 0.3mm dashed #999; padding: 4mm 3mm; text-align: center; color: ${MARINO}; break-inside: avoid; page-break-inside: avoid; height: 60mm; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .aqr-ficha .aqr-qr { width: 36mm; height: 36mm; }
        .aqr-ficha .aqr-qr svg { width: 100%; height: 100%; display: block; }
        .aqr-ficha .aqr-sesion { margin: 1.5mm 0 0; font-size: 10.5pt; font-weight: 700; line-height: 1.15; }
        .aqr-ficha .aqr-datos { margin: 0.5mm 0 0; font-size: 8.5pt; color: #444; }
      `}</style>

      <BarraImpresion formato={formato} />

      {formato === 'hojas' ? (
        <div>{elementos.map((e) => <Hoja key={e.sesion.clave} {...e} />)}</div>
      ) : (
        <div className="aqr-tira">{elementos.map((e) => <Ficha key={e.sesion.clave} sesion={e.sesion} qr={e.qr} />)}</div>
      )}
    </>
  );
}
