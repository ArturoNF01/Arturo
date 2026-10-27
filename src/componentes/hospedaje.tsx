'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { HOTEL, LANDING } from '@/lib/landing';

/**
 * El hotel con convenio, con el código de promoción como lo principal.
 *
 * El comité no tiene tarifas que publicar: lo que hace falta es que quien
 * reserve sepa que existe el convenio y tenga el código a un clic, sin
 * teclearlo mal. Por eso el código es lo más grande de la sección y se copia.
 */
export function Hospedaje() {
  const { idioma } = useApp();
  const textos = LANDING[idioma];
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(HOTEL.codigo);
    } catch {
      // Sin permiso del portapapeles (contexto no seguro, navegador viejo):
      // el código sigue a la vista y seleccionable, y no se finge que se copió.
      return;
    }
    setCopiado(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <section className="border-t" style={{ borderColor: 'var(--borde)' }}>
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="titulo-seccion">{textos.hospedajeTitulo}</h2>
        <p className="mt-2 max-w-2xl tenue">{textos.hospedajeAyuda}</p>

        <div
          className="mt-8 grid overflow-hidden rounded-xl border shadow-sm md:grid-cols-[1.25fr,1fr]"
          style={{ borderColor: 'var(--borde)', backgroundColor: 'var(--fondo-tarjeta)' }}
        >
          {/* El hotel ------------------------------------------------- */}
          <div className="p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] tenue">
              {textos.hospedajeEtiqueta}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold leading-snug">{HOTEL.nombre}</h3>
            <p className="mt-2 text-sm leading-relaxed tenue">{HOTEL.direccion}</p>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
              <EnlaceHotel href={HOTEL.web} externo>{textos.hospedajeSitio}</EnlaceHotel>
              <EnlaceHotel href={HOTEL.telefonoEnlace}>{textos.hospedajeLlamar} · {HOTEL.telefono}</EnlaceHotel>
              <EnlaceHotel href={HOTEL.mapa} externo>{textos.hospedajeComoLlegar}</EnlaceHotel>
            </div>
            <p className="mt-3 text-xs tenue">{textos.hospedajeAtencion}</p>
          </div>

          {/* El código ------------------------------------------------ */}
          <div className="hospedaje-codigo flex flex-col justify-center p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] texto-marca">
              {textos.codigoEtiqueta}
            </p>
            <p className="hospedaje-codigo-valor mt-3 select-all rounded-lg px-4 py-3 text-center text-2xl font-bold tracking-wide sm:text-3xl">
              {HOTEL.codigo}
            </p>
            <button
              type="button"
              onClick={copiar}
              className="boton-primario mt-4 w-full justify-center"
            >
              {copiado ? `✓ ${textos.codigoCopiado}` : textos.codigoCopiar}
            </button>
            <p className="mt-3 text-center text-xs tenue">{textos.codigoAyuda}</p>
            {/* El aviso para lectores de pantalla: el botón ya cambia de
                texto, pero un cambio dentro de un botón no se anuncia. */}
            <span className="sr-only" aria-live="polite">{copiado ? textos.codigoCopiado : ''}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function EnlaceHotel({
  href, externo, children,
}: {
  href: string;
  externo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex items-center gap-1.5 border-b border-current pb-0.5 text-ciess-600 transition hover:text-ciess-500 dark:text-ciess-300 dark:hover:text-ciess-200"
    >
      {children}
      <svg
        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      >
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
  );
}
