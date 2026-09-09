import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Refresca la sesión de Supabase en cada petición y protege /panel.
 * La comprobación de rol se hace después, en el propio panel, contra la
 * tabla usuarios_panel.
 */
export async function middleware(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return respuesta;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => peticion.cookies.getAll(),
      setAll: (galletas: { name: string; value: string; options: CookieOptions }[]) => {
        galletas.forEach(({ name, value }) => peticion.cookies.set(name, value));
        respuesta = NextResponse.next({ request: peticion });
        galletas.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  if (!data.user && peticion.nextUrl.pathname.startsWith('/panel')) {
    const destino = peticion.nextUrl.clone();
    destino.pathname = '/login';
    destino.searchParams.set('destino', peticion.nextUrl.pathname);
    return NextResponse.redirect(destino);
  }

  return respuesta;
}

export const config = {
  matcher: ['/panel/:path*', '/login'],
};
