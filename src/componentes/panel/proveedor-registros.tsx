'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type { RegistroPanel } from './usar-registros';

/**
 * Los registros del panel, con la lista al día.
 *
 * El panel pregunta cada pocos segundos en lugar de sostener una conexión
 * abierta. Para un congreso —unas cuantas personas del comité mirando la
 * pantalla— una consulta cada veinte segundos cuesta menos que un websocket
 * por pestaña, y no hay reconexiones que manejar.
 *
 * Se consulta una sola vez para todo el panel: el dashboard, la tabla y los
 * avisos de registro nuevo leen de aquí.
 */
const INTERVALO_MS = 20_000;

interface Contexto {
  registros: RegistroPanel[];
  cargando: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  /** Los que aparecieron en la última consulta. Alimenta los avisos. */
  nuevos: RegistroPanel[];
}

const ContextoRegistros = createContext<Contexto | null>(null);

export function ProveedorRegistros({ children }: { children: React.ReactNode }) {
  const [registros, setRegistros] = useState<RegistroPanel[]>([]);
  const [nuevos, setNuevos] = useState<RegistroPanel[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Los identificadores ya vistos viven en una referencia: comparar contra el
  // estado obligaría a rehacer la consulta cada vez que cambia.
  const vistos = useRef<Set<string> | null>(null);

  const cargar = useCallback(async () => {
    try {
      const respuesta = await fetch('/api/registros', { cache: 'no-store' });
      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => ({}));
        setError(cuerpo.mensaje ?? 'No fue posible leer los registros.');
        return;
      }

      const filas = (await respuesta.json()) as RegistroPanel[];
      setError(null);
      setRegistros(filas);

      if (vistos.current === null) {
        // La primera carga no es novedad: son los registros que ya existían.
        vistos.current = new Set(filas.map((r) => r.id));
        setNuevos([]);
      } else {
        const recientes = filas.filter((r) => !vistos.current!.has(r.id));
        recientes.forEach((r) => vistos.current!.add(r.id));
        if (recientes.length > 0) setNuevos(recientes);
      }
    } catch {
      setError('No fue posible leer los registros.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // `cargar` es asíncrona: su setState ocurre después del efecto, no de
    // forma síncrona dentro de él, que es lo que la regla busca evitar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
    const temporizador = setInterval(() => void cargar(), INTERVALO_MS);

    // Al volver a la pestaña se consulta de inmediato, en lugar de esperar al
    // siguiente turno del temporizador.
    const alVolver = () => {
      if (document.visibilityState === 'visible') void cargar();
    };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      clearInterval(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [cargar]);

  const valor = useMemo<Contexto>(
    () => ({ registros, cargando, error, recargar: cargar, nuevos }),
    [registros, cargando, error, cargar, nuevos],
  );

  return <ContextoRegistros.Provider value={valor}>{children}</ContextoRegistros.Provider>;
}

export function useContextoRegistros(): Contexto {
  const contexto = useContext(ContextoRegistros);
  if (!contexto) {
    throw new Error('useRegistros debe usarse dentro del panel.');
  }
  return contexto;
}
