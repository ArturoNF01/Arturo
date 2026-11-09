'use client';

import { useEffect, useState } from 'react';
import { BotonTema, SelectorIdioma } from '@/componentes/controles';
import { LogoCiess } from '@/componentes/logo';
import { useApp } from '@/componentes/proveedores';
import { interpolar, type Idioma } from '@/i18n';
import type { RespuestaDeAsistencia, ViaAsistencia } from '@/lib/asistencia';
import { SALAS, type ClaveSala } from '@/lib/programa';

type Texto = Record<Idioma, string>;

export interface DatosDeSesion {
  clave: string;
  via: ViaAsistencia;
  corto: Texto;
  titulo: Texto | null;
  dia: Texto;
  horario: string;
  sala: ClaveSala | null;
  estado: 'antes' | 'abierta' | 'cerrada';
  abre: string;
  cierra: string;
}

type Listo = Extract<RespuestaDeAsistencia, { ok: true }>;
type Fuera = { estado: 'antes' | 'cerrada'; abre: string };

/** Para que quien escanea no vuelva a teclear su correo en las siguientes sesiones. Sólo en su celular. */
const LLAVE = 'congreso.asistencia.correo';

function recordado(): string {
  try {
    return localStorage.getItem(LLAVE) ?? '';
  } catch {
    return '';
  }
}
function recordar(correo: string | null) {
  try {
    if (correo) localStorage.setItem(LLAVE, correo);
    else localStorage.removeItem(LLAVE);
  } catch {
    // Sin almacenamiento (ventana privada) funciona igual: sólo hay que volver a escribirlo.
  }
}

const LENGUA = { es: 'es-MX', en: 'en-US', pt: 'pt-BR' } as const;

function horaDeMexico(iso: string, idioma: Idioma): string {
  return new Date(iso).toLocaleTimeString(LENGUA[idioma], {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
  });
}

