'use client';

import { useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { transicionesDesde, type EstadoRegistro } from '@/lib/estados';

const COLOR: Record<EstadoRegistro, string> = {
  en_proceso: 'bg-ciess-500/15 text-ciess-400',
  confirmado: 'bg-emerald-500/15 text-emerald-500',
  lista_espera: 'bg-amber-500/15 text-amber-500',
  cancelado: 'bg-red-500/15 text-red-500',
};

export function InsigniaEstado({ estado }: { estado: EstadoRegistro }) {
  const { t } = useApp();
  return <span className={`insignia ${COLOR[estado]}`}>{t.panel.estadosRegistro[estado]}</span>;
}

/**
 * Cambio de estado de un registro. Sólo ofrece las transiciones que tienen
 * sentido desde el estado actual; el servidor vuelve a comprobarlas y además
 * verifica el cupo presencial antes de asignar un lugar.
 */
export function ControlEstado({
  id,
  estado,
  onCambio,
  compacto = false,
  avisarFijo,
  destacar,
}: {
  id: string;
  estado: EstadoRegistro;
  onCambio: () => void;
  /** Sin cabecera ni casilla propia: para listas con una decisión común. */
  compacto?: boolean;
  /** En modo compacto, la preferencia de aviso la lleva la lista. */
  avisarFijo?: boolean;
  /** Estado que se presenta como acción principal. */
  destacar?: EstadoRegistro;
}) {
  const { t } = useApp();
  const [avisarPropio, setAvisar] = useState(true);
  const avisar = compacto ? (avisarFijo ?? true) : avisarPropio;
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const opciones = transicionesDesde(estado);

  async function cambiar(nuevo: EstadoRegistro) {
    setOcupado(true);
    setMensaje('');
    setError('');
    try {
      const respuesta = await fetch(`/api/registros/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevo, avisar }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos.mensaje ?? t.estados.error);
        return;
      }
      setMensaje(
        datos.correo?.enviado
          ? `${t.panel.estadosRegistro.cambiado} · ${t.panel.plantillas.enviarPrueba.toLowerCase()}`
          : t.panel.estadosRegistro.cambiado,
      );
      onCambio();
    } catch {
      setError(t.estados.error);
    } finally {
      setOcupado(false);
    }
  }

  if (compacto) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {opciones.map((opcion) => (
          <button
            key={opcion}
            type="button"
            className={
              opcion === destacar
                ? 'boton-primario !py-1.5 !text-xs'
                : 'boton-secundario !py-1.5 !text-xs'
            }
            disabled={ocupado}
            onClick={() => void cambiar(opcion)}
          >
            {t.panel.estadosRegistro.verbo[opcion]}
          </button>
        ))}
        {mensaje && <span className="text-xs text-emerald-500">{mensaje}</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <section className="rounded-lg border p-4" style={{ borderColor: 'var(--borde)' }}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold">{t.panel.estadosRegistro.titulo}</h3>
        <InsigniaEstado estado={estado} />
      </div>

      {opciones.length === 0 ? (
        <p className="ayuda">{t.panel.registros.sinPermiso}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {opciones.map((opcion) => (
              <button
                key={opcion}
                type="button"
                className="boton-secundario !py-1.5 !text-xs"
                disabled={ocupado}
                onClick={() => void cambiar(opcion)}
              >
                {t.panel.estadosRegistro.verbo[opcion]}
              </button>
            ))}
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-ciess-500"
              checked={avisar}
              onChange={(e) => setAvisar(e.target.checked)}
            />
            <span className="text-xs tenue">{t.panel.estadosRegistro.avisar}</span>
          </label>
        </>
      )}

      {mensaje && <p className="mt-3 text-xs text-emerald-500">{mensaje}</p>}
      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
    </section>
  );
}
