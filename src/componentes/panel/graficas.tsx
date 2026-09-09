'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Leyenda } from './tarjeta-grafica';
import { colorSerie, pasoSecuencial, type Conteo } from '@/lib/graficas';

const EJE = { fontSize: 11, fill: 'var(--texto-viz-tenue)' };

/** Etiqueta emergente común a todas las gráficas. */
function Emergente({ activo, contenido }: { activo?: boolean; contenido?: { nombre: string; valor: string }[] }) {
  if (!activo || !contenido?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ backgroundColor: 'var(--fondo-tarjeta)', borderColor: 'var(--borde)', color: 'var(--texto-viz)' }}
    >
      {contenido.map((c) => (
        <p key={c.nombre} className="whitespace-nowrap">
          <span className="tenue">{c.nombre}: </span>
          <span className="font-semibold tabular-nums">{c.valor}</span>
        </p>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emergenteRecharts = (props: any) => (
  <Emergente
    activo={props.active}
    contenido={(props.payload ?? []).map((p: any) => ({
      nombre: p.name ?? p.payload?.nombre ?? '',
      valor: Number(p.value).toLocaleString(),
    }))}
  />
);

/** Barras horizontales: la forma correcta cuando las etiquetas son largas. */
export function GraficaBarras({
  datos, unidad, horizontal = true,
}: {
  datos: Conteo[];
  unidad: string;
  horizontal?: boolean;
}) {
  const maximo = Math.max(...datos.map((d) => d.total), 1);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={datos}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
        barCategoryGap={horizontal ? '28%' : '32%'}
      >
        <CartesianGrid
          horizontal={!horizontal}
          vertical={horizontal}
          stroke="var(--rejilla)"
          strokeWidth={1}
        />
        {horizontal ? (
          <>
            <XAxis type="number" tick={EJE} axisLine={false} tickLine={false} domain={[0, maximo]} />
            <YAxis type="category" dataKey="nombre" tick={EJE} axisLine={false} tickLine={false} width={140} />
          </>
        ) : (
          <>
            <XAxis dataKey="nombre" tick={EJE} axisLine={false} tickLine={false} />
            <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
          </>
        )}
        <Tooltip content={emergenteRecharts} cursor={{ fill: 'var(--rejilla)', fillOpacity: 0.35 }} />
        <Bar
          dataKey="total"
          name={unidad}
          radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          maxBarSize={24}
          isAnimationActive={false}
          label={{
            position: horizontal ? 'right' : 'top',
            fontSize: 11,
            fill: 'var(--texto-viz)',
          }}
        >
          {datos.map((d, i) => (
            <Cell key={d.clave} fill={colorSerie(i)} stroke="var(--superficie)" strokeWidth={2} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Dona: sólo para composición de pocas categorías sobre un total. */
export function GraficaPastel({ datos, unidad }: { datos: Conteo[]; unidad: string }) {
  const total = datos.reduce((s, d) => s + d.total, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={emergenteRecharts} />
            <Pie
              data={datos}
              dataKey="total"
              nameKey="nombre"
              innerRadius="58%"
              outerRadius="86%"
              paddingAngle={2}
              isAnimationActive={false}
            >
              {datos.map((d, i) => (
                <Cell key={d.clave} fill={colorSerie(i)} stroke="var(--superficie)" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--texto-viz)' }}>
              {total.toLocaleString()}
            </p>
            <p className="text-xs" style={{ color: 'var(--texto-viz-tenue)' }}>{unidad}</p>
          </div>
        </div>
      </div>
      <Leyenda elementos={datos.map((d, i) => ({ nombre: `${d.nombre} · ${d.total}`, color: colorSerie(i) }))} />
    </div>
  );
}

/** Línea temporal con área de apoyo; una sola serie no lleva leyenda. */
export function GraficaLineas({
  datos, etiquetaValor, acumulado = false,
}: {
  datos: { dia: string; total: number; acumulado: number }[];
  etiquetaValor: string;
  acumulado?: boolean;
}) {
  const clave = acumulado ? 'acumulado' : 'total';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id={`degradado-${clave}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--serie-1)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--serie-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--rejilla)" strokeWidth={1} />
        <XAxis dataKey="dia" tick={EJE} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} width={44} />
        <Tooltip content={emergenteRecharts} cursor={{ stroke: 'var(--rejilla)', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey={clave}
          name={etiquetaValor}
          stroke="var(--serie-1)"
          strokeWidth={2}
          strokeLinecap="round"
          fill={`url(#degradado-${clave})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--superficie)' }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Proyección por regresión lineal simple: la serie real y la estimada se
 * distinguen por trazo continuo frente a discontinuo, no sólo por color.
 */
export function GraficaPrediccion({
  datos, etiquetaReal, etiquetaProyectado,
}: {
  datos: { dia: string; real: number | null; proyectado: number | null; banda?: [number, number] }[];
  etiquetaReal: string;
  etiquetaProyectado: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--rejilla)" strokeWidth={1} />
            <XAxis dataKey="dia" tick={EJE} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} width={44} />
            <Tooltip content={emergenteRecharts} />
            <Line
              type="monotone" dataKey="real" name={etiquetaReal} stroke="var(--serie-1)"
              strokeWidth={2} strokeLinecap="round" dot={false} connectNulls={false} isAnimationActive={false}
            />
            <Line
              type="monotone" dataKey="proyectado" name={etiquetaProyectado} stroke="var(--serie-2)"
              strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round" dot={false}
              connectNulls isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Leyenda
        elementos={[
          { nombre: etiquetaReal, color: 'var(--serie-1)' },
          { nombre: `${etiquetaProyectado} (línea discontinua)`, color: 'var(--serie-2)' },
        ]}
      />
    </div>
  );
}

/**
 * Mapa de calor de actividad por hora y día de la semana. Rampa secuencial de
 * un solo tono; el valor va en la etiqueta emergente y en la vista de tabla.
 */
export function Heatmap({
  matriz, dias, maximo, etiquetaUnidad,
}: {
  matriz: number[][];
  dias: string[];
  maximo: number;
  etiquetaUnidad: string;
}) {
  const horas = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div className="desplazable h-full overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid" style={{ gridTemplateColumns: '2.5rem repeat(24, minmax(0, 1fr))', gap: 2 }}>
          <span />
          {horas.map((h) => (
            <span
              key={h}
              className="text-center text-[9px] tabular-nums"
              style={{ color: 'var(--texto-viz-tenue)' }}
            >
              {h % 3 === 0 ? h : ''}
            </span>
          ))}
          {dias.map((dia, d) => (
            <div key={dia} className="contents">
              <span className="pr-1 text-right text-[10px] leading-5" style={{ color: 'var(--texto-viz-tenue)' }}>
                {dia}
              </span>
              {horas.map((h) => {
                const valor = matriz[d]?.[h] ?? 0;
                return (
                  <div
                    key={`${dia}-${h}`}
                    title={`${dia} ${String(h).padStart(2, '0')}:00 · ${valor} ${etiquetaUnidad}`}
                    className="h-5 rounded-[3px]"
                    style={{
                      backgroundColor: valor === 0 ? 'var(--rejilla)' : pasoSecuencial(valor / Math.max(maximo, 1)),
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 text-[10px]" style={{ color: 'var(--texto-viz-tenue)' }}>
          <span>0</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((f) => (
            <span key={f} className="h-3 w-6 rounded-[3px]" style={{ backgroundColor: pasoSecuencial(f) }} />
          ))}
          <span className="tabular-nums">{maximo}</span>
          <span className="ml-1">{etiquetaUnidad}</span>
        </div>
      </div>
    </div>
  );
}
