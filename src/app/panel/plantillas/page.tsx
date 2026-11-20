import { exigirUsuario } from '@/lib/servidor/sesion';
import { EditorPlantillas } from '@/componentes/panel/editor-plantillas';

export const dynamic = 'force-dynamic';

/** La clave que se pide por la dirección (`?clave=constancia`): sólo letras y guiones bajos; el editor la ignora si no existe. */
const FORMA_DE_CLAVE = /^[a-z_]{1,60}$/;

export default async function PaginaPlantillas({ searchParams }: { searchParams: Promise<{ clave?: string }> }) {
  await exigirUsuario('organizador');
  const { clave } = await searchParams;
  return <EditorPlantillas claveInicial={clave && FORMA_DE_CLAVE.test(clave) ? clave : undefined} />;
}
