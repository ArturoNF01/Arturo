'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { interpolar, type Idioma } from '@/i18n';
import { SESION_DE_PRUEBA, type PersonaConAsistencia, type ViaAsistencia } from '@/lib/asistencia';
import { SALAS, type ClaveSala, type TipoSesion } from '@/lib/programa';
import type { Asistente, CodigosPorSesion, EstadoDePrueba, RegistroCoincidente, ResumenDeSesion } from '@/lib/servidor/asistencia';

type Texto = Record<Idioma, string>;

export interface SesionPlana {
  clave: string;
  dia: string;
  horario: string;
  tipo: TipoSesion;
  sala: ClaveSala | null;
  corto: Texto;
  titulo: Texto | null;
  abre: string;
  cierra: string;
}

type Pestana = 'sesiones' | 'personas' | 'codigos';

const LENGUA = { es: 'es-MX', en: 'en-US', pt: 'pt-BR' } as const;
const REFRESCO_MS = 30_000;

async function pedir<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; datos: T | null; mensaje?: string }> {
  try {
    const r = await fetch(url, init);
    const datos = (await r.json().catch(() => null)) as (T & { mensaje?: string }) | null;
    return { ok: r.ok, datos, mensaje: datos?.mensaje };
  } catch {
    return { ok: false, datos: null };
  }
}

const post = (cuerpo: Record<string, unknown>) =>
  ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }) satisfies RequestInit;

/**
 * La asistencia a las sesiones, en tres vistas: por sesión (cuántas personas y quiénes), por persona
 * (a qué fue cada quien en los tres días) y los códigos para imprimir los QR y pegar los enlaces en el chat.
 *
 * El resumen se refresca solo cada 30 segundos mientras la pestaña está a la vista: durante una mesa se
 * ve cómo va entrando la gente.
 */
