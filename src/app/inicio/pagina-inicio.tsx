'use client';

import Link from 'next/link';
import { useApp } from '@/componentes/proveedores';
import { Encabezado, PieDePagina } from '@/componentes/controles';
import { LogoCiess } from '@/componentes/logo';
import { VideoFondo } from '@/componentes/video-fondo';
import { CALENDARIO, CORREO_TRABAJOS, LANDING } from '@/lib/landing';
import { traducir, type DatosCongreso, type EjeTematico } from '@/lib/contenido';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';

export function PaginaInicio({
  configuracion,
  congreso,
  ejes,
}: {
  configuracion: ConfiguracionPublica;
  congreso: DatosCongreso;
  ejes: EjeTematico[];
}) {
  const { t, idioma } = useApp();
  const textos = LANDING[idioma];
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Encabezado />

      <main>
        {/* Portada ------------------------------------------------------ */}
        <section className="relative overflow-hidden bg-ciess-950 text-white">
          <VideoFondo url={configuracion.url_video_login} variante="oscuro" posicion="contenido" />

          <div className="relative z-10 mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <LogoCiess className="mx-auto h-14 w-auto" forzar="oscuro" />

            <h1 className="mt-8 text-3xl font-bold leading-tight sm:text-5xl">
              {t.congreso.titulo}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg italic text-ciess-200 sm:text-xl">
              {t.congreso.subtitulo}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-medium text-white/90">
              <span className="rounded-full border border-white/25 px-4 py-1.5">
                {traducir(congreso.fechas, idioma)}
              </span>
              <span className="rounded-full border border-white/25 px-4 py-1.5">
                {traducir(congreso.sede, idioma)}
              </span>
              <span className="rounded-full border border-white/25 px-4 py-1.5">
                {t.modalidad.presencial} · {t.modalidad.en_linea}
              </span>
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-base text-white/75">{textos.entradilla}</p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/registro"
                className="rounded-lg bg-ciess-500 px-7 py-3 text-sm font-semibold text-white transition hover:bg-ciess-400"
              >
                {textos.registrarse}
              </Link>
              <a
                href={configuracion.url_agenda}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/30 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {textos.verConvocatoria}
              </a>
            </div>
          </div>
        </section>

        {/* Presentación ------------------------------------------------- */}
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="titulo-seccion">{textos.presentacionTitulo}</h2>
          <div className="mt-6 space-y-5 text-base leading-relaxed">
            {textos.presentacion.map((parrafo, i) => (
              <p key={i} className={i === 0 ? 'text-lg' : undefined}>
                {parrafo}
              </p>
            ))}
          </div>
        </section>

        {/* Ejes temáticos ----------------------------------------------- */}
        <section className="border-y" style={{ borderColor: 'var(--borde)', backgroundColor: 'var(--fondo-alterno, transparent)' }}>
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="titulo-seccion">{textos.ejesTitulo}</h2>
            <p className="mt-2 tenue">{textos.ejesAyuda}</p>

            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ejes.map((eje, i) => (
                <li key={eje.clave} className="tarjeta">
                  <span className="text-xs font-semibold text-ciess-600 dark:text-ciess-300">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-1 text-sm font-semibold leading-snug">
                    {traducir(eje.nombre, idioma)}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed tenue">
                    {traducir(eje.descripcion, idioma)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Calendario --------------------------------------------------- */}
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="titulo-seccion">{textos.calendarioTitulo}</h2>
          <p className="mt-2 tenue">{textos.calendarioAyuda}</p>

          <ol className="mt-8 space-y-0">
            {CALENDARIO.map((hito, i) => {
              const pasado = hito.iso < hoy;
              const ultimo = i === CALENDARIO.length - 1;
              return (
                <li key={hito.iso} className="relative flex gap-4 pb-8 last:pb-0">
                  {/* La línea une los hitos; el último no la necesita. */}
                  {!ultimo && (
                    <span
                      aria-hidden
                      className="absolute left-[7px] top-4 h-full w-px"
                      style={{ backgroundColor: 'var(--borde)' }}
                    />
                  )}
                  <span
                    aria-hidden
                    className={`relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                      ultimo ? 'border-ciess-500 bg-ciess-500' : pasado ? 'border-ciess-500/40' : 'border-ciess-500'
                    }`}
                    style={{ backgroundColor: ultimo ? undefined : 'var(--fondo)' }}
                  />
                  <div className={pasado && !ultimo ? 'opacity-55' : undefined}>
                    <p className="text-sm font-semibold">{hito.fecha[idioma]}</p>
                    <p className="text-sm tenue">{hito.hecho[idioma]}</p>
                    {pasado && !ultimo && (
                      <span className="mt-1 inline-block text-[11px] uppercase tracking-wide tenue">
                        {textos.cumplido}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Llamado a registrarse ---------------------------------------- */}
        <section className="border-t" style={{ borderColor: 'var(--borde)' }}>
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="titulo-seccion">{textos.participarTitulo}</h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed tenue">{textos.participarAyuda}</p>
            <Link href="/registro" className="boton-primario mt-8 inline-flex px-8 py-3">
              {textos.registrarse}
            </Link>

            <div className="mt-12 grid gap-4 text-left sm:grid-cols-2">
              <div className="tarjeta">
                <h3 className="text-sm font-semibold">{textos.dudasRegistro}</h3>
                <a
                  href={`mailto:${configuracion.correo_contacto}`}
                  className="mt-1 block break-all text-sm text-ciess-600 underline underline-offset-4 dark:text-ciess-300"
                >
                  {configuracion.correo_contacto}
                </a>
              </div>
              <div className="tarjeta">
                <h3 className="text-sm font-semibold">{textos.dudasTrabajos}</h3>
                <a
                  href={`mailto:${CORREO_TRABAJOS}`}
                  className="mt-1 block break-all text-sm text-ciess-600 underline underline-offset-4 dark:text-ciess-300"
                >
                  {CORREO_TRABAJOS}
                </a>
              </div>
            </div>

            <p className="mx-auto mt-12 max-w-xl text-xs leading-relaxed tenue">
              <span className="font-semibold">{textos.cierreTitulo}: </span>
              {textos.cierreTexto}
            </p>
          </div>
        </section>
      </main>

      <PieDePagina />
    </>
  );
}
