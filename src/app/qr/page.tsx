import type { Metadata } from 'next';
import { leerSegundos } from '@/lib/recepcion';
import { armarParaPeticion } from '@/lib/servidor/recepcion-peticion';
import { PantallaRecepcion } from './pantalla-recepcion';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Recepción · QR',
  // Una página que no enlaza nadie: que ningún buscador la guarde.
  robots: { index: false, follow: false },
};

/**
 * La pantalla vertical (9:16) de la mesa de recepción: el QR de la agenda del sitio, el QR de la asistencia del día —que
 * cambia solo, miércoles, jueves o viernes, según la fecha de México—, qué sesión está en vivo ahora y qué sigue, y el
 * aviso que el comité deje en el panel.
 *
 * Aquí sólo se arma la primera imagen (para que no salga en blanco); después la pantalla se actualiza sola pidiendo
 * `/api/recepcion` cada minuto. Ahí está la explicación de qué se arma y de por qué así (`armarDatosDePantalla`).
 *
 * Parámetros:
 *  - `?ligero=1`: sin video, sin desenfoque y sin luces, para un equipo que no pueda con tanto efecto.
 *  - `?segundos=12`: cuánto se queda cada idioma (de 5 a 30). Sin esto se calcula según lo que haya que leer: de 9 a 16.
 *  - `?dia=miercoles|jueves|viernes` (y, opcional, `&hora=10:45`): enseña ese día —y a esa hora— en lugar de la fecha
 *    de hoy, para revisar el diseño antes del Congreso. Sólo lo atiende a quien tiene sesión en el panel.
 */
export default async function Recepcion({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; hora?: string; ligero?: string; segundos?: string }>;
}) {
  const { dia, hora, ligero, segundos } = await searchParams;
  const fijo = leerSegundos(segundos);
  const datos = await armarParaPeticion({ dia, hora, ligero: ligero === '1', segundos: fijo });

  // Los mismos parámetros viajan a cada actualización, para que una vista previa siga siendo la misma.
  const consulta = new URLSearchParams();
  if (dia) consulta.set('dia', dia);
  if (hora) consulta.set('hora', hora);
  if (ligero === '1') consulta.set('ligero', '1');
  if (fijo) consulta.set('segundos', String(fijo));

  return <PantallaRecepcion datos={datos} consulta={consulta.toString()} />;
}
