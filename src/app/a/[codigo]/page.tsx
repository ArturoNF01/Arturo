import type { Metadata } from 'next';
import { esSesionDePrueba, estadoDeVentana, sesionPorClave, ventanaDe } from '@/lib/asistencia';
import { resolverCodigo } from '@/lib/servidor/asistencia';
import { PaginaAsistencia, type DatosDeSesion } from './pagina-asistencia';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Registro de asistencia',
  // Un enlace con un código secreto: que ningún buscador lo guarde.
  robots: { index: false, follow: false },
};

/**
 * A donde llega quien escanea el QR de una sesión o abre el enlace del chat (`/a/<código>`).
 *
 * El código dice la sesión y la vía —presencial o en línea—; nada de eso lo elige quien escanea. Aquí
 * sólo se resuelve y se le pasa a la pantalla lo que hace falta para mostrarse en los tres idiomas.
 */
export default async function Asistencia({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const resuelto = await resolverCodigo(codigo.trim().toLowerCase()).catch(() => null);
  const sesion = resuelto ? sesionPorClave(resuelto.sesion) : undefined;

  if (!resuelto || !sesion) return <PaginaAsistencia codigo={codigo} sesion={null} />;

  const { abre, cierra } = ventanaDe(sesion);
  const datos: DatosDeSesion = {
    clave: sesion.clave,
    via: resuelto.via,
    corto: sesion.corto,
    titulo: sesion.titulo ?? null,
    dia: sesion.diaTexto,
    horario: sesion.horario,
    sala: sesion.sala ?? null,
    estado: estadoDeVentana(sesion),
    esPrueba: esSesionDePrueba(sesion.clave),
    esDia: sesion.tipo === 'dia',
    abre: abre.toISOString(),
    cierra: cierra.toISOString(),
  };
  return <PaginaAsistencia codigo={codigo} sesion={datos} />;
}
