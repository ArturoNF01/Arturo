'use client';

import { Encabezado, PieDePagina } from '@/componentes/controles';
import { useApp } from '@/componentes/proveedores';
import { traducir, traducirLista, type BloqueAvisoPrivacidad } from '@/lib/contenido';
import { AVISO } from '@/i18n/aviso-privacidad';

export function PaginaAviso({ bloques }: { bloques: BloqueAvisoPrivacidad[] }) {
  const { idioma } = useApp();
  const encabezado = AVISO[idioma];

  return (
    <>
      <Encabezado />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6">
        <h1 className="text-2xl font-bold leading-tight">{encabezado.titulo}</h1>
        <p className="mt-2 text-xs tenue">{encabezado.actualizado}</p>

        <div className="mt-8 space-y-8">
          {bloques.map((bloque) => (
            <section key={bloque.clave}>
              <h2 className="titulo-seccion">{traducir(bloque.titulo, idioma)}</h2>
              <div className="mt-2 space-y-3">
                {traducirLista(bloque.parrafos, idioma).map((parrafo, i) => (
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
