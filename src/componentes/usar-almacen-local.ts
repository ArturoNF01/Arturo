'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Lee y escribe una preferencia en `localStorage` sin sincronizarla con un
 * efecto: `useSyncExternalStore` entrega el valor de respaldo durante el
 * renderizado del servidor y el valor guardado en cuanto hidrata, sin
 * renderizados en cascada ni desajustes de hidratación.
 *
 * El almacenamiento puede fallar (ventana privada, cookies bloqueadas), así
 * que toda lectura y escritura va protegida.
 */
const suscriptores = new Set<() => void>();

function avisarCambio() {
  suscriptores.forEach((notificar) => notificar());
}

export function useAlmacenLocal(
  clave: string,
  respaldo: string,
  /** Valor a usar cuando no hay nada guardado; se evalúa sólo en el navegador. */
  calcularInicial?: () => string,
): [string, (valor: string) => void] {
  const suscribir = useCallback((alCambiar: () => void) => {
    suscriptores.add(alCambiar);
    window.addEventListener('storage', alCambiar);
    return () => {
      suscriptores.delete(alCambiar);
      window.removeEventListener('storage', alCambiar);
    };
  }, []);

  const leerNavegador = useCallback(() => {
    try {
      return localStorage.getItem(clave) ?? calcularInicial?.() ?? respaldo;
    } catch {
      return respaldo;
    }
  }, [clave, respaldo, calcularInicial]);

  const leerServidor = useCallback(() => respaldo, [respaldo]);

  const valor = useSyncExternalStore(suscribir, leerNavegador, leerServidor);

  const fijar = useCallback(
    (nuevo: string) => {
      try {
        localStorage.setItem(clave, nuevo);
      } catch {
        // Sin almacenamiento la preferencia dura lo que la sesión.
      }
      avisarCambio();
    },
    [clave],
  );

  return [valor, fijar];
}
