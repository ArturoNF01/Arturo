'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { interpolar } from '@/i18n';
import { MAXIMO_LISTA, porcentajeAtendido, type Audiencia, type AudienciaGuardada, type IdiomaEnvio, type Progreso } from '@/lib/comunicados';

interface Calculo {
  total: number;
  porIdioma: { es: number; en: number; pt: number };
  excluidos: { cancelados: number; listaEspera: number; sinCorreo: number; yaRecibieron: number; noPonentes: number; otroIdioma: number };
  repetidosEnLista: number;
}

/** El envío automático tras el correo de confirmación: si está encendido y cuántos han salido. */
interface Automatico {
  activo: boolean;
  enviados: number;
  errores: number;
}

interface Campana {
  id: string;
  audiencia: AudienciaGuardada;
  creada_en: string;
  creada_por: string | null;
  estado: 'en_curso' | 'terminada';
  progreso: Progreso;
  faltaPorEnviar: boolean;
}

const dormir = (ms: number) => new Promise((seguir) => setTimeout(seguir, ms));

/**
 * El envío masivo de un comunicado, debajo de su plantilla.
 *
 * Lo que manda es la versión **guardada** de la plantilla —la que se probó y se aprobó—, así que
 * mientras haya cambios sin guardar el botón no funciona. Mandar a mucha gente no se puede
 * deshacer, y por eso hay tres frenos: se enseña a cuántas personas llega y a quiénes se deja
 * fuera, hay que escribir esa cifra para confirmar, y el servidor la vuelve a comprobar.
 *
 * El envío sale por tandas que pide esta pantalla una tras otra. Si se cierra a medias, nada se
 * repite: el envío queda en el historial como «sin terminar» y se continúa desde ahí.
 */
