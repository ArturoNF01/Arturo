'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { interpolar } from '@/i18n';
import { porcentajeAtendido, type Progreso } from '@/lib/comunicados';
import { PlantillaDeConstancia } from './plantilla-de-constancia';

type Grupo = 'publico_general' | 'ponente';
/** A quién sale un envío: a un grupo o a una lista de correos. */
type Alcance = Grupo | 'lista';
const GRUPOS: readonly Grupo[] = ['publico_general', 'ponente'];

interface Excluidos {
  sinRegistro: number; sinConstancia: number; enlaceInvalido: number; sinCorreo: number; correoRepetido: number; yaRecibieron: number;
}
interface EstadoDeGrupo {
  porEnviar: number;
  enlaceNuevo: number;
  porIdioma: { es: number; en: number; pt: number };
  excluidos: Excluidos;
  faltan: { numero: string; nombre: string; correo: string }[];
  faltanTotal: number;
  muestra: { numero: string; nombre: string; enlace: string }[];
}
type Hoja =
  | { ok: true; filas: number; conRegistro: number; sinPerfil: number; grupos: Record<Grupo, EstadoDeGrupo> }
  | { ok: false; mensaje: string };

type EstadoDeCorreo = 'enviar' | 'yaRecibio' | 'sinRegistro' | 'sinConstancia' | 'enlaceInvalido' | 'noEstaEnLaHoja' | 'correoInvalido';
interface VerificacionDeLista {
  verificacion: { correo: string; estado: EstadoDeCorreo; numero?: string; nombre?: string; reenvio?: boolean }[];
  porEnviar: number;
  reenvios: number;
  enlaceNuevo: number;
  porIdioma: { es: number; en: number; pt: number };
}

interface Campana {
  id: string;
  creada_en: string;
  creada_por: string | null;
  estado: 'en_curso' | 'terminada';
  progreso: Progreso;
  faltaPorEnviar: boolean;
  /** A quién salió: un grupo, la lista, o nada si no se sabe. */
  alcance: string | null;
}

const MAXIMO_DE_LA_LISTA = 200;
const dormir = (ms: number) => new Promise((seguir) => setTimeout(seguir, ms));

/**
 * El envío de las constancias: cada persona recibe un correo con un botón para descargar SU constancia, con el enlace de su fila
 * de la hoja de Google. Se manda por separado a público general, a ponentes o a una lista de correos que se escriben aquí, y de
 * cada correo de la lista se comprueba que tenga su constancia.
 *
 * Mandar un correo no se puede deshacer, y por eso hay tres frenos: se enseña a cuántas personas llega y a quiénes se deja fuera,
 * hay que escribir esa cifra para confirmar, y el servidor la vuelve a comprobar contra la hoja. El envío sale por tandas que pide
 * esta pantalla una tras otra; si se cierra a medias, nada se repite y se continúa desde el historial.
 */
