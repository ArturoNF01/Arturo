'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogoCiess } from '@/componentes/logo';
import { VideoFondo } from '@/componentes/video-fondo';
import type { Idioma } from '@/i18n';
import { HUSO_CONGRESO } from '@/lib/fechas';
import type { RelacionConHoy } from '@/lib/asistencia';

type Texto = Record<Idioma, string>;
type TextoParcial = Partial<Record<Idioma, string>>;

export interface DatosDePantalla {
  /** El instante del servidor al armar la pantalla: el reloj del monitor puede estar mal; el del servidor no. */
  ahora: string;
  urlVideo: string;
  nombre: TextoParcial;
  fechas: TextoParcial;
  sede: TextoParcial;
  /** SVG del QR de la agenda. */
  qrAgenda: string;
  asistencia: {
    /** SVG del QR presencial del día, o null si todavía no hay código. */
    qr: string | null;
    dia: Texto;
    relacion: RelacionConHoy;
    abre: string;
    cierra: string;
    previa: boolean;
  } | null;
}

const IDIOMAS: readonly Idioma[] = ['es', 'en', 'pt'];
/** Cuánto se queda cada idioma en pantalla. */
const SEGUNDOS_POR_IDIOMA = 4.5;
/** Cada cuánto se vuelve a pedir la pantalla al servidor: lo justo para que cambie sola de un día al siguiente. */
const REFRESCO_MS = 60_000;
const REFRESCO_SIN_DATOS_MS = 10_000;

const completo = (t: TextoParcial): Texto => ({ es: t.es ?? '', en: t.en ?? t.es ?? '', pt: t.pt ?? t.es ?? '' });

const TEXTOS = {
  agenda: { es: 'Descarga la agenda', en: 'Download the agenda', pt: 'Baixe a agenda' },
  asistencia: { es: 'Registra tu asistencia', en: 'Check in', pt: 'Registre sua presença' },
  escanea: {
    es: 'Escanea con la cámara de tu celular',
    en: 'Scan with your phone camera',
    pt: 'Escaneie com a câmera do seu celular',
  },
  abierto: { es: 'Registro abierto', en: 'Check-in open', pt: 'Registro aberto' },
  cerrado: { es: 'Registro cerrado por hoy', en: 'Check-in closed for today', pt: 'Registro encerrado por hoje' },
  gracias: { es: 'Gracias por acompañarnos', en: 'Thank you for joining us', pt: 'Obrigado por nos acompanhar' },
  sinCodigo: { es: 'Código no disponible', en: 'Code not available', pt: 'Código indisponível' },
  reconectando: { es: 'Reconectando…', en: 'Reconnecting…', pt: 'Reconectando…' },
} satisfies Record<string, Texto>;

/** Un texto que va pasando por los tres idiomas, uno tras otro. Todos miden lo del más largo: nada brinca. */
function Triple({ textos, className = '' }: { textos: Texto; className?: string }) {
  return (
    <span className={`rq-triple ${className}`}>
      {IDIOMAS.map((idioma, n) => (
        <span key={idioma} lang={idioma} style={{ animationDelay: `${n * SEGUNDOS_POR_IDIOMA}s` }}>
          {textos[idioma]}
        </span>
      ))}
    </span>
  );
}

/**
 * La hora de ahora según el servidor: se toma el desfase entre su reloj y el del monitor y se corrige con él. Si
 * alguien deja el monitor con la hora mal, la pantalla no dice «cerrado» con el registro abierto.
 */
function useAhora(servidor: string, cada: number): number | null {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    const desfase = new Date(servidor).getTime() - Date.now();
    const marcar = () => setAhora(Date.now() + desfase);
    const primero = setTimeout(marcar, 0);
    const id = setInterval(marcar, cada);
    return () => {
      clearTimeout(primero);
      clearInterval(id);
    };
  }, [servidor, cada]);
  return ahora;
}

const formatoHora = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: HUSO_CONGRESO,
});

