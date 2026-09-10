import { redirect } from 'next/navigation';
import { canjearEnlaceAcceso } from '@/lib/servidor/sesion';

export const dynamic = 'force-dynamic';

/**
 * Canjea un enlace de acceso y entra al panel.
 *
 * El enlace se marca usado en la misma sentencia que lo lee, así que dos
 * clics simultáneos no abren dos sesiones.
 */
export default async function CanjearAcceso({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const usuario = await canjearEnlaceAcceso(token);
  redirect(usuario ? '/panel' : '/login?enlace=vencido');
}
