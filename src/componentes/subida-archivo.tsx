'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useApp } from './proveedores';
import { interpolar } from '@/i18n';

/** Los tres destinos en Drive. Cada uno con su carpeta y sus formatos. */
export type DestinoArchivo = 'fotografia' | 'semblanza' | 'boleto';

const FORMATOS: Record<DestinoArchivo, string[]> = {
  fotografia: ['image/jpeg', 'image/png'],
  semblanza: ['application/pdf'],
  boleto: ['application/pdf', 'image/jpeg'],
};

/**
 * Sube un archivo a Drive y devuelve su enlace.
 *
 * El servidor es quien decide en qué carpeta cae y qué acepta: aquí el
 * `accept` y la comprobación previa sólo evitan que alguien espere a que
 * suban diez megabytes para que se los rechacen. Quien manipule esta
 * pantalla se encuentra la misma negativa del otro lado.
 */
export function SubidaArchivo({
  destino, etiqueta, ayuda, valorUrl, onSubida, onQuitar, megabytesMaximo, error: errorExterno,
}: {
  destino: DestinoArchivo;
  etiqueta: string;
  ayuda?: string;
  valorUrl: string;
  onSubida: (url: string, driveId: string) => void;
  onQuitar: () => void;
  megabytesMaximo: number;
  error?: string;
}) {
  const { t } = useApp();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [vistaPrevia, setVistaPrevia] = useState('');
  const [nombre, setNombre] = useState('');

  const aceptados = FORMATOS[destino];

  async function manejarArchivo(archivo: File | undefined) {
    if (!archivo) return;
    setError('');

    if (!aceptados.includes(archivo.type)) {
      setError(t.formulario.validacion.archivoTipo);
      return;
    }
    if (archivo.size > megabytesMaximo * 1024 * 1024) {
      setError(interpolar(t.formulario.validacion.archivoGrande, { mb: megabytesMaximo }));
      return;
    }

    setSubiendo(true);
    try {
      const cuerpo = new FormData();
      cuerpo.append('archivo', archivo);
      cuerpo.append('destino', destino);
      const respuesta = await fetch('/api/archivos', { method: 'POST', body: cuerpo });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos.mensaje ?? t.estados.error);
        return;
      }
      // La vista previa sólo tiene sentido con una imagen; de un PDF basta el
      // nombre para que quien sube reconozca lo que acaba de mandar.
      if (archivo.type.startsWith('image/')) setVistaPrevia(URL.createObjectURL(archivo));
      setNombre(archivo.name);
      onSubida(datos.url, datos.id);
    } catch {
      setError(t.estados.error);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
      <span className="etiqueta">{etiqueta}</span>
      <div
        className="rounded-lg border border-dashed p-4"
        style={{ borderColor: 'var(--borde)' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void manejarArchivo(e.dataTransfer.files[0]); }}
      >
        {valorUrl ? (
          <div className="flex items-center gap-4">
            {vistaPrevia ? (
              <Image src={vistaPrevia} alt="" width={64} height={80} unoptimized className="h-20 w-16 rounded object-cover" />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded bg-black/5 dark:bg-white/10" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6" />
                </svg>
              </span>
            )}
            <div className="min-w-0 flex-1">
              <a href={valorUrl} target="_blank" rel="noreferrer" className="block truncate text-sm text-ciess-400 underline">
                {nombre || valorUrl}
              </a>
            </div>
            <button
              type="button"
              className="boton-secundario !py-1.5 !text-xs"
              onClick={() => { setVistaPrevia(''); setNombre(''); onQuitar(); }}
            >
              {t.acciones.eliminar}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <button type="button" className="boton-secundario" onClick={() => entrada.current?.click()} disabled={subiendo}>
              {subiendo ? t.estados.enviando : t.acciones.buscar}
            </button>
            <input
              ref={entrada}
              type="file"
              accept={aceptados.join(',')}
              className="hidden"
              onChange={(e) => void manejarArchivo(e.target.files?.[0])}
            />
          </div>
        )}
      </div>
      {ayuda && <p className="ayuda">{ayuda}</p>}
      {(error || errorExterno) && <p className="error">{error || errorExterno}</p>}
    </div>
  );
}