function Reloj({ servidor }: { servidor: string }) {
  const ahora = useAhora(servidor, 1000);
  return (
    <div className="rq-reloj" aria-hidden>
      <span className="rq-hora">{ahora === null ? '--:--' : formatoHora.format(ahora)}</span>
      <span className="rq-huso">CDMX</span>
    </div>
  );
}

function Estado({ servidor, asistencia }: { servidor: string; asistencia: NonNullable<DatosDePantalla['asistencia']> }) {
  const ahora = useAhora(servidor, 5000);
  if (ahora === null) return <span className="rq-chip rq-chip-espera">&nbsp;</span>;

  const abre = new Date(asistencia.abre).getTime();
  const cierra = new Date(asistencia.cierra).getTime();
  const hora = formatoHora.format(abre);

  if (ahora >= abre && ahora <= cierra) {
    return (
      <span className="rq-chip rq-chip-abierto">
        <i className="rq-punto" />
        <Triple textos={TEXTOS.abierto} />
      </span>
    );
  }
  if (ahora < abre) {
    // Hoy: a qué hora abre. Otro día: cuál.
    const textos: Texto =
      asistencia.relacion === 'hoy'
        ? { es: `Abre a las ${hora}`, en: `Opens at ${hora}`, pt: `Abre às ${hora}` }
        : { es: `Disponible el ${asistencia.dia.es}`, en: `Available ${asistencia.dia.en}`, pt: `Disponível ${asistencia.dia.pt}` };
    return (
      <span className="rq-chip rq-chip-antes">
        <i className="rq-punto" />
        <Triple textos={textos} />
      </span>
    );
  }
  return (
    <span className="rq-chip rq-chip-cerrado">
      <i className="rq-punto" />
      <Triple textos={asistencia.relacion === 'termino' ? TEXTOS.gracias : TEXTOS.cerrado} />
    </span>
  );
}

/** El QR con su marco: esquinas de visor, anillo dorado que gira y, si se pide, una línea de escaneo. */
function CajaQr({ svg, tamano, escaneo, pulso, vacio }: { svg: string | null; tamano: 'agenda' | 'asistencia'; escaneo?: boolean; pulso?: boolean; vacio?: string }) {
  return (
    <div className={`rq-caja rq-caja-${tamano}`}>
      <div className="rq-anillo" aria-hidden />
      <div className={`rq-panel ${pulso ? 'rq-pulso' : ''}`}>
        {svg ? (
          <div className="rq-qr" role="img" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="rq-vacio">{vacio}</div>
        )}
        {svg && escaneo && <div className="rq-escaneo" aria-hidden />}
      </div>
      <i className="rq-esquina rq-e1" aria-hidden />
      <i className="rq-esquina rq-e2" aria-hidden />
      <i className="rq-esquina rq-e3" aria-hidden />
      <i className="rq-esquina rq-e4" aria-hidden />
    </div>
  );
}

const IconoAgenda = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M12 12v6" />
    <polyline points="9 15.5 12 18.5 15 15.5" />
  </svg>
);

const IconoAsistencia = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <polyline points="16 11 18 13 22 9" />
  </svg>
);

