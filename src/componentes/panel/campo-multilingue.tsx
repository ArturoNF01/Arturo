'use client';

import { useState } from 'react';
import { IDIOMAS, diccionarios, type Idioma } from '@/i18n';
import type { Multilingue, MultilingueLista } from '@/lib/contenido';

/**
 * Campo de texto con una pestaña por idioma. El valor viaja como
 * {es, en, pt}; los idiomas sin traducir caen al español al mostrarse.
 */
export function CampoMultilingue({
  etiqueta, valor, onChange, ayuda, filas, maximo,
}: {
  etiqueta: string;
  valor: Multilingue;
  onChange: (valor: Multilingue) => void;
  ayuda?: string;
  /** Si se indica, se usa un área de texto de ese número de filas. */
  filas?: number;
  maximo?: number;
}) {
  const [activo, setActivo] = useState<Idioma>('es');
  const texto = valor[activo] ?? '';

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="etiqueta !mb-0">{etiqueta}</span>
        <PestanasIdioma activo={activo} onCambio={setActivo} valores={valor} />
      </div>
      {filas ? (
        <textarea
          rows={filas}
          maxLength={maximo}
          className="campo resize-y"
          value={texto}
          onChange={(e) => onChange({ ...valor, [activo]: e.target.value })}
        />
      ) : (
        <input
          className="campo"
          maxLength={maximo}
          value={texto}
          onChange={(e) => onChange({ ...valor, [activo]: e.target.value })}
        />
      )}
      {ayuda && <p className="ayuda">{ayuda}</p>}
    </div>
  );
}

/** Lista de párrafos por idioma: uno por línea en blanco. */
export function CampoParrafosMultilingue({
  etiqueta, valor, onChange, ayuda,
}: {
  etiqueta: string;
  valor: MultilingueLista;
  onChange: (valor: MultilingueLista) => void;
  ayuda?: string;
}) {
  const [activo, setActivo] = useState<Idioma>('es');
  const parrafos = valor[activo] ?? [];

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="etiqueta !mb-0">{etiqueta}</span>
        <PestanasIdioma
          activo={activo}
          onCambio={setActivo}
          valores={Object.fromEntries(
            IDIOMAS.map((i) => [i, (valor[i] ?? []).join('')]),
          ) as Multilingue}
        />
      </div>
      <textarea
        rows={8}
        className="campo resize-y"
        value={parrafos.join('\n\n')}
        onChange={(e) =>
          onChange({
            ...valor,
            [activo]: e.target.value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
          })
        }
      />
      <p className="ayuda">
        {ayuda ?? 'Separe cada párrafo con una línea en blanco.'} · {parrafos.length} párrafos
      </p>
    </div>
  );
}

function PestanasIdioma({
  activo, onCambio, valores,
}: {
  activo: Idioma;
  onCambio: (idioma: Idioma) => void;
  valores: Multilingue;
}) {
  return (
    <div className="flex gap-1">
      {IDIOMAS.map((codigo) => {
        const traducido = Boolean(valores[codigo]?.trim());
        return (
          <button
            key={codigo}
            type="button"
            onClick={() => onCambio(codigo)}
            aria-pressed={activo === codigo}
            title={diccionarios[codigo].meta.nombre}
            className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase transition ${
              activo === codigo
                ? 'bg-ciess-500 text-white'
                : traducido
                  ? 'tenue hover:bg-black/5 dark:hover:bg-white/10'
                  : 'text-amber-500 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            {codigo}
            {!traducido && <span aria-hidden> ·</span>}
          </button>
        );
      })}
    </div>
  );
}
