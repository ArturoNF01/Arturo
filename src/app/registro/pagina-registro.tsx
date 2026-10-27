'use client';

import { Encabezado, PieDePagina } from '@/componentes/controles';
import { FormularioRegistro } from '@/componentes/formulario-registro';
import { useApp } from '@/componentes/proveedores';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';
import { traducir, type DatosCongreso } from '@/lib/contenido';
import { VideoFondo } from '@/componentes/video-fondo';

export function PaginaRegistro({
  configuracion,
  congreso,
}: {
  configuracion: ConfiguracionPublica;
  congreso: DatosCongreso;
}) {
  const { t, idioma } = useApp();
  const limite = fechaLegible(configuracion.fecha_limite_registro, idioma);
  const quedan = diasHasta(configuracion.fecha_limite_registro);

  return (
    <>
      <Encabezado />
      {/* El mismo azul de la portada detrás de todo el registro: el formulario
          va en tarjetas claras sobre él, y lo que queda fuera de las tarjetas
          —título, pasos, botones— va en blanco y dorado. */}
      <main className="seccion-azul min-h-[80vh]">
        {/* El video de la portada, detrás de todo el registro. Va en una capa
            «pegajosa» de la altura de la pantalla: el formulario es largo, y
            con el video estirado a toda la página se vería enorme y
            recortado; así se queda quieto en la ventana mientras el contenido
            pasa por encima. El margen negativo evita que la capa empuje el
            contenido hacia abajo. */}
        <div aria-hidden className="pointer-events-none sticky top-0 z-0 -mb-[100svh] h-[100svh] overflow-hidden">
          <VideoFondo url={configuracion.url_video_login} opacidad={1} variante="sin-velo" posicion="contenido" />
          <div className="portada-velo" />
        </div>

        <div className="relative z-10">
        {/* Quien llega aquí ya leyó la portada: el encabezado no repite el
            congreso entero, lo sitúa y pasa al formulario. Lo único que
            necesita destacar es hasta cuándo se puede uno registrar, que
            antes se leía «2026-10-30», una fecha de base de datos. */}
        <section className="mx-auto max-w-3xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16">
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
            {t.formulario.titulo}
          </h1>
          <span aria-hidden className="regla-dorada" />

          <div className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs font-medium text-white/90">
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1">
              {traducir(congreso.fechas, idioma)}
            </span>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1">
              {traducir(congreso.sede, idioma)}
            </span>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1">
              {t.modalidad.presencial} · {t.modalidad.en_linea}
            </span>
          </div>

          <p className="mt-6 text-base leading-relaxed text-white/85">{t.formulario.intro}</p>

          <div className="vidrio mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 !rounded-lg border-l-4 px-4 py-3"
               style={{ borderLeftColor: 'var(--dorado)' }}>
            <span className="text-xs uppercase tracking-wide text-white/70">
              {t.formulario.fechaLimite}
            </span>
            <span className="text-base font-semibold text-white">{limite}</span>
            {quedan !== null && quedan >= 0 && (
              <span className="text-xs text-white/70">
                {quedan === 0 ? t.formulario.limiteHoy : t.formulario.limiteDias(quedan)}
              </span>
            )}
          </div>
        </section>
        <FormularioRegistro configuracion={configuracion} congreso={congreso} />
        </div>
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
