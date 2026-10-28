'use client';

import Link from 'next/link';
import { useApp } from '@/componentes/proveedores';
import { Encabezado, PieDePagina } from '@/componentes/controles';
import { Portada } from '@/componentes/portada';
import { Collage } from '@/componentes/collage';
import { GALERIA, LANDING, SEDE_MAPA_EMBED, SEDE_MAPA_ENLACE } from '@/lib/landing';
import { Programa } from '@/componentes/programa';
import { Hospedaje } from '@/componentes/hospedaje';
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
  const { idioma } = useApp();
  const textos = LANDING[idioma];

  return (
    <>
      <Encabezado />

      <main>
        {/* Portada ------------------------------------------------------ */}
        <Portada configuracion={configuracion} congreso={congreso} />

        {/* Presentación ------------------------------------------------- */}
        {/* Sobre un fondo celeste y no sobre el de la página: tras la portada,
            azul intenso, un bloque de texto en blanco liso se leía como otra
            página. El texto va en una tarjeta de vidrio claro para que el
            fondo lo enmarque sin quitarle contraste. */}
        <section className="seccion-celeste">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[5fr_7fr] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 className="titulo-bloque">{textos.presentacionTitulo}</h2>
              <span aria-hidden className="regla-dorada" />
            </div>
            <div className="vidrio-claro space-y-5 p-6 text-base leading-relaxed sm:p-8">
              {textos.presentacion.map((parrafo, i) => (
                <p key={i} className={i === 0 ? 'text-lg font-medium' : undefined}>
                  {parrafo}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* Ejes temáticos ----------------------------------------------- */}
        {/* El azul de la portada y tarjetas de vidrio esmerilado: los nueve ejes
            se recorren de un vistazo, con el número en dorado como lo único
            que se enciende. */}
        <section className="seccion-azul">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <h2 className="titulo-bloque">{textos.ejesTitulo}</h2>
            <span aria-hidden className="regla-dorada" />
            <p className="bajada">{textos.ejesAyuda}</p>

            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ejes.map((eje, i) => (
                <li key={eje.clave} className="vidrio flex gap-4 p-5 sm:p-6">
                  <span aria-hidden className="shrink-0 text-3xl font-bold leading-none tabular-nums" style={{ color: 'var(--dorado)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold leading-snug text-white">
                      {traducir(eje.nombre, idioma)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/75">
                      {traducir(eje.descripcion, idioma)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Agenda -------------------------------------------------------- */}
        {/* Se enseña sólo cuando el comité la da por publicada: el PDF se
            corrige hasta el último momento, y una agenda vieja a la vista
            manda gente a la sala equivocada. */}
        {configuracion.programa_publicado && (
          <Programa
            urlAgenda={configuracion.url_agenda}
            urlAgendaPt={configuracion.url_agenda_pt}
            urlAgendaEn={configuracion.url_agenda_en}
          />
        )}

        {/* Sede ---------------------------------------------------------- */}
        {/* Aquí estaba «Convoca», que repetía palabra por palabra los dos
            enlaces del pie de página. En su lugar va lo que sí falta al
            final de la página: dónde es. */}
        <section className="seccion-celeste">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="grid gap-8 lg:grid-cols-[1fr,1.3fr] lg:items-center">
              <div>
                <h2 className="titulo-bloque">{textos.sedeTitulo}</h2>
                <span aria-hidden className="regla-dorada" />
                <p className="mt-6 text-lg font-medium leading-relaxed">{traducir(congreso.sede, idioma)}</p>
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
                className="vidrio-claro overflow-hidden !p-1.5"
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
        <section>
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <h2 className="titulo-bloque">{textos.galeriaTitulo}</h2>
            <span aria-hidden className="regla-dorada" />
            <p className="bajada">{textos.galeriaAyuda}</p>

            <div className="mt-10">
              <Collage fotos={GALERIA} />
            </div>
          </div>
        </section>

        {/* Hospedaje ----------------------------------------------------- */}
        <Hospedaje />

        {/* Llamado a registrarse ---------------------------------------- */}
        <section className="seccion-azul">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
            <h2 className="titulo-bloque">{textos.participarTitulo}</h2>
            <span aria-hidden className="regla-dorada mx-auto" />
            <p className="bajada mx-auto">{textos.participarAyuda}</p>
            <Link href="/registro" className="portada-boton portada-boton-registro mt-8">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              {textos.irAlRegistro}
            </Link>
          </div>
        </section>
      </main>

      <PieDePagina />
    </>
  );
}
