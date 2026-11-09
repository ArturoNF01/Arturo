'use client';

import { useEffect, useRef, useState } from 'react';
import { BotonTema, SelectorIdioma } from '@/componentes/controles';
import { LogoCiess } from '@/componentes/logo';
import { useApp } from '@/componentes/proveedores';
import { interpolar, type Idioma } from '@/i18n';
import { correoValido, type RespuestaDeAsistencia, type RespuestaDeBusqueda, type ViaAsistencia } from '@/lib/asistencia';
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
  /** La sesión de prueba del panel: se avisa que no cuenta. */
  esPrueba: boolean;
}

type Listo = Extract<RespuestaDeAsistencia, { ok: true }>;
type Fuera = { estado: 'antes' | 'cerrada'; abre: string };
/** Cómo va la búsqueda del correo: de ella sale el nombre que se rellena solo. */
type Busqueda = 'inactiva' | 'buscando' | 'encontrado' | 'no_encontrado';

/** Para que quien escanea no vuelva a teclear su correo en las siguientes sesiones. Sólo en su celular. */
const LLAVE = 'congreso.asistencia.correo';
/** Lo que se espera tras la última tecla antes de buscar el correo: para no pedir una búsqueda por letra. */
const ESPERA_MS = 600;

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

const enviarJson = (cuerpo: Record<string, unknown>) => fetch('/api/asistencia', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
});

