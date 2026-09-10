import { exigirUsuario } from '@/lib/servidor/sesion';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { BitacoraAuditoria, type EntradaAuditoria } from '@/componentes/panel/bitacora-auditoria';

export const dynamic = 'force-dynamic';

export default async function PaginaAuditoria() {
  await exigirUsuario('organizador');

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from('auditoria')
    .select('id, tabla, registro_id, accion, actor_correo, actor_rol, origen, campos, ocurrido_en, datos_previos, datos_nuevos')
    .order('ocurrido_en', { ascending: false })
    .limit(500);

  return <BitacoraAuditoria entradas={(data ?? []) as EntradaAuditoria[]} />;
}
