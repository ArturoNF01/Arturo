'use client';

import Link from 'next/link';
import { ENLACE_CIESS, ENLACE_RIUSS, LogoCiess } from '@/componentes/logo';
import { useState } from 'react';
import { IDIOMAS, diccionarios, type Idioma } from '@/i18n';
import { useApp } from './proveedores';

export function SelectorIdioma({ compacto = false }: { compacto?: boolean }) {
  const { idioma, cambiarIdioma, t } = useApp();
  return (
    <div
      className="inline-flex rounded-lg border p-0.5"
      role="group"
      aria-label={t.idiomaSelector}
      style={{ borderColor: 'var(--borde)' }}
    >
      {IDIOMAS.map((codigo: Idioma) => (
        <button
          key={codigo}
          type="button"
          onClick={() => cambiarIdioma(codigo)}
          aria-pressed={idioma === codigo}
          title={diccionarios[codigo].meta.nombre}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition ${
            idioma === codigo
              ? 'bg-ciess-500 text-white'
              : 'hover:bg-black/5 dark:hover:bg-white/10 tenue'
          }`}
        >
          {compacto ? codigo : `${diccionarios[codigo].meta.bandera} ${codigo}`}
        </button>
      ))}
    </div>
  );
}

export function BotonTema() {
  const { tema, alternarTema, t } = useApp();
  const esOscuro = tema === 'oscuro';
  return (
    <button
      type="button"
      onClick={alternarTema}
      className="boton-secundario !px-2.5 !py-2"
      aria-label={t.tema.alternar}
      title={esOscuro ? t.tema.claro : t.tema.oscuro}
    >
      {esOscuro ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

export function Encabezado({ variante = 'publico' }: { variante?: 'publico' | 'panel' }) {
  const { t } = useApp();
  const [abierto, setAbierto] = useState(false);

  const enlaces =
    variante === 'publico'
      ? [
          { href: '/', texto: t.nav.inicio },
          { href: '/registro', texto: t.nav.registro },
          { href: '/instalaciones', texto: t.nav.instalaciones },
          { href: '/faqs', texto: t.nav.faqs },
          { href: '/aviso-privacidad', texto: t.nav.privacidad },
        ]
      : [];

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur sin-impresion"
      style={{ borderColor: 'var(--borde)', backgroundColor: 'color-mix(in srgb, var(--fondo) 88%, transparent)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        {/* Sólo los logos. El título del congreso estaba aquí cortado a
            «1er Congreso de Estud…», que no dice nada, y encima repetía lo
            primero que se lee en la portada. El hueco lo aprovecha el menú. */}
        <Link href="/" className="shrink-0" aria-label={t.congreso.titulo}>
          <LogoCiess className="h-9 sm:h-11" />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {enlaces.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              {e.texto}
            </Link>
          ))}
        </nav>

        {/* En pantallas anchas, todo a la vista. En las estrechas sólo el
            botón del menú: el idioma y el tema se consultan una vez y no
            merecen el sitio que ocupaban en una barra de 390 píxeles. */}
        <div className="ml-auto flex items-center gap-2 md:ml-2">
          <div className="hidden items-center gap-2 md:flex">
            <SelectorIdioma compacto />
            <BotonTema />
            {variante === 'publico' && (
              <Link href="/login" className="boton-secundario whitespace-nowrap">
                {t.nav.login}
              </Link>
            )}
          </div>

          <button
            type="button"
            className="boton-secundario !px-2.5 !py-2 md:hidden"
            aria-expanded={abierto}
            aria-controls="menu-movil"
            aria-label={t.nav.menu}
            onClick={() => setAbierto((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {abierto ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {abierto && (
        <nav
          id="menu-movil"
          className="border-t px-4 pb-4 md:hidden"
          style={{ borderColor: 'var(--borde)' }}
        >
          {enlaces.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              onClick={() => setAbierto(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              {e.texto}
            </Link>
          ))}

          {variante === 'publico' && (
            <Link
              href="/login"
              onClick={() => setAbierto(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              {t.nav.login}
            </Link>
          )}

          <div
            className="mt-3 flex items-center justify-between gap-3 border-t pt-3"
            style={{ borderColor: 'var(--borde)' }}
          >
            <SelectorIdioma compacto />
            <BotonTema />
          </div>
        </nav>
      )}
    </header>
  );
}

export function PieDePagina() {
  const { t } = useApp();
  return (
    <footer className="mt-16 border-t sin-impresion" style={{ borderColor: 'var(--borde)' }}>
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-xs tenue sm:px-6">
        {/* Las dos instituciones que convocan, cada una a su sitio. */}
        {/* Sin separador entre medias: cuando las dos líneas no caben, el
            punto se quedaba colgando al final de la primera. */}
        <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <a
            href={ENLACE_CIESS}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-ciess-600 dark:hover:text-ciess-300"
          >
            {t.congreso.organiza}
          </a>
          <a
            href={ENLACE_RIUSS}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-ciess-600 dark:hover:text-ciess-300"
          >
            {t.congreso.riuss}
          </a>
        </p>
      </div>
    </footer>
  );
}
