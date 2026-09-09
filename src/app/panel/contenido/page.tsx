import { exigirUsuario, permisos } from '@/lib/servidor/sesion';
import { EditorContenido } from '@/componentes/panel/editor-contenido';

export const dynamic = 'force-dynamic';

export default async function PaginaContenido() {
  const usuario = await exigirUsuario('organizador');
  return <EditorContenido permisos={permisos(usuario.rol)} />;
}
