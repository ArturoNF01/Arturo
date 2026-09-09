'use client';

import { useState } from 'react';
import { useApp } from '@/componentes/proveedores';

/**
 * Envoltura común de las gráficas: título, alternancia entre la vista gráfica
 * y la vista de tabla —obligatoria porque tres tonos de la paleta quedan por
 * debajo de 3:1 sobre la superficie clara— y espacio para la leyenda.
 */
export function TarjetaGrafica({
  titulo,
  ayuda,
  filas,
  columnas,
  alto = 280,
  acciones,
  children,
}: {
  titulo: string;
  ayuda?: string;
  /** Datos que respaldan la gráfica, para la vista de tabla. */
  filas?: (string | number)[][];
  columnas?: string[];
  alto?: number;
  acciones?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useApp();
  const [tabla, setTabla] = useState(false);
  const hayDatos = !filas || filas.length > 0;

  return (
    <section className="tarjeta viz flex flex-col p-4 sm:p-5">
      <header className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{titulo}</h3>
          {ayuda && <p className="ayuda !mt-1">{ayuda}</p>}
        </div>
        {acciones}
        {filas && columnas && (
          <button
            type="button"
            onClick={() => setTabla((v) => !v)}
            aria-pressed={tabla}
            title={tabla ? titulo : t.panel.exportar.csv}
            className="shrink-0 rounded-lg border px-2 py-1 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/5"
            style={{ borderColor: 'var(--borde)' }}
          >
            {tabla ? '▤' : '☰'}
          </button>
        )}
      </header>

      {!hayDatos ? (
        <p className="grid flex-1 place-items-center py-10 text-sm tenue" style={{ minHeight: alto }}>
          {t.estados.sinDatos}
        </p>
      ) : tabla && filas && columnas ? (
        <div className="desplazable overflow-auto" style={{ maxHeight: alto }}>
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0" style={{ backgroundColor: 'var(--fondo-tarjeta)' }}>
              <tr>
                {columnas.map((c) => (
                  <th key={c} className="border-b py-2 pr-4 font-semibold" style={{ borderColor: 'var(--borde)' }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  {fila.map((celda, j) => (
                    <td key={j} className="border-b py-1.5 pr-4 tabular-nums" style={{ borderColor: 'var(--borde)' }}>
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height: alto }}>{children}</div>
      )}
    </section>
  );
}

/** Leyenda con punto de color; el texto nunca lleva el color de la serie. */
export function Leyenda({ elementos }: { elementos: { nombre: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {elementos.map((e) => (
        <li key={e.nombre} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--texto-viz-tenue)' }}>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} aria-hidden />
          {e.nombre}
        </li>
      ))}
    </ul>
  );
}

/** Ficha con un número grande: la forma correcta cuando el dato es un valor. */
export function Ficha({
  etiqueta, valor, detalle, acento,
}: {
  etiqueta: string;
  valor: string | number;
  detalle?: string;
  acento?: string;
}) {
  return (
    <div className="tarjeta p-4">
      <p className="text-xs uppercase tracking-wide tenue">{etiqueta}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums" style={acento ? { color: acento } : undefined}>
        {typeof valor === 'number' ? valor.toLocaleString() : valor}
      </p>
      {detalle && <p className="ayuda !mt-1">{detalle}</p>}
    </div>
  );
}