export function PaginaAsistencia({ codigo, sesion }: { codigo: string; sesion: DatosDeSesion | null }) {
  const { t, idioma } = useApp();
  const a = t.asistencia;

  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');
  const [busqueda, setBusqueda] = useState<Busqueda>('inactiva');
  /** El correo recordado de la vez anterior, y el nombre que tiene en los registros. */
  const [guardado, setGuardado] = useState('');
  const [nombreGuardado, setNombreGuardado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState<Listo | null>(null);
  const [fuera, setFuera] = useState<Fuera | null>(
    sesion && sesion.estado !== 'abierta' ? { estado: sesion.estado, abre: sesion.abre } : null,
  );
  const [invalido, setInvalido] = useState(sesion === null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Para descartar la respuesta de una búsqueda vieja si ya se tecleó otro correo. */
  const turno = useRef(0);

  /** Pregunta al servidor quién es ese correo. Devuelve su nombre, o null si no está (o no se pudo saber). */
  async function buscarNombre(correoABuscar: string): Promise<{ encontrado: boolean; nombre: string } | null> {
    try {
      const r = await enviarJson({ accion: 'buscar', codigo, correo: correoABuscar });
      if (r.status === 429) { setError(a.limite); return null; }
      const datos = (await r.json().catch(() => null)) as RespuestaDeBusqueda | null;
      if (!datos) return null;
      if (datos.ok) return { encontrado: datos.encontrado, nombre: datos.encontrado ? datos.nombre : '' };
      if (datos.motivo === 'fuera_de_horario') setFuera({ estado: datos.estado, abre: datos.abre });
      else if (datos.motivo === 'codigo_invalido') setInvalido(true);
      return null;
    } catch {
      return null;
    }
  }

  async function buscarYRellenar(correoABuscar: string) {
    const mio = ++turno.current;
    setBusqueda('buscando');
    setError('');
    const r = await buscarNombre(correoABuscar);
    if (mio !== turno.current) return; // ya se tecleó otra cosa
    if (!r) { setBusqueda('inactiva'); return; }
    setBusqueda(r.encontrado ? 'encontrado' : 'no_encontrado');
    setNombre(r.nombre);
  }

  function alEscribirElCorreo(valor: string) {
    setCorreo(valor);
    setError('');
    turno.current += 1; // lo que estuviera buscándose ya no vale
    if (espera.current) clearTimeout(espera.current);
    // Cambió el correo: el nombre que se había rellenado ya no es de este correo.
    setBusqueda('inactiva');
    setNombre('');
    if (correoValido(valor)) espera.current = setTimeout(() => void buscarYRellenar(valor.trim()), ESPERA_MS);
  }

  function alSalirDelCorreo() {
    // Al salir del campo no se espera: la búsqueda sale ya.
    if (espera.current) { clearTimeout(espera.current); espera.current = null; }
    if (correoValido(correo) && busqueda === 'inactiva') void buscarYRellenar(correo.trim());
  }

  useEffect(() => {
    // El correo de la vez anterior sólo se puede leer en el navegador, ya hidratada la página. Se busca de una vez
    // para saludar con el nombre completo en el botón.
    const previo = recordado();
    if (!previo) return;
    let vigente = true;
    void (async () => {
      setGuardado(previo);
      const r = await buscarNombre(previo);
      if (!vigente) return;
      if (r?.encontrado) setNombreGuardado(r.nombre);
      else if (r) {
        // Ya no está entre los registros: se vuelve al formulario con el correo puesto.
        setGuardado('');
        setCorreo(previo);
        setBusqueda('no_encontrado');
      }
    })();
    return () => { vigente = false; if (espera.current) clearTimeout(espera.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar(correoAEnviar: string, nombreAEnviar?: string) {
    setEnviando(true);
    setError('');
    try {
      const r = await enviarJson({ codigo, correo: correoAEnviar, nombre: nombreAEnviar });
      const datos = (await r.json().catch(() => null)) as RespuestaDeAsistencia | null;
      if (r.status === 429) setError(a.limite);
      else if (!datos) setError(a.error);
      else if (datos.ok) {
        recordar(correoAEnviar.trim().toLowerCase());
        setListo(datos);
      } else if (datos.motivo === 'no_encontrado') {
        setGuardado('');
        setCorreo(correoAEnviar);
        setBusqueda('no_encontrado');
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

  const puedeRegistrar =
    !enviando && (busqueda === 'encontrado' || (busqueda === 'no_encontrado' && nombre.trim().length > 0));

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
              {!sesion.esPrueba && (
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
              )}
              <p
                className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: 'color-mix(in srgb, var(--dorado) 28%, transparent)' }}
              >
                {a.via[sesion.via]}
              </p>
              {sesion.esPrueba && (
                <p className="mt-3 rounded-lg bg-sky-500/10 p-3 text-sm" role="note">{a.esPrueba}</p>
              )}
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
            ) : guardado ? (
              <div>
                <button
                  type="button"
                  className="boton-primario w-full !py-3.5 !text-base"
                  disabled={enviando}
                  onClick={() => void enviar(guardado)}
                >
                  {enviando ? a.registrando : interpolar(a.comoSoy, { correo: nombreGuardado || guardado })}
                </button>
                {nombreGuardado && <p className="mt-2 text-center text-xs tenue break-all">{guardado}</p>}
                <button
                  type="button"
                  className="mt-3 w-full text-sm underline"
                  disabled={enviando}
                  onClick={() => { recordar(null); setGuardado(''); setNombreGuardado(''); setError(''); }}
                >
                  {a.noSoyYo}
                </button>
                {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (puedeRegistrar) void enviar(correo, busqueda === 'no_encontrado' ? nombre : undefined);
                }}
                noValidate
              >
                {busqueda === 'no_encontrado' ? (
                  <p className="mb-3 rounded-lg bg-amber-500/10 p-3 text-base" role="status">{a.noEncontrado}</p>
                ) : (
                  <p className="mb-3 text-base">{a.intro}</p>
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
                  onChange={(e) => alEscribirElCorreo(e.target.value)}
                  onBlur={alSalirDelCorreo}
                  required
                />

                <label className="etiqueta mt-3 block" htmlFor="asistencia-nombre">{a.nombre}</label>
                <input
                  id="asistencia-nombre"
                  className="campo !py-3 text-base"
                  type="text"
                  autoComplete="name"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  // Rellenado desde el registro, no se edita: si no es el nombre de quien escanea, cambia el correo.
                  readOnly={busqueda === 'encontrado'}
                  disabled={busqueda === 'inactiva' || busqueda === 'buscando'}
                  placeholder={busqueda === 'buscando' ? a.buscando : busqueda === 'no_encontrado' ? a.nombreManual : a.nombrePendiente}
                  aria-busy={busqueda === 'buscando'}
                  required={busqueda === 'no_encontrado'}
                />
                {busqueda === 'encontrado' && <p className="mt-1.5 text-sm text-green-700 dark:text-green-400" role="status">{a.encontrado}</p>}

                {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
                <button type="submit" className="boton-primario mt-4 w-full !py-3.5 !text-base" disabled={!puedeRegistrar}>
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
