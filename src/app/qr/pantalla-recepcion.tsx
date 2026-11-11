'use client';

import { useEffect, useRef, useState } from 'react';
import { LogoCiess } from '@/componentes/logo';
import { VideoFondo } from '@/componentes/video-fondo';
import {
  TEXTOS_RECEPCION as TEXTOS, horaDeMexico, momentoDelDia,
  type DatosDePantalla, type Texto,
} from '@/lib/recepcion';
import { EnVivo } from './en-vivo';
import { ESTILOS } from './estilos';
import { SEGUNDOS_POR_IDIOMA, Triple, useAhora } from './triple';

type Asistencia = NonNullable<DatosDePantalla['asistencia']>;

/** Cada cuánto se vuelve a pedir la pantalla al servidor: lo justo para que cambie sola de un día al siguiente. */
const REFRESCO_MS = 60_000;
const REFRESCO_SIN_DATOS_MS = 10_000;
/** Si en tanto tiempo no llegó nada nuevo, se avisa a quien atiende que la pantalla está desactualizada. */
const SIN_ACTUALIZAR_MS = 150_000;

const completo = (t: Partial<Texto>): Texto => ({ es: t.es ?? '', en: t.en ?? t.es ?? '', pt: t.pt ?? t.es ?? '' });

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function Reloj({ servidor }: { servidor: string }) {
  const ahora = useAhora(servidor, 1000);
  return (
    <div className="rq-reloj" aria-hidden>
      <span className="rq-hora">{horaDeMexico(ahora)}</span>
      <span className="rq-huso">CDMX</span>
    </div>
  );
}

function Estado({ ahora, asistencia }: { ahora: number; asistencia: Asistencia }) {
  const abre = Date.parse(asistencia.abre);
  const cierra = Date.parse(asistencia.cierra);

  if (ahora >= abre && ahora <= cierra) {
    return (
      <span className="rq-chip rq-chip-abierto">
        <i className="rq-punto" />
        <Triple textos={TEXTOS.registroAbierto(horaDeMexico(cierra))} />
      </span>
    );
  }
  if (ahora < abre) {
    // Hoy: a qué hora abre. Otro día: cuál.
    const textos = asistencia.relacion === 'hoy' ? TEXTOS.registroAbre(horaDeMexico(abre)) : TEXTOS.registroDisponible(asistencia.dia);
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
      <Triple textos={asistencia.relacion === 'termino' ? TEXTOS.gracias : TEXTOS.registroCerrado} />
    </span>
  );
}

