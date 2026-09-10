'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/componentes/proveedores';
import { Ficha } from './tarjeta-grafica';
import { EstadoSincronizacion } from './sincronizacion';
import { ListaEspera } from './lista-espera';
import { interpolar } from '@/i18n';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';
import type { DatosCongreso } from '@/lib/contenido';
import { CampoMultilingue } from './campo-multilingue';
import { SeccionRecordatorios } from './recordatorios';
import type { EstadoRecordatorios } from '@/lib/servidor/recordatorios';

/**
 * Comprueba que la URL del video se puede reproducir desde el navegador.
 * Es la única forma de saberlo: el servidor puede alcanzar un archivo que el
 * navegador de un participante no, por CORS o por protección de enlaces.
 */
function PruebaVideo({ url }: { url: string }) {
  const [estado, setEstado] = useState<'sin_probar' | 'probando' | 'ok' | 'falla'>('sin_probar');

  if (!url) return null;

  return (
    <div className="mt-2">
      {estado === 'sin_probar' && (
        <button
          type="button"
          className="boton-secundario !px-3 !py-1.5 !text-xs"
          onClick={() => setEstado('probando')}
        >
          Probar el video
        </button>
      )}

      {estado !== 'sin_probar' && (
        <div className="flex flex-wrap items-center gap-3">
          <video
            className="h-20 w-36 rounded-lg object-cover"
            style={{ backgroundColor: 'var(--fondo)' }}
            src={url}
            muted
            playsInline
            autoPlay
            loop
            onCanPlay={() => setEstado('ok')}
            onError={() => setEstado('falla')}
          />
          <p className="text-xs" style={{ color: estado === 'falla' ? 'var(--texto)' : undefined }}>
            {estado === 'probando' && <span className="tenue">Cargando…</span>}
            {estado === 'ok' && <span className="text-emerald-500">Se reproduce correctamente.</span>}
            {estado === 'falla' && (
              <span className="text-amber-500">
                El navegador no pudo cargarlo. Suele ser que el servidor del archivo bloquea
                enlaces externos o que la dirección ya no existe. Súbalo a Cloudflare R2, a
                Vercel Blob o a la carpeta <code>public/</code> del proyecto.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export function PanelCupos({
  configuracion,
  congreso,
  recordatorios,
  limiteHuella,
}: {
  configuracion: ConfiguracionPublica;
  congreso: DatosCongreso;
  recordatorios: EstadoRecordatorios;
  limiteHuella: number;
}) {
  const { t } = useApp();
  const router = useRouter();

  const [datos, setDatos] = useState<DatosCongreso>(congreso);
  const [valores, setValores] = useState({
    cupos_presenciales: configuracion.cupos_presenciales?.toString() ?? '',
    cupos_en_linea: configuracion.cupos_en_linea?.toString() ?? '',
    registro_abierto: configuracion.registro_abierto,
    fecha_limite_registro: configuracion.fecha_limite_registro,
    url_agenda: configuracion.url_agenda,
    url_video_login: configuracion.url_video_login,
    correo_contacto: configuracion.correo_contacto,
    limite_registros_por_huella: limiteHuella.toString(),
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
        url_video_login: valores.url_video_login,
        correo_contacto: valores.correo_contacto,
        limite_registros_por_huella: Number(valores.limite_registros_por_huella),
        congreso_nombre: datos.nombre,
        congreso_nombre_corto: datos.nombre_corto,
        congreso_sede: datos.sede,
        congreso_fechas: datos.fechas,
        congreso_fecha_inicio: datos.fecha_inicio,
        congreso_fecha_fin: datos.fecha_fin,
        limite_semblanza_palabras: datos.limite_semblanza_palabras,
        limite_semblanza_caracteres: datos.limite_semblanza_caracteres,
        limite_resumen_caracteres: datos.limite_resumen_caracteres,
        foto_megabytes_maximo: datos.foto_megabytes_maximo,
      }),
    });
    const resultado = await respuesta.json();
    setMensaje(respuesta.ok ? t.estados.guardado : resultado.mensaje ?? t.estados.error);
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

      <section className="tarjeta mb-5 max-w-2xl p-5">
        <h2 className="titulo-seccion mb-1">Datos del congreso</h2>
        <p className="ayuda !mt-0 mb-5">
          Los valores actuales son una propuesta del equipo de desarrollo. Sustitúyalos por los
          definitivos: se reflejan de inmediato en el formulario, los correos y las páginas públicas.
        </p>

        <div className="space-y-5">
          <CampoMultilingue
            etiqueta="Nombre del congreso"
            valor={datos.nombre}
            onChange={(v) => setDatos({ ...datos, nombre: v })}
            filas={2}
            maximo={300}
          />
          <CampoMultilingue
            etiqueta="Nombre corto"
            valor={datos.nombre_corto}
            onChange={(v) => setDatos({ ...datos, nombre_corto: v })}
            maximo={160}
          />
          <CampoMultilingue
            etiqueta="Sede"
            valor={datos.sede}
            onChange={(v) => setDatos({ ...datos, sede: v })}
            maximo={200}
          />
          <CampoMultilingue
            etiqueta="Fechas, tal como se muestran"
            valor={datos.fechas}
            onChange={(v) => setDatos({ ...datos, fechas: v })}
            ayuda="Texto libre. Ejemplo: 3, 4 y 5 de junio de 2026."
            maximo={120}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="etiqueta">Primer día</span>
              <input
                type="date" className="campo" value={datos.fecha_inicio}
                onChange={(e) => setDatos({ ...datos, fecha_inicio: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="etiqueta">Último día</span>
              <input
                type="date" className="campo" value={datos.fecha_fin}
                onChange={(e) => setDatos({ ...datos, fecha_fin: e.target.value })}
              />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="etiqueta">Semblanza · máximo de palabras</span>
              <input
                type="number" min={10} className="campo" value={datos.limite_semblanza_palabras}
                onChange={(e) => setDatos({ ...datos, limite_semblanza_palabras: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="etiqueta">Semblanza · máximo de caracteres</span>
              <input
                type="number" min={50} className="campo" value={datos.limite_semblanza_caracteres}
                onChange={(e) => setDatos({ ...datos, limite_semblanza_caracteres: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="etiqueta">Resumen · máximo de caracteres</span>
              <input
                type="number" min={100} className="campo" value={datos.limite_resumen_caracteres}
                onChange={(e) => setDatos({ ...datos, limite_resumen_caracteres: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="etiqueta">Fotografía · máximo en MB</span>
              <input
                type="number" min={1} max={50} className="campo" value={datos.foto_megabytes_maximo}
                onChange={(e) => setDatos({ ...datos, foto_megabytes_maximo: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>
      </section>

      <div className="tarjeta max-w-2xl p-5">
        <h2 className="titulo-seccion mb-5">Cupos y registro</h2>
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
          <label className="block sm:col-span-2">
            <span className="etiqueta">Video de fondo (login y formulario)</span>
            <input
              type="url" className="campo"
              value={valores.url_video_login}
              onChange={(e) => setValores({ ...valores, url_video_login: e.target.value })}
            />
            <span className="ayuda">
              Se muestra al 15 % de opacidad. Quien haya pedido menos movimiento en su sistema
              ve sólo el fondo, sin descargar el video. Dejar vacío para quitarlo.
            </span>
            <PruebaVideo url={valores.url_video_login} />
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

      <section className="tarjeta mt-5 max-w-3xl p-5">
        <h2 className="text-sm font-semibold">{t.panel.antiabuso.titulo}</h2>
        <p className="ayuda !mt-1 mb-4">{t.panel.antiabuso.ayuda}</p>
        <label className="block">
          <span className="etiqueta">{t.panel.antiabuso.limite}</span>
          <input
            type="number" min={1} max={1000} className="campo max-w-[10rem]"
            value={valores.limite_registros_por_huella}
            onChange={(e) =>
              setValores({ ...valores, limite_registros_por_huella: e.target.value })
            }
          />
          <span className="ayuda">{t.panel.antiabuso.limiteAyuda}</span>
        </label>
        <div className="mt-5">
          <button type="button" className="boton-primario !py-2 !text-sm" onClick={guardar} disabled={guardando}>
            {t.acciones.guardar}
          </button>
        </div>
      </section>

      <ListaEspera configuracion={configuracion} />
      <SeccionRecordatorios estado={recordatorios} />
      <EstadoSincronizacion />
    </div>
  );
}