export function PaginaAsistencia({ codigo, sesion }: { codigo: string; sesion: DatosDeSesion | null }) {
  const { t, idioma } = useApp();
  const a = t.asistencia;

  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');
  const [guardado, setGuardado] = useState('');
  const [paso, setPaso] = useState<'correo' | 'datos'>('correo');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState<Listo | null>(null);
  const [fuera, setFuera] = useState<Fuera | null>(
    sesion && sesion.estado !== 'abierta' ? { estado: sesion.estado, abre: sesion.abre } : null,
  );
  const [invalido, setInvalido] = useState(sesion === null);

  useEffect(() => {
    // El correo de la vez anterior sólo se puede leer en el navegador, ya hidratada la página.
    const previo = recordado();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (previo) setGuardado(previo);
  }, []);

  async function enviar(correoAEnviar: string, nombreAEnviar?: string) {
    setEnviando(true);
    setError('');
    try {
      const r = await fetch('/api/asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, correo: correoAEnviar, nombre: nombreAEnviar }),
      });
      const datos = (await r.json().catch(() => null)) as RespuestaDeAsistencia | null;
      if (r.status === 429) setError(a.limite);
      else if (!datos) setError(a.error);
      else if (datos.ok) {
        recordar(correoAEnviar.trim().toLowerCase());
        setListo(datos);
      } else if (datos.motivo === 'no_encontrado') {
        setCorreo(correoAEnviar);
        setGuardado('');
        setPaso('datos');
      } else if (datos.motivo === 'fuera_de_horario') setFuera({ estado: datos.estado, abre: datos.abre });
      else if (datos.motivo === 'codigo_invalido') setInvalido(true);
      else if (datos.motivo === 'datos_invalidos') setError(a.correoInvalido);
      else setError(datos.motivo === 'limite' ? a.limite : a.error);
    } catch {
      setError(a.error);
    } finally {
      setEnviando(false);
    }
  }

  const mensajeFuera = fuera
    ? fuera.estado === 'antes'
      ? interpolar(a.fueraAntes, { hora: horaDeMexico(fuera.abre, idioma) })
      : a.fueraDespues
    : '';

  return (
    <>
      <header
        className="border-b"
        style={{ borderColor: 'var(--borde)', backgroundColor: 'color-mix(in srgb, var(--fondo) 88%, transparent)' }}
      >
        {/* Los logos juntos miden ~340 px: en un celular no caben con los controles al lado, y el
            menú baja a su propia línea en vez de ensanchar la página. */}
        <div className="mx-auto flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <LogoCiess className="h-7 max-w-full sm:h-9" />
          <div className="ml-auto flex items-center gap-2">
            <SelectorIdioma compacto />
            <BotonTema />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6 sm:py-10">
        <section className="tarjeta p-5 sm:p-7" aria-labelledby="asistencia-titulo">
          <p className="text-xs font-semibold uppercase tracking-wide tenue">{a.titulo}</p>

          {sesion && !invalido && (
            <>
              <h1 id="asistencia-titulo" className="mt-1 text-2xl font-bold leading-tight">{sesion.corto[idioma]}</h1>
              {sesion.titulo && <p className="mt-1 text-base leading-snug">{sesion.titulo[idioma]}</p>}
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="tenue">{a.dia}</dt>
                <dd>{sesion.dia[idioma]}</dd>
                <dt className="tenue">{a.horario}</dt>
                <dd>{sesion.horario}</dd>
                {sesion.sala && (
                  <>
                    <dt className="tenue">{a.sala}</dt>
                    <dd>{SALAS[sesion.sala][idioma]}</dd>
                  </>
                )}
              </dl>
              <p
                className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: 'color-mix(in srgb, var(--dorado) 28%, transparent)' }}
              >
                {a.via[sesion.via]}
              </p>
            </>
          )}

          <div className="mt-5">
            {invalido ? (
              <p className="rounded-lg bg-red-500/10 p-4 text-base text-red-600 dark:text-red-400" role="alert">{a.invalido}</p>
            ) : fuera ? (
              <p className="rounded-lg bg-amber-500/10 p-4 text-base" role="status">{mensajeFuera}</p>
            ) : listo ? (
              <div role="status" aria-live="polite">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-green-600 dark:text-green-400"
                  aria-hidden
                >
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </div>
                <h2 className="mt-3 text-xl font-bold">{a.listoTitulo}</h2>
                {listo.nombre && <p className="mt-1 text-base">{interpolar(a.gracias, { nombre: listo.nombre })}</p>}
                {listo.estado === 'ya_registrada' && <p className="mt-2 text-sm">{a.yaEstaba}</p>}
                {listo.sinRegistro && (
                  <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm">{a.sinRegistro}</p>
                )}
                <p className="ayuda mt-3">{a.nota}</p>
              </div>
            ) : paso === 'correo' && guardado ? (
              <div>
                <button
                  type="button"
                  className="boton-primario w-full !py-3.5 !text-base"
                  disabled={enviando}
                  onClick={() => void enviar(guardado)}
                >
                  {enviando ? a.registrando : interpolar(a.comoSoy, { correo: guardado })}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full text-sm underline"
                  disabled={enviando}
                  onClick={() => { recordar(null); setGuardado(''); setError(''); }}
                >
                  {a.noSoyYo}
                </button>
                {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void enviar(correo, paso === 'datos' ? nombre : undefined);
                }}
                noValidate
              >
                {paso === 'correo' ? (
                  <p className="mb-3 text-base">{a.intro}</p>
                ) : (
                  <p className="mb-3 rounded-lg bg-amber-500/10 p-3 text-base" role="status">{a.noEncontrado}</p>
                )}

                {paso === 'datos' && (
                  <div className="mb-3">
                    <label className="etiqueta" htmlFor="asistencia-nombre">{a.nombre}</label>
                    <input
                      id="asistencia-nombre"
                      className="campo !py-3 text-base"
                      type="text"
                      autoComplete="name"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      required
                    />
                  </div>
                )}

                <label className="etiqueta" htmlFor="asistencia-correo">{a.correo}</label>
                <input
                  id="asistencia-correo"
                  className="campo !py-3 text-base"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  required
                />
                {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
                <button
                  type="submit"
                  className="boton-primario mt-4 w-full !py-3.5 !text-base"
                  disabled={enviando || correo.trim().length === 0 || (paso === 'datos' && nombre.trim().length === 0)}
                >
                  {enviando ? a.registrando : a.registrar}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
