'use client';

import { useId } from 'react';

export interface Opcion { valor: string; etiqueta: string }

/**
 * Qué le dice cada campo al navegador para que ofrezca autocompletar.
 *
 * En un formulario público —y sobre todo en un teléfono— esto es la
 * diferencia entre teclear el nombre, el correo y la institución a mano o
 * aceptarlos de una vez. Sólo están los campos que el navegador sabe
 * rellenar; el resto no lleva nada, que es lo correcto: un `autocomplete`
 * inventado hace que ofrezca datos equivocados.
 */
const AUTOCOMPLETADO: Record<string, string> = {
  nombres: 'given-name',
  apellidos: 'family-name',
  nombre_constancia: 'name',
  correo: 'email',
  telefono_whatsapp: 'tel',
  institucion: 'organization',
  cargo: 'organization-title',
  pais_residencia: 'country-name',
  entidad_federativa: 'address-level1',
  ciudad_residencia: 'address-level2',
  nacionalidad: 'country-name',
};

interface BaseProps {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  className?: string;
  /**
   * Clave del campo en el registro. Se usa como `name` —para que el navegador
   * y los gestores de contraseñas lo reconozcan— y para decidir qué
   * autocompletar ofrecer.
   */
  campo?: string;
}

function Envoltura({
  etiqueta, ayuda, error, requerido, id, children, className = '',
}: BaseProps & { id: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="etiqueta">
        {etiqueta}
        {requerido && <span className="ml-1 text-red-500" aria-hidden>*</span>}
      </label>
      {children}
      {ayuda && !error && <p className="ayuda">{ayuda}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export function CampoTexto({
  valor, onChange, tipo = 'text', marcador, maximo, ...base
}: BaseProps & {
  valor: string;
  onChange: (v: string) => void;
  tipo?: 'text' | 'email' | 'tel' | 'date' | 'time' | 'url' | 'number';
  marcador?: string;
  maximo?: number;
}) {
  const id = useId();
  return (
    <Envoltura {...base} id={id}>
      <input
        id={id}
        name={base.campo}
        autoComplete={base.campo ? AUTOCOMPLETADO[base.campo] : undefined}
        type={tipo}
        className="campo"
        value={valor}
        placeholder={marcador}
        maxLength={maximo}
        required={base.requerido}
        aria-invalid={base.error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Envoltura>
  );
}

export function CampoParrafo({
  valor, onChange, filas = 4, maximo, contador, textoContador, ...base
}: BaseProps & {
  valor: string;
  onChange: (v: string) => void;
  filas?: number;
  maximo?: number;
  contador?: boolean;
  textoContador?: string;
}) {
  const id = useId();
  return (
    <Envoltura {...base} id={id}>
      <textarea
        id={id}
        rows={filas}
        className="campo resize-y"
        value={valor}
        maxLength={maximo}
        required={base.requerido}
        aria-invalid={base.error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {contador && (
        <p className={`ayuda text-right ${maximo && valor.length > maximo ? '!text-red-500' : ''}`}>
          {textoContador}
        </p>
      )}
    </Envoltura>
  );
}

export function CampoSeleccion({
  valor, onChange, opciones, marcador, ...base
}: BaseProps & {
  valor: string;
  onChange: (v: string) => void;
  opciones: readonly Opcion[];
  marcador?: string;
}) {
  const id = useId();
  return (
    <Envoltura {...base} id={id}>
      <select
        id={id}
        className="campo"
        value={valor}
        required={base.requerido}
        aria-invalid={base.error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{marcador ?? '—'}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
        ))}
      </select>
    </Envoltura>
  );
}

export function CampoOpcionUnica({
  valor, onChange, opciones, columnas = 1, ...base
}: BaseProps & {
  valor: string;
  onChange: (v: string) => void;
  opciones: readonly Opcion[];
  columnas?: 1 | 2;
}) {
  const id = useId();
  return (
    <fieldset className={base.className}>
      <legend className="etiqueta">
        {base.etiqueta}
        {base.requerido && <span className="ml-1 text-red-500" aria-hidden>*</span>}
      </legend>
      <div className={`grid gap-2 ${columnas === 2 ? 'sm:grid-cols-2' : ''}`}>
        {opciones.map((o) => (
          <label
            key={o.valor}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition ${
              valor === o.valor ? 'border-ciess-400 bg-ciess-500/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            style={{ borderColor: valor === o.valor ? undefined : 'var(--borde)' }}
          >
            <input
              type="radio"
              name={id}
              className="mt-0.5 accent-ciess-500"
              checked={valor === o.valor}
              onChange={() => onChange(o.valor)}
            />
            <span>{o.etiqueta}</span>
          </label>
        ))}
      </div>
      {base.ayuda && !base.error && <p className="ayuda">{base.ayuda}</p>}
      {base.error && <p className="error" role="alert">{base.error}</p>}
    </fieldset>
  );
}

export function CampoCasillas({
  valores, onChange, opciones, ...base
}: BaseProps & {
  valores: string[];
  onChange: (v: string[]) => void;
  opciones: readonly Opcion[];
}) {
  const alternar = (opcion: string) =>
    onChange(valores.includes(opcion) ? valores.filter((v) => v !== opcion) : [...valores, opcion]);

  return (
    <fieldset className={base.className}>
      <legend className="etiqueta">{base.etiqueta}</legend>
      <div className="grid gap-2">
        {opciones.map((o) => (
          <label
            key={o.valor}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition ${
              valores.includes(o.valor) ? 'border-ciess-400 bg-ciess-500/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            style={{ borderColor: valores.includes(o.valor) ? undefined : 'var(--borde)' }}
          >
            <input
              type="checkbox"
              className="mt-0.5 accent-ciess-500"
              checked={valores.includes(o.valor)}
              onChange={() => alternar(o.valor)}
            />
            <span>{o.etiqueta}</span>
          </label>
        ))}
      </div>
      {base.ayuda && !base.error && <p className="ayuda">{base.ayuda}</p>}
      {base.error && <p className="error" role="alert">{base.error}</p>}
    </fieldset>
  );
}

export function CampoInterruptor({
  valor, onChange, etiqueta, ayuda,
}: {
  valor: boolean;
  onChange: (v: boolean) => void;
  etiqueta: string;
  ayuda?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-ciess-500"
        checked={valor}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">
        {etiqueta}
        {ayuda && <span className="ayuda block">{ayuda}</span>}
      </span>
    </label>
  );
}
