'use client';

import { useMemo, useState } from 'react';
import { Encabezado, PieDePagina } from '@/componentes/controles';
import { useApp } from '@/componentes/proveedores';
import { traducir, type Faq } from '@/lib/contenido';

export function PaginaFaqs({ urlAgenda, faqs }: { urlAgenda: string; faqs: Faq[] }) {
  const { idioma, t } = useApp();
  const [busqueda, setBusqueda] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);

  const preguntas = useMemo(
    () =>
      faqs.map((f) => ({
        id: f.clave,
        categoria: traducir(f.categoria, idioma),
        pregunta: traducir(f.pregunta, idioma),
        respuesta: traducir(f.respuesta, idioma),
        provisional: f.provisional,
      })),
    [faqs, idioma],
  );
  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return preguntas;
    return preguntas.filter(
      (p) =>
        p.pregunta.toLowerCase().includes(termino) ||
        p.respuesta.toLowerCase().includes(termino) ||
        p.categoria.toLowerCase().includes(termino),
    );
  }, [preguntas, busqueda]);

  const categorias = useMemo(
    () => [...new Set(filtradas.map((p) => p.categoria))],
    [filtradas],
  );

  return (
    <>
      <Encabezado />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6">
        <h1 className="text-2xl font-bold">{t.faq.titulo}</h1>
        <p className="mt-2 text-sm tenue">{t.faq.subtitulo}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            className="campo flex-1"
            placeholder={t.faq.buscar}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label={t.faq.buscar}
          />
          <a href={urlAgenda} target="_blank" rel="noreferrer" className="boton-secundario shrink-0">
            {t.faq.verConvocatoria}
          </a>
        </div>

        {filtradas.length === 0 ? (
          <p className="mt-10 text-center text-sm tenue">{t.faq.sinResultados}</p>
        ) : (
          <div className="mt-8 space-y-8">
            {categorias.map((categoria) => (
              <section key={categoria}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ciess-400">
                  {categoria}
                </h2>
                <div className="space-y-2">
                  {filtradas
                    .filter((p) => p.categoria === categoria)
                    .map((p) => (
                      <article key={p.id} className="tarjeta overflow-hidden">
                        <h3>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-4 p-4 text-left text-sm font-medium"
                            aria-expanded={abierta === p.id}
                            onClick={() => setAbierta(abierta === p.id ? null : p.id)}
                          >
                            <span>{p.pregunta}</span>
                            <svg
                              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                              strokeWidth="2" strokeLinecap="round" aria-hidden
                              className={`shrink-0 transition-transform ${abierta === p.id ? 'rotate-180' : ''}`}
                            >
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </button>
                        </h3>
                        {abierta === p.id && (
                          <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--borde)' }}>
                            <p className="text-sm leading-relaxed tenue">{p.respuesta}</p>
                            {p.provisional && (
                              <p className="mt-3 text-xs text-amber-500">{t.panel.agenda.provisional}</p>
                            )}
                          </div>
                        )}
                      </article>
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
      <PieDePagina />
    </>
  );
}
