import { exigirUsuario } from '@/lib/servidor/sesion';
import { consultar } from '@/lib/bd/conexion';
import { BitacoraAuditoria, type EntradaAuditoria } from '@/componentes/panel/bitacora-auditoria';

export const dynamic = 'force-dynamic';

export default async function PaginaAuditoria() {
  await exigirUsuario('organizador');

  const entradas = await consultar<EntradaAuditoria>(
    `select id, tabla, registro_id, accion, actor_correo, actor_rol, origen,
            campos, ocurrido_en, datos_previos, datos_nuevos
       from auditoria
      order by ocurrido_en desc
      limit 500`,
  ).catch(() => []);

  return <BitacoraAuditoria entradas={entradas} />;
}
