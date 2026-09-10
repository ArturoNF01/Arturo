import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-ciess-400">404</p>
        <h1 className="mt-2 text-2xl font-bold">Página no encontrada</h1>
        <p className="mt-2 text-sm tenue">
          El enlace puede haber caducado o el registro ya no está disponible.
        </p>
        <p className="mt-1 text-sm tenue">
          Page not found · Página não encontrada
        </p>
        <Link href="/registro" className="boton-primario mt-6">
          Ir al formulario de registro
        </Link>
      </div>
    </main>
  );
}
