import { exigirUsuario } from '@/lib/servidor/sesion';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { leerDatosCongreso } from '@/lib/servidor/contenido';
import { leerEstadoRecordatorios } from '@/lib/servidor/recordatorios';
import { limitePorHuella } from '@/lib/servidor/antiabuso';
import { PanelCupos } from '@/componentes/panel/panel-cupos';

export const dynamic = 'force-dynamic';

export default async function PaginaCupos() {
  await exigirUsuario('organizador');
  const [configuracion, congreso, recordatorios, limiteHuella] = await Promise.all([
    leerConfiguracion(),
    leerDatosCongreso(),
    leerEstadoRecordatorios(),
    limitePorHuella(),
  ]);
  return (
    <PanelCupos
      configuracion={configuracion}
      congreso={congreso}
      recordatorios={recordatorios}
      limiteHuella={limiteHuella}
    />
  );
}