export function PanelAsistencia({
  sesiones, dias, resumenInicial, puedeExportar, puedeGestionar, codigos: codigosIniciales, qrs, urlBase, pruebaInicial,
}: {
  sesiones: SesionPlana[];
  dias: { iso: string; texto: Texto }[];
  resumenInicial: Record<string, ResumenDeSesion>;
  puedeExportar: boolean;
  puedeGestionar: boolean;
  codigos: CodigosPorSesion | null;
  qrs: Record<string, string>;
  urlBase: string;
  pruebaInicial: EstadoDePrueba | null;
}) {
  const { t, idioma } = useApp();
  const a = t.panel.asistencia;

  const [pestana, setPestana] = useState<Pestana>('sesiones');
  const [ahora, setAhora] = useState(() => Date.now());
  // El día de hoy si cae en el Congreso; si no, el primero.
  const [dia, setDia] = useState(() => {
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
    return dias.find((d) => d.iso === hoy)?.iso ?? dias[0]?.iso ?? '';
  });
  const [resumen, setResumen] = useState(resumenInicial);
  const [actualizadoA, setActualizadoA] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [asistentes, setAsistentes] = useState<Record<string, Asistente[]>>({});
  const [personas, setPersonas] = useState<PersonaConAsistencia[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [personaAbierta, setPersonaAbierta] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [codigos, setCodigos] = useState(codigosIniciales);
  const [prueba, setPrueba] = useState(pruebaInicial);
  const [trabajando, setTrabajando] = useState(false);
  /** Cómo le fue a la última pasada a la hoja de Google desde el servidor del sitio. */
  const [hoja, setHoja] = useState<{ ultimaVez: string | null; error: string | null } | null>(null);
  const abiertaRef = useRef(abierta);
  useEffect(() => { abiertaRef.current = abierta; }, [abierta]);

  const hora = useCallback(
    (iso: string) => new Date(iso).toLocaleTimeString(LENGUA[idioma], { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }),
    [idioma],
  );
  const marcarActualizado = useCallback(
    () => setActualizadoA(new Date().toLocaleTimeString(LENGUA[idioma], { hour: '2-digit', minute: '2-digit', second: '2-digit' })),
    [idioma],
  );

  const cargarResumen = useCallback(async () => {
    const r = await pedir<{ resumen: Record<string, ResumenDeSesion>; hoja: { ultimaVez: string | null; error: string | null } }>('/api/asistencia/panel?vista=resumen');
    if (r.ok && r.datos) { setResumen(r.datos.resumen); setHoja(r.datos.hoja); marcarActualizado(); setError(''); } else setError(a.error);
  }, [a.error, marcarActualizado]);

  const cargarSesion = useCallback(async (clave: string) => {
    const r = await pedir<{ asistentes: Asistente[] }>(`/api/asistencia/panel?vista=sesion&sesion=${encodeURIComponent(clave)}`);
    if (r.ok && r.datos) setAsistentes((previos) => ({ ...previos, [clave]: r.datos!.asistentes }));
    else setError(a.error);
  }, [a.error]);

  const cargarPersonas = useCallback(async () => {
    const r = await pedir<{ personas: PersonaConAsistencia[] }>('/api/asistencia/panel?vista=personas');
    if (r.ok && r.datos) setPersonas(r.datos.personas); else setError(a.error);
  }, [a.error]);

  // El refresco automático: sólo con la pestaña del navegador a la vista.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setAhora(Date.now());
      void cargarResumen();
      if (abiertaRef.current) void cargarSesion(abiertaRef.current);
    }, REFRESCO_MS);
    return () => clearInterval(id);
  }, [cargarResumen, cargarSesion]);

  // Al abrir la pantalla también se pregunta cómo va la hoja de Google, no sólo cuando pasan los 30 segundos.
  useEffect(() => {
    // La respuesta llega después de pintar: no se actualiza nada de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarResumen();
  }, [cargarResumen]);

  useEffect(() => {
    // Carga perezosa: la vista por persona pesa más y sólo se pide al abrirla.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pestana === 'personas' && personas === null) void cargarPersonas();
  }, [pestana, personas, cargarPersonas]);

  // La prueba aparece como un cuarto «día» mientras esté activa o tenga algo guardado, y no suma al total.
  const hayPrueba = Boolean(prueba?.activa) || (resumen.prueba?.total ?? 0) > 0;
  const diasVista = useMemo(
    () => (hayPrueba ? [...dias, { iso: 'prueba', texto: SESION_DE_PRUEBA.diaTexto }] : dias),
    [dias, hayPrueba],
  );
  const sesionDePrueba: SesionPlana = useMemo(() => ({
    clave: SESION_DE_PRUEBA.clave, dia: 'prueba', horario: SESION_DE_PRUEBA.horario, tipo: SESION_DE_PRUEBA.tipo, sala: null,
    corto: SESION_DE_PRUEBA.corto, titulo: null, abre: SESION_DE_PRUEBA.inicio.toISOString(), cierra: SESION_DE_PRUEBA.fin.toISOString(),
  }), []);
  const sesionesDelDia = useMemo(
    () => (dia === 'prueba' ? [sesionDePrueba] : sesiones.filter((s) => s.dia === dia)),
    [sesiones, dia, sesionDePrueba],
  );
  const totalGeneral = useMemo(
    () => Object.entries(resumen).filter(([clave]) => clave !== 'prueba').reduce((n, [, r]) => n + r.total, 0),
    [resumen],
  );
  const nombreDia = (iso: string) => diasVista.find((d) => d.iso === iso)?.texto[idioma] ?? iso;
  const diaCorto = (iso: string) => nombreDia(iso).split(' ').slice(0, 2).join(' ');
  const abiertaAhora = (s: SesionPlana) => ahora >= Date.parse(s.abre) && ahora <= Date.parse(s.cierra);

  async function alternarSesion(clave: string) {
    if (abierta === clave) { setAbierta(null); return; }
    setAbierta(clave);
    // Se cuenta de nuevo al abrir: lo que escaneó la gente desde la última vez ya debe verse en los números.
    await Promise.all([cargarSesion(clave), cargarResumen()]);
  }

  async function refrescarTodo(clave?: string) {
    await cargarResumen();
    if (clave) await cargarSesion(clave);
    if (personas !== null) await cargarPersonas();
  }

  async function quitar(id: string, clave: string) {
    if (!window.confirm(a.confirmarQuitar)) return;
    const r = await pedir('/api/asistencia/panel', post({ accion: 'quitar', id }));
    if (r.ok) await refrescarTodo(clave); else setError(r.mensaje ?? a.error);
  }

  function avisar(mensaje: string) {
    setAviso(mensaje);
    setTimeout(() => setAviso(''), 8000);
  }

  async function activarPrueba() {
    setTrabajando(true);
    const r = await pedir<{ prueba: EstadoDePrueba }>('/api/asistencia/panel', post({ accion: 'activar_prueba' }));
    setTrabajando(false);
    if (r.ok && r.datos) { setPrueba(r.datos.prueba); avisar(a.pruebaActivada); } else setError(r.mensaje ?? a.error);
  }

  async function borrarPrueba() {
    if (!window.confirm(a.confirmarBorrarPrueba)) return;
    setTrabajando(true);
    const r = await pedir<{ borradas: { asistencias: number }; prueba: EstadoDePrueba }>('/api/asistencia/panel', post({ accion: 'borrar_prueba' }));
    setTrabajando(false);
    if (r.ok && r.datos) {
      setPrueba(r.datos.prueba);
      if (dia === 'prueba') setDia(dias[0]?.iso ?? '');
      avisar(interpolar(a.pruebaBorrada, { n: r.datos.borradas.asistencias }));
      await refrescarTodo(abierta ?? undefined);
    } else setError(r.mensaje ?? a.error);
  }

  async function pasarALaHoja() {
    setTrabajando(true);
    const r = await pedir<{ hoja: { nuevas: number; cambiadas: number; quitadas: number; omitido?: string } }>(
      '/api/asistencia/panel', post({ accion: 'sincronizar_hoja' }),
    );
    setTrabajando(false);
    if (!r.ok || !r.datos) { setError(r.mensaje ?? a.error); return; }
    const h = r.datos.hoja;
    avisar(h.omitido ?? interpolar(a.hojaActualizada, { nuevas: h.nuevas, cambiadas: h.cambiadas, quitadas: h.quitadas }));
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">{a.titulo}</h1>
        <p className="ayuda !mt-1">{a.ayuda}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist">
        {([['sesiones', a.pestanaSesiones], ['personas', a.pestanaPersonas], ...(puedeGestionar ? [['codigos', a.pestanaCodigos]] : [])] as [Pestana, string][]).map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={pestana === clave}
            onClick={() => setPestana(clave)}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${pestana === clave ? 'bg-ciess-500 text-white' : 'boton-secundario'}`}
          >
            {texto}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3 text-xs tenue">
          <span>{interpolar(a.total, { n: totalGeneral })}</span>
          {actualizadoA && <span>{interpolar(a.actualizadoA, { hora: actualizadoA })}</span>}
          <button type="button" className="underline" onClick={() => void refrescarTodo(abierta ?? undefined)}>{a.actualizar}</button>
          {puedeExportar && <a className="underline" href="/api/asistencia/exportar">{a.exportarTodo}</a>}
          {puedeGestionar && (
            <button type="button" className="underline" disabled={trabajando} onClick={() => void pasarALaHoja()}>{a.hojaAhora}</button>
          )}
        </span>
      </div>

      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
      {puedeGestionar && hoja?.error && (
        <p className="rounded-lg bg-amber-500/10 p-3 text-sm" role="status">{interpolar(a.hojaError, { mensaje: hoja.error })}</p>
      )}
      {puedeGestionar && !hoja?.error && hoja?.ultimaVez && (
        <p className="text-xs tenue">{interpolar(a.hojaAlDia, { hora: hora(hoja.ultimaVez) })}</p>
      )}
      {aviso && <p className="rounded-lg bg-green-500/10 p-3 text-sm" role="status">{aviso}</p>}

      {pestana === 'sesiones' && (
        <section className="tarjeta p-4" aria-label={a.pestanaSesiones}>
          <div className="mb-3 flex flex-wrap gap-2">
            {diasVista.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => { setDia(d.iso); void cargarResumen(); }}
                aria-pressed={dia === d.iso}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${dia === d.iso ? 'bg-ciess-500 text-white' : 'boton-secundario'}`}
              >
                {diaCorto(d.iso)}
              </button>
            ))}
          </div>

          <div className="desplazable overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="tenue text-xs">
                  <th className="py-1.5 pr-3 font-medium">{a.colHorario}</th>
                  <th className="py-1.5 pr-3 font-medium">{a.colSesion}</th>
                  <th className="py-1.5 pr-3 font-medium">{a.colSala}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">{a.colPresencial}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">{a.colEnLinea}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">{a.colSinRegistro}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">{a.colTotal}</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {sesionesDelDia.map((s) => {
                  const r = resumen[s.clave] ?? { presencial: 0, en_linea: 0, sinRegistro: 0, total: 0 };
                  const lista = asistentes[s.clave];
                  return (
                    <Fragment key={s.clave}>
                      <tr className="border-t align-top" style={{ borderColor: 'var(--borde)' }}>
                        <td className="whitespace-nowrap py-2 pr-3">{s.horario}</td>
                        <td className="py-2 pr-3">
                          <span className="font-semibold">{s.corto[idioma]}</span>
                          {s.titulo && <span className="block text-xs tenue">{s.titulo[idioma]}</span>}
                          {abiertaAhora(s) && (
                            <span className="mt-1 inline-block rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
                              {a.abiertaAhora}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs">{s.sala ? SALAS[s.sala][idioma] : '—'}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.presencial}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.en_linea}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.sinRegistro > 0 ? <span className="text-amber-600">{r.sinRegistro}</span> : 0}</td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums">{r.total}</td>
                        <td className="py-2 text-right">
                          <button type="button" className="text-xs underline" onClick={() => void alternarSesion(s.clave)} aria-expanded={abierta === s.clave}>
                            {abierta === s.clave ? a.ocultarLista : a.verLista}
                          </button>
                        </td>
                      </tr>
                      {abierta === s.clave && (
                        <tr>
                          <td colSpan={8} className="pb-3">
                            <ListaDeAsistentes
                              asistentes={lista}
                              clave={s.clave}
                              puedeExportar={puedeExportar}
                              puedeGestionar={puedeGestionar}
                              hora={hora}
                              alCambiar={async (mensaje) => { if (mensaje) { setAviso(mensaje); setTimeout(() => setAviso(''), 6000); } await refrescarTodo(s.clave); }}
                              alQuitar={(id) => void quitar(id, s.clave)}
                              alFallar={(m) => setError(m)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pestana === 'personas' && (
        <section className="tarjeta p-4" aria-label={a.pestanaPersonas}>
          <label className="etiqueta" htmlFor="buscar-persona">{a.buscarPersona}</label>
          <input id="buscar-persona" className="campo max-w-md text-sm" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />

          {personas === null ? (
            <p className="mt-3 text-sm tenue">…</p>
          ) : (
            <TablaDePersonas
              personas={personas}
              busqueda={busqueda}
              dias={dias}
              diaCorto={diaCorto}
              abierta={personaAbierta}
              alAbrir={(clave) => setPersonaAbierta(personaAbierta === clave ? null : clave)}
              sesiones={sesiones}
              hora={hora}
            />
          )}
        </section>
      )}

      {pestana === 'codigos' && puedeGestionar && codigos && (
        <section className="space-y-4" aria-label={a.pestanaCodigos}>
          <TarjetaDePrueba
            prueba={prueba}
            trabajando={trabajando}
            alActivar={() => void activarPrueba()}
            alBorrar={() => void borrarPrueba()}
            alFallar={(m) => setError(m)}
          />
          <div className="tarjeta p-4">
            <p className="text-sm">{a.codigosAyuda}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a className="boton-primario !py-2 !text-sm" href="/asistencia-qr?formato=hojas" target="_blank" rel="noreferrer">{a.imprimirHojas}</a>
              <a className="boton-secundario !py-2 !text-sm" href="/asistencia-qr?formato=tira" target="_blank" rel="noreferrer">{a.imprimirTira}</a>
            </div>
          </div>

          {dias.map((d) => (
            <div key={d.iso} className="tarjeta p-4">
              <h2 className="text-base font-bold">{d.texto[idioma]}</h2>
              <div className="mt-3 divide-y" style={{ borderColor: 'var(--borde)' }}>
                {sesiones.filter((s) => s.dia === d.iso).map((s) => {
                  const c = codigos[s.clave];
                  if (!c) return null;
                  return (
                    <FilaDeCodigos
                      key={s.clave}
                      sesion={s}
                      codigos={c}
                      qr={qrs[s.clave]}
                      urlBase={urlBase}
                      vale={interpolar(a.vale, { abre: hora(s.abre), cierra: hora(s.cierra) })}
                      alCambiar={(via, codigo) => {
                        setCodigos((previos) => previos && ({ ...previos, [s.clave]: { ...previos[s.clave], [via]: codigo } }));
                        setAviso(a.codigoCambiado);
                        setTimeout(() => setAviso(''), 6000);
                      }}
                      alFallar={(m) => setError(m)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ListaDeAsistentes({
  asistentes, clave, puedeExportar, puedeGestionar, hora, alCambiar, alQuitar, alFallar,
}: {
  asistentes: Asistente[] | undefined;
  clave: string;
  puedeExportar: boolean;
  puedeGestionar: boolean;
  hora: (iso: string) => string;
  alCambiar: (mensaje?: string) => Promise<void>;
  alQuitar: (id: string) => void;
  alFallar: (mensaje: string) => void;
}) {
  const { t } = useApp();
  const a = t.panel.asistencia;
  const [ligando, setLigando] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<RegistroCoincidente[] | null>(null);

  // Búsqueda con una pequeña espera: no se pide al servidor por cada tecla.
  useEffect(() => {
    if (!ligando || texto.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResultados(null);
      return;
    }
    const id = setTimeout(async () => {
      const r = await pedir<{ registros: RegistroCoincidente[] }>('/api/asistencia/panel', post({ accion: 'buscar', texto }));
      setResultados(r.ok && r.datos ? r.datos.registros : []);
    }, 300);
    return () => clearTimeout(id);
  }, [ligando, texto]);

  async function ligar(asistenciaId: string, registroId: string) {
    const r = await pedir<{ resultado: 'ligada' | 'duplicada_descartada' }>('/api/asistencia/panel', post({ accion: 'conciliar', asistenciaId, registroId }));
    if (!r.ok || !r.datos) { alFallar(r.mensaje ?? a.error); return; }
    setLigando(null); setTexto(''); setResultados(null);
    await alCambiar(r.datos.resultado === 'ligada' ? a.ligada : a.duplicadaDescartada);
  }

  if (!asistentes) return <p className="py-2 text-sm tenue">…</p>;
  if (asistentes.length === 0) return <p className="py-2 text-sm tenue">{a.sinAsistentes}</p>;

  const identificacion = { correo: a.porCorreo, nombre: a.porNombre, conciliada: a.conciliada, ninguno: a.sinRegistro } as const;

  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--borde)' }}>
      {puedeExportar && (
        <p className="mb-2 text-right text-xs"><a className="underline" href={`/api/asistencia/exportar?sesion=${encodeURIComponent(clave)}`}>{a.exportar}</a></p>
      )}
      <div className="desplazable overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="tenue">
              <th className="py-1 pr-3 font-medium">{a.colNombre}</th>
              <th className="py-1 pr-3 font-medium">{a.colCorreo}</th>
              <th className="py-1 pr-3 font-medium">{a.colPerfil}</th>
              <th className="py-1 pr-3 font-medium">{a.colVia}</th>
              <th className="py-1 pr-3 font-medium">{a.colHora}</th>
              <th className="py-1 pr-3 font-medium">{a.colIdentificacion}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {asistentes.map((x) => (
              <Fragment key={x.id}>
                <tr className="border-t align-top" style={{ borderColor: 'var(--borde)' }}>
                  <td className="py-1.5 pr-3 font-medium">{x.nombre}</td>
                  <td className="py-1.5 pr-3 break-all">{x.correo}</td>
                  <td className="py-1.5 pr-3">{x.perfil ?? '—'}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{x.via === 'presencial' ? a.colPresencial : a.colEnLinea}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{hora(x.creada_en)}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {x.registro_id === null ? <span className="text-amber-600">{a.sinRegistro}</span> : identificacion[x.identificado_por]}
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    {puedeGestionar && x.registro_id === null && (
                      <button type="button" className="mr-3 underline" onClick={() => { setLigando(ligando === x.id ? null : x.id); setTexto(''); setResultados(null); }}>
                        {a.ligar}
                      </button>
                    )}
                    {puedeGestionar && <button type="button" className="underline" onClick={() => alQuitar(x.id)}>{a.quitar}</button>}
                  </td>
                </tr>
                {x.registro_id === null && x.capturado_nombre && (
                  <tr><td colSpan={7} className="pb-1 text-xs tenue">{interpolar(a.capturado, { nombre: x.capturado_nombre, correo: x.capturado_correo ?? '' })}</td></tr>
                )}
                {ligando === x.id && (
                  <tr>
                    <td colSpan={7} className="pb-2">
                      <input
                        className="campo max-w-md text-sm"
                        placeholder={a.buscarRegistro}
                        aria-label={a.buscarRegistro}
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        autoFocus
                      />
                      {resultados !== null && (
                        resultados.length === 0 ? (
                          <p className="mt-1 text-xs tenue">{a.sinCoincidencias}</p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {resultados.map((r) => (
                              <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-medium">{r.nombre}</span>
                                <span className="tenue">{r.correo} · {r.folio}</span>
                                <button type="button" className="boton-secundario !px-2 !py-1 !text-xs" onClick={() => void ligar(x.id, r.id)}>{a.ligarA}</button>
                              </li>
                            ))}
                          </ul>
                        )
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TablaDePersonas({
  personas, busqueda, dias, diaCorto, abierta, alAbrir, sesiones, hora,
}: {
  personas: PersonaConAsistencia[];
  busqueda: string;
  dias: { iso: string; texto: Texto }[];
  diaCorto: (iso: string) => string;
  abierta: string | null;
  alAbrir: (clave: string) => void;
  sesiones: SesionPlana[];
  hora: (iso: string) => string;
}) {
  const { t, idioma } = useApp();
  const a = t.panel.asistencia;
  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? personas.filter((p) => p.nombre.toLowerCase().includes(q) || p.correo.toLowerCase().includes(q))
    : personas;
  const sesionDe = (clave: string) => sesiones.find((s) => s.clave === clave);

  if (personas.length === 0) return <p className="mt-3 text-sm tenue">{a.sinPersonas}</p>;

  return (
    <div className="desplazable mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="tenue text-xs">
            <th className="py-1.5 pr-3 font-medium">{a.colNombre}</th>
            <th className="py-1.5 pr-3 font-medium">{a.colCorreo}</th>
            <th className="py-1.5 pr-3 font-medium">{a.colPerfil}</th>
            {dias.map((d) => <th key={d.iso} className="py-1.5 pr-3 text-right font-medium">{diaCorto(d.iso)}</th>)}
            <th className="py-1.5 text-right font-medium">{a.colTotal}</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((p) => (
            <Fragment key={p.clave}>
              <tr className="cursor-pointer border-t align-top hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: 'var(--borde)' }} onClick={() => alAbrir(p.clave)}>
                <td className="py-1.5 pr-3 font-medium">
                  {p.nombre}
                  {p.sinRegistro && <span className="ml-2 text-xs text-amber-600">{a.sinRegistro}</span>}
                </td>
                <td className="py-1.5 pr-3 text-xs break-all">{p.correo}</td>
                <td className="py-1.5 pr-3 text-xs">{p.perfil ?? '—'}</td>
                {dias.map((d) => <td key={d.iso} className="py-1.5 pr-3 text-right tabular-nums">{p.porDia[d.iso] ?? 0}</td>)}
                <td className="py-1.5 text-right font-semibold tabular-nums">{p.total}</td>
              </tr>
              {abierta === p.clave && (
                <tr>
                  <td colSpan={4 + dias.length} className="pb-2 text-xs">
                    <span className="tenue">{a.asistio}: </span>
                    {p.sesiones.map((s, i) => {
                      const sesion = sesionDe(s.sesion);
                      return (
                        <span key={`${s.sesion}-${i}`} className="mr-3 inline-block">
                          {(sesion?.corto[idioma] ?? s.sesion)}
                          <span className="tenue"> · {s.via === 'presencial' ? a.colPresencial : a.colEnLinea} · {hora(s.creada_en)}</span>
                        </span>
                      );
                    })}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FilaDeCodigos({
  sesion, codigos, qr, urlBase, vale, alCambiar, alFallar,
}: {
  sesion: SesionPlana;
  codigos: Record<ViaAsistencia, string>;
  qr: string | undefined;
  urlBase: string;
  vale: string;
  alCambiar: (via: ViaAsistencia, codigo: string) => void;
  alFallar: (mensaje: string) => void;
}) {
  const { t, idioma } = useApp();
  const a = t.panel.asistencia;
  const [copiado, setCopiado] = useState('');
  const enlace = (via: ViaAsistencia) => `${urlBase}/a/${codigos[via]}`;

  async function copiar(texto: string, marca: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(marca);
      setTimeout(() => setCopiado(''), 2000);
    } catch {
      alFallar(a.error);
    }
  }

  async function cambiar(via: ViaAsistencia) {
    if (!window.confirm(a.confirmarCambio)) return;
    const r = await pedir<{ codigo: string }>('/api/asistencia/panel', post({ accion: 'cambiar_codigo', sesion: sesion.clave, via }));
    if (r.ok && r.datos) alCambiar(via, r.datos.codigo); else alFallar(r.mensaje ?? a.error);
  }

  // Un solo mensaje para todo el chat, sin importar en qué idioma hable la sala.
  const mensaje = [
    `Registro de asistencia · Attendance check-in · Registro de presença`,
    `${sesion.corto.es}${sesion.titulo ? ` — ${sesion.titulo.es}` : ''}`,
    enlace('en_linea'),
  ].join('\n');

  return (
    <div className="grid gap-3 py-3 sm:grid-cols-[auto_1fr]">
      <div
        className="h-28 w-28 shrink-0 rounded-lg bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
        // El SVG lo genera el servidor a partir de nuestro propio enlace: no lleva nada que venga de fuera.
        dangerouslySetInnerHTML={{ __html: qr ?? '' }}
        role="img"
        aria-label={`${a.qrPresencial}: ${sesion.corto[idioma]}`}
      />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">
          {sesion.corto[idioma]}
          <span className="ml-2 text-xs font-normal tenue">{sesion.horario}</span>
        </p>
        {sesion.titulo && <p className="text-xs tenue">{sesion.titulo[idioma]}</p>}
        <p className="mt-0.5 text-xs tenue">{vale}</p>

        <p className="mt-2 text-xs"><span className="font-semibold">{a.qrPresencial}:</span> <span className="break-all">{enlace('presencial')}</span></p>
        <p className="mt-1 text-xs"><span className="font-semibold">{a.enlaceEnLinea}:</span> <span className="break-all">{enlace('en_linea')}</span></p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="boton-secundario !px-2.5 !py-1 !text-xs" onClick={() => void copiar(enlace('en_linea'), 'enlace')}>
            {copiado === 'enlace' ? a.copiado : a.copiar}
          </button>
          <button type="button" className="boton-secundario !px-2.5 !py-1 !text-xs" onClick={() => void copiar(mensaje, 'mensaje')}>
            {copiado === 'mensaje' ? a.copiado : a.copiarMensaje}
          </button>
          <button type="button" className="text-xs underline" onClick={() => void cambiar('presencial')}>{a.cambiarCodigo} ({a.qrPresencial})</button>
          <button type="button" className="text-xs underline" onClick={() => void cambiar('en_linea')}>{a.cambiarCodigo} ({a.colEnLinea})</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * La sesión de prueba: para ver cómo se captura una asistencia (en el celular, aquí y en la hoja) antes del
 * Congreso. Se activa y se borra con un clic, y no cuenta para la asistencia de nadie.
 */
function TarjetaDePrueba({
  prueba, trabajando, alActivar, alBorrar, alFallar,
}: {
  prueba: EstadoDePrueba | null;
  trabajando: boolean;
  alActivar: () => void;
  alBorrar: () => void;
  alFallar: (mensaje: string) => void;
}) {
  const { t } = useApp();
  const a = t.panel.asistencia;
  const [copiado, setCopiado] = useState(false);

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      alFallar(a.error);
    }
  }

  return (
    <div className="tarjeta border-2 border-dashed p-4" style={{ borderColor: 'var(--dorado)' }}>
      <h2 className="text-base font-bold">{a.pruebaTitulo}</h2>
      <p className="ayuda">{a.pruebaAyuda}</p>

      {!prueba?.activa ? (
        <button type="button" className="boton-primario mt-3 !py-2 !text-sm" disabled={trabajando} onClick={alActivar}>
          {a.activarPrueba}
        </button>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-[auto_1fr]">
          <div
            className="h-40 w-40 shrink-0 rounded-lg bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
            // El SVG lo genera el servidor a partir de nuestro propio enlace: no lleva nada que venga de fuera.
            dangerouslySetInnerHTML={{ __html: prueba.qr ?? '' }}
            role="img"
            aria-label={a.pruebaTitulo}
          />
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{interpolar(a.pruebaActiva, { n: prueba.total })}</p>
            <p className="mt-2 text-xs"><span className="font-semibold">{a.enlacePrueba}:</span> <span className="break-all">{prueba.presencial}</span></p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="boton-secundario !px-2.5 !py-1 !text-xs" onClick={() => void copiar(prueba.presencial ?? '')}>
                {copiado ? a.copiado : a.copiar}
              </button>
              <button type="button" className="boton-secundario !px-2.5 !py-1 !text-xs" disabled={trabajando} onClick={alBorrar}>
                {a.borrarPrueba}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
