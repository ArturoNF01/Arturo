'use client';

import { useEffect, useMemo, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import { pasoSecuencial } from '@/lib/graficas';
import { nombrePais } from '@/lib/paises';
import { useApp } from '@/componentes/proveedores';

/**
 * El atlas se sirve desde el propio sitio, no desde un CDN.
 *
 * Son 105 KB que se piden una vez y quedan en la caché del navegador, y a
 * cambio el mapa no depende de que un tercero esté en pie ni de que la red
 * de la institución permita salir a ese dominio. Viene del paquete
 * `world-atlas` (Natural Earth, dominio público) y se actualiza copiando el
 * archivo de nuevo a `public/`.
 */
const ATLAS = '/atlas-paises.json';

/**
 * Coropleta por país. La magnitud se codifica con una rampa secuencial de un
 * solo tono; el valor exacto vive en la etiqueta emergente y en la tabla de la
 * tarjeta, de modo que nada depende únicamente del color.
 */
export function MapaPaises({
  conteos, etiquetaUnidad,
}: {
  conteos: Record<string, number>;
  etiquetaUnidad: string;
}) {
  const { t } = useApp();
  const [geografia, setGeografia] = useState<FeatureCollection<Geometry> | null>(null);
  const [fallo, setFallo] = useState(false);
  const [encima, setEncima] = useState<{ x: number; y: number; texto: string } | null>(null);

  useEffect(() => {
    let vigente = true;
    fetch(ATLAS)
      .then((r) => r.json())
      .then((topologia) => {
        if (!vigente) return;
        const objetos = topologia.objects.countries;
        setGeografia(feature(topologia, objetos) as unknown as FeatureCollection<Geometry>);
      })
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, []);

  const maximo = useMemo(() => Math.max(1, ...Object.values(conteos)), [conteos]);

  const { rutas, ancho, alto } = useMemo(() => {
    const ancho = 760;
    const alto = 420;
    if (!geografia) return { rutas: [], ancho, alto };

    // Encuadre centrado en el continente americano, que es el foco del congreso.
    const proyeccion = geoMercator().center([-70, 8]).scale(150).translate([ancho / 2, alto / 2]);
    const trazo = geoPath(proyeccion);

    const rutas = geografia.features.map((pais) => {
      const codigo = String(pais.id ?? '').padStart(3, '0');
      const total = conteos[codigo] ?? 0;
      return {
        codigo,
        d: trazo(pais) ?? '',
        total,
        color: total === 0 ? 'var(--rejilla)' : pasoSecuencial(total / maximo),
      };
    });

    return { rutas, ancho, alto };
  }, [geografia, conteos, maximo]);

  if (fallo) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <p className="text-sm tenue">
          No fue posible cargar el mapa base del atlas mundial. Los datos por país están
          disponibles en la vista de tabla de esta misma tarjeta.
        </p>
      </div>
    );
  }
  if (!geografia) {
    return <p className="grid h-full place-items-center text-sm tenue">{t.estados.cargando}</p>;
  }

  return (
    <div className="relative h-full">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="h-full w-full" role="img" aria-label={t.panel.graficas.mapa}>
        {rutas.map((ruta) => (
          <path
            key={ruta.codigo}
            d={ruta.d}
            fill={ruta.color}
            stroke="var(--superficie)"
            strokeWidth={0.6}
            onMouseMove={(e) => {
              const caja = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
              setEncima({
                x: e.clientX - caja.left,
                y: e.clientY - caja.top,
                texto: `${nombrePais(ruta.codigo)}: ${ruta.total} ${etiquetaUnidad}`,
              });
            }}
            onMouseLeave={() => setEncima(null)}
          />
        ))}
      </svg>

      {encima && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: encima.x, top: encima.y - 8,
            backgroundColor: 'var(--fondo-tarjeta)', borderColor: 'var(--borde)', color: 'var(--texto-viz)',
          }}
        >
          {encima.texto}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 text-[10px]" style={{ color: 'var(--texto-viz-tenue)' }}>
        <span>0</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((f) => (
          <span key={f} className="h-3 w-6 rounded-[3px]" style={{ backgroundColor: pasoSecuencial(f) }} />
        ))}
        <span className="tabular-nums">{maximo}</span>
        <span className="ml-1">{etiquetaUnidad}</span>
      </div>
    </div>
  );
}
