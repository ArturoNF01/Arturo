'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { interpolar, type Idioma } from '@/i18n';
import { correoValido, type RespuestaManual, type ViaAsistencia } from '@/lib/asistencia';
import type { AsistenciaManual, RegistroCoincidente } from '@/lib/servidor/asistencia';
import { pedir, post } from './pedir';

type Mensaje = { tipo: 'ok' | 'info' | 'error'; texto: string };

const COLOR_DEL_MENSAJE = {
  ok: 'bg-green-500/10',
  info: 'bg-amber-500/10',
  error: 'bg-red-500/10',
} as const;

/**
 * Registrar a mano la asistencia de quien no tiene teléfono —o no pudo escanear el QR—, desde el panel.
 *
 * Se escribe el correo con el que la persona se registró (o, si no lo recuerda, su nombre): salen los registros que
 * coinciden y con un clic se anota su asistencia. Es lo mismo que un escaneo, con las mismas reglas: una asistencia por
 * persona y por día. Si el correo no está entre los registros se pide el nombre y queda «sin registro», para que el
 * comité la concilie después, igual que cuando alguien escanea y no aparece.
 *
 * Abajo se ven las últimas anotadas a mano, con quién las anotó, para revisar y deshacer una equivocación.
 */
export function RegistroManual({
  dias, diaDeHoy, alCambiar,
}: {
  /** Los días de la agenda, para elegir en cuál se anota. */
  dias: { clave: string; corto: Record<Idioma, string> }[];
  /** El día que se propone —el de hoy, o el más cercano— y si de verdad es hoy. */
  diaDeHoy: { clave: string; esHoy: boolean };
  /** Avisa que cambió la asistencia, para que el resto del panel vuelva a contar. */
  alCambiar: () => void | Promise<void>;
}) {
  const { t, idioma } = useApp();
  const a = t.panel.asistencia;

  const [dia, setDia] = useState(diaDeHoy.clave);
  const [via, setVia] = useState<ViaAsistencia>('presencial');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState<{ q: string; lista: RegistroCoincidente[] } | null>(null);
  const [nombre, setNombre] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [recientes, setRecientes] = useState<AsistenciaManual[] | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const nombreDelDia = useCallback((clave: string) => dias.find((d) => d.clave === clave)?.corto[idioma] ?? clave, [dias, idioma]);
  const nombreDeVia = (v: ViaAsistencia) => (v === 'presencial' ? a.colPresencial : a.colEnLinea);
  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString({ es: 'es-MX', en: 'en-US', pt: 'pt-BR' }[idioma], { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });

  const cargarRecientes = useCallback(async () => {
    const r = await pedir<{ manuales: AsistenciaManual[] }>('/api/asistencia/panel?vista=manuales');
    if (r.ok && r.datos) setRecientes(r.datos.manuales);
  }, []);

  useEffect(() => {
    // La respuesta llega después de pintar: no se actualiza nada de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarRecientes();
  }, [cargarRecientes]);

  // La búsqueda espera un instante a que se deje de teclear, y descarta lo que llegue fuera de orden.
  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBusqueda(null);
      return;
    }
    let vigente = true;
    const id = setTimeout(async () => {
      const r = await pedir<{ registros: RegistroCoincidente[] }>('/api/asistencia/panel', post({ accion: 'buscar', texto: q }));
      if (vigente) setBusqueda({ q, lista: r.ok && r.datos ? r.datos.registros : [] });
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(id);
    };
  }, [texto]);

  const correo = texto.trim().toLowerCase();
  // Mientras se teclea, la lista que se ve es de lo anterior: se ve atenuada y no se puede actuar sobre ella (ni con el
  // botón ni con Enter), para no anotar a la persona equivocada con una lista que ya no corresponde a lo escrito.
  const fresca = busqueda !== null && busqueda.q === texto.trim();
  const resultados = busqueda?.lista ?? null;
  // Un correo bien escrito que no está entre los registros: se puede anotar «sin registro» con el nombre.
  const sinRegistro = fresca && resultados !== null && resultados.length === 0 && correoValido(correo);

  function limpiar() {
    setTexto('');
    setNombre('');
    setBusqueda(null);
    entrada.current?.focus();
  }

  async function registrar(cuerpo: { registroId?: string; correo?: string; nombre?: string }) {
    setTrabajando(true);
    setMensaje(null);
    const r = await pedir<RespuestaManual>('/api/asistencia/panel', post({ accion: 'registrar_manual', sesion: dia, via, ...cuerpo }));
    setTrabajando(false);

    const d = r.datos;
    if (!d || !('ok' in d)) {
      setMensaje({ tipo: 'error', texto: r.mensaje ?? a.error });
      return;
    }
    if (d.ok) {
      const datos = { nombre: d.nombre, dia: nombreDelDia(d.sesion), via: nombreDeVia(d.via) };
      setMensaje(
        d.estado === 'ya_registrada'
          ? { tipo: 'info', texto: interpolar(a.manualYa, datos) }
          : { tipo: 'ok', texto: interpolar(d.sinRegistro ? a.manualRegistradaSinRegistro : a.manualRegistrada, datos) },
      );
      limpiar();
      void cargarRecientes();
      await alCambiar();
      return;
    }
    if (d.motivo === 'no_encontrado') {
      // El servidor tampoco halló ese correo: se pide el nombre.
      setBusqueda({ q: texto.trim(), lista: [] });
      return;
    }
    setMensaje({
      tipo: 'error',
      texto:
        d.motivo === 'datos_invalidos' ? a.manualDatosInvalidos
        : d.motivo === 'registro_invalido' ? a.manualRegistroInvalido
        : (d.mensaje ?? r.mensaje ?? a.error),
    });
  }

  async function quitar(id: string) {
    if (!window.confirm(a.confirmarQuitar)) return;
    const r = await pedir('/api/asistencia/panel', post({ accion: 'quitar', id }));
    if (!r.ok) {
      setMensaje({ tipo: 'error', texto: r.mensaje ?? a.error });
      return;
    }
    setMensaje(null);
    void cargarRecientes();
    await alCambiar();
  }

  // Enter anota a la persona cuando es la única que salió: el camino corto de quien teclea el correo completo.
  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || trabajando) return;
    e.preventDefault();
    if (fresca && resultados?.length === 1) void registrar({ registroId: resultados[0].id, ...(correoValido(correo) ? { correo } : {}) });
  }

  const botonDe = (activo: boolean) =>
    `rounded-lg px-3.5 py-2 text-sm font-semibold ${activo ? 'bg-ciess-500 text-white' : 'boton-secundario'}`;

  return (
    <section className="space-y-4" aria-label={a.manualTitulo}>
      <div className="tarjeta space-y-4 p-4">
        <div>
          <h2 className="text-base font-bold">{a.manualTitulo}</h2>
          <p className="ayuda">{a.manualAyuda}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <span className="etiqueta">{a.manualDia}</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label={a.manualDia}>
              {dias.map((d) => (
                <button key={d.clave} type="button" aria-pressed={dia === d.clave} className={botonDe(dia === d.clave)} onClick={() => setDia(d.clave)}>
                  {d.corto[idioma]}
                  {diaDeHoy.esHoy && d.clave === diaDeHoy.clave && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${dia === d.clave ? 'bg-white/25' : 'bg-green-500/15 text-green-700 dark:text-green-400'}`}>
                      {a.manualHoy}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {diaDeHoy.esHoy && dia !== diaDeHoy.clave && <p className="mt-1 text-xs text-amber-600">{a.manualOtroDia}</p>}
          </div>
          <div>
            <span className="etiqueta">{a.manualVia}</span>
            <div className="flex gap-2" role="group" aria-label={a.manualVia}>
              {(['presencial', 'en_linea'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={via === v} className={botonDe(via === v)} onClick={() => setVia(v)}>
                  {nombreDeVia(v)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="etiqueta" htmlFor="manual-buscar">{a.manualBuscar}</label>
          <input
            id="manual-buscar" ref={entrada} className="campo max-w-xl" value={texto} autoFocus autoComplete="off" spellCheck={false}
            onChange={(e) => {
              setTexto(e.target.value);
              // Lo que se dijo de la persona anterior ya no corresponde a lo que se está escribiendo.
              setMensaje(null);
            }}
            onKeyDown={alTeclear}
          />
          <span className="ayuda block">{a.manualBuscarAyuda}</span>
        </div>

        {mensaje && <p className={`rounded-lg p-3 text-sm ${COLOR_DEL_MENSAJE[mensaje.tipo]}`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>{mensaje.texto}</p>}

        {resultados !== null && resultados.length > 0 && (
          <ul className={`space-y-2 ${fresca ? '' : 'opacity-50'}`} aria-busy={!fresca}>
            {resultados.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--borde)' }}>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{r.nombre}</p>
                  <p className="break-all text-xs tenue">{r.correo} · {r.perfil} · {r.folio}</p>
                </div>
                <button
                  type="button" className="boton-primario !py-2 !text-sm" disabled={trabajando || !fresca}
                  onClick={() => void registrar({ registroId: r.id, ...(correoValido(correo) ? { correo } : {}) })}
                >
                  {a.manualRegistrar}
                </button>
              </li>
            ))}
          </ul>
        )}

        {fresca && resultados !== null && resultados.length === 0 && !sinRegistro && <p className="text-sm tenue">{a.sinCoincidencias}</p>}

        {sinRegistro && (
          <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: 'var(--dorado)' }}>
            <p className="text-sm">{a.manualNoEncontrado}</p>
            <label className="block max-w-xl">
              <span className="etiqueta">{a.manualNombre}</span>
              <input className="campo" value={nombre} autoComplete="off" onChange={(e) => setNombre(e.target.value)} />
            </label>
            <button
              type="button" className="boton-secundario !py-2 !text-sm" disabled={trabajando || nombre.trim().length < 3}
              onClick={() => void registrar({ correo, nombre })}
            >
              {a.manualSinRegistro}
            </button>
          </div>
        )}
      </div>

      <div className="tarjeta p-4">
        <h3 className="text-sm font-bold">{a.manualRecientes}</h3>
        {recientes === null ? (
          <p className="mt-2 text-sm tenue">…</p>
        ) : recientes.length === 0 ? (
          <p className="mt-2 text-sm tenue">{a.manualSinRecientes}</p>
        ) : (
          <ul className="mt-2 divide-y" style={{ borderColor: 'var(--borde)' }}>
            {recientes.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {m.nombre}
                    {m.sin_registro && <span className="ml-2 text-xs text-amber-600">{a.sinRegistro}</span>}
                  </p>
                  <p className="text-xs tenue">
                    <span className="break-all">{m.correo}</span> · {nombreDelDia(m.sesion)} · {nombreDeVia(m.via)} · {hora(m.creada_en)}
                    {m.registrada_por && <> · {interpolar(a.manualPor, { quien: m.registrada_por })}</>}
                  </p>
                </div>
                <button type="button" className="text-xs underline" onClick={() => void quitar(m.id)}>{a.quitar}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
