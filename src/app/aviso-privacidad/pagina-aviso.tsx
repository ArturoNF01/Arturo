'use client';

import { Encabezado, PieDePagina } from '@/componentes/controles';
import { useApp } from '@/componentes/proveedores';
import { AVISO } from '@/i18n/aviso-privacidad';

export function PaginaAviso() {
  const { idioma, t } = useApp();
  const aviso = AVISO[idioma];

  return (
    <>
      <Encabezado />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6">
        <h1 className="text-2xl font-bold leading-tight">{aviso.titulo}</h1>
        <p className="mt-2 text-xs tenue">{aviso.actualizado} · {t.privacidad.marcoLegal}</p>

        <div className="mt-8 space-y-8">
          {aviso.bloques.map((bloque) => (
            <section key={bloque.titulo}>
              <h2 className="titulo-seccion">{bloque.titulo}</h2>
              <div className="mt-2 space-y-3">
                {bloque.parrafos.map((parrafo, i) => (
                  <p key={i} className="text-sm leading-relaxed tenue">{parrafo}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <PieDePagina />
    </>
  );
}
