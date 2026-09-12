'use client';

import { Encabezado, PieDePagina } from '@/componentes/controles';
import { FormularioRegistro } from '@/componentes/formulario-registro';
import { useApp } from '@/componentes/proveedores';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';
import { traducir, type DatosCongreso, type EjeTematico } from '@/lib/contenido';
import { VideoFondo } from '@/componentes/video-fondo';

export function PaginaRegistro({
  configuracion,
  congreso,
  ejes,
}: {
  configuracion: ConfiguracionPublica;
  congreso: DatosCongreso;
  ejes: EjeTematico[];
}) {
  const { t, idioma } = useApp();
  const limite = fechaLegible(configuracion.fecha_limite_registro, idioma);
  const quedan = diasHasta(configuracion.fecha_limite_registro);

  return (
    <>
      <VideoFondo url={configuracion.url_video_login} />
      <Encabezado />
      <main>
        {/* Quien llega aquí ya leyó la portada: el encabezado no repite el
            congreso entero, lo sitúa y pasa al formulario. Lo único que
            necesita destacar es hasta cuándo se puede uno registrar, que
            antes se leía «2026-10-30», una fecha de base de datos. */}
        <section className="mx-auto max-w-3xl px-4 pb-8 pt-10 sm:px-6">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            {t.formulario.titulo}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs font-medium tenue">
            <span className="rounded-full border px-3 py-1" style={{ borderColor: 'var(--borde)' }}>
              {traducir(congreso.fechas, idioma)}
            </span>
            <span className="rounded-full border px-3 py-1" style={{ borderColor: 'var(--borde)' }}>
              {traducir(congreso.sede, idioma)}
            </span>
            <span className="rounded-full border px-3 py-1" style={{ borderColor: 'var(--borde)' }}>
              {t.modalidad.presencial} · {t.modalidad.en_linea}
            </span>
          </div>

          <p className="mt-6 text-sm leading-relaxed">{t.formulario.intro}</p>

          <div
            className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border-l-4 border-ciess-500 py-2 pl-4"
            style={{ backgroundColor: 'color-mix(in srgb, var(--borde) 28%, transparent)' }}
          >
            <span className="text-xs uppercase tracking-wide tenue">
              {t.formulario.fechaLimite}
            </span>
            <span className="text-sm font-semibold">{limite}</span>
            {quedan !== null && quedan >= 0 && (
              <span className="text-xs tenue">
                {quedan === 0 ? t.formulario.limiteHoy : t.formulario.limiteDias(quedan)}
              </span>
            )}
          </div>
        </section>
        <FormularioRegistro configuracion={configuracion} congreso={congreso} ejes={ejes} />
      </main>
      <PieDePagina />
    </>
  );
}

/**
 * «30 de octubre de 2026» en vez de «2026-10-30».
 *
 * La fecha se guarda como texto ISO y se parte a mano: `new Date('2026-10-30')`
 * se interpreta en UTC y en México se leería el día anterior.
 */
function fechaLegible(iso: string, idioma: string): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  if (!anio || !mes || !dia) return iso;
  return new Date(anio, mes - 1, dia).toLocaleDateString(idioma, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Días entre hoy y el límite; null si la fecha no se entiende. */
function diasHasta(iso: string): number | null {
  const [anio, mes, dia] = iso.split('-').map(Number);
  if (!anio || !mes || !dia) return null;
  const hoy = new Date();
  const limite = new Date(anio, mes - 1, dia);
  hoy.setHours(0, 0, 0, 0);
  limite.setHours(0, 0, 0, 0);
  return Math.round((limite.getTime() - hoy.getTime()) / 86_400_000);
}
