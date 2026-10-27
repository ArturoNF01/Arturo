'use client';

import '@fontsource/work-sans/latin-400.css';
import '@fontsource/work-sans/latin-600.css';
import '@fontsource/work-sans/latin-700.css';
import { useApp } from '@/componentes/proveedores';
import { VideoFondo } from '@/componentes/video-fondo';
import { LANDING, SEDE_MAPA_ENLACE } from '@/lib/landing';
import { traducir, type DatosCongreso } from '@/lib/contenido';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';

/**
 * La portada, igual que el banner de la página de la RIUSS: el video del
 * Congreso a toda luz bajo un degradado azul, el texto a la izquierda, el
 * nombre del Congreso en dorado y dos botones.
 *
 * Los estilos viven en globals.css (`.portada*`) y no en clases de Tailwind:
 * son una réplica de los del sitio institucional, y así se comparan
 * valor por valor con los de allá cuando alguien los retoque.
 *
 * El nombre completo del Congreso va en dorado, sobre el lema, y no sólo
 * «1er Congreso»: el banner de la RIUSS puede acortarlo porque está dentro de
 * su propio sitio, pero esta es la página del Congreso y quien llega aquí
 * tiene que leer cómo se llama.
 */
export function Portada({
  configuracion,
  congreso,
}: {
  configuracion: ConfiguracionPublica;
  congreso: DatosCongreso;
}) {
  const { t, idioma } = useApp();
  const textos = LANDING[idioma];

  return (
    <section className="portada">
      <VideoFondo url={configuracion.url_video_login} opacidad={1} variante="sin-velo" posicion="contenido" />
      <div className="portada-velo" aria-hidden />

      <div className="portada-contenido">
        {/* La condición que más importa a quien duda si registrarse: va
            arriba, en dorado macizo, y no como una píldora entre los datos. */}
        <p className="portada-gratuita portada-entrada" style={{ ['--retraso' as string]: '0.1s' }}>
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          >
            <circle cx="12" cy="12" r="9.5" />
            <path d="m7.5 12.5 3 3 6-6.5" />
          </svg>
          {textos.gratuita}
        </p>

        <h1 className="portada-titulo portada-entrada" style={{ ['--retraso' as string]: '0.3s' }}>
          <span className="portada-nombre">{t.congreso.titulo}</span>
          {t.congreso.subtitulo}
        </h1>

        <p className="portada-descripcion portada-entrada" style={{ ['--retraso' as string]: '0.6s' }}>
          {/* La sede es el dato sobre el que alguien querrá hacer algo: ver
              dónde cae. Se abre en otra pestaña para no sacar a nadie del
              Congreso a medias. */}
          <a
            href={SEDE_MAPA_ENLACE}
            target="_blank"
            rel="noopener noreferrer"
            className="portada-sede"
          >
            {traducir(congreso.sede, idioma)}
            <span className="sr-only"> · {textos.verEnMapa}</span>
          </a>
          <span aria-hidden className="portada-barra">|</span>
          <span className="portada-fechas">{traducir(congreso.fechas, idioma)}</span>
          <span className="portada-modalidad">
            {t.modalidad.presencial} · {t.modalidad.en_linea}
          </span>
        </p>

        <div className="portada-botones portada-entrada" style={{ ['--retraso' as string]: '0.8s' }}>
          <a href="/registro" className="portada-boton portada-boton-registro">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            {textos.irAlRegistro}
          </a>
          {/* Sólo cuando el comité da la agenda por publicada: el PDF se
              corrige hasta el último momento, y una agenda vieja a la vista
              manda gente a la sala equivocada. Lleva a la sección de la
              página; el PDF se descarga desde ahí. */}
          {configuracion.programa_publicado && (
            <a href="#agenda" className="portada-boton portada-boton-agenda">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              {textos.verAgenda}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
