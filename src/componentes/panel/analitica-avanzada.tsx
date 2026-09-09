'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { BarraFiltros } from './filtros';
import { TarjetaGrafica } from './tarjeta-grafica';
import { GraficaBarras } from './graficas';
import { aplicarFiltros, useRegistros, FILTROS_VACIOS, type Filtros, type RegistroPanel } from './usar-registros';
import { contarPor } from '@/lib/graficas';
import { nombrePerfil, PERFILES } from '@/lib/perfiles';
import { etiquetaDe } from '@/lib/opciones';
import type { Permisos } from '@/lib/servidor/sesion';

/**
 * Vista de análisis: tabulaciones cruzadas y rankings que complementan las
 * gráficas del dashboard, pensadas para el trabajo de los científicos de datos.
 */
export function AnaliticaAvanzada({ permisos }: { permisos: Permisos }) {
  const { t } = useApp();
  const { registros, cargando } = useRegistros();
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);

  const activos = useMemo(
    () => aplicarFiltros(registros, filtros).filter((r) => r.estado !== 'cancelado'),
    [registros, filtros],
  );

  const cruce = useMemo(() => cruzarPerfilModalidad(activos), [activos]);
  const porCiudad = useMemo(
    () => contarPor(activos, (r) => r.ciudad_residencia, (v) => v, { maximo: 8 }),
    [activos],
  );
  const porProcedencia = useMemo(
    () => contarPor(
      activos.filter((r) => r.procedencia),
      (r) => r.procedencia,
      (v) => etiquetaDe('procedencia', v, t),
    ),
    [activos, t],
  );
  const porRol = useMemo(
    () => contarPor(
      activos.filter((r) => r.modalidad_participacion),
      (r) => r.modalidad_participacion,
      (v) => etiquetaDe('roles', v, t),
      { maximo: 8 },
    ),
    [activos, t],
  );

  const conLogistica = activos.filter((r) => r.requiere_alojamiento).length;
  const conTraslado = activos.filter((r) => r.requiere_traslado && r.requiere_traslado !== 'no').length;

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-bold">{t.panel.secciones.analitica}</h1>
        {permisos.exportar && (
          <div className="flex flex-wrap gap-2">
            {(['csv', 'xlsx', 'json'] as const).map((formato) => (
              <a key={formato} href={`/api/exportar?formato=${formato}`} className="boton-secundario !py-2 !text-xs">
                {formato === 'xlsx' ? t.panel.exportar.excel : formato.toUpperCase()}
              </a>
            ))}
          </div>
        )}
      </header>

      <BarraFiltros filtros={filtros} onCambio={setFiltros} registros={registros} resultados={activos.length} />

      {cargando ? (
        <p className="py-16 text-center text-sm tenue">{t.estados.cargando}</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="tarjeta p-4 xl:col-span-2">
            <h2 className="mb-4 text-sm font-semibold">
              {t.panel.filtros.perfil} × {t.panel.filtros.modalidad}
            </h2>
            <div className="desplazable overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--borde)' }}>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide tenue">
                      {t.panel.filtros.perfil}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide tenue">
                      {t.modalidad.presencial}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide tenue">
                      {t.modalidad.en_linea}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide tenue">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cruce.filas.map((fila) => (
                    <tr key={fila.perfil} className="border-b" style={{ borderColor: 'var(--borde)' }}>
                      <td className="px-3 py-2">{nombrePerfil(fila.perfil, t)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fila.presencial}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fila.en_linea}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fila.total}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-3 py-2 font-semibold">Total</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{cruce.totales.presencial}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{cruce.totales.en_linea}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{cruce.totales.total}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="ayuda mt-3">
              {conLogistica} {t.formulario.campos.requiereAlojamiento.toLowerCase()} ·{' '}
              {conTraslado} {t.formulario.campos.requiereTraslado.toLowerCase()}
            </p>
          </section>

          {porRol.length > 0 && (
            <TarjetaGrafica
              titulo={t.formulario.campos.modalidadParticipacion}
              filas={porRol.map((d) => [d.nombre, d.total])}
              columnas={[t.formulario.campos.modalidadParticipacion, t.panel.graficas.registros]}
              alto={300}
            >
              <GraficaBarras datos={porRol} unidad={t.panel.graficas.registros} />
            </TarjetaGrafica>
          )}

          {porProcedencia.length > 0 && (
            <TarjetaGrafica
              titulo={t.formulario.campos.procedencia}
              filas={porProcedencia.map((d) => [d.nombre, d.total])}
              columnas={[t.formulario.campos.procedencia, t.panel.graficas.registros]}
              alto={300}
            >
              <GraficaBarras datos={porProcedencia} unidad={t.panel.graficas.registros} />
            </TarjetaGrafica>
          )}

          <TarjetaGrafica
            titulo={t.formulario.campos.ciudad}
            filas={porCiudad.map((d) => [d.nombre, d.total])}
            columnas={[t.formulario.campos.ciudad, t.panel.graficas.registros]}
            alto={300}
          >
            <GraficaBarras datos={porCiudad} unidad={t.panel.graficas.registros} />
          </TarjetaGrafica>
        </div>
      )}
    </div>
  );
}

function cruzarPerfilModalidad(registros: RegistroPanel[]) {
  const filas = PERFILES.map((p) => {
    const propios = registros.filter((r) => r.perfil === p.clave);
    const presencial = propios.filter((r) => r.modalidad === 'presencial').length;
    const en_linea = propios.filter((r) => r.modalidad === 'en_linea').length;
    return { perfil: p.clave, presencial, en_linea, total: presencial + en_linea };
  }).filter((f) => f.total > 0);

  return {
    filas,
    totales: {
      presencial: filas.reduce((s, f) => s + f.presencial, 0),
      en_linea: filas.reduce((s, f) => s + f.en_linea, 0),
      total: filas.reduce((s, f) => s + f.total, 0),
    },
  };
}
