'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { TarjetaGrafica, Ficha } from './tarjeta-grafica';
import { GraficaBarras, GraficaLineas, GraficaPastel, GraficaPrediccion, Heatmap } from './graficas';
import { MapaPaises } from './mapa-paises';
import { BarraFiltros } from './filtros';
import { aplicarFiltros, useRegistros, FILTROS_VACIOS, type Filtros, type RegistroPanel } from './usar-registros';
import { contarPor, regresionLineal } from '@/lib/graficas';
import { codigoPais } from '@/lib/paises';
import { traducir } from '@/lib/contenido';
import { etiquetaDe } from '@/lib/opciones';
import { useContenidoPanel } from './contexto-panel';
import { nombrePerfil } from '@/lib/perfiles';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';
import type { Permisos } from '@/lib/servidor/sesion';
import { CONFIG } from '@/lib/config';

const DIAS_PROYECCION = 14;

export function Dashboard({
  configuracion, permisos,
}: {
  configuracion: ConfiguracionPublica;
  permisos: Permisos;
}) {
  const { t, idioma } = useApp();
  const { nombreEje, congreso } = useContenidoPanel();
  const { registros, cargando, error } = useRegistros();
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);

  const filtrados = useMemo(() => aplicarFiltros(registros, filtros), [registros, filtros]);
  const activos = useMemo(() => filtrados.filter((r) => r.estado !== 'cancelado'), [filtrados]);

  const serieDiaria = useMemo(() => construirSerieDiaria(activos), [activos]);
  const proyeccion = useMemo(
    () => construirProyeccion(serieDiaria, configuracion.fecha_limite_registro),
    [serieDiaria, configuracion.fecha_limite_registro],
  );
  const actividad = useMemo(() => construirActividad(activos), [activos]);

  const porPerfil = useMemo(
    () => contarPor(activos, (r) => r.perfil, (v) => nombrePerfil(v, t), { etiquetaOtros: t.panel.filtros.todos }),
    [activos, t],
  );
  const porGrupo = useMemo(
    () => contarPor(activos, (r) => r.grupo, (v) => t.perfiles.grupos[v as 'interno' | 'externo']),
    [activos, t],
  );
  const porModalidad = useMemo(
    () => contarPor(activos, (r) => r.modalidad, (v) => (v === 'en_linea' ? t.modalidad.en_linea : t.modalidad.presencial)),
    [activos, t],
  );
  const porPais = useMemo(
    () => contarPor(activos, (r) => r.pais_residencia, (v) => v, { maximo: 8 }),
    [activos],
  );
  const porInstitucion = useMemo(
    () => contarPor(activos, (r) => r.institucion, (v) => v, { maximo: 8 }),
    [activos],
  );
  const porIdioma = useMemo(
    () => contarPor(activos, (r) => r.idioma, (v) => ({ es: 'Español', en: 'English', pt: 'Português' })[v] ?? v),
    [activos],
  );
  const porEje = useMemo(
    () => contarPor(activos.filter((r) => r.eje_tematico), (r) => r.eje_tematico, nombreEje, { maximo: 8 }),
    [activos, nombreEje],
  );
  const porRegimen = useMemo(
    () => contarPor(
      activos.filter((r) => r.regimen_alimentario),
      (r) => r.regimen_alimentario,
      (v) => etiquetaDe('regimen', v, t),
    ),
    [activos, t],
  );

  const conteoMapa = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const r of activos) {
      const codigo = codigoPais(r.pais_residencia);
      if (codigo) mapa[codigo] = (mapa[codigo] ?? 0) + 1;
    }
    return mapa;
  }, [activos]);

  const hoy = new Date().toISOString().slice(0, 10);
  const registrosHoy = activos.filter((r) => r.creado_en.slice(0, 10) === hoy).length;
  const presenciales = activos.filter((r) => r.modalidad === 'presencial').length;
  const enLinea = activos.filter((r) => r.modalidad === 'en_linea').length;
  const paisesUnicos = new Set(activos.map((r) => r.pais_residencia).filter(Boolean)).size;
  const institucionesUnicas = new Set(activos.map((r) => r.institucion).filter(Boolean)).size;
  const ocupacion =
    configuracion.cupos_presenciales && configuracion.cupos_presenciales > 0
      ? Math.round((presenciales / configuracion.cupos_presenciales) * 100)
      : null;

  if (error) {
    return <p className="p-6 text-sm text-red-500">{error}</p>;
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.panel.secciones.dashboard}</h1>
          <p className="ayuda !mt-1">
            {traducir(congreso.sede, idioma)} · {traducir(congreso.fechas, idioma)}
          </p>
        </div>
        {permisos.exportar && (
          <a href="/api/exportar?formato=csv" className="boton-secundario !py-2 !text-xs">
            {t.panel.exportar.titulo} · {t.panel.exportar.csv}
          </a>
        )}
      </header>

      <BarraFiltros filtros={filtros} onCambio={setFiltros} registros={registros} resultados={activos.length} />

      {cargando ? (
        <p className="py-16 text-center text-sm tenue">{t.estados.cargando}</p>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Ficha etiqueta={t.panel.kpi.total} valor={activos.length} />
            <Ficha
              etiqueta={t.panel.kpi.presencial}
              valor={presenciales}
              detalle={
                configuracion.cupos_presenciales !== null
                  ? `${ocupacion}% ${t.panel.kpi.ocupacion.toLowerCase()} · ${configuracion.cupos_presenciales} ${t.modalidad.cuposDisponibles.toLowerCase()}`
                  : t.modalidad.sinLimite
              }
            />
            <Ficha etiqueta={t.panel.kpi.enLinea} valor={enLinea} />
            <Ficha etiqueta={t.panel.kpi.hoy} valor={registrosHoy} detalle={`${paisesUnicos} ${t.panel.kpi.paises.toLowerCase()} · ${institucionesUnicas} ${t.panel.kpi.instituciones.toLowerCase()}`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <TarjetaGrafica
              titulo={t.panel.graficas.lineaTiempo}
              filas={serieDiaria.map((d) => [d.dia, d.total, d.acumulado])}
              columnas={[t.panel.filtros.desde, t.panel.graficas.registros, t.panel.graficas.acumulado]}
              alto={280}
            >
              <GraficaLineas datos={serieDiaria} etiquetaValor={t.panel.graficas.registros} />
            </TarjetaGrafica>

            <TarjetaGrafica
              titulo={t.panel.graficas.acumulado}
              filas={serieDiaria.map((d) => [d.dia, d.acumulado])}
              columnas={[t.panel.filtros.desde, t.panel.graficas.acumulado]}
              alto={280}
            >
              <GraficaLineas datos={serieDiaria} etiquetaValor={t.panel.graficas.acumulado} acumulado />
            </TarjetaGrafica>

            <TarjetaGrafica
              titulo={t.panel.graficas.porPerfil}
              filas={porPerfil.map((d) => [d.nombre, d.total])}
              columnas={[t.panel.filtros.perfil, t.panel.graficas.registros]}
              alto={280}
            >
              <GraficaBarras datos={porPerfil} unidad={t.panel.graficas.registros} />
            </TarjetaGrafica>

            <TarjetaGrafica
              titulo={t.panel.graficas.porModalidad}
              filas={porModalidad.map((d) => [d.nombre, d.total])}
              columnas={[t.panel.filtros.modalidad, t.panel.graficas.registros]}
              alto={280}
            >
              <GraficaPastel datos={porModalidad} unidad={t.panel.graficas.registros} />
            </TarjetaGrafica>

            <TarjetaGrafica
              titulo={t.panel.graficas.porGrupo}
              filas={porGrupo.map((d) => [d.nombre, d.total])}
              columnas={[t.perfiles.titulo, t.panel.graficas.registros]}
              alto={280}
            >
              <GraficaPastel datos={porGrupo} unidad={t.panel.graficas.registros} />
            </TarjetaGrafica>

            <TarjetaGrafica
              titulo={t.panel.graficas.porPais}
              filas={porPais.map((d) => [d.nombre, d.total])}
              columnas={[t.panel.filtros.pais, t.panel.graficas.registros]}
              alto={280}
            >
              <GraficaBarras datos={porPais} unidad={t.panel.graficas.registros} />
            </TarjetaGrafica>

            <TarjetaGrafica
              titulo={t.panel.graficas.mapa}
              filas={Object.entries(conteoMapa).map(([codigo, total]) => [codigo, total])}
              columnas={[t.panel.filtros.pais, t.panel.graficas.registros]}
              alto={420}
            >
              <MapaPaises conteos={conteoMapa} etiquetaUnidad={t.panel.graficas.registros} />
            </TarjetaGrafica>

            <TarjetaGrafica
              titulo={t.panel.graficas.heatmap}
              filas={actividad.filas}
              columnas={[t.panel.auditoria.columnas.fecha, 'Hora', t.panel.graficas.registros]}
              alto={420}
            >
              <Heatmap
                matriz={actividad.matriz}
                dias={t.panel.graficas.dias}
                maximo={actividad.maximo}
                etiquetaUnidad={t.panel.graficas.registros}
              />
            </TarjetaGrafica>

            <TarjetaGrafica
              titulo={t.panel.graficas.prediccion}
              ayuda={t.panel.graficas.prediccionAyuda}
              filas={proyeccion.datos.map((d) => [d.dia, d.real ?? '', d.proyectado ?? ''])}
              columnas={[t.panel.filtros.desde, t.panel.graficas.real, t.panel.graficas.proyectado]}
              alto={300}
              acciones={
                proyeccion.r2 !== null ? (
                  <span className="shrink-0 rounded-full bg-ciess-500/15 px-2 py-0.5 text-[11px] font-medium text-ciess-400">
                    R² {proyeccion.r2.toFixed(2)}
                  </span>
                ) : undefined
              }
            >
              <GraficaPrediccion
                datos={proyeccion.datos}
                etiquetaReal={t.panel.graficas.real}
                etiquetaProyectado={t.panel.graficas.proyectado}
              />
            </TarjetaGrafica>

            <TarjetaGrafica
              titulo={t.panel.graficas.instituciones}
              filas={porInstitucion.map((d) => [d.nombre, d.total])}
              columnas={[t.panel.filtros.institucion, t.panel.graficas.registros]}
              alto={300}
            >
              <GraficaBarras datos={porInstitucion} unidad={t.panel.graficas.registros} />
            </TarjetaGrafica>

            {porEje.length > 0 && (
              <TarjetaGrafica
                titulo={t.panel.graficas.ejes}
                filas={porEje.map((d) => [d.nombre, d.total])}
                columnas={[t.formulario.campos.ejeTematico, t.panel.graficas.registros]}
                alto={300}
              >
                <GraficaBarras datos={porEje} unidad={t.panel.graficas.registros} />
              </TarjetaGrafica>
            )}

            {porRegimen.length > 0 && (
              <TarjetaGrafica
                titulo={t.panel.graficas.alimentacion}
                filas={porRegimen.map((d) => [d.nombre, d.total])}
                columnas={[t.formulario.campos.regimenAlimentario, t.panel.graficas.registros]}
                alto={280}
              >
                <GraficaPastel datos={porRegimen} unidad={t.panel.graficas.registros} />
              </TarjetaGrafica>
            )}

            <TarjetaGrafica
              titulo={t.panel.graficas.idioma}
              filas={porIdioma.map((d) => [d.nombre, d.total])}
              columnas={[t.idiomaSelector, t.panel.graficas.registros]}
              alto={280}
            >
              <GraficaPastel datos={porIdioma} unidad={t.panel.graficas.registros} />
            </TarjetaGrafica>
          </div>

          <p className="mt-6 text-xs tenue">
            {idioma === 'es' ? 'Los datos se actualizan en tiempo real conforme llegan los registros.' : null}
          </p>
        </>
      )}
    </div>
  );
}

