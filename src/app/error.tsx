'use client';

import { useEffect } from 'react';

export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error no controlado:', error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Ocurrió un error</h1>
        <p className="mt-2 text-sm tenue">
          Vuelva a intentarlo. Si el problema persiste, escriba al comité organizador
          indicando la hora del intento.
        </p>
        <p className="mt-1 text-sm tenue">
          Something went wrong · Ocorreu um erro
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs tenue">{error.digest}</p>}
        <button type="button" onClick={reset} className="boton-primario mt-6">
          Reintentar
        </button>
      </div>
    </main>
  );
}
