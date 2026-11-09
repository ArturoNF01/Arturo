import QRCode from 'qrcode';
import { urlSitio } from '@/lib/config';
import { DIAS_DE_ASISTENCIA, SESIONES_DE_ASISTENCIA, ventanaDe } from '@/lib/asistencia';
import { asegurarCodigos, estadoDePrueba, resumenPorSesion, type CodigosPorSesion } from '@/lib/servidor/asistencia';
import { exigirUsuario, permisos } from '@/lib/servidor/sesion';
import { PanelAsistencia, type SesionPlana } from '@/componentes/panel/panel-asistencia';

export const dynamic = 'force-dynamic';

export default async function PaginaAsistencia() {
  const usuario = await exigirUsuario('lector');
  const p = permisos(usuario.rol);
  const base = urlSitio().replace(/\/+$/, '');

  const sesiones: SesionPlana[] = SESIONES_DE_ASISTENCIA.map((s) => {
    const { abre, cierra } = ventanaDe(s);
    return {
      clave: s.clave, dia: s.dia, horario: s.horario, tipo: s.tipo, sala: s.sala ?? null,
      corto: s.corto, titulo: s.titulo ?? null, abre: abre.toISOString(), cierra: cierra.toISOString(),
    };
  });

  const resumen = await resumenPorSesion().catch(() => ({}));

  // Los códigos sólo los ve —y los genera— quien organiza: con ellos se registra asistencia.
  let codigos: CodigosPorSesion | null = null;
  const qrs: Record<string, string> = {};
  if (p.gestionarAsistencia) {
    codigos = await asegurarCodigos().catch(() => null);
    if (codigos) {
      for (const [sesion, c] of Object.entries(codigos)) {
        qrs[sesion] = await QRCode.toString(`${base}/a/${c.presencial}`, {
          type: 'svg', margin: 1, errorCorrectionLevel: 'M',
        });
      }
    }
  }

  // La sesión de prueba sólo la maneja quien organiza.
  const prueba = p.gestionarAsistencia ? await estadoDePrueba(base).catch(() => null) : null;

  return (
    <PanelAsistencia
      sesiones={sesiones}
      dias={DIAS_DE_ASISTENCIA.map((d) => ({ iso: d.iso, texto: d.texto }))}
      resumenInicial={resumen}
      puedeExportar={p.exportar}
      puedeGestionar={p.gestionarAsistencia}
      codigos={codigos}
      qrs={qrs}
      urlBase={base}
      pruebaInicial={prueba}
    />
  );
}