/** El QR con su marco: esquinas de visor, anillo dorado que gira y, si se pide, una línea de escaneo. */
function CajaQr({ svg, tamano, escaneo, pulso, vacio }: {
  svg: string | null; tamano: 'agenda' | 'asistencia'; escaneo?: boolean; pulso?: boolean; vacio?: Texto;
}) {
  return (
    <div className={`rq-caja rq-caja-${tamano}`}>
      <div className="rq-anillo" aria-hidden />
      <div className={`rq-panel ${pulso ? 'rq-pulso' : ''}`}>
        {svg ? (
          <div className="rq-qr" role="img" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="rq-vacio">{vacio && <Triple textos={vacio} />}</div>
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
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4M8 14h3M8 17.5h6" />
  </svg>
);

const IconoAsistencia = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <polyline points="16 11 18 13 22 9" />
  </svg>
);

const IconoAviso = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

// ---------------------------------------------------------------------------
// La pantalla
// ---------------------------------------------------------------------------

function Contenido({ datos }: { datos: DatosDePantalla }) {
  const ahora = useAhora(datos.ahora, 5000);
  const { asistencia: a, programa, aviso } = datos;

  const momento = programa ? momentoDelDia(programa.bloques, ahora) : null;
  // Hay que cuidar el lugar del QR de asistencia, que es el que más importa. Con dos salas a la vez, o con un aviso, que
  // ocupan más, la tarjeta de la agenda se aprieta (sin su icono y con un QR un poco menor); con un aviso se quita además
  // el recordatorio de la constancia, y con aviso y dos salas, también «a continuación». Sin aviso y con una sola sala,
  // no se quita nada.
  const dosSalas = (momento?.actuales.length ?? 0) > 1;
  const clases = [
    'rq-escena',
    dosSalas || aviso ? 'rq-compacta' : '',
    aviso ? 'rq-sin-constancia' : '',
    aviso && dosSalas ? 'rq-sin-sig' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={clases}>
      <header className="rq-entrada" style={{ ['--retraso' as string]: '0s' }}>
        <div className="rq-fila">
          <LogoCiess forzar="oscuro" className="rq-logo" />
          <Reloj servidor={datos.ahora} />
        </div>
        <h1 className="rq-nombre"><Triple textos={completo(datos.nombre)} lineas={2} /></h1>
      </header>

      {aviso && (
        <aside className="rq-aviso rq-entrada" style={{ ['--retraso' as string]: '0.1s' }} role="status">
          <span className="rq-aviso-icono"><IconoAviso /></span>
          <div>
            <p className="rq-aviso-etq"><Triple textos={TEXTOS.aviso} /></p>
            <p className="rq-aviso-texto"><Triple textos={aviso} lineas={3} /></p>
          </div>
        </aside>
      )}

      {programa && momento && <EnVivo programa={programa} momento={momento} ahora={ahora} />}

      {datos.qrAgenda && (
        <section className="rq-tarjeta rq-tarjeta-agenda rq-entrada" style={{ ['--retraso' as string]: '0.3s' }}>
          <div className="rq-agenda-texto">
            <span className="rq-icono"><IconoAgenda /></span>
            <h2 className="rq-titulo rq-titulo-agenda"><Triple textos={TEXTOS.agendaTitulo} /></h2>
            <p className="rq-sub"><Triple textos={TEXTOS.agendaAyuda} /></p>
            <p className="rq-nota"><Triple textos={TEXTOS.agendaIdioma} /></p>
          </div>
          <CajaQr svg={datos.qrAgenda} tamano="agenda" />
        </section>
      )}

      {a && (
        <section className="rq-tarjeta rq-tarjeta-asistencia rq-entrada" style={{ ['--retraso' as string]: '0.45s' }}>
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
            <h2 className="rq-titulo rq-titulo-fila">
              <span className="rq-icono"><IconoAsistencia /></span>
              <Triple textos={TEXTOS.asistenciaTitulo} />
            </h2>
            <p className="rq-sub"><Triple textos={TEXTOS.asistenciaAyuda} /></p>
          </div>
          <div className="rq-zona-qr">
            <CajaQr svg={a.qr} tamano="asistencia" escaneo pulso vacio={TEXTOS.sinCodigo} />
          </div>
          <Estado ahora={ahora} asistencia={a} />
          <p className="rq-constancia"><Triple textos={TEXTOS.constancia} /></p>
        </section>
      )}
    </div>
  );
}

/**
 * La pantalla vertical de la mesa de recepción. Se deja abierta en un monitor, sin nadie que la maneje, durante tres
 * días: por eso cuida lo que una pantalla desatendida necesita.
 *
 * - Se vuelve a pedir al servidor cada minuto (`/api/recepcion`) —cambia sola de un día al siguiente, recoge un aviso
 *   nuevo— y, si la petición falla (la base, la red del lugar), se queda con lo último que enseñó en vez de quedar en blanco.
 *   Se pide con `fetch` y no con `router.refresh()`: cuando una petición de Next falla, éste pasa a una navegación completa,
 *   y sin red eso deja la página de «sin conexión» del navegador.
 * - «En vivo ahora» y el reloj corren con la hora del servidor ya traída: siguen cambiando a su hora aunque se caiga la red.
 * - Pide que el monitor no se apague, se recarga sola si el sitio se actualizó, avisa —a quien atiende— cuando lleva
 *   rato sin poder actualizarse, y con doble clic pasa a pantalla completa.
 *
 * `consulta` son los parámetros de la dirección (`dia`, `hora`, `ligero`), para que una vista previa siga siendo la misma
 * en cada actualización.
 */
export function PantallaRecepcion({ datos, consulta }: { datos: DatosDePantalla | null; consulta: string }) {
  const [mostrado, setMostrado] = useState(datos);
  const llegada = useRef(0);
  const [sinActualizar, setSinActualizar] = useState(false);

  // Lo pide cada minuto (cada 10 segundos mientras no haya nada que enseñar), al volver a verse la pantalla y al volver la red.
  const conDatos = mostrado !== null;
  useEffect(() => {
    let vigente = true;
    const url = consulta ? `/api/recepcion?${consulta}` : '/api/recepcion';
    const actualizar = async () => {
      try {
        const respuesta = await fetch(url, {
          cache: 'no-store',
          signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(15_000) : undefined,
        });
        if (!respuesta.ok) return;
        const nuevos = (await respuesta.json()) as DatosDePantalla;
        if (!vigente) return;
        llegada.current = Date.now();
        setMostrado(nuevos);
      } catch {
        /* sin red o sin respuesta: se queda con lo último, y el aviso de abajo lo dirá si dura */
      }
    };
    const alVolver = () => {
      if (document.visibilityState === 'visible') void actualizar();
    };

    llegada.current = Date.now();
    const id = setInterval(() => void actualizar(), conDatos ? REFRESCO_MS : REFRESCO_SIN_DATOS_MS);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alVolver);
    return () => {
      vigente = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alVolver);
    };
  }, [consulta, conDatos]);

  // Si el sitio se actualizó mientras la pantalla estaba abierta, el código que tiene el navegador es el viejo: se recarga.
  // (Sólo ocurre cuando acaba de llegar una respuesta del servidor, así que el servidor está arriba.)
  const versionInicial = useRef<string | null>(null);
  const version = mostrado?.version ?? '';
  useEffect(() => {
    if (!version) return;
    if (versionInicial.current === null) versionInicial.current = version;
    else if (versionInicial.current !== version) window.location.reload();
  }, [version]);

  // Que el monitor no se apague ni se atenúe. Sólo donde el navegador lo permite; si no, queda lo que diga el monitor.
  useEffect(() => {
    let sentinela: WakeLockSentinel | null = null;
    let cerrado = false;
    const pedir = async () => {
      try {
        if (cerrado || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
        sentinela = await navigator.wakeLock.request('screen');
      } catch {
        /* sin permiso o sin soporte: no pasa nada */
      }
    };
    const alVolver = () => void pedir();
    void pedir();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      cerrado = true;
      document.removeEventListener('visibilitychange', alVolver);
      sentinela?.release().catch(() => undefined);
    };
  }, []);

  // ¿Lleva rato sin recibir nada nuevo? Lo ve quien atiende, no el público.
  useEffect(() => {
    const id = setInterval(() => setSinActualizar(Date.now() - llegada.current > SIN_ACTUALIZAR_MS), 10_000);
    return () => clearInterval(id);
  }, []);

  const pantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  return (
    <main
      className={`rq ${mostrado?.ligero ? 'rq-ligero' : ''}`}
      style={{ ['--ciclo' as string]: `${SEGUNDOS_POR_IDIOMA * 3}s` }}
      onDoubleClick={pantallaCompleta}
    >
      <style>{ESTILOS}</style>
      <VideoFondo url={mostrado && !mostrado.ligero ? mostrado.urlVideo : ''} opacidad={1} variante="sin-velo" posicion="contenido" />
      <div className="rq-velo" aria-hidden />
      {!mostrado?.ligero && (
        <div className="rq-orbes" aria-hidden>
          <i /><i /><i />
        </div>
      )}

      {mostrado ? (
        <Contenido datos={mostrado} />
      ) : (
        <div className="rq-escena">
          <div className="rq-espera">
            <LogoCiess forzar="oscuro" className="rq-logo" />
            <p><Triple textos={TEXTOS.reconectando} /></p>
          </div>
        </div>
      )}

      {mostrado?.asistencia?.previa && <p className="rq-previa">Vista previa · no es la fecha ni la hora de hoy</p>}

      {mostrado && sinActualizar && (
        <p className="rq-sin-conexion" role="status">
          Sin conexión con el servidor · mostrando lo último ({horaDeMexico(Date.parse(mostrado.ahora))})
        </p>
      )}
    </main>
  );
}
