import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { PaginaConfirmacion } from './pagina-confirmacion';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Confirmación de registro', robots: { index: false } };

export default async function Confirmacion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  const supabase = crearClienteAdmin();
  const { data: registro } = await supabase.from('registros').select('*').eq('id', id).maybeSingle();

  if (!registro || !token || token !== registro.token_edicion) notFound();

  const configuracion = await leerConfiguracion();
  return <PaginaConfirmacion registro={registro} configuracion={configuracion} token={token} />;
}
