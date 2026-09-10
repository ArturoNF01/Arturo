'use client';

import { Encabezado, PieDePagina } from '@/componentes/controles';
import { FormularioRegistro } from '@/componentes/formulario-registro';
import { useApp } from '@/componentes/proveedores';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';
import { traducir, type DatosCongreso, type EjeTematico } from '@/lib/contenido';
import { VideoFondo } from '@/componentes/video-fondo';

export function PaginaRegistro({
  configuracion,
  congreso,
  ejes,
}: {
  configuracion: ConfiguracionPublica;
  congreso: DatosCongreso;
  ejes: EjeTematico[];
}) {
  const { t, idioma } = useApp();

  return (
    <>
      <VideoFondo url={configuracion.url_video_login} />
      <Encabezado />
      <main>
        <section className="mx-auto max-w-3xl px-4 pb-8 pt-10 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ciess-400">
            {t.congreso.organiza}
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            {traducir(congreso.nombre, idioma)}
          </h1>
          <p className="mt-3 text-sm tenue">
            {traducir(congreso.sede, idioma)} · {traducir(congreso.fechas, idioma)}
          </p>
          <p className="mt-5 text-sm leading-relaxed">{t.formulario.intro}</p>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide tenue">{t.formulario.fechaLimite}</dt>
              <dd className="font-medium">{configuracion.fecha_limite_registro}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide tenue">{t.formulario.contacto}</dt>
              <dd className="font-medium">{configuracion.correo_contacto}</dd>
            </div>
          </dl>
        </section>
        <FormularioRegistro configuracion={configuracion} congreso={congreso} ejes={ejes} />
      </main>
      <PieDePagina />
    </>
  );
}
