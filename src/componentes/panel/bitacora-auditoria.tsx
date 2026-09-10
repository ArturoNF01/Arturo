'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/componentes/proveedores';

export interface EntradaAuditoria {
  id: number;
  tabla: string;
  registro_id: string;
  accion: 'INSERT' | 'UPDATE' | 'DELETE';
  actor_correo: string | null;
  actor_rol: string | null;
  origen: string;
  campos: string[] | null;
  ocurrido_en: string;
  datos_previos: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
}

const COLOR_ACCION: Record<string, string> = {
  INSERT: 'bg-emerald-500/15 text-emerald-500',
  UPDATE: 'bg-ciess-500/15 text-ciess-400',
  DELETE: 'bg-red-500/15 text-red-500',
};

export function BitacoraAuditoria({ entradas }: { entradas: EntradaAuditoria[] }) {
  const { t, idioma } = useApp();
  const [accion, setAccion] = useState('');
  const [texto, setTexto] = useState('');
  const [abierta, setAbierta] = useState<number | null>(null);

  const filtradas = useMemo(() => {
    const termino = texto.trim().toLowerCase();
    return entradas.filter((e) => {
      if (accion && e.accion !== accion) return false;
      if (!termino) return true;
      return [e.actor_correo, e.registro_id, e.tabla, (e.campos ?? []).join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(termino);
    });
  }, [entradas, accion, texto]);

  const columnas = t.panel.auditoria.columnas;

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold">{t.panel.auditoria.titulo}</h1>
      </header>

      <div className="tarjeta mb-4 flex flex-wrap items-end gap-3 p-3.5">
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide tenue">{columnas.accion}</span>
          <select className="campo !py-1.5" value={accion} onChange={(e) => setAccion(e.target.value)}>
            <option value="">{t.panel.filtros.todos}</option>
            {(['INSERT', 'UPDATE', 'DELETE'] as const).map((a) => (
              <option key={a} value={a}>{t.panel.auditoria.acciones[a]}</option>
            ))}
          </select>
        </label>
        <label className="block min-w-[14rem] flex-1">
          <span className="mb-1 block text-[11px] uppercase tracking-wide tenue">{t.acciones.buscar}</span>
          <input type="search" className="campo !py-1.5" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <span className="ml-auto text-xs tabular-nums tenue">{filtradas.length}</span>
      </div>

      <div className="tarjeta desplazable overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--borde)' }}>
              {[columnas.fecha, columnas.actor, columnas.rol, columnas.accion, columnas.tabla,
                columnas.registro, columnas.campos].map((c) => (
                <th key={c} className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide tenue">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((e) => (
              <tr key={e.id} className="border-b align-top" style={{ borderColor: 'var(--borde)' }}>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums tenue">
                  {new Date(e.ocurrido_en).toLocaleString(idioma)}
                </td>
                <td className="max-w-[13rem] truncate px-3 py-2.5">{e.actor_correo ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tenue">
                  {e.actor_rol ? t.panel.roles[e.actor_rol as keyof typeof t.panel.roles] ?? e.actor_rol : e.origen}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className={`insignia ${COLOR_ACCION[e.accion]}`}>
                    {t.panel.auditoria.acciones[e.accion]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">{e.tabla}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs tenue">
                  {e.registro_id.slice(0, 8)}
                </td>
                <td className="px-3 py-2.5">
                  {e.campos?.length ? (
                    <button
                      type="button"
                      className="text-xs text-ciess-400 underline"
                      onClick={() => setAbierta(abierta === e.id ? null : e.id)}
                    >
                      {e.campos.length} · {t.panel.auditoria.verCambios}
                    </button>
                  ) : (
                    <span className="text-xs tenue">—</span>
                  )}
                  {abierta === e.id && e.campos && (
                    <dl className="mt-2 space-y-1.5 rounded-lg border p-2.5 text-xs" style={{ borderColor: 'var(--borde)' }}>
                      {e.campos.map((campo) => (
                        <div key={campo}>
                          <dt className="font-mono font-semibold">{campo}</dt>
                          <dd className="tenue">
                            <span className="line-through">{formatear(e.datos_previos?.[campo])}</span>
                            {' → '}
                            <span>{formatear(e.datos_nuevos?.[campo])}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtradas.length === 0 && <p className="py-10 text-center text-sm tenue">{t.estados.sinDatos}</p>}
    </div>
  );
}

function formatear(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (Array.isArray(valor)) return valor.join('; ') || '—';
  const texto = String(valor);
  return texto.length > 80 ? `${texto.slice(0, 80)}…` : texto;
}
