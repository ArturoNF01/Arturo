'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { useRegistros } from './usar-registros';
import { ControlEstado } from './control-estado';
import { nombrePerfil } from '@/lib/perfiles';
import type { EstadoRegistro } from '@/lib/estados';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';

/**
 * Quienes se registraron cuando los lugares presenciales ya estaban agotados,
 * en orden de llegada. Al liberarse un lugar —porque alguien canceló o porque
 * se amplió el cupo— desde aquí se confirma a la siguiente persona.
 */
export function ListaEspera({ configuracion }: { configuracion: ConfiguracionPublica }) {
  const { t, idioma } = useApp();
  const { registros, cargando, recargar } = useRegistros();
  // La decisión de avisar es la misma para toda la lista: una casilla, no una
  // por persona.
  const [avisar, setAvisar] = useState(true);

  const enEspera = useMemo(
    () =>
      registros
        .filter((r) => r.estado === 'lista_espera')
        .sort((a, b) => a.creado_en.localeCompare(b.creado_en)),
    [registros],
  );

  const libres =
    configuracion.cupos_presenciales === null
      ? null
      : Math.max(0, configuracion.cupos_presenciales - configuracion.ocupado_presencial);

  if (cargando) return null;

  return (
    <section className="tarjeta mt-5 max-w-3xl p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t.panel.estadosRegistro.listaEspera}</h2>
          <p className="ayuda !mt-1">{t.panel.estadosRegistro.listaEsperaAyuda}</p>
        </div>
        <span
          className={`insignia shrink-0 ${
            enEspera.length === 0
              ? 'bg-emerald-500/15 text-emerald-500'
              : 'bg-amber-500/15 text-amber-500'
          }`}
        >
          {enEspera.length}
        </span>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {libres !== null && (
          <p className="ayuda !mt-0">
            {t.modalidad.cuposDisponibles}: <strong>{libres}</strong>
          </p>
        )}
        {enEspera.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-ciess-500"
              checked={avisar}
              onChange={(e) => setAvisar(e.target.checked)}
            />
            <span className="text-xs tenue">{t.panel.estadosRegistro.avisar}</span>
          </label>
        )}
      </div>

      {enEspera.length === 0 ? (
        <p className="text-sm tenue">{t.panel.estadosRegistro.sinEspera}</p>
      ) : (
        <ol className="space-y-3.5">
          {enEspera.map((r, indice) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-3 last:border-0 last:pb-0"
              style={{ borderColor: 'var(--borde)' }}
            >
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums"
                style={{ backgroundColor: 'var(--fondo)', color: 'var(--texto-tenue)' }}
                title={`${t.panel.estadosRegistro.turno} ${indice + 1}`}
              >
                {indice + 1}
              </span>

              <div className="min-w-[14rem] flex-1">
                <p className="text-sm font-medium">
                  {r.nombres} {r.apellidos}{' '}
                  <span className="font-mono text-[11px] font-normal tenue">{r.folio}</span>
                </p>
                <p className="ayuda !mt-0.5">
                  {nombrePerfil(r.perfil, t)} · {r.institucion} · {r.pais_residencia} ·{' '}
                  {new Date(r.creado_en).toLocaleDateString(idioma)}
                </p>
              </div>

              <ControlEstado
                id={r.id}
                estado={r.estado as EstadoRegistro}
                onCambio={recargar}
                compacto
                avisarFijo={avisar}
                destacar="confirmado"
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
