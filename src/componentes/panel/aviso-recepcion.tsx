'use client';

import { useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import { LARGO_MAXIMO_DE_AVISO, type Texto } from '@/lib/recepcion';

const IDIOMAS = [['es', 'Español'], ['en', 'English'], ['pt', 'Português']] as const;

const hayAviso = (t: Texto) => Boolean(t.es.trim() || t.en.trim() || t.pt.trim());

/**
 * El aviso de la pantalla de recepción (`/qr`): un mensaje corto —un cambio de sala, un retraso, el Wi-Fi— que el comité
 * escribe aquí y la pantalla enseña arriba de «En vivo ahora», en los tres idiomas. La agenda de la pantalla sale del
 * programa y no sabe si una sesión se retrasó; esto es lo que sí lo dice, sin esperar a un despliegue.
 *
 * Se guarda con la misma ruta que el resto de la configuración (`/api/configuracion-panel`): queda en la auditoría, con
 * quién lo puso y cuándo.
 */
export function AvisoRecepcion({ inicial }: { inicial: Texto }) {
  const { t } = useApp();
  const a = t.panel.asistencia;

  const [valores, setValores] = useState<Texto>(inicial);
  const [publicado, setPublicado] = useState<Texto>(inicial);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function enviar(nuevo: Texto, exito: string) {
    setGuardando(true);
    setMensaje('');
    setError(false);
    try {
      const respuesta = await fetch('/api/configuracion-panel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aviso_recepcion: nuevo }),
      });
      if (!respuesta.ok) throw new Error('no se guardó');
      setPublicado(nuevo);
      setValores(nuevo);
      setMensaje(exito);
    } catch {
      setError(true);
      setMensaje(a.avisoError);
    } finally {
      setGuardando(false);
    }
  }

  const publicar = () => {
    const limpio: Texto = { es: valores.es.trim(), en: valores.en.trim(), pt: valores.pt.trim() };
    if (!hayAviso(limpio)) {
      setError(true);
      setMensaje(a.avisoVacio);
      return;
    }
    void enviar(limpio, a.avisoPublicado);
  };
  const quitar = () => void enviar({ es: '', en: '', pt: '' }, a.avisoQuitado);

  return (
    <div className="tarjeta space-y-3 p-4">
      <div>
        <h3 className="text-sm font-semibold">{a.avisoTitulo}</h3>
        <p className="mt-1 text-sm">{a.avisoAyuda}</p>
        <p className="mt-1 text-xs tenue" role="status">{hayAviso(publicado) ? a.avisoActivo : a.avisoSin}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {IDIOMAS.map(([clave, nombre]) => (
          <label key={clave} className="block">
            <span className="etiqueta">{nombre}</span>
            <textarea
              className="campo" rows={3} maxLength={LARGO_MAXIMO_DE_AVISO} value={valores[clave]}
              onChange={(e) => setValores({ ...valores, [clave]: e.target.value })}
            />
            <span className="ayuda">{valores[clave].length}/{LARGO_MAXIMO_DE_AVISO}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="boton-primario !py-2 !text-sm" disabled={guardando} onClick={publicar}>{a.avisoPublicar}</button>
        <button type="button" className="boton-secundario !py-2 !text-sm" disabled={guardando || !hayAviso(publicado)} onClick={quitar}>{a.avisoQuitar}</button>
        {mensaje && <span className={`text-xs ${error ? 'text-red-600' : 'tenue'}`} role="status">{mensaje}</span>}
      </div>
    </div>
  );
}