export function PantallaRecepcion({ datos }: { datos: DatosDePantalla | null }) {
  const router = useRouter();

  // Si una petición falla (la base, la red del lugar), `datos` llega vacío: la pantalla se queda con lo último que
  // enseñó en vez de quedar en blanco frente a quien llega a registrarse.
  const [mostrado, setMostrado] = useState(datos);
  if (datos && datos !== mostrado) setMostrado(datos);

  const conDatos = mostrado !== null;
  useEffect(() => {
    const id = setInterval(() => router.refresh(), conDatos ? REFRESCO_MS : REFRESCO_SIN_DATOS_MS);
    return () => clearInterval(id);
  }, [router, conDatos]);

  // Un monitor que se deja prendido tres días: se pide la pantalla también al volver a verse la pestaña.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [router]);

  const a = mostrado?.asistencia ?? null;

  return (
    <main className="rq" style={{ ['--ciclo' as string]: `${SEGUNDOS_POR_IDIOMA * 3}s` }}>
      <style>{ESTILOS}</style>
      <VideoFondo url={mostrado?.urlVideo ?? ''} opacidad={1} variante="sin-velo" posicion="contenido" />
      <div className="rq-velo" aria-hidden />
      <div className="rq-orbes" aria-hidden>
        <i /><i /><i />
      </div>

      <div className="rq-escena">
        {mostrado ? (
          <>
            <header className="rq-cabecera rq-entrada" style={{ ['--retraso' as string]: '0s' }}>
              <div className="rq-fila">
                <LogoCiess forzar="oscuro" className="rq-logo" />
                <Reloj servidor={mostrado.ahora} />
              </div>
              <h1 className="rq-nombre">
                <Triple textos={completo(mostrado.nombre)} />
              </h1>
              <p className="rq-datos">
                {completo(mostrado.fechas).es} <span aria-hidden>·</span> {completo(mostrado.sede).es}
              </p>
            </header>

            <section className="rq-tarjeta rq-entrada" style={{ ['--retraso' as string]: '0.25s' }}>
              <div className="rq-encabezado">
                <span className="rq-icono"><IconoAgenda /></span>
                <h2 className="rq-titulo"><Triple textos={TEXTOS.agenda} /></h2>
                <p className="rq-sub"><Triple textos={TEXTOS.escanea} /></p>
              </div>
              <CajaQr svg={mostrado.qrAgenda} tamano="agenda" />
            </section>

            {a && (
              <section className="rq-tarjeta rq-tarjeta-asistencia rq-entrada" style={{ ['--retraso' as string]: '0.5s' }}>
                <div className="rq-encabezado">
                  <p className="rq-dia">
                    <Triple
                      textos={{
                        es: `${a.relacion === 'hoy' ? 'Hoy · ' : a.relacion === 'proximo' ? 'Próximo día · ' : ''}${a.dia.es}`,
                        en: `${a.relacion === 'hoy' ? 'Today · ' : a.relacion === 'proximo' ? 'Next day · ' : ''}${a.dia.en}`,
                        pt: `${a.relacion === 'hoy' ? 'Hoje · ' : a.relacion === 'proximo' ? 'Próximo dia · ' : ''}${a.dia.pt}`,
                      }}
                    />
                  </p>
                  <span className="rq-icono"><IconoAsistencia /></span>
                  <h2 className="rq-titulo"><Triple textos={TEXTOS.asistencia} /></h2>
                  <p className="rq-sub"><Triple textos={TEXTOS.escanea} /></p>
                </div>
                <CajaQr svg={a.qr} tamano="asistencia" escaneo pulso vacio={TEXTOS.sinCodigo.es} />
                <Estado servidor={mostrado.ahora} asistencia={a} />
                {a.previa && <span className="rq-previa">Vista previa</span>}
              </section>
            )}
          </>
        ) : (
          <div className="rq-espera">
            <LogoCiess forzar="oscuro" className="rq-logo" />
            <p><Triple textos={TEXTOS.reconectando} /></p>
          </div>
        )}
      </div>
    </main>
  );
}

const DORADO = '#c7ae6f';
const DORADO_CLARO = '#ecdca8';

/**
 * Los estilos van aquí y con prefijo `rq-`: la pantalla es una sola y no comparte nada con el resto del sitio. Todo
 * se mide en «u», que es el 1 % del ancho de una pantalla vertical 9:16 (`min(1vw, 0.5625dvh)`): así la escena
 * entera —de 100u por 177.8u— cabe en cualquier monitor sin que nada se desborde, y en uno más ancho sobra video a
 * los lados.
 */
