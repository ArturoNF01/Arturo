import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { bdConfigurada } from '@/lib/bd/conexion';
import { usuarioActual } from '@/lib/servidor/sesion';
import { diagnosticar, type Estado, type Pieza } from '@/lib/servidor/diagnostico';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Diagnóstico del despliegue · 1er Congreso',
  robots: { index: false, follow: false },
};

/**
 * Qué le falta a este despliegue.
 *
 * Es la única pantalla que tiene sentido ver *antes* de que el panel
 * funcione, así que mientras la base no esté conectada se muestra sin
 * sesión: no revela nada que la página de acceso no diga ya. En cuanto hay
 * base de datos, exige sesión de superadministrador.
 */
export default async function PaginaDiagnostico() {
  if (bdConfigurada()) {
    const usuario = await usuarioActual();
    if (!usuario) redirect('/login?destino=/diagnostico');
    if (usuario.rol !== 'superadmin') redirect('/panel');
  }

  const informe = await diagnosticar();
  const pendientes = informe.piezas.filter((p) => p.estado !== 'listo').length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest tenue">CIESS</p>
        <h1 className="mt-2 text-2xl font-bold">Diagnóstico del despliegue</h1>
        <p className="ayuda max-w-prose">
          Qué falta para que el sistema funcione del todo. Se informa si cada variable está
          puesta, nunca su valor. El sitio público —formulario, FAQs y aviso de privacidad—
          funciona aunque todo lo demás esté pendiente.
        </p>
      </header>

      <div
        className="tarjeta mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 p-5"
        style={{ borderColor: pendientes ? 'var(--borde-fuerte)' : undefined }}
      >
        <p className="text-sm">
          {pendientes === 0 ? (
            <span className="font-semibold text-emerald-500">Todo configurado.</span>
          ) : (
            <>
              <span className="font-semibold">{pendientes}</span> de {informe.piezas.length}{' '}
              piezas pendientes.
            </>
          )}
        </p>
        {informe.registros !== null && (
          <p className="text-sm tenue">
            Registros en la base: <strong>{informe.registros}</strong>
          </p>
        )}
        {informe.usuariosPanel !== null && (
          <p className="text-sm tenue">
            Cuentas del panel: <strong>{informe.usuariosPanel}</strong>
          </p>
        )}
      </div>

      <ol className="space-y-4">
        {informe.piezas.map((pieza) => (
          <FichaPieza key={pieza.clave} pieza={pieza} />
        ))}
      </ol>

      {informe.piezas[0].estado !== 'falta' && (
        <section className="tarjeta mt-6 p-5">
          <h2 className="text-sm font-semibold">Esquema de la base</h2>
          <p className="ayuda !mt-1 mb-4">
            Cada pieza se reconoce por la tabla o la vista que crea. Si falta alguna, basta
            ejecutar{' '}
            <code className="font-mono text-[12px]">basedatos/esquema.sql</code> contra la base:
            se puede ejecutar más de una vez sin romper nada.
          </p>
          <ul className="space-y-1.5">
            {informe.migraciones.map((m) => (
              <li key={m.archivo} className="flex items-center gap-2.5 text-sm">
                <Marca ok={m.aplicada} />
                <span className="font-mono text-xs">{m.archivo}</span>
                <span className="ayuda !mt-0">{m.prueba}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="ayuda mt-8">
        <Link href="/" className="underline underline-offset-4">
          Ir al sitio
        </Link>
        {' · '}
        <Link href="/panel" className="underline underline-offset-4">
          Panel de control
        </Link>
      </p>
    </main>
  );
}

function FichaPieza({ pieza }: { pieza: Pieza }) {
  return (
    <li className="tarjeta p-5">
      <header className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{pieza.titulo}</h2>
        <Insignia estado={pieza.estado} />
      </header>
      <p className="text-sm">{pieza.resumen}</p>
      {pieza.estado !== 'listo' && (
        <p className="ayuda">
          <strong>Siguiente paso:</strong> {pieza.siguiente}
        </p>
      )}

      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {pieza.variables.map((v) => (
          <li key={v.nombre} className="flex items-center gap-2 text-xs">
            <Marca ok={v.presente} />
            <span className="font-mono">{v.nombre}</span>
            {!v.obligatoria && <span className="ayuda !mt-0">opcional</span>}
          </li>
        ))}
      </ul>
    </li>
  );
}

function Insignia({ estado }: { estado: Estado }) {
  const tono =
    estado === 'listo'
      ? 'bg-emerald-500/15 text-emerald-500'
      : estado === 'incompleto'
      ? 'bg-amber-500/15 text-amber-500'
      : 'bg-black/10 text-[color:var(--texto-tenue)] dark:bg-white/10';
  const texto = estado === 'listo' ? 'Listo' : estado === 'incompleto' ? 'Incompleto' : 'Pendiente';
  return <span className={`insignia shrink-0 ${tono}`}>{texto}</span>;
}

function Marca({ ok }: { ok: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0"
      stroke={ok ? '#10b981' : 'var(--texto-tenue)'}
    >
      {ok ? <path d="M20 6L9 17l-5-5" /> : <path d="M5 12h14" />}
    </svg>
  );
}
