'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/componentes/proveedores';
import { BarraFiltros } from './filtros';
import { aplicarFiltros, useRegistros, FILTROS_VACIOS, type Filtros, type RegistroPanel } from './usar-registros';
import { ResumenRegistro } from '@/componentes/resumen-registro';
import { useContenidoPanel } from './contexto-panel';
import { ControlEstado, InsigniaEstado } from './control-estado';
import type { EstadoRegistro } from '@/lib/estados';
import { nombrePerfil } from '@/lib/perfiles';
import { interpolar } from '@/i18n';
import type { Permisos } from '@/lib/servidor/sesion';

const POR_PAGINA = 50;

export function TablaRegistros({ permisos }: { permisos: Permisos }) {
  const { t, idioma } = useApp();
  const { ejes } = useContenidoPanel();
  const parametros = useSearchParams();
  const { registros, cargando, error, recargar } = useRegistros();

  const [filtros, setFiltros] = useState<Filtros>({
    ...FILTROS_VACIOS,
    texto: parametros.get('folio') ?? '',
  });
  const [pagina, setPagina] = useState(0);
  const [detalle, setDetalle] = useState<RegistroPanel | null>(null);
  const [completo, setCompleto] = useState<Record<string, unknown> | null>(null);
  const [mensaje, setMensaje] = useState('');

  const filtrados = useMemo(() => aplicarFiltros(registros, filtros), [registros, filtros]);
  const paginados = useMemo(
    () => filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA),
    [filtrados, pagina],
  );
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));

  async function abrirDetalle(registro: RegistroPanel) {
    setDetalle(registro);
    setCompleto(null);
    const respuesta = await fetch(`/api/registros/${registro.id}`);
    if (respuesta.ok) setCompleto(await respuesta.json());
  }

  async function eliminar(registro: RegistroPanel) {
    if (!window.confirm(interpolar(t.panel.registros.confirmarEliminar, { folio: registro.folio }))) return;
    const respuesta = await fetch(`/api/registros/${registro.id}`, { method: 'DELETE' });
    if (respuesta.ok) {
      setDetalle(null);
      void recargar();
    } else {
      setMensaje(t.panel.registros.sinPermiso);
    }
  }

  const columnas = t.panel.registros.columnas;

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-bold">{t.panel.registros.titulo}</h1>
        {permisos.exportar && (
          <div className="flex flex-wrap gap-2">
            {(['csv', 'xlsx', 'json'] as const).map((formato) => (
              <a key={formato} href={`/api/exportar?formato=${formato}`} className="boton-secundario !py-2 !text-xs">
                {formato === 'xlsx' ? t.panel.exportar.excel : formato.toUpperCase()}
              </a>
            ))}
          </div>
        )}
      </header>

      <BarraFiltros filtros={filtros} onCambio={(f) => { setFiltros(f); setPagina(0); }} registros={registros} resultados={filtrados.length} />

      {mensaje && <p className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{mensaje}</p>}
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {cargando ? (
        <p className="py-16 text-center text-sm tenue">{t.estados.cargando}</p>
      ) : (
        <div className="tarjeta desplazable overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              {/* La cabecera lleva la regla fuerte: separa el encabezado de los
                  datos también en modo oscuro, donde la hairline se pierde. */}
              <tr className="border-b" style={{ borderColor: 'var(--borde-fuerte)' }}>
                {[columnas.folio, columnas.nombre, columnas.perfil, columnas.modalidad,
                  columnas.estado, columnas.institucion, columnas.pais, columnas.fecha,
                  columnas.acciones].map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide tenue">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginados.map((r) => (
                <tr key={r.id} className="border-b transition hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: 'var(--borde)' }}>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">{r.folio}</td>
                  <td className="px-3 py-2.5">{r.nombres} {r.apellidos}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{nombrePerfil(r.perfil, t)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className={`insignia ${
                        r.modalidad === 'presencial'
                          ? 'bg-ciess-500/15 text-ciess-400'
                          : 'bg-emerald-500/15 text-emerald-500'
                      }`}
                    >
                      {r.modalidad === 'presencial' ? t.modalidad.presencial : t.modalidad.en_linea}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <InsigniaEstado estado={r.estado as EstadoRegistro} />
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-2.5">{r.institucion}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{r.pais_residencia}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums tenue">
                    {new Date(r.creado_en).toLocaleDateString(idioma)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <button type="button" className="boton-secundario !px-2 !py-1 !text-xs" onClick={() => void abrirDetalle(r)}>
                      {t.acciones.ver}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button type="button" className="boton-secundario !py-1.5 !text-xs" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
            {t.acciones.anterior}
          </button>
          <span className="text-xs tabular-nums tenue">{pagina + 1} / {totalPaginas}</span>
          <button type="button" className="boton-secundario !py-1.5 !text-xs" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
            {t.acciones.siguiente}
          </button>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4" role="dialog" aria-modal>
          <div className="tarjeta my-8 w-full max-w-3xl p-5 sm:p-6">
            <header className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{t.panel.registros.detalle}</h2>
                <p className="font-mono text-xs tenue">{detalle.folio}</p>
              </div>
              <div className="flex gap-2">
                {permisos.eliminarRegistros && (
                  <button type="button" className="boton-peligro !py-1.5 !text-xs" onClick={() => void eliminar(detalle)}>
                    {t.acciones.eliminar}
                  </button>
                )}
                <button type="button" className="boton-secundario !py-1.5 !text-xs" onClick={() => setDetalle(null)}>
                  {t.acciones.cerrar}
                </button>
              </div>
            </header>
            {permisos.editarRegistros && (
              <div className="mb-5">
                <ControlEstado
                  id={detalle.id}
                  estado={detalle.estado as EstadoRegistro}
                  onCambio={() => {
                    void recargar();
                    setDetalle(null);
                  }}
                />
              </div>
            )}

            {completo ? (
              <ResumenRegistro registro={completo} ejes={ejes} />
            ) : (
              <p className="py-8 text-center text-sm tenue">{t.estados.cargando}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
