import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/** Cliente ligado a la sesión del usuario (respeta RLS). */
export async function crearClienteServidor() {
  const almacen = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (galletas: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            galletas.forEach(({ name, value, options }) => almacen.set(name, value, options));
          } catch {
            // Invocado desde un Server Component: el middleware refresca la sesión.
          }
        },
      },
    },
  );
}
