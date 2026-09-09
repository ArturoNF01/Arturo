'use client';

import { useMemo } from 'react';
import { useApp } from '@/componentes/proveedores';
import { PERFILES, nombrePerfil } from '@/lib/perfiles';
import { interpolar } from '@/i18n';
import type { Filtros, RegistroPanel } from './usar-registros';
import { FILTROS_VACIOS } from './usar-registros';

/** Fila única de controles sobre las gráficas, como pide la guía de datos. */
export function BarraFiltros({
  filtros, onCambio, registros, resultados,
}: {
  filtros: Filtros;
  onCambio: (filtros: Filtros) => void;
  registros: RegistroPanel[];
  resultados: number;
}) {
  const { t } = useApp();

  const paises = useMemo(
    () => [...new Set(registros.map((r) => r.pais_residencia).filter(Boolean) as string[])].sort(),
    [registros],
  );

  const fijar = (clave: keyof Filtros, valor: string) => onCambio({ ...filtros, [clave]: valor });

  return (
    <div className="tarjeta mb-5 p-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <Control etiqueta={t.panel.filtros.desde}>
          <input type="date" className="campo !py-1.5" value={filtros.desde} onChange={(e) => fijar('desde', e.target.value)} />
        </Control>
        <Control etiqueta={t.panel.filtros.hasta}>
          <input type="date" className="campo !py-1.5" value={filtros.hasta} onChange={(e) => fijar('hasta', e.target.value)} />
        </Control>
        <Control etiqueta={t.panel.filtros.pais}>
          <select className="campo !py-1.5" value={filtros.pais} onChange={(e) => fijar('pais', e.target.value)}>
            <option value="">{t.panel.filtros.todos}</option>
            {paises.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Control>
        <Control etiqueta={t.panel.filtros.perfil}>
          <select className="campo !py-1.5" value={filtros.perfil} onChange={(e) => fijar('perfil', e.target.value)}>
            <option value="">{t.panel.filtros.todos}</option>
            {PERFILES.map((p) => (
              <option key={p.clave} value={p.clave}>{nombrePerfil(p.clave, t)}</option>
            ))}
          </select>
        </Control>
        <Control etiqueta={t.panel.filtros.modalidad}>
          <select className="campo !py-1.5" value={filtros.modalidad} onChange={(e) => fijar('modalidad', e.target.value)}>
            <option value="">{t.panel.filtros.todos}</option>
            <option value="presencial">{t.modalidad.presencial}</option>
            <option value="en_linea">{t.modalidad.en_linea}</option>
          </select>
        </Control>
        <Control etiqueta={t.panel.filtros.institucion} ancho="min-w-[11rem] flex-1">
          <input
            type="search" className="campo !py-1.5" value={filtros.institucion}
            onChange={(e) => fijar('institucion', e.target.value)}
            placeholder={t.panel.filtros.todos}
          />
        </Control>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs tabular-nums tenue">
            {interpolar(t.panel.filtros.resultados, { n: resultados })}
          </span>
          <button type="button" className="boton-secundario !py-1.5 !text-xs" onClick={() => onCambio(FILTROS_VACIOS)}>
            {t.acciones.limpiar}
          </button>
        </div>
      </div>
    </div>
  );
}

function Control({
  etiqueta, ancho = '', children,
}: {
  etiqueta: string;
  ancho?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${ancho}`}>
      <span className="mb-1 block text-[11px] uppercase tracking-wide tenue">{etiqueta}</span>
      {children}
    </label>
  );
}
