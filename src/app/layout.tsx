import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Proveedores } from '@/componentes/proveedores';
import { esIdiomaValido, IDIOMA_POR_DEFECTO, obtenerDiccionario } from '@/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: '1er Congreso de Estudios Interamericanos de Seguridad Social',
  description:
    'Desafíos de la seguridad social en las Américas en el primer cuarto del siglo XXI. Ciudad de México, 11 al 13 de noviembre de 2026. Convoca el CIESS.',
  // El favicon vive en el sitio institucional, igual que el logotipo y el video.
  icons: { icon: 'https://home.ciess.org/wp-content/uploads/2025/12/cropped-FAV-CIESS-.png' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0b1420' },
    { media: '(prefers-color-scheme: light)', color: '#f7f9fc' },
  ],
};

/**
 * Aplica el tema antes de la hidratación para evitar el parpadeo.
 *
 * El claro es el de origen: la página sale sin clase «dark» y sólo se añade
 * si quien visita eligió el oscuro alguna vez. Si el almacenamiento no está
 * disponible (ventana privada, datos bloqueados), se queda en claro.
 */
const GUION_TEMA = `(function(){try{if(localStorage.getItem('congreso.tema')==='oscuro'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const galleta = (await cookies()).get('congreso.idioma')?.value;
  const idioma = esIdiomaValido(galleta) ? galleta : IDIOMA_POR_DEFECTO;

  return (
    <html lang={obtenerDiccionario(idioma).meta.codigo} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
      </head>
      <body className="min-h-screen antialiased">
        <Proveedores idiomaInicial={idioma}>{children}</Proveedores>
      </body>
    </html>
  );
}
