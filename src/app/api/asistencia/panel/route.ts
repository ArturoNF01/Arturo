import { NextRequest, NextResponse } from 'next/server';
import { agruparPorPersona, esVia, sesionPorClave } from '@/lib/asistencia';
import { urlSitio } from '@/lib/config';
import {
  activarPrueba, asistentesDeSesion, borrarPrueba, buscarRegistros, cambiarCodigo, conciliarAsistencia,
  eliminarAsistencia, estadoDePrueba, resumenPorSesion, todasLasAsistencias,
} from '@/lib/servidor/asistencia';
import { googleConfigurado } from '@/lib/servidor/google';
import { sincronizarAsistencias } from '@/lib/servidor/sheets-asistencia';
import { esUuid } from '@/lib/esquema';
import { permisos, usuarioActual } from '@/lib/servidor/sesion';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Lo que lee el panel de asistencia: el resumen por sesión, quién asistió a una sesión y la vista por
 * persona. Ve la asistencia quien ve los registros (lleva los mismos datos personales).
 */
export async function GET(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).verAsistencia) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const vista = peticion.nextUrl.searchParams.get('vista') ?? 'resumen';
  try {
    if (vista === 'resumen') return NextResponse.json({ resumen: await resumenPorSesion() });

    if (vista === 'sesion') {
      const sesion = peticion.nextUrl.searchParams.get('sesion') ?? '';
      if (!sesionPorClave(sesion)) return NextResponse.json({ mensaje: 'Sesión no válida.' }, { status: 422 });
      return NextResponse.json({ asistentes: await asistentesDeSesion(sesion) });
    }

    if (vista === 'personas') return NextResponse.json({ personas: agruparPorPersona(await todasLasAsistencias()) });

    if (vista === 'prueba') return NextResponse.json({ prueba: await estadoDePrueba(urlSitio()) });
  } catch (error) {
    console.error('No se pudo leer la asistencia:', error);
    return NextResponse.json({ mensaje: 'No fue posible leer la asistencia.' }, { status: 500 });
  }
  return NextResponse.json({ mensaje: 'Vista no válida.' }, { status: 422 });
}

/** Lo que cambia la asistencia a mano: ligar una «sin registro», quitar un escaneo, cambiar un código. */
export async function POST(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).gestionarAsistencia) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const cuerpo = (await peticion.json().catch(() => null)) as Record<string, unknown> | null;
  const accion = String(cuerpo?.accion ?? '');

  try {
    if (accion === 'buscar') {
      return NextResponse.json({ registros: await buscarRegistros(String(cuerpo?.texto ?? '')) });
    }

    if (accion === 'conciliar') {
      const asistenciaId = String(cuerpo?.asistenciaId ?? '');
      const registroId = String(cuerpo?.registroId ?? '');
      if (!esUuid(asistenciaId) || !esUuid(registroId)) {
        return NextResponse.json({ mensaje: 'Petición no válida.' }, { status: 422 });
      }
      const r = await conciliarAsistencia(asistenciaId, registroId);
      return r.ok ? NextResponse.json(r) : NextResponse.json({ mensaje: r.mensaje }, { status: 409 });
    }

    if (accion === 'quitar') {
      const id = String(cuerpo?.id ?? '');
      if (!esUuid(id)) return NextResponse.json({ mensaje: 'Petición no válida.' }, { status: 422 });
      return (await eliminarAsistencia(id))
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ mensaje: 'Esa asistencia ya no existe.' }, { status: 404 });
    }

    // La sesión de prueba: para ver cómo se captura antes del Congreso. No cuenta para nadie y se borra con un clic.
    if (accion === 'activar_prueba') return NextResponse.json({ prueba: await activarPrueba(urlSitio()) });
    if (accion === 'borrar_prueba') {
      const borradas = await borrarPrueba();
      return NextResponse.json({ borradas, prueba: await estadoDePrueba(urlSitio()) });
    }

    // Pasar la asistencia a la hoja ahora, sin esperar a la sincronización de cada 10 minutos.
    if (accion === 'sincronizar_hoja') {
      if (!googleConfigurado() || !process.env.GOOGLE_SHEETS_ID) {
        return NextResponse.json({ mensaje: 'Google Sheets no está configurado.' }, { status: 503 });
      }
      return NextResponse.json({ hoja: await sincronizarAsistencias() });
    }

    if (accion === 'cambiar_codigo') {
      const sesion = String(cuerpo?.sesion ?? '');
      const via = cuerpo?.via;
      if (!sesionPorClave(sesion) || !esVia(via)) return NextResponse.json({ mensaje: 'Petición no válida.' }, { status: 422 });
      const codigo = await cambiarCodigo(sesion, via);
      return codigo ? NextResponse.json({ codigo }) : NextResponse.json({ mensaje: 'No se pudo cambiar el código.' }, { status: 500 });
    }
  } catch (error) {
    console.error('No se pudo cambiar la asistencia:', error);
    return NextResponse.json({ mensaje: 'No fue posible completar la operación.' }, { status: 500 });
  }
  return NextResponse.json({ mensaje: 'Acción no válida.' }, { status: 422 });
}