export function EnvioComunicado({
  clave, idioma, sinGuardar,
}: {
  clave: string;
  /** El idioma de la plantilla que se está viendo: es el de las direcciones que no son de ningún registro. */
  idioma: string;
  sinGuardar: boolean;
}) {
  const { t } = useApp();
  const c = t.panel.comunicados;

  const [audiencia, setAudiencia] = useState<Audiencia>('todos');
  const [lista, setLista] = useState('');
  const [incluirEspera, setIncluirEspera] = useState(false);
  const [soloIdioma, setSoloIdioma] = useState<'' | IdiomaEnvio>('');
  const [calculo, setCalculo] = useState<Calculo | null>(null);
  const [estado, setEstado] = useState<{ faltan: number; ya: number } | null>(null);
  const [automatico, setAutomatico] = useState<Automatico | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const [aviso, setAviso] = useState('');
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [errores, setErrores] = useState<Record<string, { correo: string; error: string | null }[]>>({});
  // Si la pantalla se cierra a medias, el bucle de envío se corta aquí y el envío queda para continuarlo.
  const cortar = useRef(false);

  const cargarCampanas = useCallback(async () => {
    const r = await fetch(`/api/comunicados?clave=${encodeURIComponent(clave)}`);
    if (r.ok) setCampanas(((await r.json()) as { campanas: Campana[] }).campanas);
  }, [clave]);

  /** Cuántos registros vigentes ya recibieron el comunicado y cuántos no: lo primero que hay que saber antes de enviar. */
  const cargarEstado = useCallback(async () => {
    const r = await fetch('/api/comunicados/audiencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, audiencia: 'todos', lista: '', incluirListaEspera: false, idioma }),
    });
    if (r.ok) {
      const d = (await r.json()) as Calculo;
      setEstado({ faltan: d.total, ya: d.excluidos.yaRecibieron });
    }
  }, [clave, idioma]);

  const cargarAutomatico = useCallback(async () => {
    const r = await fetch('/api/comunicados/automatico');
    if (r.ok) setAutomatico((await r.json()) as Automatico);
  }, []);

  async function cambiarAutomatico(activo: boolean) {
    // La casilla cambia al tocarla; si el servidor no lo guarda, vuelve a como estaba y se dice por qué.
    const antes = automatico;
    setAutomatico((previo) => previo && { ...previo, activo });
    setError('');
    const r = await fetch('/api/comunicados/automatico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo }),
    }).catch(() => null);
    if (r?.ok) {
      setAutomatico((await r.json()) as Automatico);
      return;
    }
    setAutomatico(antes);
    setError(((await r?.json().catch(() => null)) as { mensaje?: string } | null)?.mensaje ?? t.estados.error);
  }

  useEffect(() => {
    cortar.current = false;
    // Carga inicial del historial: es lo que dice si hay un envío sin terminar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarCampanas();
    void cargarEstado();
    void cargarAutomatico();
    return () => { cortar.current = true; };
  }, [cargarCampanas, cargarEstado, cargarAutomatico]);

  const cuerpoDeLaPeticion = () => ({
    clave, audiencia, lista, incluirListaEspera: incluirEspera, idioma, soloIdioma: soloIdioma || undefined,
  });

  async function revisar() {
    setCalculando(true);
    setError('');
    setCalculo(null);
    setConfirmacion('');
    const r = await fetch('/api/comunicados/audiencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoDeLaPeticion()),
    });
    const datos = await r.json().catch(() => null);
    if (r.ok) setCalculo(datos as Calculo);
    else setError(datos?.mensaje ?? t.estados.error);
    setCalculando(false);
  }

  /** Pide tandas hasta que no falte nadie, o hasta que algo obligue a parar. */
  async function enviarTandas(id: string) {
    setEnviando(true);
    setAviso('');
    let fallosSeguidos = 0;
    try {
      while (!cortar.current) {
        const r = await fetch(`/api/comunicados/${id}/enviar`, { method: 'POST' });
        const datos = await r.json().catch(() => null);
        if (!r.ok || !datos) {
          setAviso(interpolar(c.falla, { mensaje: datos?.mensaje ?? t.estados.error }));
          break;
        }
        const p = datos.progreso as Progreso;
        setProgreso(p);
        const quedan = p.pendientes + p.enviando;

        if (datos.detenido === 'limite') {
          setAviso(c.despacio);
          await dormir(6000);
          continue;
        }
        if (datos.detenido === 'cuota') {
          setAviso(interpolar(c.cuota, { n: String(quedan) }));
          break;
        }
        if (datos.detenido === 'transitorio') {
          fallosSeguidos += 1;
          if (fallosSeguidos > 3) {
            setAviso(interpolar(c.falla, { mensaje: datos.mensaje ?? '' }));
            break;
          }
          await dormir(4000);
          continue;
        }
        if (datos.detenido) {
          setAviso(interpolar(c.falla, { mensaje: datos.mensaje ?? '' }));
          break;
        }
        fallosSeguidos = 0;
        setAviso('');
        if (!datos.faltaPorEnviar) break;
        // Resend admite dos llamadas por segundo.
        await dormir(700);
      }
    } catch {
      setAviso(interpolar(c.falla, { mensaje: t.estados.error }));
    } finally {
      setEnviando(false);
      await cargarCampanas();
      await cargarEstado();
    }
  }

  async function confirmarYEnviar() {
    setError('');
    const r = await fetch('/api/comunicados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cuerpoDeLaPeticion(), confirmacion }),
    });
    const datos = await r.json().catch(() => null);
    if (!r.ok) {
      setError(datos?.mensaje ?? t.estados.error);
      await cargarCampanas();
      return;
    }
    setCalculo(null);
    setConfirmacion('');
    setProgreso({ total: datos.total, enviados: 0, errores: 0, pendientes: datos.total, enviando: 0 });
    await enviarTandas(datos.id as string);
  }

  async function verErrores(id: string) {
    const r = await fetch(`/api/comunicados/${id}`);
    if (r.ok) {
      const datos = (await r.json()) as { errores: { correo: string; error: string | null }[] };
      setErrores((previos) => ({ ...previos, [id]: datos.errores }));
    }
  }

  const sinTerminar = campanas.find((x) => x.faltaPorEnviar);
  const total = calculo?.total ?? 0;
  const puedeConfirmar = calculo !== null && total > 0 && confirmacion.trim() === String(total) && !sinGuardar && !enviando;

  const nombreAudiencia: Record<AudienciaGuardada, string> = {
    todos: c.todos, ponentes: c.ponentes, lista: c.lista, automatico: c.automatico,
  };
  const fecha = (iso: string) =>
    new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mexico_City' });

  const fuera = calculo
    ? [
        calculo.excluidos.cancelados > 0 && interpolar(c.fueraCancelados, { n: String(calculo.excluidos.cancelados) }),
        calculo.excluidos.listaEspera > 0 && interpolar(c.fueraEspera, { n: String(calculo.excluidos.listaEspera) }),
        calculo.excluidos.yaRecibieron > 0 && interpolar(c.fueraYa, { n: String(calculo.excluidos.yaRecibieron) }),
        calculo.excluidos.noPonentes > 0 && interpolar(c.fueraNoPonentes, { n: String(calculo.excluidos.noPonentes) }),
        calculo.excluidos.sinCorreo > 0 && interpolar(c.fueraSinCorreo, { n: String(calculo.excluidos.sinCorreo) }),
        calculo.excluidos.otroIdioma > 0 && interpolar(c.fueraOtroIdioma, { n: String(calculo.excluidos.otroIdioma) }),
      ].filter((x): x is string => typeof x === 'string')
    : [];

  return (
    <section className="tarjeta mt-4 p-4" aria-labelledby="envio-titulo">
      <h2 id="envio-titulo" className="text-base font-bold">{c.titulo}</h2>
      <p className="ayuda !mt-1">{c.ayuda}</p>

      {estado && (
        <p className="mt-3 rounded-lg bg-black/5 p-3 text-sm dark:bg-white/5" role="status">
          {interpolar(c.estadoNuevos, { total: estado.faltan + estado.ya, ya: estado.ya, faltan: estado.faltan })}
        </p>
      )}

      {automatico && (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'var(--borde)' }}>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={automatico.activo}
              onChange={(e) => void cambiarAutomatico(e.target.checked)}
            />
            <span>
              <span className="font-semibold">{c.automaticoTitulo}</span>
              <span className="block ayuda !mt-0.5">{c.automaticoAyuda}</span>
            </span>
          </label>
          <p className="ayuda">
            {interpolar(c.automaticoCuenta, { enviados: automatico.enviados, errores: automatico.errores })}
            {automatico.errores > 0 && ` ${c.automaticoErrores}`}
          </p>
        </div>
      )}
      {sinGuardar && (
        <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600" role="status">{c.sinGuardar}</p>
      )}

      {sinTerminar && !enviando && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--borde)' }}>
          <span className="text-sm">{interpolar(c.pausado, { n: String(sinTerminar.progreso.pendientes + sinTerminar.progreso.enviando) })}</span>
          <button type="button" className="boton-primario !py-2 !text-sm" onClick={() => void enviarTandas(sinTerminar.id)}>
            {c.continuar}
          </button>
        </div>
      )}

      <fieldset className="mt-4" disabled={enviando}>
        <legend className="etiqueta">{c.aQuien}</legend>
        <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-2">
          {(['todos', 'ponentes', 'lista'] as const).map((valor) => (
            <label key={valor} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="audiencia-comunicado"
                checked={audiencia === valor}
                onChange={() => { setAudiencia(valor); setCalculo(null); setError(''); }}
              />
              {nombreAudiencia[valor]}
            </label>
          ))}
        </div>

        {audiencia === 'lista' ? (
          <div className="mt-3">
            <label className="etiqueta" htmlFor="lista-comunicado">{c.listaEtiqueta}</label>
            <textarea
              id="lista-comunicado"
              rows={4}
              spellCheck={false}
              className="campo desplazable resize-y text-sm"
              value={lista}
              onChange={(e) => { setLista(e.target.value); setCalculo(null); }}
              placeholder="correo1@ejemplo.org, correo2@ejemplo.org"
            />
            <p className="ayuda">{interpolar(c.listaAyuda, { max: String(MAXIMO_LISTA), idioma: idioma.toUpperCase() })}</p>
          </div>
        ) : (
          <>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={incluirEspera}
                onChange={(e) => { setIncluirEspera(e.target.checked); setCalculo(null); }}
              />
              {c.incluirEspera}
            </label>
            <div className="mt-3">
              <label className="etiqueta" htmlFor="idioma-comunicado">{c.idiomaEtiqueta}</label>
              <select
                id="idioma-comunicado"
                className="campo text-sm sm:max-w-xs"
                value={soloIdioma}
                onChange={(e) => { setSoloIdioma(e.target.value as '' | IdiomaEnvio); setCalculo(null); }}
              >
                <option value="">{c.idiomaTodos}</option>
                <option value="es">{c.idiomaEs}</option>
                <option value="en">{c.idiomaEn}</option>
                <option value="pt">{c.idiomaPt}</option>
              </select>
              <p className="ayuda">{c.idiomaNota}</p>
            </div>
          </>
        )}
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="boton-primario !py-2 !text-sm"
          onClick={() => void revisar()}
          disabled={calculando || enviando || sinGuardar || Boolean(sinTerminar)}
        >
          {calculando ? c.calculando : c.revisar}
        </button>
        {sinTerminar && !enviando && <span className="text-xs tenue">{c.enCurso}</span>}
      </div>

      {error && <p className="mt-3 text-sm text-red-500" role="alert">{error}</p>}

      {calculo && (
        <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'var(--borde)' }}>
          {total === 0 ? (
            <p className="text-sm">{c.sinDestinatarios}</p>
          ) : (
            <>
              <p className="text-base font-bold">{interpolar(c.resumen, { n: String(total) })}</p>
              <p className="ayuda">
                {interpolar(c.porIdioma, {
                  es: String(calculo.porIdioma.es), en: String(calculo.porIdioma.en), pt: String(calculo.porIdioma.pt),
                })}
              </p>
            </>
          )}
          {fuera.length > 0 && (
            <p className="ayuda">{c.fuera}: {fuera.join(' · ')}.</p>
          )}
          {calculo.repetidosEnLista > 0 && (
            <p className="mt-2 text-sm text-amber-600">{interpolar(c.repetidos, { n: String(calculo.repetidosEnLista) })}</p>
          )}

          {total > 0 && (
            <div className="mt-4">
              <label className="etiqueta" htmlFor="confirmar-comunicado">
                {interpolar(c.confirmar, { n: String(total) })}
              </label>
              <input
                id="confirmar-comunicado"
                className="campo !w-40"
                inputMode="numeric"
                autoComplete="off"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
              />
              <p className="ayuda">{c.advertencia}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" className="boton-primario !py-2 !text-sm" onClick={() => void confirmarYEnviar()} disabled={!puedeConfirmar}>
                  {c.enviarAhora}
                </button>
                <button type="button" className="boton-secundario !py-2 !text-sm" onClick={() => { setCalculo(null); setConfirmacion(''); }}>
                  {c.cancelar}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {progreso && (enviando || aviso) && (
        <div className="mt-4" aria-live="polite">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">
              {enviando
                ? interpolar(c.enviando, { hechos: String(progreso.enviados + progreso.errores), total: String(progreso.total) })
                : interpolar(c.terminado, { enviados: String(progreso.enviados), errores: String(progreso.errores) })}
            </span>
            <span className="tenue">{porcentajeAtendido(progreso)}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={porcentajeAtendido(progreso)}
            className="h-2.5 overflow-hidden rounded-full bg-ciess-500/15"
          >
            <div className="h-full bg-ciess-500 transition-all" style={{ width: `${porcentajeAtendido(progreso)}%` }} />
          </div>
          {enviando && <p className="ayuda">{c.noCerrar}</p>}
          {aviso && <p className="mt-2 text-sm text-amber-600" role="status">{aviso}</p>}
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold">{c.historial}</h3>
      {campanas.length === 0 ? (
        <p className="ayuda">{c.sinHistorial}</p>
      ) : (
        <div className="desplazable mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="tenue">
                <th className="py-1.5 pr-3 font-medium">{c.fecha}</th>
                <th className="py-1.5 pr-3 font-medium">{c.quien}</th>
                <th className="py-1.5 pr-3 font-medium">{c.aQuienes}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{c.enviados}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{c.errores}</th>
                <th className="py-1.5 text-right font-medium">{c.faltan}</th>
              </tr>
            </thead>
            <tbody>
              {campanas.map((x) => (
                <tr key={x.id} className="border-t" style={{ borderColor: 'var(--borde)' }}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fecha(x.creada_en)}</td>
                  <td className="py-1.5 pr-3">{x.creada_por ?? '—'}</td>
                  <td className="py-1.5 pr-3">{nombreAudiencia[x.audiencia]}</td>
                  <td className="py-1.5 pr-3 text-right">{x.progreso.enviados}</td>
                  <td className="py-1.5 pr-3 text-right">
                    {x.progreso.errores > 0 ? (
                      <button type="button" className="underline" onClick={() => void verErrores(x.id)}>{x.progreso.errores}</button>
                    ) : 0}
                  </td>
                  <td className="py-1.5 text-right">{x.progreso.pendientes + x.progreso.enviando}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {campanas.map((x) => errores[x.id] && (
            <details key={x.id} open className="mt-2 text-xs">
              <summary className="cursor-pointer">{c.verErrores} · {fecha(x.creada_en)}</summary>
              <ul className="mt-1 list-disc pl-5">
                {errores[x.id].map((e) => <li key={e.correo}>{e.correo}{e.error ? `: ${e.error}` : ''}</li>)}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
