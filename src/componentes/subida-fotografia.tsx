'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useApp } from './proveedores';
import { CONFIG } from '@/lib/config';
import { interpolar } from '@/i18n';

export function SubidaFotografia({
  valorUrl, onSubida, onQuitar,
}: {
  valorUrl: string;
  onSubida: (url: string, driveId: string) => void;
  onQuitar: () => void;
}) {
  const { t } = useApp();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [vistaPrevia, setVistaPrevia] = useState('');

  async function manejarArchivo(archivo: File | undefined) {
    if (!archivo) return;
    setError('');

    if (!['image/jpeg', 'image/png'].includes(archivo.type)) {
      setError(t.formulario.validacion.archivoTipo);
      return;
    }
    if (archivo.size > CONFIG.fotoMegabytesMaximo * 1024 * 1024) {
      setError(interpolar(t.formulario.validacion.archivoGrande, { mb: CONFIG.fotoMegabytesMaximo }));
      return;
    }

    setSubiendo(true);
    try {
      const cuerpo = new FormData();
      cuerpo.append('archivo', archivo);
      const respuesta = await fetch('/api/archivos', { method: 'POST', body: cuerpo });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos.mensaje ?? t.estados.error);
        return;
      }
      setVistaPrevia(URL.createObjectURL(archivo));
      onSubida(datos.url, datos.id);
    } catch {
      setError(t.estados.error);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
      <span className="etiqueta">{t.formulario.campos.foto}</span>
      <div
        className="rounded-lg border border-dashed p-4"
        style={{ borderColor: 'var(--borde)' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void manejarArchivo(e.dataTransfer.files[0]); }}
      >
        {valorUrl ? (
          <div className="flex items-center gap-4">
            {vistaPrevia && (
              <Image src={vistaPrevia} alt="" width={64} height={80} unoptimized className="h-20 w-16 rounded object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <a href={valorUrl} target="_blank" rel="noreferrer" className="block truncate text-sm text-ciess-400 underline">
                {valorUrl}
              </a>
            </div>
            <button type="button" className="boton-secundario !py-1.5 !text-xs" onClick={() => { setVistaPrevia(''); onQuitar(); }}>
              {t.acciones.eliminar}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <button
              type="button"
              className="boton-secundario"
              onClick={() => entrada.current?.click()}
              disabled={subiendo}
            >
              {subiendo ? t.estados.enviando : t.acciones.buscar}
            </button>
            <input
              ref={entrada}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => void manejarArchivo(e.target.files?.[0])}
            />
          </div>
        )}
      </div>
      <p className="ayuda">{interpolar(t.formulario.campos.fotoAyuda, { mb: CONFIG.fotoMegabytesMaximo })}</p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
