import { exigirUsuario, permisos } from '@/lib/servidor/sesion';
import { leerDatosCongreso, leerEjes } from '@/lib/servidor/contenido';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { MarcoPanel } from '@/componentes/panel/marco-panel';

export const dynamic = 'force-dynamic';

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const [usuario, congreso, { filas: ejes }, configuracion] = await Promise.all([
    exigirUsuario(),
    leerDatosCongreso(),
    leerEjes(),
    leerConfiguracion(),
  ]);

  return (
    <MarcoPanel usuario={usuario} permisos={permisos(usuario.rol)} congreso={congreso} ejes={ejes} urlVideo={configuracion.url_video_login}>
      {children}
    </MarcoPanel>
  );
}
