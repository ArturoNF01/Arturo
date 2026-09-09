import type { Metadata } from 'next';
import { PaginaAviso } from './pagina-aviso';

export const metadata: Metadata = {
  title: 'Aviso de privacidad · 1er Congreso de Estudios Interamericanos de Seguridad Social',
};

export default function AvisoPrivacidad() {
  return <PaginaAviso />;
}
