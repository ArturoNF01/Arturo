import { NextResponse, type NextRequest } from 'next/server';

/**
 * Protege el panel de un vistazo, antes de llegar a la página.
 *
 * Sólo comprueba que exista la galleta de sesión: validarla contra la base
 * aquí obligaría a consultar PostgreSQL en cada navegación, y el middleware
 * corre antes de la caché. La comprobación de verdad —que la sesión exista,
 * no haya vencido y la cuenta siga activa— la hace cada página del panel con
 * `exigirUsuario`.
 */
export function middleware(peticion: NextRequest) {
  const tieneSesion = Boolean(peticion.cookies.get('congreso.sesion')?.value);

  if (!tieneSesion && peticion.nextUrl.pathname.startsWith('/panel')) {
    const destino = peticion.nextUrl.clone();
    destino.pathname = '/login';
    destino.searchParams.set('destino', peticion.nextUrl.pathname);
    return NextResponse.redirect(destino);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/panel/:path*'],
};
