'use client';

import { useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { LANDING } from '@/lib/landing';
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
 * El color de cada tarjeta es la sala, no un adorno: quien mira el viernes a
 * las nueve ve en seguida que hay dos cosas a la vez y en qué sitio es cada una.
 */

/** La clase de tono de cada sala, escrita entera para poder buscarla en el código. */
const TONO_SALA: Record<ClaveSala, string> = {
  lobby: '',
  auditorio: 'tono-a',
  comisiones: 'tono-b',
  sesiones: 'tono-c',
};

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
  if (sesion.tipo === 'apertura') return 'apertura';
  return null;
}

function Sala({ sala }: { sala: ClaveSala }) {
  const { idioma } = useApp();
  return (
    <span className={`${TONO_SALA[sala]} sala-chip`}>
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
          <span aria-hidden className="texto-tono w-4 shrink-0 text-right font-serif text-sm font-bold">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug">{ponencia.titulo}</p>
            <p className="mt-1 text-xs leading-relaxed tenue">
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
          <span className="texto-tono block text-[11px] font-bold uppercase tracking-wide">{etiqueta}</span>
        )}
        <span className={`block text-sm font-semibold leading-snug ${etiqueta ? 'mt-0.5' : ''}`}>{titulo}</span>
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
    <div className={`sesion ${sesion.sala ? TONO_SALA[sesion.sala] : ''}`}>
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
          style={{ borderColor: 'color-mix(in srgb, var(--tono, var(--borde)) 22%, var(--borde))' }}
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

export function Programa({ urlAgenda }: { urlAgenda: string }) {
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
    <section
      id="programa"
      // Un degradado muy suave, de la página a un velo de la marca: las tarjetas
      // tienen sobre qué despegarse. Una banda plana pegada a la de los ejes
      // se habría leído como una sola, y el degradado no.
      style={{ background: 'linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--marca) 9%, var(--fondo)) 100%)' }}
    >
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="titulo-seccion">{textos.programaTitulo}</h2>
        <p className="mt-2 tenue">{textos.programaAyuda}</p>

        <ul className="mt-5 flex flex-wrap gap-2.5">
          {(['dias', 'mesas', 'ponencias', 'paises'] as const).map((clave) => (
            <li key={clave} className="ficha-dato flex items-baseline gap-2 px-4 py-2">
              <span className="numero font-serif text-2xl font-bold leading-none">{RESUMEN[clave]}</span>
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
              <span className="mt-0.5 block font-serif text-3xl font-bold leading-none">{Number(d.iso.slice(8))}</span>
              <span className="mt-1.5 block text-xs leading-snug">{d.titulo[idioma]}</span>
            </button>
          ))}
        </div>

        <div
          className="mt-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-3"
          style={{ borderColor: 'var(--borde-fuerte)' }}
        >
          <div>
            <h3 className="font-serif text-xl font-bold">{dia.fecha[idioma]}</h3>
            <p className="mt-0.5 text-sm tenue">{dia.titulo[idioma]}</p>
            {/* La barra dorada del programa impreso: es el color de la marca, no
                el de ninguna sala. */}
            <span aria-hidden className="mt-2.5 block h-[3px] w-12 rounded-full" style={{ backgroundColor: 'var(--acento)' }} />
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

        {dia.nota && <p className="mt-3 text-sm leading-relaxed tenue">{dia.nota[idioma]}</p>}

        <ol className="mt-5 space-y-3">
          {agruparPorHorario(dia.sesiones).map((bloque) => {
            const soloFilas = bloque.sesiones.every((s) => s.tipo === 'registro' || s.tipo === 'pausa');
            const paralelas = bloque.sesiones.length > 1;
            // Una sola sala, un solo color: la hora lo lleva. En un bloque
            // paralelo hay dos y la hora se queda neutra, que es lo correcto.
            const salaDelBloque = !paralelas && !soloFilas ? bloque.sesiones[0].sala : undefined;
            return (
              <li key={`${dia.iso}-${bloque.horario}`} className="grid gap-x-6 gap-y-2 sm:grid-cols-[6.5rem_1fr]">
                <p
                  className={`font-mono text-xs font-bold ${soloFilas ? 'sm:pt-2' : 'sm:pt-3.5'} ${
                    salaDelBloque ? `texto-tono ${TONO_SALA[salaDelBloque]}` : ''
                  }`}
                >
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

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a href={urlAgenda} target="_blank" rel="noopener noreferrer" className="boton-secundario">
            {textos.descargarAgenda}
          </a>
          <p className="ayuda !mt-0">{textos.programaNota}</p>
        </div>
      </div>
    </section>
  );
}
