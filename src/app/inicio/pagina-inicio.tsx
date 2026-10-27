'use client';

import Link from 'next/link';
import { useApp } from '@/componentes/proveedores';
import { Encabezado, PieDePagina } from '@/componentes/controles';
import { Portada } from '@/componentes/portada';
import { Collage } from '@/componentes/collage';
import { CALENDARIO, GALERIA, LANDING, SEDE_MAPA_EMBED, SEDE_MAPA_ENLACE } from '@/lib/landing';
import { Programa } from '@/componentes/programa';
import { Hospedaje } from '@/componentes/hospedaje';
import { diaEnMexico } from '@/lib/fechas';
import { traducir, type DatosCongreso, type EjeTematico } from '@/lib/contenido';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';

/**
 * Los tres tonos que rotan por las tarjetas de los ejes.
 *
 * Escritos enteros y no armados con una plantilla: Tailwind lee el código
 * buscando nombres de clase, y uno que sólo existe al ejecutarse no lo
 * encuentra y lo descarta al compilar. No da error —la página sale, sin
 * color—, que es la peor forma de fallar.
 */
const TONOS_EJE = ['tono-a', 'tono-b', 'tono-c'] as const;

export function PaginaInicio({
  configuracion,
  congreso,
  ejes,
}: {
  configuracion: ConfiguracionPublica;
  congreso: DatosCongreso;
  ejes: EjeTematico[];
}) {
  const { idioma } = useApp();
  const textos = LANDING[idioma];
  const hoy = diaEnMexico();

  return (
    <>
      <Encabezado />

      <main>
        {/* Portada ------------------------------------------------------ */}
        <Portada configuracion={configuracion} congreso={congreso} />

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
        <section className="border-y" style={{ borderColor: 'var(--borde)', backgroundColor: 'var(--fondo-alterno)' }}>
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="titulo-seccion">{textos.ejesTitulo}</h2>
            <p className="mt-2 tenue">{textos.ejesAyuda}</p>

            {/* El número va en una columna propia, grande y fuera del texto:
                así los nueve ejes se recorren de un vistazo y los títulos
                quedan alineados aunque midan distinto. La tarjeta entera se
                tiñe al pasar el ratón, no sólo el borde. */}
            <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border shadow-sm sm:grid-cols-2 lg:grid-cols-3"
                style={{ borderColor: 'var(--borde)', backgroundColor: 'var(--borde)' }}>
              {ejes.map((eje, i) => (
                <li
                  key={eje.clave}
                  className={`eje ${TONOS_EJE[i % TONOS_EJE.length]} flex gap-4 p-5`}
                >
                  <span aria-hidden className="eje-numero shrink-0 font-serif text-3xl font-bold leading-none">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-snug">
                      {traducir(eje.nombre, idioma)}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed tenue">
                      {traducir(eje.descripcion, idioma)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Programa ------------------------------------------------------ */}
        {/* Se enseña sólo cuando el comité lo da por publicado: el PDF se
            corrige hasta el último momento, y un programa viejo a la vista
            manda gente a la sala equivocada. */}
        {configuracion.programa_publicado && <Programa urlAgenda={configuracion.url_agenda} urlAgendaPt={configuracion.url_agenda_pt} />}

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

        {/* Sede ---------------------------------------------------------- */}
        {/* Aquí estaba «Convoca», que repetía palabra por palabra los dos
            enlaces del pie de página. En su lugar va lo que sí falta al
            final de la página: dónde es. */}
        <section className="border-t" style={{ borderColor: 'var(--borde)' }}>
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="grid gap-8 lg:grid-cols-[1fr,1.3fr] lg:items-center">
              <div>
                <h2 className="titulo-seccion">{textos.sedeTitulo}</h2>
                <p className="mt-4 text-base leading-relaxed">{traducir(congreso.sede, idioma)}</p>
                <p className="mt-3 leading-relaxed tenue">{textos.sedeAyuda}</p>
                <a
                  href={SEDE_MAPA_ENLACE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ciess-600 underline underline-offset-4 hover:text-ciess-500 dark:text-ciess-300 dark:hover:text-ciess-200"
                >
                  {textos.verEnMapa}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                  >
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </a>
              </div>

              {/* loading="lazy": el mapa está al final de la página y pesa
                  más que todo lo demás junto; no tiene por qué retrasar la
                  portada de quien nunca baja hasta aquí. */}
              <div
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: 'var(--borde)' }}
              >
                <iframe
                  src={SEDE_MAPA_EMBED}
                  title={`${textos.sedeTitulo} · ${traducir(congreso.sede, idioma)}`}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="block h-[320px] w-full border-0 sm:h-[380px]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Instalaciones ------------------------------------------------- */}
        {/* Un adelanto, no la galería: son doscientas fotografías y aquí
            caben nueve. Quien quiera verlas entra a su página. */}
        <section className="border-t" style={{ borderColor: 'var(--borde)' }}>
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="titulo-seccion">{textos.galeriaTitulo}</h2>
            <p className="mt-2 max-w-2xl tenue">{textos.galeriaAyuda}</p>

            <div className="mt-8">
              <Collage fotos={GALERIA} />
            </div>
          </div>
        </section>

        {/* Hospedaje ----------------------------------------------------- */}
        <Hospedaje />

        {/* Llamado a registrarse ---------------------------------------- */}
        <section className="border-t" style={{ borderColor: 'var(--borde)' }}>
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="titulo-seccion">{textos.participarTitulo}</h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed tenue">{textos.participarAyuda}</p>
            <Link href="/registro" className="boton-primario mt-8 inline-flex px-8 py-3">
              {textos.registrarse}
            </Link>
          </div>
        </section>
      </main>

      <PieDePagina />
    </>
  );
}
