'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/componentes/proveedores';
import { crearClienteNavegador } from '@/lib/supabase/cliente';
import { nombrePerfil } from '@/lib/perfiles';

interface Aviso {
  id: string;
  folio: string;
  nombre: string;
  perfil: string;
  pais: string;
}

const CLAVE_SILENCIO = 'congreso.notificaciones';

/**
 * Escucha en tiempo real las altas de la tabla `registros` y muestra un aviso
 * flotante; si el navegador lo permite, también una notificación del sistema.
 */
export function AvisosRegistros() {
  const { t, tt } = useApp();
  const router = useRouter();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [silenciado, setSilenciado] = useState(false);
  const silenciadoRef = useRef(false);

  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE_SILENCIO) === 'silenciado';
    setSilenciado(guardado);
    silenciadoRef.current = guardado;
  }, []);

  useEffect(() => {
    const supabase = crearClienteNavegador();
    const canal = supabase
      .channel('registros-nuevos')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registros' },
        (evento) => {
          if (silenciadoRef.current) return;
          const r = evento.new as Record<string, string>;
          const aviso: Aviso = {
            id: r.id,
            folio: r.folio,
            nombre: `${r.nombres ?? ''} ${r.apellidos ?? ''}`.trim(),
            perfil: r.perfil,
            pais: r.pais_residencia ?? '',
          };
          setAvisos((previos) => [aviso, ...previos].slice(0, 4));
          router.refresh();

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(t.panel.notificacion.nuevo, {
              body: tt(t.panel.notificacion.texto, {
                nombre: aviso.nombre,
                perfil: nombrePerfil(aviso.perfil, t),
                pais: aviso.pais,
              }),
              tag: aviso.id,
            });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [router, t, tt]);

  useEffect(() => {
    if (avisos.length === 0) return;
    const temporizador = setTimeout(() => setAvisos((previos) => previos.slice(0, -1)), 9000);
    return () => clearTimeout(temporizador);
  }, [avisos]);

  function alternarSilencio() {
    const nuevo = !silenciado;
    setSilenciado(nuevo);
    silenciadoRef.current = nuevo;
    localStorage.setItem(CLAVE_SILENCIO, nuevo ? 'silenciado' : 'activo');
    if (!nuevo && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {avisos.map((aviso) => (
          <Link
            key={aviso.id}
            href={`/panel/registros?folio=${aviso.folio}`}
            className="tarjeta pointer-events-auto flex items-start gap-3 p-3.5 shadow-lg transition hover:shadow-xl"
          >
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t.panel.notificacion.nuevo}</p>
              <p className="truncate text-xs tenue">
                {tt(t.panel.notificacion.texto, {
                  nombre: aviso.nombre,
                  perfil: nombrePerfil(aviso.perfil, t),
                  pais: aviso.pais,
                })}
              </p>
              <p className="mt-0.5 font-mono text-[11px] tenue">{aviso.folio}</p>
            </div>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={alternarSilencio}
        title={silenciado ? t.panel.notificacion.activar : t.panel.notificacion.silenciar}
        aria-pressed={silenciado}
        className="fixed bottom-4 left-4 z-40 grid h-10 w-10 place-items-center rounded-full border shadow-md transition hover:scale-105 sin-impresion"
        style={{ borderColor: 'var(--borde)', backgroundColor: 'var(--fondo-tarjeta)' }}
      >
        {silenciado ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M13.7 21a2 2 0 01-3.4 0M18 8a6 6 0 00-9.3-5M6 9v3c0 1.5-1 3-2 4h13M2 2l20 20" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
          </svg>
        )}
      </button>
    </>
  );
}
