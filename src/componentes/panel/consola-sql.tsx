'use client';

import { useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { interpolar } from '@/i18n';

const EJEMPLOS = [
  {
    titulo: 'Registros por país y modalidad',
    sql: `select pais_residencia, modalidad, count(*) as total
from registros
where estado <> 'cancelado'
group by 1, 2
order by total desc`,
  },
  {
    titulo: 'Evolución diaria acumulada',
    sql: `select dia, total, sum(total) over (order by dia) as acumulado
from v_registros_por_dia
order by dia`,
  },
  {
    titulo: 'Actividad por hora y día de la semana',
    sql: `select dia_semana, hora, total
from v_actividad_hora_dia
order by dia_semana, hora`,
  },
  {
    titulo: 'Instituciones con más de un registro',
    sql: `select institucion, count(*) as total
from registros
where estado <> 'cancelado'
group by 1
having count(*) > 1
order by total desc`,
  },
  {
    titulo: 'Semblanzas fuera del límite de palabras',
    sql: `select folio, apellidos, nombres, semblanza_palabras
from registros
where semblanza_palabras > 60
order by semblanza_palabras desc`,
  },
];

export function ConsolaSql() {
  const { t } = useApp();
  const [consulta, setConsulta] = useState(EJEMPLOS[0].sql);
  const [filas, setFilas] = useState<Record<string, unknown>[]>([]);
  const [columnas, setColumnas] = useState<string[]>([]);
  const [milisegundos, setMilisegundos] = useState(0);
  const [error, setError] = useState('');
  const [ejecutando, setEjecutando] = useState(false);

  async function ejecutar() {
    setEjecutando(true);
    setError('');
    try {
      const respuesta = await fetch('/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consulta, limite: 1000 }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos.mensaje ?? t.estados.error);
        setFilas([]);
        setColumnas([]);
        return;
      }
      setFilas(datos.filas);
      setColumnas(datos.columnas);
      setMilisegundos(datos.milisegundos);
    } catch {
      setError(t.estados.error);
    } finally {
      setEjecutando(false);
    }
  }

  function descargarCsv() {
    if (filas.length === 0) return;
    const escapar = (valor: unknown) => {
      const texto = valor === null || valor === undefined ? '' : String(valor);
      return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    };
    const csv = [
      columnas.join(','),
      ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(',')),
    ].join('\n');

    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    enlace.download = `consulta_${new Date().toISOString().slice(0, 10)}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold">{t.panel.sqlConsola.titulo}</h1>
        <p className="ayuda !mt-1">{t.panel.sqlConsola.ayuda}</p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {EJEMPLOS.map((ejemplo) => (
          <button
            key={ejemplo.titulo}
            type="button"
            className="boton-secundario !py-1.5 !text-xs"
            onClick={() => setConsulta(ejemplo.sql)}
          >
            {ejemplo.titulo}
          </button>
        ))}
      </div>

      <div className="tarjeta p-4">
        <textarea
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          rows={9}
          spellCheck={false}
          className="campo desplazable w-full resize-y font-mono text-xs leading-relaxed"
          aria-label={t.panel.sqlConsola.titulo}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className="boton-primario !py-2 !text-sm" onClick={ejecutar} disabled={ejecutando}>
            {ejecutando ? t.estados.cargando : t.acciones.ejecutar}
          </button>
          {filas.length > 0 && (
            <>
              <button type="button" className="boton-secundario !py-2 !text-xs" onClick={descargarCsv}>
                {t.panel.exportar.csv}
              </button>
              <span className="text-xs tabular-nums tenue">
                {interpolar(t.panel.sqlConsola.filas, { n: filas.length, ms: milisegundos })}
              </span>
            </>
          )}
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 font-mono text-xs text-red-500">{error}</p>}
      </div>

      {filas.length > 0 && (
        <div className="tarjeta desplazable mt-4 max-h-[60vh] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0" style={{ backgroundColor: 'var(--fondo-tarjeta)' }}>
              <tr>
                {columnas.map((c) => (
                  <th key={c} className="whitespace-nowrap border-b px-3 py-2 font-semibold" style={{ borderColor: 'var(--borde)' }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  {columnas.map((c) => (
                    <td key={c} className="whitespace-nowrap border-b px-3 py-1.5 tabular-nums" style={{ borderColor: 'var(--borde)' }}>
                      {fila[c] === null || fila[c] === undefined ? '—' : String(fila[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
