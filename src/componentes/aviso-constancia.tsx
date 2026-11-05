'use client';

import Link from 'next/link';
import { useApp } from '@/componentes/proveedores';

/**
 * El aviso de que la constancia exige registrarse y asistir a todas las sesiones.
 *
 * Es lo que más gente se pierde: el enlace de Zoom y el de Meet están a la vista en
 * la agenda y cualquiera puede entrar sin registrarse, pero sin registro no hay
 * constancia. Por eso va donde se decide —en la agenda, junto a los botones, y en el
 * encabezado del registro— y, ya registrada la persona, como recordatorio de lo que
 * falta (en su pantalla de confirmación y en su acuse).
 *
 * Tres usos: sobre fondo claro (`claro`), sobre el azul del registro (`azul`) y como
 * recordatorio para quien ya se registró (`recordatorio`). El texto sale del diccionario, y
 * es el mismo que usa el correo, para que no se diga de dos maneras.
 */
export function AvisoConstancia({
  variante = 'claro', conBoton = false,
}: {
  variante?: 'claro' | 'azul';
  /** El enlace al registro: sólo tiene sentido para quien todavía no se ha registrado. */
  conBoton?: boolean;
}) {
  const { t } = useApp();
  const alAzul = variante === 'azul';
  return (
    <aside
      className={alAzul ? 'vidrio flex items-start gap-3 !rounded-lg border-l-4 px-4 py-3' : 'aviso-constancia flex items-start gap-3'}
      style={alAzul ? { borderLeftColor: 'var(--dorado)' } : undefined}
    >
      <svg
        aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`mt-0.5 shrink-0 ${alAzul ? 'text-[var(--dorado)]' : 'texto-dorado'}`}
      >
        <circle cx="12" cy="9" r="6" />
        <path d="m8.5 14 -1.5 8 5 -3 5 3 -1.5 -8" />
      </svg>
      <div className="min-w-0">
        <p className={`text-sm font-bold ${alAzul ? 'text-white' : 'texto-azul'}`}>{t.constancia.titulo}</p>
        <p className={`mt-0.5 text-sm leading-relaxed ${alAzul ? 'text-white/85' : ''}`}>{t.constancia.texto}</p>
        {conBoton && (
          <Link
            href="/registro"
            className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4 hover:no-underline"
          >
            {t.constancia.ir}
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        )}
      </div>
    </aside>
  );
}

/** Para quien ya se registró: lo que falta, no lo que ya hizo. */
export function RecordatorioConstancia() {
  const { t } = useApp();
  return (
    <aside className="aviso-constancia mt-6 flex items-start gap-3">
      <svg
        aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="texto-dorado mt-0.5 shrink-0"
      >
        <circle cx="12" cy="9" r="6" />
        <path d="m8.5 14 -1.5 8 5 -3 5 3 -1.5 -8" />
      </svg>
      <div className="min-w-0">
        <p className="texto-azul text-sm font-bold">{t.constancia.titulo}</p>
        <p className="mt-0.5 text-sm leading-relaxed">{t.constancia.recordatorio}</p>
      </div>
    </aside>
  );
}