export function EnvioConstancias() {
  const { t } = useApp();
  const k = t.panel.constancias;
  const c = t.panel.comunicados;

  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [cargando, setCargando] = useState(true);
  /** Qué envío se está confirmando, si hay uno. */
  const [confirmando, setConfirmando] = useState<Alcance | null>(null);
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const [aviso, setAviso] = useState('');
  const [errores, setErrores] = useState<Record<string, { correo: string; error: string | null }[]>>({});
  // La lista de personas: lo escrito, si se reenvía a quien ya la recibió y lo que dijo la última verificación (de ese texto).
  const [texto, setTexto] = useState('');
  const [reenviar, setReenviar] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [verificada, setVerificada] = useState<(VerificacionDeLista & { texto: string; reenviar: boolean }) | null>(null);
  // Si la pantalla se cierra a medias, el bucle de envío se corta aquí y el envío queda para continuarlo.
  const cortar = useRef(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const r = await fetch('/api/constancias').catch(() => null);
    if (r?.ok) {
      const d = (await r.json()) as { hoja: Hoja; campanas: Campana[] };
      setHoja(d.hoja);
      setCampanas(d.campanas);
    } else {
      setHoja({ ok: false, mensaje: ((await r?.json().catch(() => null)) as { mensaje?: string } | null)?.mensaje ?? t.estados.error });
    }
    setCargando(false);
  }, [t.estados.error]);

  useEffect(() => {
    cortar.current = false;
    // Carga inicial: lo que dice la hoja y el historial de envíos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
    return () => { cortar.current = true; };
  }, [cargar]);

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
        if (datos.detenido === 'limite') { setAviso(c.despacio); await dormir(6000); continue; }
        if (datos.detenido === 'cuota') { setAviso(interpolar(c.cuota, { n: String(quedan) })); break; }
        if (datos.detenido === 'transitorio') {
          fallosSeguidos += 1;
          if (fallosSeguidos > 3) { setAviso(interpolar(c.falla, { mensaje: datos.mensaje ?? '' })); break; }
          await dormir(4000);
          continue;
        }
        if (datos.detenido) { setAviso(interpolar(c.falla, { mensaje: datos.mensaje ?? '' })); break; }
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
      await cargar();
    }
  }

  /** Comprueba la lista escrita contra la hoja. No manda nada. */
  async function verificarLista() {
    setError('');
    setVerificando(true);
    setConfirmando(null);
    const r = await fetch('/api/constancias/verificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, reenviar }),
    }).catch(() => null);
    const datos = await r?.json().catch(() => null);
    setVerificando(false);
    if (!r?.ok || !datos) { setVerificada(null); setError(datos?.mensaje ?? t.estados.error); return; }
    setVerificada({ ...(datos as VerificacionDeLista), texto, reenviar });
  }

  // La verificación vale para lo que se escribió al pedirla: si cambia el texto o «reenviar», hay que volver a verificar.
  const listaVigente = verificada && verificada.texto === texto && verificada.reenviar === reenviar ? verificada : null;
  const totalDe = (alcance: Alcance): number => {
    if (alcance === 'lista') return listaVigente?.porEnviar ?? 0;
    return hoja?.ok ? hoja.grupos[alcance].porEnviar : 0;
  };
  const nombreDe = (alcance: Alcance | string | null): string => {
    if (alcance === 'publico_general') return k.grupoPublico;
    if (alcance === 'ponente') return k.grupoPonentes;
    if (alcance === 'lista') return k.alcanceLista;
    if (alcance === 'todos') return k.alcanceTodos;
    return '—';
  };

  async function confirmarYEnviar() {
    if (!confirmando) return;
    setError('');
    const r = await fetch('/api/constancias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alcance: confirmando, confirmacion, ...(confirmando === 'lista' ? { texto, reenviar } : {}) }),
    });
    const datos = await r.json().catch(() => null);
    if (!r.ok) {
      setError(datos?.mensaje ?? t.estados.error);
      await cargar();
      return;
    }
    setConfirmando(null);
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
  const totalAConfirmar = confirmando ? totalDe(confirmando) : 0;
  const puedeConfirmar = totalAConfirmar > 0 && confirmacion.trim() === String(totalAConfirmar) && !enviando;
  const fecha = (iso: string) =>
    new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mexico_City' });
  /** No se puede empezar otro envío mientras uno sigue a medias, ni mientras se manda o se confirma otro. */
  const ocupado = enviando || Boolean(sinTerminar) || confirmando !== null;
  const pedirConfirmacion = (alcance: Alcance) => { setConfirmando(alcance); setConfirmacion(''); setError(''); };

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold">{k.titulo}</h1>
        <p className="ayuda !mt-1">{k.ayuda}</p>
        <p className="ayuda">{k.archivos}</p>
        <a href="/panel/plantillas?clave=constancia" className="text-sm underline">{k.editarTexto}</a>
      </header>

      <section className="tarjeta p-4" aria-labelledby="constancias-estado">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="constancias-estado" className="text-base font-bold">{k.estadoHoja}</h2>
          <button type="button" className="boton-secundario !py-2 !text-sm" onClick={() => void cargar()} disabled={cargando || enviando}>
            {cargando ? k.leyendo : k.releer}
          </button>
        </div>

        {hoja && !hoja.ok && (
          <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-500" role="alert">{interpolar(k.errorHoja, { mensaje: hoja.mensaje })}</p>
        )}
        {hoja?.ok && (
          <div className="mt-3 space-y-1 text-sm" role="status">
            <p>{interpolar(k.resumenHoja, { filas: String(hoja.filas), n: String(hoja.conRegistro) })}</p>
            {hoja.sinPerfil > 0 && <p className="text-amber-600">{interpolar(k.sinPerfil, { n: String(hoja.sinPerfil) })}</p>}
          </div>
        )}

        {sinTerminar && !enviando && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--borde)' }}>
            <span className="text-sm">{interpolar(c.pausado, { n: String(sinTerminar.progreso.pendientes + sinTerminar.progreso.enviando) })}</span>
            <button type="button" className="boton-primario !py-2 !text-sm" onClick={() => void enviarTandas(sinTerminar.id)}>{c.continuar}</button>
            <span className="text-xs tenue">{c.enCurso}</span>
          </div>
        )}
      </section>

      {hoja?.ok && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {GRUPOS.map((g) => (
            <TarjetaDeGrupo
              key={g}
              grupo={g}
              nombre={nombreDe(g)}
              estado={hoja.grupos[g]}
              bloqueado={ocupado}
              onRevisar={() => pedirConfirmacion(g)}
            />
          ))}
        </div>
      )}

      <section className="tarjeta mt-4 p-4" aria-labelledby="constancias-lista">
        <h2 id="constancias-lista" className="text-base font-bold">{k.listaTitulo}</h2>
        <p className="ayuda !mt-1">{interpolar(k.listaAyuda, { max: String(MAXIMO_DE_LA_LISTA) })}</p>
        <label className="etiqueta mt-3 block" htmlFor="lista-correos">{k.listaCorreos}</label>
        <textarea
          id="lista-correos"
          className="campo min-h-24 w-full"
          placeholder={k.listaEjemplo}
          value={texto}
          disabled={enviando || confirmando === 'lista'}
          onChange={(e) => setTexto(e.target.value)}
        />
        <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-ciess-500"
            checked={reenviar}
            disabled={enviando || confirmando === 'lista'}
            onChange={(e) => setReenviar(e.target.checked)}
          />
          <span>{k.listaReenviar}</span>
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="boton-secundario !py-2 !text-sm"
            onClick={() => void verificarLista()}
            disabled={verificando || enviando || texto.trim() === ''}
          >
            {verificando ? k.listaVerificando : k.listaVerificar}
          </button>
          {verificada && !listaVigente && <span className="text-sm text-amber-600">{k.listaCambio}</span>}
        </div>

        {listaVigente && (
          <div className="mt-3 text-sm">
            <p className="text-base font-bold" role="status">
              {interpolar(k.listaResumen, { enviar: String(listaVigente.porEnviar), total: String(listaVigente.verificacion.length) })}
            </p>
            {listaVigente.reenvios > 0 && <p className="text-amber-600">{interpolar(k.listaReenvios, { n: String(listaVigente.reenvios) })}</p>}
            {listaVigente.enlaceNuevo > 0 && <p className="text-amber-600">{interpolar(k.enlaceNuevo, { n: String(listaVigente.enlaceNuevo) })}</p>}
            {listaVigente.porEnviar > 0 && (
              <p className="ayuda">
                {interpolar(k.porIdioma, { es: String(listaVigente.porIdioma.es), en: String(listaVigente.porIdioma.en), pt: String(listaVigente.porIdioma.pt) })}
              </p>
            )}
            <div className="desplazable mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="tenue">
                    <th className="py-1.5 pr-3 font-medium">{k.tablaCorreo}</th>
                    <th className="py-1.5 pr-3 font-medium">{k.tablaPersona}</th>
                    <th className="py-1.5 pr-3 font-medium">{k.tablaFila}</th>
                    <th className="py-1.5 font-medium">{k.tablaEstado}</th>
                  </tr>
                </thead>
                <tbody>
                  {listaVigente.verificacion.map((v) => (
                    <tr key={v.correo} className="border-t" style={{ borderColor: 'var(--borde)' }}>
                      <td className="py-1.5 pr-3 break-all">{v.correo}</td>
                      <td className="py-1.5 pr-3">{v.nombre ?? '—'}</td>
                      <td className="py-1.5 pr-3">{v.numero ?? '—'}</td>
                      <td className={`py-1.5 ${v.estado === 'enviar' ? 'font-medium' : 'text-amber-600'}`}>
                        {v.estado === 'enviar' && v.reenvio ? k.estados.reenvio : k.estados[v.estado]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <button
                type="button"
                className="boton-primario !py-2 !text-sm"
                onClick={() => pedirConfirmacion('lista')}
                disabled={listaVigente.porEnviar === 0 || ocupado}
              >
                {k.listaRevisar}
              </button>
            </div>
          </div>
        )}
      </section>

      {error && <p className="mt-3 text-sm text-red-500" role="alert">{error}</p>}

      {confirmando && totalAConfirmar > 0 && (
        <section className="tarjeta mt-4 p-4" aria-label={k.enviarAhora}>
          <p className="text-base font-bold">{interpolar(k.confirmarA, { alcance: nombreDe(confirmando), n: String(totalAConfirmar) })}</p>
          <label className="etiqueta mt-3 block" htmlFor="confirmar-constancias">{interpolar(c.confirmar, { n: String(totalAConfirmar) })}</label>
          <input
            id="confirmar-constancias"
            className="campo !w-40"
            inputMode="numeric"
            autoComplete="off"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
          />
          <p className="ayuda">{c.advertencia}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className="boton-primario !py-2 !text-sm" onClick={() => void confirmarYEnviar()} disabled={!puedeConfirmar}>
              {k.enviarAhora}
            </button>
            <button type="button" className="boton-secundario !py-2 !text-sm" onClick={() => { setConfirmando(null); setConfirmacion(''); }}>
              {c.cancelar}
            </button>
          </div>
        </section>
      )}

      {progreso && (enviando || aviso) && (
        <section className="tarjeta mt-4 p-4" aria-live="polite">
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
        </section>
      )}

      <section className="tarjeta mt-4 p-4" aria-labelledby="constancias-historial">
        <h2 id="constancias-historial" className="text-base font-bold">{c.historial}</h2>
        {campanas.length === 0 ? (
          <p className="ayuda">{k.sinHistorial}</p>
        ) : (
          <div className="desplazable mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="tenue">
                  <th className="py-1.5 pr-3 font-medium">{c.fecha}</th>
                  <th className="py-1.5 pr-3 font-medium">{k.historialA}</th>
                  <th className="py-1.5 pr-3 font-medium">{c.quien}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">{c.enviados}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">{c.errores}</th>
                  <th className="py-1.5 text-right font-medium">{c.faltan}</th>
                </tr>
              </thead>
              <tbody>
                {campanas.map((x) => (
                  <tr key={x.id} className="border-t" style={{ borderColor: 'var(--borde)' }}>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fecha(x.creada_en)}</td>
                    <td className="py-1.5 pr-3">{nombreDe(x.alcance)}</td>
                    <td className="py-1.5 pr-3">{x.creada_por ?? '—'}</td>
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

      <PlantillaDeConstancia />
    </div>
  );
}

/** Un grupo (público general o ponentes): cuántos reciben ahora su constancia, a quiénes se deja fuera y por qué, y su botón de envío. */
function TarjetaDeGrupo({
  grupo, nombre, estado, bloqueado, onRevisar,
}: { grupo: Grupo; nombre: string; estado: EstadoDeGrupo; bloqueado: boolean; onRevisar: () => void }) {
  const { t } = useApp();
  const k = t.panel.constancias;
  const x = estado.excluidos;
  const fuera = [
    x.sinConstancia > 0 && interpolar(k.fueraSinConstancia, { n: String(x.sinConstancia) }),
    x.enlaceInvalido > 0 && interpolar(k.fueraEnlaceInvalido, { n: String(x.enlaceInvalido) }),
    x.sinCorreo > 0 && interpolar(k.fueraSinCorreo, { n: String(x.sinCorreo) }),
    x.correoRepetido > 0 && interpolar(k.fueraRepetidos, { n: String(x.correoRepetido) }),
    x.sinRegistro > 0 && interpolar(k.fueraSinRegistro, { n: String(x.sinRegistro) }),
  ].filter((v): v is string => typeof v === 'string');

  return (
    <section className="tarjeta p-4" aria-labelledby={`constancias-${grupo}`}>
      <h2 id={`constancias-${grupo}`} className="text-base font-bold">{nombre}</h2>
      <div className="mt-2 space-y-1 text-sm" role="status">
        <p>{interpolar(k.yaRecibieron, { n: String(x.yaRecibieron) })}</p>
        <p className="text-base font-bold">{interpolar(k.porEnviar, { n: String(estado.porEnviar) })}</p>
        {estado.porEnviar > 0 && (
          <p className="ayuda">{interpolar(k.porIdioma, { es: String(estado.porIdioma.es), en: String(estado.porIdioma.en), pt: String(estado.porIdioma.pt) })}</p>
        )}
        {estado.enlaceNuevo > 0 && <p className="text-amber-600">{interpolar(k.enlaceNuevo, { n: String(estado.enlaceNuevo) })}</p>}
        {fuera.length > 0 && <p className="ayuda">{k.fuera}: {fuera.join(' · ')}.</p>}
      </div>

      {estado.faltan.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">{k.faltanConstancia} ({estado.faltanTotal})</summary>
          <p className="ayuda !mt-1">{k.faltanAyuda}</p>
          <ul className="mt-1 list-disc pl-5">
            {estado.faltan.map((f) => <li key={f.numero}>N.º {f.numero} · {f.nombre}{f.correo ? ` · ${f.correo}` : ''}</li>)}
            {estado.faltanTotal > estado.faltan.length && <li>{interpolar(k.yMas, { n: String(estado.faltanTotal - estado.faltan.length) })}</li>}
          </ul>
        </details>
      )}

      {estado.muestra.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">{k.muestra}</summary>
          <ul className="mt-1 space-y-1">
            {estado.muestra.map((m) => (
              <li key={m.numero}>
                N.º {m.numero} · {m.nombre} ·{' '}
                <a className="underline" href={m.enlace} target="_blank" rel="noopener noreferrer">{k.probarEnlace}</a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="boton-primario !py-2 !text-sm" onClick={onRevisar} disabled={estado.porEnviar === 0 || bloqueado}>
          {interpolar(k.grupoRevisar, { grupo: nombre })}
        </button>
        {estado.porEnviar === 0 && <span className="text-sm">{k.sinDestinatarios}</span>}
      </div>
    </section>
  );
}
