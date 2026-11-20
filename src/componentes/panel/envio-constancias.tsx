'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { interpolar } from '@/i18n';
import { porcentajeAtendido, type Progreso } from '@/lib/comunicados';

interface Excluidos {
  sinRegistro: number; sinConstancia: number; enlaceInvalido: number; sinCorreo: number; correoRepetido: number; yaRecibieron: number;
}
type Hoja =
  | {
      ok: true;
      filas: number;
      conRegistro: number;
      porEnviar: number;
      enlaceNuevo: number;
      porIdioma: { es: number; en: number; pt: number };
      excluidos: Excluidos;
      faltan: { numero: string; nombre: string; correo: string }[];
      faltanTotal: number;
      muestra: { numero: string; nombre: string; enlace: string }[];
    }
  | { ok: false; mensaje: string };

interface Campana {
  id: string;
  creada_en: string;
  creada_por: string | null;
  estado: 'en_curso' | 'terminada';
  progreso: Progreso;
  faltaPorEnviar: boolean;
}

const dormir = (ms: number) => new Promise((seguir) => setTimeout(seguir, ms));

/**
 * El envío de las constancias: cada persona recibe un correo con un botón para descargar SU constancia, con el enlace de su fila
 * de la hoja de Google.
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
  const [confirmando, setConfirmando] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const [aviso, setAviso] = useState('');
  const [errores, setErrores] = useState<Record<string, { correo: string; error: string | null }[]>>({});
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

  async function confirmarYEnviar() {
    setError('');
    const r = await fetch('/api/constancias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmacion }),
    });
    const datos = await r.json().catch(() => null);
    if (!r.ok) {
      setError(datos?.mensaje ?? t.estados.error);
      await cargar();
      return;
    }
    setConfirmando(false);
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
  const total = hoja?.ok ? hoja.porEnviar : 0;
  const puedeConfirmar = total > 0 && confirmacion.trim() === String(total) && !enviando;
  const fecha = (iso: string) =>
    new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mexico_City' });

  const fuera = hoja?.ok
    ? [
        hoja.excluidos.sinConstancia > 0 && interpolar(k.fueraSinConstancia, { n: String(hoja.excluidos.sinConstancia) }),
        hoja.excluidos.enlaceInvalido > 0 && interpolar(k.fueraEnlaceInvalido, { n: String(hoja.excluidos.enlaceInvalido) }),
        hoja.excluidos.sinCorreo > 0 && interpolar(k.fueraSinCorreo, { n: String(hoja.excluidos.sinCorreo) }),
        hoja.excluidos.correoRepetido > 0 && interpolar(k.fueraRepetidos, { n: String(hoja.excluidos.correoRepetido) }),
        hoja.excluidos.sinRegistro > 0 && interpolar(k.fueraSinRegistro, { n: String(hoja.excluidos.sinRegistro) }),
      ].filter((x): x is string => typeof x === 'string')
    : [];

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold">{k.titulo}</h1>
        <p className="ayuda !mt-1">{k.ayuda}</p>
        <p className="ayuda">{k.archivos}</p>
        <a href="/panel/plantillas" className="text-sm underline">{k.editarTexto}</a>
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
            <p>{interpolar(k.conRegistro, { n: String(hoja.conRegistro) })}</p>
            <p>{interpolar(k.yaRecibieron, { n: String(hoja.excluidos.yaRecibieron) })}</p>
            <p className="text-base font-bold">{interpolar(k.porEnviar, { n: String(hoja.porEnviar) })}</p>
            {hoja.porEnviar > 0 && (
              <p className="ayuda">
                {interpolar(k.porIdioma, { es: String(hoja.porIdioma.es), en: String(hoja.porIdioma.en), pt: String(hoja.porIdioma.pt) })}
              </p>
            )}
            {hoja.enlaceNuevo > 0 && <p className="text-amber-600">{interpolar(k.enlaceNuevo, { n: String(hoja.enlaceNuevo) })}</p>}
            {fuera.length > 0 && <p className="ayuda">{k.fuera}: {fuera.join(' · ')}.</p>}
          </div>
        )}

        {hoja?.ok && hoja.faltan.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-medium">{k.faltanConstancia} ({hoja.faltanTotal})</summary>
            <p className="ayuda !mt-1">{k.faltanAyuda}</p>
            <ul className="mt-1 list-disc pl-5">
              {hoja.faltan.map((f) => <li key={f.numero}>N.º {f.numero} · {f.nombre}{f.correo ? ` · ${f.correo}` : ''}</li>)}
              {hoja.faltanTotal > hoja.faltan.length && <li>{interpolar(k.yMas, { n: String(hoja.faltanTotal - hoja.faltan.length) })}</li>}
            </ul>
          </details>
        )}

        {hoja?.ok && hoja.muestra.length > 0 && (
          <div className="mt-3 text-sm">
            <p className="ayuda !mt-0">{k.muestra}</p>
            <ul className="mt-1 space-y-1">
              {hoja.muestra.map((m) => (
                <li key={m.numero}>
                  N.º {m.numero} · {m.nombre} ·{' '}
                  <a className="underline" href={m.enlace} target="_blank" rel="noopener noreferrer">{k.probarEnlace}</a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {sinTerminar && !enviando && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--borde)' }}>
            <span className="text-sm">{interpolar(c.pausado, { n: String(sinTerminar.progreso.pendientes + sinTerminar.progreso.enviando) })}</span>
            <button type="button" className="boton-primario !py-2 !text-sm" onClick={() => void enviarTandas(sinTerminar.id)}>{c.continuar}</button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="boton-primario !py-2 !text-sm"
            onClick={() => { setConfirmando(true); setConfirmacion(''); setError(''); }}
            disabled={!hoja?.ok || hoja.porEnviar === 0 || enviando || Boolean(sinTerminar) || confirmando}
          >
            {k.revisar}
          </button>
          {sinTerminar && !enviando && <span className="text-xs tenue">{c.enCurso}</span>}
          {hoja?.ok && hoja.porEnviar === 0 && !sinTerminar && <span className="text-sm">{k.sinDestinatarios}</span>}
        </div>

        {error && <p className="mt-3 text-sm text-red-500" role="alert">{error}</p>}

        {confirmando && hoja?.ok && total > 0 && (
          <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'var(--borde)' }}>
            <p className="text-base font-bold">{interpolar(c.resumen, { n: String(total) })}</p>
            <label className="etiqueta mt-3 block" htmlFor="confirmar-constancias">{interpolar(c.confirmar, { n: String(total) })}</label>
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
              <button type="button" className="boton-secundario !py-2 !text-sm" onClick={() => { setConfirmando(false); setConfirmacion(''); }}>
                {c.cancelar}
              </button>
            </div>
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
          <p className="ayuda">{k.sinHistorial}</p>
        ) : (
          <div className="desplazable mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="tenue">
                  <th className="py-1.5 pr-3 font-medium">{c.fecha}</th>
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
    </div>
  );
}
