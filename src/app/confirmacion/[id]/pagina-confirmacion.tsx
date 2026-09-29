'use client';

import { useState } from 'react';
import { Encabezado, PieDePagina } from '@/componentes/controles';
import { FormularioRegistro } from '@/componentes/formulario-registro';
import { useApp } from '@/componentes/proveedores';
import { ResumenRegistro } from '@/componentes/resumen-registro';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';
import type { DatosCongreso, EjeTematico } from '@/lib/contenido';
import { interpolar } from '@/i18n';
import { perfilPorClave, registroMinimo, type Modalidad } from '@/lib/perfiles';

export function PaginaConfirmacion({
  registro,
  configuracion,
  congreso,
  ejes,
  token,
  puedeEditar,
}: {
  registro: Record<string, unknown>;
  configuracion: ConfiguracionPublica;
  congreso: DatosCongreso;
  ejes: EjeTematico[];
  token: string;
  /** Se decide en el servidor: la hora del navegador no es de fiar. */
  puedeEditar: boolean;
}) {
  const { t } = useApp();
  const [editando, setEditando] = useState(false);

  // A quien sigue la transmisión le falta el paso que no depende de nosotros:
  // el enlace se lo da Zoom al registrarse ahí. Si no se le dice aquí —y en
  // el acuse— se queda con un folio y sin manera de conectarse.
  const vaAZoom =
    registroMinimo(
      perfilPorClave(String(registro.perfil)),
      registro.modalidad === 'en_linea' ? 'en_linea' : ('presencial' as Modalidad),
    ) && Boolean(configuracion.url_registro_zoom);

  if (editando) {
    return (
      <>
        <Encabezado />
        <main className="pt-8">
          <FormularioRegistro
            configuracion={configuracion}
            congreso={congreso}
            registroExistente={registro}
            token={token}
          />
        </main>
        <PieDePagina />
      </>
    );
  }

  return (
    <>
      <Encabezado />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6">
        <div className="tarjeta p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <div>
              <h1 className="text-xl font-bold">{t.confirmacion.titulo}</h1>
              <p className="mt-1 text-sm tenue">{t.confirmacion.subtitulo}</p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border p-4" style={{ borderColor: 'var(--borde)' }}>
            <p className="text-xs uppercase tracking-wide tenue">{t.confirmacion.folio}</p>
            <p className="mt-1 font-mono text-lg font-bold tracking-tight">{String(registro.folio)}</p>
          </div>

          {vaAZoom && (
            <div
              className="mt-6 rounded-lg border p-4"
              style={{ borderColor: 'var(--acento, #2e5c8a)', background: 'color-mix(in srgb, #2e5c8a 12%, transparent)' }}
            >
              <p className="font-semibold">{t.confirmacion.zoomTitulo}</p>
              <p className="mt-1 text-sm">{t.confirmacion.zoomTexto}</p>
              <a
                href={configuracion.url_registro_zoom}
                target="_blank"
                rel="noopener noreferrer"
                className="boton-primario mt-4 inline-flex"
              >
                {t.confirmacion.zoomBoton}
              </a>
              <p className="ayuda mt-3">{t.confirmacion.zoomNota}</p>
            </div>
          )}

          {registro.estado === 'lista_espera' && (
            <p className="mt-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-500">
              {t.confirmacion.listaEspera}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3 sin-impresion">
            {puedeEditar && (
              <button type="button" className="boton-primario" onClick={() => setEditando(true)}>
                {t.confirmacion.editar}
              </button>
            )}
            <button type="button" className="boton-secundario" onClick={() => window.print()}>
              {t.confirmacion.imprimir}
            </button>
          </div>
          {puedeEditar && (
            <p className="ayuda mt-3">
              {interpolar(t.confirmacion.editarAyuda, { fecha: configuracion.fecha_limite_registro })}
            </p>
          )}
          <p className="ayuda mt-1">
            {interpolar(t.confirmacion.correoNoRecibido, { contacto: configuracion.correo_contacto })}
          </p>
        </div>

        <section className="mt-8">
          <h2 className="titulo-seccion mb-4">{t.confirmacion.resumen}</h2>
          <ResumenRegistro registro={registro} ejes={ejes} />
        </section>
      </main>
      <PieDePagina />
    </>
  );
}
