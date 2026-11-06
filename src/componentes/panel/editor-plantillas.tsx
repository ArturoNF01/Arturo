'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { interpolar } from '@/i18n';
import { esPlantillaMasiva } from '@/lib/comunicados';
import { EnvioComunicado } from './envio-comunicado';
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
  comunicado: 'Comunicado: acceso, asistencia y constancias',
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
  // A quién va la prueba. Vacío: a quien está en el panel.
  const [destinatarios, setDestinatarios] = useState('');
  // El correo ya armado, tal como llegará: lo calcula el servidor con el mismo código del envío.
  const [armado, setArmado] = useState<{ asunto: string; html: string } | null>(null);

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
      body: JSON.stringify({ clave, idioma: idiomaPlantilla, ...borrador, destinatarios }),
    });
    const datos = await respuesta.json();
    setMensaje(
      respuesta.ok
        ? interpolar(t.panel.plantillas.pruebaEnviada, { n: String(datos.destinatarios ?? 1) })
        : datos.mensaje ?? t.estados.error,
    );
    setGuardando(false);
  }

  // La vista previa se pide al servidor y no se arma aquí: así el comité ve el correo
  // con su envoltura y sus bloques —lo que de verdad llega—, y no sólo el cuerpo suelto.
  // Se espera un momento tras cada tecla para no pedir uno por letra.
  const asuntoBorrador = borrador?.asunto;
  const cuerpoBorrador = borrador?.cuerpo_html;
  useEffect(() => {
    if (asuntoBorrador === undefined || cuerpoBorrador === undefined) return;
    const espera = setTimeout(() => {
      void fetch('/api/plantillas/vista-previa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave, idioma: idiomaPlantilla, asunto: asuntoBorrador, cuerpo_html: cuerpoBorrador }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((datos: { asunto: string; html: string } | null) => setArmado(datos));
    }, 400);
    return () => clearTimeout(espera);
  }, [clave, idiomaPlantilla, asuntoBorrador, cuerpoBorrador]);

  // ¿Hay algo sin guardar en esta plantilla, en cualquiera de sus idiomas? El envío manda lo guardado.
  const hayCambiosSinGuardar = Object.entries(edicion).some(([llaveEditada, valores]) => {
    const [claveEditada, idiomaEditado] = llaveEditada.split('|');
    const guardada = plantillas.find((p) => p.clave === claveEditada && p.idioma === idiomaEditado);
    return (
      claveEditada === clave && Boolean(guardada) &&
      (guardada!.asunto !== valores.asunto || guardada!.cuerpo_html !== valores.cuerpo_html)
    );
  });

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
            <label className="etiqueta mt-4" htmlFor="destinatarios-prueba">{t.panel.plantillas.pruebaA}</label>
            <input
              id="destinatarios-prueba"
              className="campo"
              inputMode="email"
              autoComplete="off"
              placeholder={t.panel.plantillas.pruebaAPlaceholder}
              value={destinatarios}
              onChange={(e) => setDestinatarios(e.target.value)}
            />
            <p className="ayuda">{t.panel.plantillas.pruebaAyuda}</p>
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
            <h2 className="mb-1 text-sm font-semibold">{t.panel.plantillas.vistaPrevia}</h2>
            <p className="ayuda !mt-0 mb-3">{t.panel.plantillas.vistaPreviaAyuda}</p>
            <p className="mb-3 rounded-lg border p-2.5 text-sm font-medium" style={{ borderColor: 'var(--borde)' }}>
              {armado?.asunto ?? borrador.asunto}
            </p>
            {/* Un iframe sin permisos: el HTML del correo no puede ejecutar nada ni tocar el panel,
                y conserva sus propios estilos sin mezclarse con los del panel. */}
            <iframe
              title={t.panel.plantillas.vistaPrevia}
              sandbox=""
              srcDoc={armado?.html ?? ''}
              className="h-[40rem] w-full rounded-lg border bg-white"
              style={{ borderColor: 'var(--borde)' }}
            />
          </div>
        </div>
      )}

      {/* Sólo las plantillas pensadas para mandarse a mucha gente llevan envío. */}
      {esPlantillaMasiva(clave) && (
        <EnvioComunicado clave={clave} idioma={idiomaPlantilla} sinGuardar={hayCambiosSinGuardar} />
      )}
    </div>
  );
}