const ESTILOS = `
@property --rq-ang { syntax: '<angle>'; inherits: false; initial-value: 0deg; }

.rq { --u: min(1vw, 0.5625dvh); position: relative; isolation: isolate; overflow: hidden; display: grid; place-items: center;
  min-height: 100dvh; width: 100%; background: #000; color: #fff; text-align: center;
  font-family: 'Work Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; }
.rq h1, .rq h2, .rq p { margin: 0; font-family: inherit; }

/* El video a toda luz, bajo un velo azul como el de la portada; más cerrado abajo, donde van los QR. */
.rq-velo { position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(180deg, rgba(11,37,112,.78) 0%, rgba(11,37,112,.5) 32%, rgba(11,37,112,.62) 62%, rgba(0,27,87,.9) 100%); }

/* Tres manchas de luz que van a la deriva sobre el video: lo que le da vida a lo quieto. */
.rq-orbes { position: absolute; inset: 0; z-index: 1; pointer-events: none; mix-blend-mode: screen; }
.rq-orbes i { position: absolute; border-radius: 50%; will-change: transform; }
.rq-orbes i:nth-child(1) { width: calc(var(--u)*90); height: calc(var(--u)*90); left: -25%; top: 4%;
  background: radial-gradient(circle, rgba(60,110,255,.45), transparent 65%); animation: rq-deriva-1 19s ease-in-out infinite alternate; }
.rq-orbes i:nth-child(2) { width: calc(var(--u)*80); height: calc(var(--u)*80); right: -28%; top: 38%;
  background: radial-gradient(circle, rgba(199,174,111,.38), transparent 65%); animation: rq-deriva-2 23s ease-in-out infinite alternate; }
.rq-orbes i:nth-child(3) { width: calc(var(--u)*85); height: calc(var(--u)*85); left: -10%; bottom: -8%;
  background: radial-gradient(circle, rgba(70,140,255,.35), transparent 65%); animation: rq-deriva-3 27s ease-in-out infinite alternate; }
@keyframes rq-deriva-1 { to { transform: translate(calc(var(--u)*30), calc(var(--u)*22)) scale(1.18); } }
@keyframes rq-deriva-2 { to { transform: translate(calc(var(--u)*-26), calc(var(--u)*-28)) scale(.88); } }
@keyframes rq-deriva-3 { to { transform: translate(calc(var(--u)*24), calc(var(--u)*-20)) scale(1.12); } }

.rq-escena { position: relative; z-index: 2; box-sizing: border-box; width: calc(var(--u)*100); height: calc(var(--u)*177.78);
  padding: calc(var(--u)*4) calc(var(--u)*5) calc(var(--u)*4.5); display: flex; flex-direction: column; justify-content: space-between; gap: calc(var(--u)*2.2); }

/* Cada bloque entra desde abajo, uno tras otro. */
.rq-entrada { animation: rq-entra 1s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--retraso, 0s); }
@keyframes rq-entra { from { opacity: 0; transform: translateY(calc(var(--u)*5)); } to { opacity: 1; transform: none; } }

/* Cabecera */
.rq-fila { display: flex; align-items: center; justify-content: space-between; }
.rq-logo { height: calc(var(--u)*5.6); }
.rq-reloj { display: flex; align-items: baseline; gap: calc(var(--u)*1.2); font-variant-numeric: tabular-nums; }
.rq-hora { font-size: calc(var(--u)*5.2); font-weight: 600; letter-spacing: .02em; color: ${DORADO_CLARO}; text-shadow: 0 0 calc(var(--u)*2) rgba(199,174,111,.55); }
.rq-huso { font-size: calc(var(--u)*1.9); font-weight: 600; letter-spacing: .18em; opacity: .75; }
.rq-nombre { margin-top: calc(var(--u)*2.4); font-size: calc(var(--u)*4); font-weight: 700; line-height: 1.15; color: ${DORADO_CLARO};
  text-shadow: 0 calc(var(--u)*.2) calc(var(--u)*1.6) rgba(0,10,40,.6); }
.rq-datos { margin-top: calc(var(--u)*1.4); font-size: calc(var(--u)*2.3); font-weight: 500; opacity: .92; }

/* Tarjetas */
.rq-tarjeta { position: relative; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: calc(var(--u)*3.6); padding: calc(var(--u)*3) calc(var(--u)*3); border-radius: calc(var(--u)*3.2);
  background: linear-gradient(180deg, rgba(10,28,92,.62), rgba(4,14,52,.72)); border: 1px solid rgba(199,174,111,.45);
  box-shadow: 0 calc(var(--u)*1.5) calc(var(--u)*6) rgba(0,8,40,.5), inset 0 1px 0 rgba(255,255,255,.12);
  backdrop-filter: blur(calc(var(--u)*1.1)); -webkit-backdrop-filter: blur(calc(var(--u)*1.1)); }
.rq-tarjeta-asistencia { border-color: rgba(236,220,168,.7); }
.rq-encabezado { display: flex; flex-direction: column; align-items: center; gap: calc(var(--u)*.9); }
.rq-icono { display: grid; place-items: center; width: calc(var(--u)*5.4); height: calc(var(--u)*5.4); border-radius: 50%;
  color: #001b57; background: linear-gradient(135deg, ${DORADO_CLARO}, ${DORADO}); box-shadow: 0 0 calc(var(--u)*2.4) rgba(199,174,111,.65); }
.rq-icono svg { width: 58%; height: 58%; }
.rq-titulo { font-size: calc(var(--u)*4.8); font-weight: 700; line-height: 1.1; }
.rq-sub { font-size: calc(var(--u)*2.4); font-weight: 500; opacity: .88; }
.rq-dia { font-size: calc(var(--u)*2.6); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: ${DORADO_CLARO}; }

/* El QR: blanco, con anillo dorado que gira, esquinas de visor y, el de asistencia, una línea que lo barre. */
.rq-caja { position: relative; flex: none; }
.rq-caja-agenda { width: calc(var(--u)*31); height: calc(var(--u)*31); }
.rq-caja-asistencia { width: calc(var(--u)*40); height: calc(var(--u)*40); }
.rq-panel { position: absolute; inset: 0; z-index: 2; overflow: hidden; border-radius: calc(var(--u)*2); background: #fff; display: grid; place-items: center; }
.rq-qr, .rq-qr svg { width: 100%; height: 100%; display: block; }
.rq-vacio { padding: calc(var(--u)*3); color: #001b57; font-size: calc(var(--u)*3); font-weight: 600; }
.rq-anillo { position: absolute; z-index: 1; inset: calc(var(--u)*-.9); border-radius: calc(var(--u)*2.8);
  background: conic-gradient(from var(--rq-ang), rgba(199,174,111,.12) 0 55%, ${DORADO} 78%, #fff 92%, rgba(199,174,111,.12) 100%);
  animation: rq-giro 5s linear infinite; }
@keyframes rq-giro { to { --rq-ang: 360deg; } }
.rq-pulso { animation: rq-latido 2.4s ease-in-out infinite; }
@keyframes rq-latido { 0% { box-shadow: 0 0 0 0 rgba(236,220,168,.6); } 70%, 100% { box-shadow: 0 0 0 calc(var(--u)*3.4) rgba(236,220,168,0); } }
.rq-escaneo { position: absolute; left: 0; right: 0; top: 0; height: calc(var(--u)*1.6); pointer-events: none; mix-blend-mode: multiply;
  background: linear-gradient(180deg, rgba(255,190,70,0), rgba(255,190,70,.85) 60%, rgba(255,255,255,0));
  animation: rq-barrido 3.2s ease-in-out infinite; }
/* Multiplicada, la línea tiñe de ámbar lo blanco y deja intacto lo negro: el QR se sigue leyendo en cualquier cuadro. */
@keyframes rq-barrido { 0% { transform: translateY(0); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateY(calc(var(--u)*38.5)); opacity: 0; } }
.rq-esquina { position: absolute; z-index: 3; width: calc(var(--u)*4.2); height: calc(var(--u)*4.2); border: calc(var(--u)*.55) solid ${DORADO_CLARO};
  filter: drop-shadow(0 0 calc(var(--u)*.7) rgba(236,220,168,.9)); animation: rq-visor 2.4s ease-in-out infinite; pointer-events: none; }
.rq-e1 { left: calc(var(--u)*-2.2); top: calc(var(--u)*-2.2); border-right: 0; border-bottom: 0; border-top-left-radius: calc(var(--u)*1.6); transform-origin: top left; }
.rq-e2 { right: calc(var(--u)*-2.2); top: calc(var(--u)*-2.2); border-left: 0; border-bottom: 0; border-top-right-radius: calc(var(--u)*1.6); transform-origin: top right; }
.rq-e3 { left: calc(var(--u)*-2.2); bottom: calc(var(--u)*-2.2); border-right: 0; border-top: 0; border-bottom-left-radius: calc(var(--u)*1.6); transform-origin: bottom left; }
.rq-e4 { right: calc(var(--u)*-2.2); bottom: calc(var(--u)*-2.2); border-left: 0; border-top: 0; border-bottom-right-radius: calc(var(--u)*1.6); transform-origin: bottom right; }
@keyframes rq-visor { 0%, 100% { transform: scale(1); opacity: .95; } 50% { transform: scale(1.22); opacity: .55; } }

/* El estado del registro */
.rq-chip { display: inline-flex; align-items: center; gap: calc(var(--u)*1.2); padding: calc(var(--u)*1) calc(var(--u)*2.6); border-radius: 999px;
  font-size: calc(var(--u)*2.5); font-weight: 600; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.28); }
.rq-chip .rq-triple { text-align: left; }
.rq-punto { width: calc(var(--u)*1.5); height: calc(var(--u)*1.5); border-radius: 50%; background: currentColor; flex: none; }
.rq-chip-abierto { color: #54e6a4; border-color: rgba(84,230,164,.6); background: rgba(40,160,110,.22); }
.rq-chip-abierto .rq-punto { animation: rq-vivo 1.4s ease-out infinite; }
@keyframes rq-vivo { 0% { box-shadow: 0 0 0 0 rgba(84,230,164,.75); } 100% { box-shadow: 0 0 0 calc(var(--u)*1.8) rgba(84,230,164,0); } }
.rq-chip-antes { color: ${DORADO_CLARO}; border-color: rgba(236,220,168,.55); }
.rq-chip-cerrado { color: #ffd08a; border-color: rgba(255,208,138,.5); }
.rq-chip-cerrado .rq-triple, .rq-chip-antes .rq-triple, .rq-chip-abierto .rq-triple { color: #fff; }
.rq-previa { position: absolute; top: calc(var(--u)*1.6); right: calc(var(--u)*2); font-size: calc(var(--u)*1.7); font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  padding: calc(var(--u)*.4) calc(var(--u)*1.2); border-radius: 999px; background: #c7ae6f; color: #001b57; }

/* Reconectando */
.rq-espera { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(var(--u)*4); font-size: calc(var(--u)*4); font-weight: 600; }

/* Los tres idiomas, uno sobre otro: cada uno se enciende un tercio del ciclo. */
.rq-triple { display: inline-grid; }
.rq-triple > span { grid-area: 1 / 1; opacity: 0; animation: rq-idioma var(--ciclo, 13.5s) ease-in-out infinite; }
@keyframes rq-idioma {
  0% { opacity: 0; transform: translateY(35%); }
  4% { opacity: 1; transform: none; }
  30% { opacity: 1; transform: none; }
  34% { opacity: 0; transform: translateY(-35%); }
  100% { opacity: 0; transform: translateY(-35%); }
}

/* Quien pidió menos movimiento: sin animaciones, y en un solo idioma. */
@media (prefers-reduced-motion: reduce) {
  .rq *, .rq *::before, .rq *::after { animation: none !important; }
  .rq-triple > span:first-child { opacity: 1; }
  .rq-triple > span:not(:first-child) { display: none; }
  .rq-escaneo { display: none; }
}
@media print { .rq { display: none; } }
`;
