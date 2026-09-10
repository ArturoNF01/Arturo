import { exigirUsuario } from '@/lib/servidor/sesion';
import { EditorPlantillas } from '@/componentes/panel/editor-plantillas';

export const dynamic = 'force-dynamic';

export default async function PaginaPlantillas() {
  await exigirUsuario('organizador');
  return <EditorPlantillas />;
}
