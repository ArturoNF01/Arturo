import { exigirUsuario, permisos } from '@/lib/servidor/sesion';
import { leerDatosCongreso, leerEjes } from '@/lib/servidor/contenido';
import { MarcoPanel } from '@/componentes/panel/marco-panel';

export const dynamic = 'force-dynamic';

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const [usuario, congreso, { filas: ejes }] = await Promise.all([
    exigirUsuario(),
    leerDatosCongreso(),
    leerEjes(),
  ]);

  return (
    <MarcoPanel usuario={usuario} permisos={permisos(usuario.rol)} congreso={congreso} ejes={ejes}>
      {children}
    </MarcoPanel>
  );
}
