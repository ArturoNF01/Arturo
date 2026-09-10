import type { Metadata } from 'next';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { supabaseConfigurado } from '@/lib/supabase/admin';
import { PaginaLogin } from './pagina-login';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Acceso al panel · 1er Congreso',
  robots: { index: false, follow: false },
};

export default async function Login() {
  const configuracion = await leerConfiguracion();
  return (
    <PaginaLogin
      urlVideo={configuracion.url_video_login}
      configurado={supabaseConfigurado()}
    />
  );
}