/** Serie diaria continua, sin huecos, con el acumulado. */
function construirSerieDiaria(registros: RegistroPanel[]) {
  if (registros.length === 0) return [];

  const porDia = new Map<string, number>();
  for (const r of registros) {
    const dia = r.creado_en.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }

  const dias = [...porDia.keys()].sort();
  const inicio = new Date(`${dias[0]}T00:00:00Z`);
  const fin = new Date(`${dias[dias.length - 1]}T00:00:00Z`);

  const serie: { dia: string; total: number; acumulado: number }[] = [];
  let acumulado = 0;
  for (let d = new Date(inicio); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
    const clave = d.toISOString().slice(0, 10);
    const total = porDia.get(clave) ?? 0;
    acumulado += total;
    serie.push({ dia: clave.slice(5), total, acumulado });
  }
  return serie;
}

/** Proyección del acumulado por regresión lineal simple. */
function construirProyeccion(
  serie: { dia: string; acumulado: number }[],
  fechaLimite: string,
): { datos: { dia: string; real: number | null; proyectado: number | null }[]; r2: number | null } {
  if (serie.length < 3) {
    return { datos: serie.map((d) => ({ dia: d.dia, real: d.acumulado, proyectado: null })), r2: null };
  }

  const puntos = serie.map((d, i) => ({ x: i, y: d.acumulado }));
  const modelo = regresionLineal(puntos);
  if (!modelo) {
    return { datos: serie.map((d) => ({ dia: d.dia, real: d.acumulado, proyectado: null })), r2: null };
  }

  const datos: { dia: string; real: number | null; proyectado: number | null }[] = serie.map((d, i) => ({
    dia: d.dia,
    real: d.acumulado,
    // La proyección arranca en el último punto real para que las líneas se unan.
    proyectado: i === serie.length - 1 ? d.acumulado : null,
  }));

  const diasHastaLimite = Math.max(
    0,
    Math.round((Date.parse(`${fechaLimite}T00:00:00Z`) - Date.now()) / 86_400_000),
  );
  const pasos = Math.min(DIAS_PROYECCION, diasHastaLimite || DIAS_PROYECCION);
  const ultimoAcumulado = serie[serie.length - 1].acumulado;

  // La proyección parte del último acumulado real y avanza con el ritmo diario
  // ajustado: extrapolar la recta cruda arrancaría por debajo del dato de hoy
  // y se leería como una caída que no ha ocurrido.
  for (let paso = 1; paso <= pasos; paso += 1) {
    const fecha = new Date(Date.now() + paso * 86_400_000).toISOString().slice(5, 10);
    datos.push({
      dia: fecha,
      real: null,
      proyectado: Math.max(0, Math.round(ultimoAcumulado + modelo.pendiente * paso)),
    });
  }

  return { datos, r2: modelo.r2 };
}

/** Matriz de actividad día de la semana × hora, en la zona del congreso. */
function construirActividad(registros: RegistroPanel[]) {
  const matriz: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const filas: (string | number)[][] = [];
  let maximo = 0;

  for (const r of registros) {
    const fecha = new Date(r.creado_en);
    const local = new Date(fecha.toLocaleString('en-US', { timeZone: CONFIG.zonaHoraria }));
    const dia = local.getDay();
    const hora = local.getHours();
    matriz[dia][hora] += 1;
    maximo = Math.max(maximo, matriz[dia][hora]);
  }

  for (let d = 0; d < 7; d += 1) {
    for (let h = 0; h < 24; h += 1) {
      if (matriz[d][h] > 0) filas.push([d, `${String(h).padStart(2, '0')}:00`, matriz[d][h]]);
    }
  }

  return { matriz, maximo, filas };
}
