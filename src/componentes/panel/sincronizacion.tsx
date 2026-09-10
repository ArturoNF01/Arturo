'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/componentes/proveedores';

interface Pendiente {
  id: string;
  folio: string;
  creado_en: string;
  sheets_error: string | null;
}

/**
 * Estado de la réplica en Google Sheets. Si un registro no llegó a la hoja
 * —por una caída de la API o por credenciales aún sin configurar— queda
 * listado aquí y se puede reintentar sin perder el dato, que ya está en
 * la base.
 */
export function EstadoSincronizacion() {
  const { t, idioma } = useApp();
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [configurado, setConfigurado] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargar = useCallback(async () => {
    const respuesta = await fetch('/api/sincronizar');
    if (!respuesta.ok) {
      setCargando(false);
      return;
    }
    const datos = await respuesta.json();
    setPendientes(datos.pendientes);
    setConfigurado(datos.configurado);
    setCargando(false);
  }, []);

  useEffect(() => {
  // La regla no distingue la frontera asíncrona: `cargar` es una promesa y su
  // setState ocurre después del efecto, no de forma síncrona dentro de él.
  // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  async function reintentar(id?: string) {
    setTrabajando(true);
    setMensaje('');
    const respuesta = await fetch('/api/sincronizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id } : {}),
    });
    const datos = await respuesta.json();
    setMensaje(
      respuesta.ok
        ? `${datos.sincronizados} sincronizados${datos.fallidos.length ? ` · ${datos.fallidos.length} con error` : ''}`
        : datos.mensaje ?? t.estados.error,
    );
    await cargar();
    setTrabajando(false);
  }

  if (cargando) return null;

  return (
    <section className="tarjeta mt-5 max-w-2xl p-5">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Réplica en Google Sheets</h2>
          <p className="ayuda !mt-1">
            Cada registro se guarda primero en la base y después se replica en el libro de
            seguimiento. Lo que no haya llegado a la hoja aparece aquí y se puede reintentar.
          </p>
        </div>
        <span
          className={`insignia shrink-0 ${
            !configurado
              ? 'bg-amber-500/15 text-amber-500'
              : pendientes.length === 0
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-red-500/15 text-red-500'
          }`}
        >
          {!configurado ? 'Sin configurar' : pendientes.length === 0 ? 'Al día' : `${pendientes.length} pendientes`}
        </span>
      </header>

      {pendientes.length > 0 && (
        <ul className="desplazable mb-4 max-h-60 space-y-1.5 overflow-y-auto">
          {pendientes.map((p) => (
            <li
              key={p.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-2.5 text-xs"
              style={{ borderColor: 'var(--borde)' }}
            >
              <div className="min-w-0">
                <p className="font-mono font-semibold">{p.folio}</p>
                <p className="tenue">{new Date(p.creado_en).toLocaleString(idioma)}</p>
                {p.sheets_error && <p className="mt-1 break-words text-red-500">{p.sheets_error}</p>}
              </div>
              <button
                type="button"
                className="boton-secundario shrink-0 !px-2 !py-1 !text-xs"
                disabled={trabajando || !configurado}
                onClick={() => void reintentar(p.id)}
              >
                {t.acciones.reintentar}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="boton-secundario !py-2 !text-xs"
          disabled={trabajando || !configurado || pendientes.length === 0}
          onClick={() => void reintentar()}
        >
          {trabajando ? t.estados.cargando : `${t.acciones.reintentar} (${pendientes.length})`}
        </button>
        {mensaje && <span className="text-xs tenue">{mensaje}</span>}
      </div>
    </section>
  );
}
