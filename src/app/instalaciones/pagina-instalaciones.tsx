'use client';

import { Encabezado, PieDePagina } from '@/componentes/controles';
import { Galeria } from '@/componentes/galeria';
import { useApp } from '@/componentes/proveedores';
import { GALERIA, LANDING, SEDE_MAPA_ENLACE } from '@/lib/landing';

export function PaginaInstalaciones() {
  const { idioma } = useApp();
  const textos = LANDING[idioma];

  return (
    <>
      <Encabezado />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{textos.galeriaTitulo}</h1>
        <p className="mt-3 max-w-2xl leading-relaxed tenue">{textos.galeriaAyuda}</p>
        <a
          href={SEDE_MAPA_ENLACE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-sm font-semibold text-ciess-600 underline underline-offset-4 hover:text-ciess-500 dark:text-ciess-300 dark:hover:text-ciess-200"
        >
          {textos.verEnMapa}
        </a>

        <div className="mt-10">
          <Galeria fotos={GALERIA} />
        </div>
      </main>
      <PieDePagina />
    </>
  );
}
