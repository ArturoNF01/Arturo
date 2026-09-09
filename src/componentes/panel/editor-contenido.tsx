'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { CampoMultilingue, CampoParrafosMultilingue } from './campo-multilingue';
import type { Multilingue, MultilingueLista } from '@/lib/contenido';
import type { Permisos } from '@/lib/servidor/sesion';

type Tabla = 'ejes_tematicos' | 'faqs' | 'aviso_privacidad';

interface Fila {
  clave: string;
  orden: number;
  [campo: string]: unknown;
}

const NUEVA: Record<Tabla, () => Fila> = {
  ejes_tematicos: () => ({ clave: '', nombre: {}, descripcion: {}, orden: 99, activo: true }),
  faqs: () => ({
    clave: '', categoria: {}, pregunta: {}, respuesta: {}, orden: 99, activa: true, provisional: false,
  }),
  aviso_privacidad: () => ({ clave: '', titulo: {}, parrafos: {}, orden: 99, activo: true }),
};

export function EditorContenido({ permisos }: { permisos: Permisos }) {
  const { t } = useApp();
  const [tabla, setTabla] = useState<Tabla>('ejes_tematicos');
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async (destino: Tabla) => {
    setCargando(true);
    const respuesta = await fetch(`/api/contenido?tabla=${destino}`);
    setFilas(respuesta.ok ? await respuesta.json() : []);
    setCargando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar(tabla);
  }, [tabla, cargar]);

  async function guardar(fila: Fila) {
    if (!fila.clave) {
      setMensaje('Indique una clave para identificar el elemento.');
      return;
    }
    setOcupado(true);
    setMensaje('');
    const respuesta = await fetch(`/api/contenido?tabla=${tabla}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fila),
    });
    const datos = await respuesta.json();
    setMensaje(respuesta.ok ? t.estados.guardado : datos.mensaje ?? t.estados.error);
    if (respuesta.ok) await cargar(tabla);
    setOcupado(false);
  }

  async function eliminar(clave: string) {
    if (!window.confirm(`¿Eliminar «${clave}»? La acción queda asentada en la auditoría.`)) return;
    setOcupado(true);
    const respuesta = await fetch(`/api/contenido?tabla=${tabla}&clave=${encodeURIComponent(clave)}`, {
      method: 'DELETE',
    });
    const datos = await respuesta.json();
    setMensaje(respuesta.ok ? t.estados.guardado : datos.mensaje ?? t.estados.error);
    if (respuesta.ok) await cargar(tabla);
    setOcupado(false);
  }

  async function sembrar() {
    setOcupado(true);
    setMensaje('');
    const respuesta = await fetch('/api/contenido', { method: 'POST' });
    const datos = await respuesta.json();
    setMensaje(
      respuesta.ok
        ? `Sembrado: ${datos.ejes} ejes · ${datos.faqs} preguntas · ${datos.aviso} bloques del aviso`
        : datos.mensaje ?? t.estados.error,
    );
    if (respuesta.ok) await cargar(tabla);
    setOcupado(false);
  }

  function actualizar(clave: string, cambios: Partial<Fila>) {
    setFilas((previas) => previas.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  }

  function agregar() {
    const nueva = NUEVA[tabla]();
    nueva.clave = `nuevo_${Date.now().toString(36)}`;
    setFilas((previas) => [...previas, nueva]);
    setAbierta(nueva.clave);
  }

  const pestanas: { valor: Tabla; texto: string; permitido: boolean }[] = [
    { valor: 'ejes_tematicos', texto: 'Ejes temáticos', permitido: permisos.editarConfiguracion },
    { valor: 'faqs', texto: t.nav.faqs, permitido: permisos.editarConfiguracion },
    { valor: 'aviso_privacidad', texto: t.nav.privacidad, permitido: permisos.gestionarUsuarios },
  ];

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold">Contenido del sitio</h1>
        <p className="ayuda !mt-1">
          Los valores que trae el sistema son propuestas del equipo de desarrollo. Edítelos aquí y
          quedan publicados de inmediato en el formulario y en las páginas públicas, en los tres
          idiomas. Una pestaña de idioma en ámbar señala que ese idioma todavía no está traducido.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {pestanas.map((p) => (
          <button
            key={p.valor}
            type="button"
            disabled={!p.permitido}
            onClick={() => { setTabla(p.valor); setAbierta(null); }}
            aria-pressed={tabla === p.valor}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tabla === p.valor ? 'bg-ciess-500 text-white' : 'boton-secundario'
            } ${p.permitido ? '' : 'opacity-50'}`}
          >
            {p.texto}
          </button>
        ))}

        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="boton-secundario !py-1.5 !text-xs" onClick={sembrar} disabled={ocupado}>
            Sembrar propuestas
          </button>
          <button type="button" className="boton-primario !py-1.5 !text-xs" onClick={agregar} disabled={ocupado}>
            Añadir
          </button>
        </div>
      </div>

      {mensaje && <p className="mb-4 text-sm tenue">{mensaje}</p>}

      {cargando ? (
        <p className="py-16 text-center text-sm tenue">{t.estados.cargando}</p>
      ) : filas.length === 0 ? (
        <div className="tarjeta p-6 text-center">
          <p className="text-sm tenue">
            Esta sección todavía usa las propuestas incluidas en el sistema. Pulse
            <strong className="mx-1">Sembrar propuestas</strong>
            para copiarlas a la base y poder editarlas.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filas.map((fila) => (
            <article key={fila.clave} className="tarjeta overflow-hidden">
              <div className="flex items-center gap-3 p-3.5">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setAbierta(abierta === fila.clave ? null : fila.clave)}
                  aria-expanded={abierta === fila.clave}
                >
                  <span className="block truncate text-sm font-medium">
                    {resumen(tabla, fila) || fila.clave}
                  </span>
                  <span className="block truncate font-mono text-[11px] tenue">{fila.clave}</span>
                </button>

                {'provisional' in fila && Boolean(fila.provisional) && (
                  <span className="insignia bg-amber-500/15 text-amber-500">Provisional</span>
                )}
                <span className="text-xs tabular-nums tenue">#{fila.orden}</span>
              </div>

              {abierta === fila.clave && (
                <div className="space-y-4 border-t p-4" style={{ borderColor: 'var(--borde)' }}>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="block">
                      <span className="etiqueta">Clave</span>
                      <input
                        className="campo font-mono text-xs"
                        value={fila.clave}
                        onChange={(e) => actualizar(fila.clave, { clave: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="etiqueta">Orden</span>
                      <input
                        type="number" min={0} className="campo"
                        value={fila.orden}
                        onChange={(e) => actualizar(fila.clave, { orden: Number(e.target.value) })}
                      />
                    </label>
                    <label className="flex items-end gap-2 pb-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-ciess-500"
                        checked={Boolean(fila.activo ?? fila.activa)}
                        onChange={(e) =>
                          actualizar(fila.clave, tabla === 'faqs'
                            ? { activa: e.target.checked }
                            : { activo: e.target.checked })
                        }
                      />
                      <span className="text-sm">Visible</span>
                    </label>
                  </div>

                  {tabla === 'ejes_tematicos' && (
                    <>
                      <CampoMultilingue
                        etiqueta="Nombre del eje"
                        valor={fila.nombre as Multilingue}
                        onChange={(v) => actualizar(fila.clave, { nombre: v })}
                        maximo={200}
                      />
                      <CampoMultilingue
                        etiqueta="Descripción"
                        valor={fila.descripcion as Multilingue}
                        onChange={(v) => actualizar(fila.clave, { descripcion: v })}
                        filas={3}
                        maximo={600}
                      />
                    </>
                  )}

                  {tabla === 'faqs' && (
                    <>
                      <CampoMultilingue
                        etiqueta="Categoría"
                        valor={fila.categoria as Multilingue}
                        onChange={(v) => actualizar(fila.clave, { categoria: v })}
                        maximo={80}
                      />
                      <CampoMultilingue
                        etiqueta="Pregunta"
                        valor={fila.pregunta as Multilingue}
                        onChange={(v) => actualizar(fila.clave, { pregunta: v })}
                        maximo={300}
                      />
                      <CampoMultilingue
                        etiqueta="Respuesta"
                        valor={fila.respuesta as Multilingue}
                        onChange={(v) => actualizar(fila.clave, { respuesta: v })}
                        filas={5}
                        maximo={4000}
                      />
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-ciess-500"
                          checked={Boolean(fila.provisional)}
                          onChange={(e) => actualizar(fila.clave, { provisional: e.target.checked })}
                        />
                        <span className="text-sm">
                          Provisional · depende de la convocatoria o la agenda definitiva
                        </span>
                      </label>
                    </>
                  )}

                  {tabla === 'aviso_privacidad' && (
                    <>
                      <CampoMultilingue
                        etiqueta="Título del apartado"
                        valor={fila.titulo as Multilingue}
                        onChange={(v) => actualizar(fila.clave, { titulo: v })}
                        maximo={200}
                      />
                      <CampoParrafosMultilingue
                        etiqueta="Párrafos"
                        valor={fila.parrafos as MultilingueLista}
                        onChange={(v) => actualizar(fila.clave, { parrafos: v })}
                      />
                    </>
                  )}

                  <div className="flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'var(--borde)' }}>
                    <button
                      type="button"
                      className="boton-primario !py-2 !text-sm"
                      onClick={() => guardar(fila)}
                      disabled={ocupado}
                    >
                      {t.acciones.guardar}
                    </button>
                    <button
                      type="button"
                      className="boton-peligro !py-2 !text-xs"
                      onClick={() => eliminar(fila.clave)}
                      disabled={ocupado}
                    >
                      {t.acciones.eliminar}
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/** Texto corto que identifica la fila en la lista plegada. */
function resumen(tabla: Tabla, fila: Fila): string {
  const español = (campo: unknown) => (campo as Multilingue | undefined)?.es ?? '';
  if (tabla === 'ejes_tematicos') return español(fila.nombre);
  if (tabla === 'faqs') return español(fila.pregunta);
  return español(fila.titulo);
}
