'use client';

import { useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { LANDING } from '@/lib/landing';
import { urlAgendaSegunIdioma } from '@/lib/agenda';
import {
  MESA_POR_NUMERO, PAISES, PROGRAMA, RESUMEN, SALAS, TEXTOS_PROGRAMA,
  agruparPorHorario, unirAutores,
  type ClaveSala, type Mesa, type Sesion,
} from '@/lib/programa';

/**
 * El programa del Congreso en la página de inicio.
 *
 * No reproduce el PDF: lo aprovecha. Un día a la vez en lugar de tres tablas
 * seguidas, las sesiones paralelas lado a lado en lugar de dos filas con la
 * misma hora, y las ponencias de cada mesa plegadas hasta que alguien las
 * abre —son cuarenta y nueve, y desplegadas todas serían una pared—.
 *
 * Lleva los colores del programa impreso —azul marino y dorado— y una sola
 * tipografía. Las sesiones paralelas se distinguen por la etiqueta de su sala
 * y por ir lado a lado, no por un color distinto cada una.
 */

/** La fecha de hoy en la Ciudad de México, que es la que importa el día del Congreso. */
function hoyEnMexico(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

function diaDeLaSemana(iso: string, idioma: string): string {
  const texto = new Intl.DateTimeFormat(idioma, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T12:00:00Z`),
  );
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Lo que se puede desplegar: las mesas, que traen sus ponencias, y la apertura, que trae a quien la abre. */
function claveDesplegable(sesion: Sesion): string | null {
  if (sesion.tipo === 'mesa') return `mesa-${sesion.mesa}`;
  // La apertura se despliega sólo si trae a quién enseñar. Sin lista, un botón de
  // desplegar abriría una caja vacía.
  if (sesion.tipo === 'apertura') return sesion.participantes?.length ? 'apertura' : null;
  return null;
}

function Sala({ sala }: { sala: ClaveSala }) {
  const { idioma } = useApp();
  return (
    <span className="sala-chip">
      <span aria-hidden className="punto-sala h-2 w-2 shrink-0 rounded-full" />
      {SALAS[sala][idioma]}
    </span>
  );
}

function Flecha({ abierta }: { abierta: boolean }) {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`mt-0.5 shrink-0 tenue transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ListaPonencias({ mesa }: { mesa: Mesa }) {
  const { idioma } = useApp();
  return (
    <ol className="space-y-3.5">
      {mesa.ponencias.map((ponencia, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="texto-dorado w-4 shrink-0 text-right text-sm font-bold">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug">{ponencia.titulo}</p>
            <p className="texto-azul mt-1 text-xs leading-relaxed">
              {unirAutores(ponencia, idioma)}
              <span className="pais-chip ml-2 inline-block whitespace-nowrap rounded-full px-2 py-px text-[11px] leading-snug">
                {PAISES[ponencia.pais][idioma]}
              </span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tarjeta({
  sesion, abierta, alternar, mostrarSala,
}: {
  sesion: Sesion;
  abierta: boolean;
  alternar: (clave: string) => void;
  mostrarSala: boolean;
}) {
  const { idioma } = useApp();
  const ui = TEXTOS_PROGRAMA[idioma];
  const mesa = sesion.mesa !== undefined ? MESA_POR_NUMERO.get(sesion.mesa) : undefined;
  const clave = claveDesplegable(sesion);

  const etiqueta =
    sesion.tipo === 'mesa' ? `${ui.mesa} ${sesion.mesa}`
    : sesion.tipo === 'conferencia' ? ui.conferencia
    : null;
  const titulo = mesa ? mesa.titulo[idioma] : sesion.actividad?.[idioma] ?? '';
  const cuenta = mesa
    ? `${mesa.ponencias.length} ${ui.ponencias}`
    : sesion.participantes
      ? `${sesion.participantes.length} ${ui.participan}`
      : null;

  const cabecera = (
    <>
      <span className="min-w-0 flex-1">
        {etiqueta && (
          <span className="texto-dorado block text-[11px] font-bold uppercase tracking-wide">{etiqueta}</span>
        )}
        <span className={`texto-azul block text-sm font-semibold leading-snug ${etiqueta ? 'mt-0.5' : ''}`}>{titulo}</span>
        {((mostrarSala && sesion.sala) || cuenta) && (
          <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {mostrarSala && sesion.sala && <Sala sala={sesion.sala} />}
            {cuenta && <span className="text-xs font-medium tenue">{cuenta}</span>}
          </span>
        )}
      </span>
      {clave && <Flecha abierta={abierta} />}
    </>
  );

  return (
    <div className="sesion">
      {clave ? (
        <button
          type="button"
          className="sesion-cabecera flex w-full items-start gap-3 p-4 text-left"
          aria-expanded={abierta}
          aria-controls={abierta ? `programa-${clave}` : undefined}
          onClick={() => alternar(clave)}
        >
          {cabecera}
        </button>
      ) : (
        <div className="flex items-start gap-3 p-4">{cabecera}</div>
      )}

      {clave && abierta && (
        <div
          id={`programa-${clave}`}
          className="border-t px-4 pb-4 pt-3"
        >
          {mesa && <ListaPonencias mesa={mesa} />}
          {sesion.participantes && (
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {sesion.participantes.map((p) => (
                <li key={p.nombre}>
                  <p className="text-sm font-medium">{p.nombre}</p>
                  <p className="text-xs leading-snug tenue">{p.cargo[idioma]}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Un trámite o una pausa: una línea, no una tarjeta. No compite con las sesiones. */
function Fila({ sesion, mostrarSala }: { sesion: Sesion; mostrarSala: boolean }) {
  const { idioma } = useApp();
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 py-2 text-sm tenue ${
        sesion.tipo === 'pausa' ? 'border-y border-dashed' : ''
      }`}
    >
      <span>{sesion.actividad?.[idioma]}</span>
      {mostrarSala && sesion.sala && <Sala sala={sesion.sala} />}
    </div>
  );
}

export function Programa({
  urlAgenda, urlAgendaPt, urlAgendaEn,
}: {
  urlAgenda: string;
  urlAgendaPt?: string;
  urlAgendaEn?: string;
}) {
  const { idioma } = useApp();
  const textos = LANDING[idioma];
  const ui = TEXTOS_PROGRAMA[idioma];

  // Se abre en el día de hoy si hoy es uno de los tres: el jueves por la mañana
  // quien entra al sitio quiere ver el jueves, no el miércoles.
  const [indice, setIndice] = useState(() => {
    const hoy = PROGRAMA.findIndex((d) => d.iso === hoyEnMexico());
    return hoy < 0 ? 0 : hoy;
  });
  // La apertura entra abierta: es lo único de los tres días que se lee de corrido.
  const [abiertas, setAbiertas] = useState<ReadonlySet<string>>(() => new Set(['apertura']));

  const dia = PROGRAMA[indice];
  const claves = dia.sesiones.map(claveDesplegable).filter((c): c is string => c !== null);
  const todasAbiertas = claves.length > 0 && claves.every((c) => abiertas.has(c));

  // Las salas que de verdad se usan ese día, sin el lobby: el lobby es donde se
  // hace el registro, no donde ocurre nada que haya que distinguir por color.
  const salasDelDia = [
    ...new Set(
      dia.sesiones
        .map((s) => s.sala)
        .filter((s): s is ClaveSala => s !== undefined && s !== 'lobby'),
    ),
  ];
  // Un día en una sola sala (el miércoles) lo dice una vez arriba, no en cada tarjeta.
  const salaUnica = salasDelDia.length === 1 ? salasDelDia[0] : null;

  const alternar = (clave: string) =>
    setAbiertas((previas) => {
      const nuevas = new Set(previas);
      if (nuevas.has(clave)) nuevas.delete(clave);
      else nuevas.add(clave);
      return nuevas;
    });

  const alternarTodo = () =>
    setAbiertas((previas) => {
      const nuevas = new Set(previas);
      for (const clave of claves) {
        if (todasAbiertas) nuevas.delete(clave);
        else nuevas.add(clave);
      }
      return nuevas;
    });

  return (
    <section id="agenda">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        {/* La descarga va arriba, a la vista de quien llega a la sección: quien
            quiere el PDF no tiene por qué recorrer tres días de sesiones para
            encontrarlo al final. */}
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0 max-w-2xl">
            <h2 className="titulo-bloque">{textos.programaTitulo}</h2>
            <span aria-hidden className="regla-dorada" />
            <p className="bajada">{textos.programaAyuda}</p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <a
              href={urlAgendaSegunIdioma({ general: urlAgenda, pt: urlAgendaPt, en: urlAgendaEn }, idioma)}
              target="_blank"
              rel="noopener noreferrer"
              className="portada-boton portada-boton-registro"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3v12" />
                <path d="m7 11 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              {textos.descargarAgenda}
            </a>
            <p className="text-xs tenue">{textos.programaNota}</p>
          </div>
        </div>

        <ul className="mt-8 flex flex-wrap gap-2.5">
          {(['dias', 'mesas', 'ponencias', 'paises'] as const).map((clave) => (
            <li key={clave} className="ficha-dato flex items-baseline gap-2 px-4 py-2">
              <span className="numero text-2xl font-bold leading-none">{RESUMEN[clave]}</span>
              <span className="text-sm">{ui.resumen[clave]}</span>
            </li>
          ))}
        </ul>

        <div role="group" aria-label={ui.selector} className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
          {PROGRAMA.map((d, i) => (
            <button
              key={d.iso}
              type="button"
              aria-pressed={i === indice}
              onClick={() => setIndice(i)}
              className={`opcion p-3 sm:p-4 ${i === indice ? 'dia-activo' : ''}`}
            >
              <span className="block text-[11px] font-semibold uppercase tracking-wide tenue">
                {diaDeLaSemana(d.iso, idioma)}
              </span>
              <span className="dia-numero mt-0.5 block text-3xl font-bold leading-none">{Number(d.iso.slice(8))}</span>
              <span className="mt-1.5 block text-xs leading-snug">{d.titulo[idioma]}</span>
            </button>
          ))}
        </div>

        <div
          className="mt-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-3"
          style={{ borderColor: 'var(--borde-fuerte)' }}
        >
          <div>
            <h3 className="texto-azul text-xl font-bold">{dia.fecha[idioma]}</h3>
            <p className="mt-0.5 text-sm tenue">{dia.titulo[idioma]}</p>
            {/* La barra dorada del programa impreso. */}
            <span aria-hidden className="mt-2.5 block h-[3px] w-12 rounded-full" style={{ backgroundColor: 'var(--dorado)' }} />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {salaUnica ? (
              <Sala sala={salaUnica} />
            ) : (
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <li className="text-xs tenue">{ui.leyenda}:</li>
                {salasDelDia.map((sala) => (
                  <li key={sala}>
                    <Sala sala={sala} />
                  </li>
                ))}
              </ul>
            )}
            {claves.length > 0 && (
              <button
                type="button"
                onClick={alternarTodo}
                className="text-xs font-semibold underline underline-offset-4 hover:no-underline"
              >
                {todasAbiertas ? ui.contraer : ui.desplegar}
              </button>
            )}
          </div>
        </div>

        {dia.nota && (
          <p className="mt-3 text-sm leading-relaxed tenue">
            {dia.nota[idioma]}
            {dia.notaDestacada && (
              <>
                {' '}
                <strong className="font-semibold" style={{ color: 'var(--texto)' }}>
                  {dia.notaDestacada[idioma]}
                </strong>
              </>
            )}
          </p>
        )}

        <ol className="mt-5 space-y-3">
          {agruparPorHorario(dia.sesiones).map((bloque) => {
            const soloFilas = bloque.sesiones.every((s) => s.tipo === 'registro' || s.tipo === 'pausa');
            const paralelas = bloque.sesiones.length > 1;
            return (
              <li key={`${dia.iso}-${bloque.horario}`} className="grid gap-x-6 gap-y-2 sm:grid-cols-[6.5rem_1fr]">
                <p className={`texto-azul text-sm font-bold tabular-nums ${soloFilas ? 'sm:pt-2' : 'sm:pt-3.5'}`}>
                  {bloque.horario}
                </p>
                <div className={paralelas ? 'grid items-start gap-3 md:grid-cols-2' : ''}>
                  {paralelas && (
                    <p className="text-[11px] font-semibold uppercase tracking-wide tenue md:col-span-2">
                      {ui.paralelo}
                    </p>
                  )}
                  {bloque.sesiones.map((sesion, i) => {
                    const clave = claveDesplegable(sesion);
                    return sesion.tipo === 'registro' || sesion.tipo === 'pausa' ? (
                      <Fila key={i} sesion={sesion} mostrarSala={!salaUnica} />
                    ) : (
                      <Tarjeta
                        key={i}
                        sesion={sesion}
                        abierta={clave !== null && abiertas.has(clave)}
                        alternar={alternar}
                        mostrarSala={!salaUnica}
                      />
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
