'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/componentes/proveedores';
import { nombrePerfil } from '@/lib/perfiles';
import {
  ESTADOS_PONENCIA, calcularAvance, comentariosObligatorios, dictamenResuelto,
  type EstadoPonencia,
} from '@/lib/dictamen';
import { Ficha } from './tarjeta-grafica';
import { useContenidoPanel } from './contexto-panel';
import type { Ponencia } from '@/lib/servidor/ponencias';

/** Color de la insignia según el sentido del dictamen. */
const TONO: Record<EstadoPonencia, string> = {
  sin_dictamen: 'bg-black/10 text-[color:var(--texto-tenue)] dark:bg-white/10',
  en_revision: 'bg-sky-500/15 text-sky-500',
  aceptada: 'bg-emerald-500/15 text-emerald-500',
  aceptada_con_cambios: 'bg-amber-500/15 text-amber-500',
  rechazada: 'bg-rose-500/15 text-rose-500',
};

/**
 * Dictamen de las propuestas por el comité científico.
 *
 * Cada propuesta se muestra completa —resumen incluido— porque dictaminar sin
 * leer el texto no tiene sentido, y el comentario viaja en el correo que
 * recibe la persona autora.
 */
export function DictamenPonencias({ ponencias }: { ponencias: Ponencia[] }) {
  const { t, idioma } = useApp();
  const router = useRouter();
  const { nombreEje } = useContenidoPanel();

  const [filtro, setFiltro] = useState<EstadoPonencia | 'todas'>('todas');
  const [avisar, setAvisar] = useState(true);

  const avance = useMemo(
    () => calcularAvance(ponencias.map((p) => p.estado_ponencia)),
    [ponencias],
  );

  const visibles = useMemo(
    () => (filtro === 'todas' ? ponencias : ponencias.filter((p) => p.estado_ponencia === filtro)),
    [ponencias, filtro],
  );

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold">{t.panel.dictamen.titulo}</h1>
        <p className="ayuda">{t.panel.dictamen.ayuda}</p>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Ficha etiqueta={t.panel.dictamen.recibidas} valor={avance.total} />
        <Ficha etiqueta={t.panel.dictamen.pendientes} valor={avance.pendientes} />
        <Ficha etiqueta={t.panel.dictamen.resueltas} valor={avance.resueltas} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <BotonFiltro activo={filtro === 'todas'} onClick={() => setFiltro('todas')}>
          {t.panel.filtros.todos} ({avance.total})
        </BotonFiltro>
        {ESTADOS_PONENCIA.map((estado) => (
          <BotonFiltro key={estado} activo={filtro === estado} onClick={() => setFiltro(estado)}>
            {t.panel.dictamen[estado]} ({avance.porEstado[estado]})
          </BotonFiltro>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-ciess-500"
            checked={avisar}
            onChange={(e) => setAvisar(e.target.checked)}
          />
          <span className="text-xs tenue">{t.panel.dictamen.avisar}</span>
        </label>
      </div>

      {visibles.length === 0 ? (
        <p className="tarjeta p-6 text-sm tenue">{t.panel.dictamen.sinPonencias}</p>
      ) : (
        <ul className="space-y-4">
          {visibles.map((ponencia) => (
            <FichaPonencia
              key={ponencia.id}
              ponencia={ponencia}
              avisar={avisar}
              nombreEje={nombreEje}
              idioma={idioma}
              onGuardado={() => router.refresh()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BotonFiltro({
  activo, onClick, children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        activo ? 'bg-ciess-500 text-white' : 'boton-secundario !rounded-full !px-3 !py-1.5'
      }`}
    >
      {children}
    </button>
  );
}

function FichaPonencia({
  ponencia, avisar, nombreEje, idioma, onGuardado,
}: {
  ponencia: Ponencia;
  avisar: boolean;
  nombreEje: (clave: string | null | undefined) => string;
  idioma: string;
  onGuardado: () => void;
}) {
  const { t } = useApp();
  // Lo que falta dictaminar se abre con el resumen a la vista: es el texto
  // que hay que leer para decidir. Lo ya resuelto queda plegado.
  const [abierta, setAbierta] = useState(!dictamenResuelto(ponencia.estado_ponencia));
  const [comentarios, setComentarios] = useState(ponencia.dictamen_comentarios ?? '');
  const [enviando, setEnviando] = useState<EstadoPonencia | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);
  const cajaComentarios = useRef<HTMLTextAreaElement>(null);

  async function dictaminar(estado: EstadoPonencia) {
    if (comentariosObligatorios(estado) && !comentarios.trim()) {
      setMensaje(t.panel.dictamen.faltanComentarios);
      setEsError(true);
      cajaComentarios.current?.focus();
      return;
    }
    setEnviando(estado);
    setMensaje('');
    setEsError(false);
    const respuesta = await fetch(`/api/registros/${ponencia.id}/dictamen`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado_ponencia: estado, comentarios, avisar }),
    });
    const resultado = await respuesta.json().catch(() => ({}));
    setMensaje(respuesta.ok ? t.panel.dictamen.guardado : resultado.mensaje ?? t.estados.error);
    setEsError(!respuesta.ok);
    setEnviando(null);
    if (respuesta.ok) onGuardado();
  }

  const estado = ponencia.estado_ponencia;

  return (
    <li className="tarjeta p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[16rem] flex-1">
          <h2 className="text-sm font-semibold">{ponencia.titulo_ponencia || '—'}</h2>
          <p className="ayuda !mt-1">
            {ponencia.nombres} {ponencia.apellidos} ·{' '}
            <span className="font-mono text-[11px]">{ponencia.folio}</span> ·{' '}
            {nombrePerfil(ponencia.perfil, t)}
            {ponencia.institucion ? ` · ${ponencia.institucion}` : ''}
            {ponencia.pais_residencia ? ` · ${ponencia.pais_residencia}` : ''} ·{' '}
            {new Date(ponencia.creado_en).toLocaleDateString(idioma)}
          </p>
          {ponencia.eje_tematico && (
            <p className="ayuda !mt-1">
              {t.formulario.campos.ejeTematico}: {nombreEje(ponencia.eje_tematico)}
            </p>
          )}
        </div>
        <span className={`insignia shrink-0 ${TONO[estado]}`}>{t.panel.dictamen[estado]}</span>
      </header>

      {ponencia.resumen_ponencia && (
        <details className="mb-3" open={abierta} onToggle={(e) => setAbierta(e.currentTarget.open)}>
          <summary className="cursor-pointer text-xs font-medium text-ciess-400">
            {t.panel.dictamen.resumen}
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
            {ponencia.resumen_ponencia}
          </p>
          {ponencia.palabras_clave && (
            <p className="ayuda !mt-2">
              {t.panel.dictamen.palabrasClave}: {ponencia.palabras_clave}
            </p>
          )}
          {ponencia.coautoria && (
            <p className="ayuda !mt-1">
              {t.panel.dictamen.coautoria}: {ponencia.coautoria}
            </p>
          )}
        </details>
      )}

      <label className="block">
        <span className="etiqueta">{t.panel.dictamen.comentarios}</span>
        <textarea
          ref={cajaComentarios}
          className="campo"
          rows={3}
          maxLength={5000}
          value={comentarios}
          onChange={(e) => setComentarios(e.target.value)}
        />
        <span className="ayuda">{t.panel.dictamen.comentariosAyuda}</span>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {ESTADOS_PONENCIA.filter((e) => e !== estado).map((opcion) => (
          <button
            key={opcion}
            type="button"
            className="boton-secundario !px-3 !py-1.5 !text-xs"
            disabled={enviando !== null}
            onClick={() => dictaminar(opcion)}
          >
            {enviando === opcion ? t.estados.enviando : t.panel.dictamen.verbo[opcion]}
          </button>
        ))}
        {mensaje && (
          <span
            role={esError ? 'alert' : 'status'}
            className={`text-xs ${esError ? 'text-amber-500' : 'tenue'}`}
          >
            {mensaje}
          </span>
        )}
      </div>

      {ponencia.dictamen_en && (
        <p className="ayuda !mt-3">
          {t.panel.dictamen.dictaminadaPor}: {ponencia.dictamen_por_correo ?? '—'} ·{' '}
          {new Date(ponencia.dictamen_en).toLocaleString(idioma)}
        </p>
      )}
    </li>
  );
}
