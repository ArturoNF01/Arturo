'use client';

import {
  TEXTOS_RECEPCION as TEXTOS, avance, horaDeMexico, minutosPara, unir,
  type BloqueDeAgenda, type MomentoDelDia, type ProgramaDePantalla, type Texto,
} from '@/lib/recepcion';
import { Triple } from './triple';

const IconoSala = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

function Etiqueta({ textos, vivo }: { textos: Texto; vivo: boolean }) {
  return (
    <span className={`rq-tag ${vivo ? 'rq-tag-vivo' : 'rq-tag-neutra'}`}>
      {vivo ? (
        // El ecualizador: cuatro barras que suben y bajan, para que «en vivo» se vea vivo.
        <span className="rq-barras" aria-hidden><i /><i /><i /><i /></span>
      ) : (
        <i className="rq-punto" aria-hidden />
      )}
      <Triple textos={textos} />
    </span>
  );
}

/** La barra de lo que va de la sesión y cuánto falta. */
function Avance({ bloque, ahora }: { bloque: BloqueDeAgenda; ahora: number }) {
  return (
    <div className="rq-avance">
      <div className="rq-barra"><i style={{ width: `${Math.round(avance(bloque, ahora) * 100)}%` }} /></div>
      <span className="rq-quedan"><Triple textos={TEXTOS.quedan(minutosPara(bloque.fin, ahora))} /></span>
    </div>
  );
}

function FilaDeSesion({ bloque, ahora, lineas, conHorario, conAvance }: {
  bloque: BloqueDeAgenda; ahora: number; lineas: number; conHorario: boolean; conAvance: boolean;
}) {
  return (
    <div className="rq-sesion">
      {(bloque.sala || conHorario) && (
        <div className="rq-sesion-linea">
          {bloque.sala ? <span className="rq-sala"><IconoSala /><Triple textos={bloque.sala} /></span> : <span />}
          {conHorario && <span className="rq-horas">{bloque.horario}</span>}
        </div>
      )}
      {bloque.etiqueta && <p className="rq-sesion-etq"><Triple textos={bloque.etiqueta} /></p>}
      <p className="rq-sesion-titulo"><Triple textos={bloque.titulo} lineas={lineas} /></p>
      {bloque.ponente && lineas > 2 && (
        <p className="rq-ponente"><span className="rq-ponente-etq"><Triple textos={TEXTOS.ponente} /></span>{bloque.ponente}</p>
      )}
      {conAvance && <Avance bloque={bloque} ahora={ahora} />}
    </div>
  );
}

/**
 * «En vivo ahora»: lo que pasa en el Congreso en este momento, en qué sala, cuánto le falta, y lo que sigue.
 *
 * Todo sale de la agenda del día que le llega ya armada y de la hora (la del servidor, corregida): no vuelve a pedir
 * nada, así que sigue cambiando a su hora aunque la red del lugar se caiga. Lo único que no sabe es si una sesión se
 * retrasó; para eso está el aviso.
 *
 * Cuando hay dos salas a la vez (casi siempre con el mismo horario) se enseña una sola barra y un solo horario, en la
 * cabecera: lo mismo dicho dos veces sólo quitaría lugar al QR.
 */
export function EnVivo({
  programa, momento, ahora,
}: {
  programa: ProgramaDePantalla;
  momento: MomentoDelDia;
  ahora: number;
}) {
  const { fase, actuales, siguientes } = momento;
  const hayVivo = actuales.some((b) => b.naturaleza === 'sesion');
  // La llave cambia cuando cambia lo que se enseña: ahí se vuelve a disparar la entrada.
  const llave = `${fase}:${actuales.map((b) => b.clave).join('+')}`;

  const primero = siguientes[0] ?? null;
  const mananaPrimero = fase === 'despues' ? programa.manana : null;
  const proximo = primero ?? mananaPrimero?.bloque ?? null;

  const compartido = actuales.length > 0 && actuales.every((b) => b.inicio === actuales[0].inicio && b.fin === actuales[0].fin);

  let etiqueta: Texto;
  if (fase === 'en_curso') etiqueta = hayVivo ? TEXTOS.enVivo : TEXTOS.ahora;
  else if (fase === 'receso') etiqueta = TEXTOS.receso;
  else if (fase === 'antes') etiqueta = TEXTOS.proximamente;
  else etiqueta = programa.manana ? TEXTOS.hastaManana : TEXTOS.hastaPronto;

  // Los casos sin nada en marcha dicen una frase grande en lugar de una sesión.
  let mensaje: Texto | null = null;
  if (fase === 'antes' && primero) {
    const hora = horaDeMexico(primero.inicio);
    mensaje = programa.relacion === 'hoy' ? TEXTOS.hoyIniciamos(hora) : TEXTOS.iniciaElDia(programa.dia, hora);
  } else if (fase === 'despues') {
    mensaje = TEXTOS.gracias;
  } else if (fase === 'receso' && actuales.length === 0) {
    mensaje = TEXTOS.receso;
  }

  const lineas = actuales.length > 1 ? 2 : 3;

  return (
    <section className={`rq-vivo rq-entrada ${hayVivo ? 'rq-vivo-en-vivo' : ''}`} style={{ ['--retraso' as string]: '0.15s' }} aria-live="polite">
      <div className="rq-vivo-cabecera">
        <Etiqueta textos={etiqueta} vivo={hayVivo} />
        {compartido && <span className="rq-horas">{actuales[0].horario}</span>}
      </div>

      <div key={llave} className="rq-cambio">
        {actuales.length > 0 ? (
          <div className={`rq-sesiones ${actuales.length > 1 ? 'rq-sesiones-dos' : ''}`}>
            {actuales.map((b) => (
              <FilaDeSesion key={b.clave} bloque={b} ahora={ahora} lineas={lineas} conHorario={!compartido} conAvance={!compartido} />
            ))}
            {compartido && <Avance bloque={actuales[0]} ahora={ahora} />}
          </div>
        ) : (
          mensaje && <p className="rq-mensaje"><Triple textos={mensaje} /></p>
        )}
      </div>

      {/* Lo que sigue, con la cuenta regresiva: «en 38 min». Cuando el día ya acabó, lo primero de mañana. */}
      {proximo && (
        <div className="rq-sig">
          <div className="rq-sig-cab">
            <span className="rq-sig-etq"><Triple textos={primero ? TEXTOS.aContinuacion : TEXTOS.manana} /></span>
            <span className="rq-sig-hora">{horaDeMexico(proximo.inicio)}</span>
            {primero && (
              <span className="rq-sig-cuenta"><Triple textos={TEXTOS.en(minutosPara(primero.inicio, ahora))} /></span>
            )}
          </div>
          <ul className="rq-sig-lista">
            {(primero ? siguientes : [proximo]).map((b) => (
              <li key={b.clave}><Triple textos={unir(b.corto, b.sala)} lineas={2} /></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
