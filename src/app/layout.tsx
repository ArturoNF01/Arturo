import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Proveedores } from '@/componentes/proveedores';
import { esIdiomaValido, IDIOMA_POR_DEFECTO, obtenerDiccionario } from '@/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: '1er Congreso · Desafíos de la seguridad social en las Américas',
  description:
    'Registro y panel de control del 1er Congreso Desafíos de la seguridad social en las Américas en el primer cuarto del siglo XXI · CIESS',
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

/** Aplica el tema antes de la hidratación para evitar el parpadeo. */
const GUION_TEMA = `(function(){try{var t=localStorage.getItem('congreso.tema');if(t!=='claro'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const galleta = (await cookies()).get('congreso.idioma')?.value;
  const idioma = esIdiomaValido(galleta) ? galleta : IDIOMA_POR_DEFECTO;

  return (
    <html lang={obtenerDiccionario(idioma).meta.codigo} className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
      </head>
      <body className="min-h-screen antialiased">
        <Proveedores idiomaInicial={idioma}>{children}</Proveedores>
      </body>
    </html>
  );
}
