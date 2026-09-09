'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/componentes/proveedores';
import { Ficha } from './tarjeta-grafica';
import { EstadoSincronizacion } from './sincronizacion';
import { interpolar } from '@/i18n';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';

export function PanelCupos({ configuracion }: { configuracion: ConfiguracionPublica }) {
  const { t } = useApp();
  const router = useRouter();

  const [valores, setValores] = useState({
    cupos_presenciales: configuracion.cupos_presenciales?.toString() ?? '',
    cupos_en_linea: configuracion.cupos_en_linea?.toString() ?? '',
    registro_abierto: configuracion.registro_abierto,
    fecha_limite_registro: configuracion.fecha_limite_registro,
    url_agenda: configuracion.url_agenda,
    correo_contacto: configuracion.correo_contacto,
  });
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const restantes =
    configuracion.cupos_presenciales === null
      ? null
      : Math.max(0, configuracion.cupos_presenciales - configuracion.ocupado_presencial);
  const porcentaje =
    configuracion.cupos_presenciales && configuracion.cupos_presenciales > 0
      ? Math.min(100, Math.round((configuracion.ocupado_presencial / configuracion.cupos_presenciales) * 100))
      : 0;

  async function guardar() {
    setGuardando(true);
    setMensaje('');
    const respuesta = await fetch('/api/configuracion-panel', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cupos_presenciales: valores.cupos_presenciales === '' ? null : Number(valores.cupos_presenciales),
        cupos_en_linea: valores.cupos_en_linea === '' ? null : Number(valores.cupos_en_linea),
        registro_abierto: valores.registro_abierto,
        fecha_limite_registro: valores.fecha_limite_registro,
        url_agenda: valores.url_agenda,
        correo_contacto: valores.correo_contacto,
      }),
    });
    const datos = await respuesta.json();
    setMensaje(respuesta.ok ? t.estados.guardado : datos.mensaje ?? t.estados.error);
    if (respuesta.ok) router.refresh();
    setGuardando(false);
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold">{t.panel.cupos.titulo}</h1>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Ficha
          etiqueta={t.panel.kpi.ocupacion}
          valor={`${porcentaje}%`}
          detalle={
            configuracion.cupos_presenciales !== null
              ? interpolar(t.panel.cupos.ocupados, {
                  n: configuracion.ocupado_presencial,
                  total: configuracion.cupos_presenciales,
                })
              : t.modalidad.sinLimite
          }
        />
        <Ficha
          etiqueta={t.modalidad.cuposDisponibles}
          valor={restantes === null ? '∞' : restantes}
        />
        <Ficha etiqueta={t.panel.kpi.enLinea} valor={configuracion.ocupado_en_linea} />
      </div>

      <div className="tarjeta max-w-2xl p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="etiqueta">{t.panel.cupos.presenciales}</span>
            <input
              type="number" min={0} className="campo"
              value={valores.cupos_presenciales}
              onChange={(e) => setValores({ ...valores, cupos_presenciales: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="etiqueta">{t.panel.cupos.enLinea}</span>
            <input
              type="number" min={0} className="campo"
              value={valores.cupos_en_linea}
              onChange={(e) => setValores({ ...valores, cupos_en_linea: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="etiqueta">{t.panel.cupos.fechaLimite}</span>
            <input
              type="date" className="campo"
              value={valores.fecha_limite_registro}
              onChange={(e) => setValores({ ...valores, fecha_limite_registro: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="etiqueta">{t.panel.cupos.correoContacto}</span>
            <input
              type="email" className="campo"
              value={valores.correo_contacto}
              onChange={(e) => setValores({ ...valores, correo_contacto: e.target.value })}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="etiqueta">{t.panel.cupos.urlAgenda}</span>
            <input
              type="url" className="campo"
              value={valores.url_agenda}
              onChange={(e) => setValores({ ...valores, url_agenda: e.target.value })}
            />
          </label>
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 accent-ciess-500"
            checked={valores.registro_abierto}
            onChange={(e) => setValores({ ...valores, registro_abierto: e.target.checked })}
          />
          <span className="text-sm font-medium">{t.panel.cupos.registroAbierto}</span>
        </label>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5" style={{ borderColor: 'var(--borde)' }}>
          <button type="button" className="boton-primario !py-2 !text-sm" onClick={guardar} disabled={guardando}>
            {t.acciones.guardar}
          </button>
          <a href={valores.url_agenda} target="_blank" rel="noreferrer" className="boton-secundario !py-2 !text-xs">
            {t.panel.agenda.descargar}
          </a>
          {mensaje && <span className="text-xs tenue">{mensaje}</span>}
        </div>
        <p className="ayuda mt-3">{t.panel.agenda.provisional}</p>
      </div>

      <EstadoSincronizacion />
    </div>
  );
}
