import { exigirUsuario, permisos } from '@/lib/servidor/sesion';
import { MarcoPanel } from '@/componentes/panel/marco-panel';

export const dynamic = 'force-dynamic';

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  return (
    <MarcoPanel usuario={usuario} permisos={permisos(usuario.rol)}>
      {children}
    </MarcoPanel>
  );
}
