'use client';

import Link from 'next/link';
import { useApp } from '@/componentes/proveedores';

/** La barra de arriba de la hoja de QR: sólo en pantalla, nunca en lo impreso. */
export function BarraImpresion({ formato }: { formato: 'hojas' | 'tira' }) {
  const { t } = useApp();
  const a = t.panel.asistencia;
  return (
    <div className="sin-impresion mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-4">
      <Link href="/panel/asistencia" className="text-sm underline">{a.volverAlPanel}</Link>
      <div className="flex gap-2" role="group">
        {([['hojas', a.formatoHojas], ['tira', a.formatoTira]] as const).map(([clave, texto]) => (
          <Link
            key={clave}
            href={`/asistencia-qr?formato=${clave}`}
            aria-current={formato === clave ? 'page' : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${formato === clave ? 'bg-ciess-500 text-white' : 'boton-secundario'}`}
          >
            {texto}
          </Link>
        ))}
      </div>
      <button type="button" className="boton-primario ml-auto !py-2 !text-sm" onClick={() => window.print()}>{a.imprimir}</button>
      <p className="ayuda w-full !mt-0">{a.sugerenciaImpresion}</p>
    </div>
  );
}
