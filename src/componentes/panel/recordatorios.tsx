'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/componentes/proveedores';
import { interpolar } from '@/i18n';
import type { Recordatorio } from '@/lib/recordatorios';
import type { EstadoRecordatorios } from '@/lib/servidor/recordatorios';

/**
 * Recordatorios automáticos antes del congreso.
 *
 * El cron diario decide solo cuál toca; desde aquí se ajusta la antelación,
 * se desactivan y —si hace falta— se dispara uno a mano.
 */
export function SeccionRecordatorios({ estado }: { estado: EstadoRecordatorios }) {
  const { t, idioma } = useApp();
  const router = useRouter();

  const [filas, setFilas] = useState<Recordatorio[]>(estado.recordatorios);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const envioDe = (clave: string) => estado.envios.find((e) => e.clave === clave);

  function cambiar(indice: number, cambios: Partial<Recordatorio>) {
    setFilas(filas.map((f, i) => (i === indice ? { ...f, ...cambios } : f)));
  }

  async function guardar() {
    setOcupado('guardar');
    setMensaje('');
    const respuesta = await fetch('/api/configuracion-panel', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordatorios: filas }),
    });
    const resultado = await respuesta.json().catch(() => ({}));
    setMensaje(respuesta.ok ? t.estados.guardado : resultado.mensaje ?? t.estados.error);
    if (respuesta.ok) router.refresh();
    setOcupado(null);
  }

  async function enviarAhora(clave: string) {
    if (!window.confirm(interpolar(t.panel.recordatorios.confirmarEnvio, { clave }))) return;
    setOcupado(clave);
    setMensaje('');
    const respuesta = await fetch('/api/recordatorios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave }),
    });
    const resultado = await respuesta.json().catch(() => ({}));
    setMensaje(
      respuesta.ok
        ? `${t.panel.recordatorios.enviados}: ${resultado.enviados ?? 0}`
        : resultado.mensaje ?? t.estados.error,
    );
    if (respuesta.ok) router.refresh();
    setOcupado(null);
  }

  return (
    <section className="tarjeta mt-5 max-w-3xl p-5">
      <h2 className="text-sm font-semibold">{t.panel.recordatorios.titulo}</h2>
      <p className="ayuda !mt-1 mb-4">{t.panel.recordatorios.ayuda}</p>

      {!estado.cronConfigurado && (
        <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
          {t.panel.recordatorios.sinCron}
        </p>
      )}

      <ul className="space-y-3">
        {filas.map((fila, indice) => {
          const envio = envioDe(fila.clave);
          return (
            <li
              key={fila.clave}
              className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b pb-3 last:border-0 last:pb-0"
              style={{ borderColor: 'var(--borde)' }}
            >
              <span className="mb-2.5 min-w-[3.5rem] font-mono text-xs tenue">{fila.clave}</span>

              <label className="block w-28">
                {/* La etiqueta se escribe una vez: en las filas siguientes queda
                    sólo para lectores de pantalla. */}
                <span className={indice === 0 ? 'etiqueta' : 'sr-only'}>
                  {t.panel.recordatorios.diasAntes}
                </span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  className="campo"
                  value={fila.dias_antes}
                  onChange={(e) => cambiar(indice, { dias_antes: Number(e.target.value) })}
                />
              </label>

              <label className="mb-2.5 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-ciess-500"
                  checked={fila.activo}
                  onChange={(e) => cambiar(indice, { activo: e.target.checked })}
                />
                <span className="text-xs">{t.panel.recordatorios.activo}</span>
              </label>

              <p className="mb-2.5 flex-1 text-xs tenue">
                {t.panel.recordatorios.enviados}: <strong>{envio?.enviados ?? 0}</strong>
                {' · '}
                {t.panel.recordatorios.ultimoEnvio}:{' '}
                {envio?.ultimo_envio
                  ? new Date(envio.ultimo_envio).toLocaleString(idioma)
                  : t.panel.recordatorios.nunca}
              </p>

              <button
                type="button"
                className="boton-secundario mb-2 !px-3 !py-1.5 !text-xs"
                disabled={ocupado !== null}
                onClick={() => enviarAhora(fila.clave)}
              >
                {ocupado === fila.clave ? t.estados.enviando : t.panel.recordatorios.enviarAhora}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="boton-primario !py-2 !text-sm"
          onClick={guardar}
          disabled={ocupado !== null}
        >
          {t.acciones.guardar}
        </button>
        {mensaje && <span className="text-xs tenue">{mensaje}</span>}
      </div>
    </section>
  );
}
