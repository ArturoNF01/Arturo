'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { IDIOMAS, diccionarios, type Idioma } from '@/i18n';

interface Plantilla {
  clave: string;
  idioma: Idioma;
  asunto: string;
  cuerpo_html: string;
  actualizado_en: string;
}

const NOMBRES_CLAVE: Record<string, string> = {
  confirmacion_registro: 'Confirmación de registro',
  edicion_registro: 'Registro actualizado',
  lista_espera: 'Lista de espera',
};

export function EditorPlantillas() {
  const { t } = useApp();
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [clave, setClave] = useState('confirmacion_registro');
  const [idiomaPlantilla, setIdiomaPlantilla] = useState<Idioma>('es');
  // Los cambios sin guardar viven en un mapa por plantilla e idioma, de modo
  // que cambiar de pestaña no los descarte ni haya que sincronizar estado
  // derivado con un efecto.
  const [edicion, setEdicion] = useState<Record<string, { asunto: string; cuerpo_html: string }>>({});
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void fetch('/api/plantillas')
      .then((r) => r.json())
      .then((datos: Plantilla[]) => setPlantillas(datos));
  }, []);

  const llave = `${clave}|${idiomaPlantilla}`;
  const actual = plantillas.find((p) => p.clave === clave && p.idioma === idiomaPlantilla);
  const borrador =
    edicion[llave] ?? (actual ? { asunto: actual.asunto, cuerpo_html: actual.cuerpo_html } : null);
  const sinGuardar =
    Boolean(actual && edicion[llave]) &&
    (edicion[llave].asunto !== actual!.asunto || edicion[llave].cuerpo_html !== actual!.cuerpo_html);

  const setBorrador = (valores: { asunto: string; cuerpo_html: string }) =>
    setEdicion((previa) => ({ ...previa, [llave]: valores }));

  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    setMensaje('');
    const respuesta = await fetch('/api/plantillas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, idioma: idiomaPlantilla, ...borrador }),
    });
    const datos = await respuesta.json();
    setMensaje(respuesta.ok ? t.estados.guardado : datos.mensaje ?? t.estados.error);
    if (respuesta.ok) {
      setPlantillas((previas) =>
        previas.map((p) =>
          p.clave === clave && p.idioma === idiomaPlantilla ? { ...p, ...borrador } : p,
        ),
      );
      setEdicion((previa) => {
        const resto = { ...previa };
        delete resto[llave];
        return resto;
      });
    }
    setGuardando(false);
  }

  async function enviarPrueba() {
    if (!borrador) return;
    setGuardando(true);
    const respuesta = await fetch('/api/plantillas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, idioma: idiomaPlantilla, ...borrador }),
    });
    const datos = await respuesta.json();
    setMensaje(respuesta.ok ? t.estados.guardado : datos.mensaje ?? t.estados.error);
    setGuardando(false);
  }

  const claves = [...new Set(plantillas.map((p) => p.clave))];

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold">{t.panel.plantillas.titulo}</h1>
        <p className="ayuda !mt-1">{t.panel.plantillas.ayuda}</p>
      </header>

      <div className="mb-4 flex flex-wrap gap-4">
        <div>
          <span className="mb-1.5 block text-[11px] uppercase tracking-wide tenue">
            {t.panel.plantillas.titulo}
          </span>
          <div className="flex flex-wrap gap-2">
            {claves.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setClave(c)}
                aria-pressed={clave === c}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  clave === c ? 'bg-ciess-500 text-white' : 'boton-secundario'
                }`}
              >
                {NOMBRES_CLAVE[c] ?? c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-[11px] uppercase tracking-wide tenue">{t.idiomaSelector}</span>
          <div className="flex gap-2">
            {IDIOMAS.map((codigo) => (
              <button
                key={codigo}
                type="button"
                onClick={() => setIdiomaPlantilla(codigo)}
                aria-pressed={idiomaPlantilla === codigo}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase transition ${
                  idiomaPlantilla === codigo ? 'bg-ciess-500 text-white' : 'boton-secundario'
                }`}
              >
                {diccionarios[codigo].meta.bandera} {codigo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!borrador ? (
        <p className="py-16 text-center text-sm tenue">{t.estados.cargando}</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="tarjeta p-4">
            <label className="etiqueta" htmlFor="asunto">{t.panel.plantillas.asunto}</label>
            <input
              id="asunto"
              className="campo"
              value={borrador.asunto}
              onChange={(e) => setBorrador({ ...borrador, asunto: e.target.value })}
            />
            <label className="etiqueta mt-4" htmlFor="cuerpo">{t.panel.plantillas.cuerpo}</label>
            <textarea
              id="cuerpo"
              rows={18}
              spellCheck={false}
              className="campo desplazable resize-y font-mono text-xs leading-relaxed"
              value={borrador.cuerpo_html}
              onChange={(e) => setBorrador({ ...borrador, cuerpo_html: e.target.value })}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className="boton-primario !py-2 !text-sm" onClick={guardar} disabled={guardando}>
                {t.acciones.guardar}
              </button>
              <button type="button" className="boton-secundario !py-2 !text-xs" onClick={enviarPrueba} disabled={guardando}>
                {t.panel.plantillas.enviarPrueba}
              </button>
              {sinGuardar && <span className="text-xs text-amber-500">Cambios sin guardar</span>}
              {mensaje && <span className="text-xs tenue">{mensaje}</span>}
            </div>
          </div>

          <div className="tarjeta p-4">
            <h2 className="mb-3 text-sm font-semibold">{t.panel.plantillas.vistaPrevia}</h2>
            <p className="mb-3 rounded-lg border p-2.5 text-sm font-medium" style={{ borderColor: 'var(--borde)' }}>
              {borrador.asunto}
            </p>
            <div
              className="desplazable max-h-[36rem] overflow-auto rounded-lg bg-white p-4 text-sm text-[#16283d]"
              // La vista previa muestra la plantilla tal como llegará al correo.
              dangerouslySetInnerHTML={{ __html: borrador.cuerpo_html }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
