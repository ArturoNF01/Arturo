import { NextRequest, NextResponse } from 'next/server';
import { agruparPorPersona, esSesionDeLaAgenda, esVia, sesionPorClave } from '@/lib/asistencia';
import { urlSitio } from '@/lib/config';
import {
  activarPrueba, asistentesDeSesion, borrarPrueba, buscarRegistros, cambiarCodigo, conciliarAsistencia,
  eliminarAsistencia, estadoDePrueba, registrarAsistenciaManual, resumenPorSesion, todasLasAsistencias, ultimasManuales,
} from '@/lib/servidor/asistencia';
import { googleConfigurado } from '@/lib/servidor/google';
import { estadoDeLaHoja, pedirSincronizacionDeAsistencias, sincronizarYAnotar } from '@/lib/servidor/sheets-asistencia';
import { hojaCongelada, ponerHojaCongelada } from '@/lib/servidor/hoja-congelada';
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
    if (vista === 'resumen') {
      // Si no se puede saber si está congelada, se dice que lo está: es lo que no hace daño.
      const congelada = await hojaCongelada().catch(() => true);
      return NextResponse.json({ resumen: await resumenPorSesion(), hoja: { ...estadoDeLaHoja(), congelada } });
    }

    if (vista === 'sesion') {
      const sesion = peticion.nextUrl.searchParams.get('sesion') ?? '';
      if (!sesionPorClave(sesion)) return NextResponse.json({ mensaje: 'Sesión no válida.' }, { status: 422 });
      return NextResponse.json({ asistentes: await asistentesDeSesion(sesion) });
    }

    if (vista === 'personas') return NextResponse.json({ personas: agruparPorPersona(await todasLasAsistencias()) });

    if (vista === 'prueba') return NextResponse.json({ prueba: await estadoDePrueba(urlSitio()) });

    // Las últimas anotadas a mano, para revisarlas y deshacer una equivocación: es de quien las anota.
    if (vista === 'manuales') {
      if (!permisos(usuario.rol).gestionarAsistencia) return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
      return NextResponse.json({ manuales: await ultimasManuales() });
    }
  } catch (error) {
    console.error('No se pudo leer la asistencia:', error);
    return NextResponse.json({ mensaje: 'No fue posible leer la asistencia.' }, { status: 500 });
  }
  return NextResponse.json({ mensaje: 'Vista no válida.' }, { status: 422 });
}

/**
 * Lo que cambia la asistencia a mano: anotar la de quien no tiene teléfono, ligar una «sin registro», quitar un escaneo,
 * cambiar un código.
 */
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

    // Anotar la asistencia de quien no puede escanear: se escribe su correo (o se elige entre los registros que se buscaron).
    if (accion === 'registrar_manual') {
      const sesion = String(cuerpo?.sesion ?? '');
      const via = cuerpo?.via;
      const registroId = typeof cuerpo?.registroId === 'string' && cuerpo.registroId !== '' ? cuerpo.registroId : undefined;
      if (!esSesionDeLaAgenda(sesion) || !esVia(via) || (registroId !== undefined && !esUuid(registroId))) {
        return NextResponse.json({ mensaje: 'Petición no válida.' }, { status: 422 });
      }
      const respuesta = await registrarAsistenciaManual({
        sesion, via, registroId, usuarioId: usuario.id,
        correo: typeof cuerpo?.correo === 'string' ? cuerpo.correo : undefined,
        nombre: typeof cuerpo?.nombre === 'string' ? cuerpo.nombre : undefined,
      });
      // La asistencia ya está en la base. A la hoja pasa unos segundos después, como las demás.
      if (respuesta.ok && respuesta.estado === 'registrada') pedirSincronizacionDeAsistencias();
      // Que falte el nombre no es un fallo: la pantalla lo pide. Lo demás sí lo es.
      if (!respuesta.ok && respuesta.motivo !== 'no_encontrado') return NextResponse.json(respuesta, { status: 422 });
      return NextResponse.json(respuesta);
    }

    if (accion === 'conciliar') {
      const asistenciaId = String(cuerpo?.asistenciaId ?? '');
      const registroId = String(cuerpo?.registroId ?? '');
      if (!esUuid(asistenciaId) || !esUuid(registroId)) {
        return NextResponse.json({ mensaje: 'Petición no válida.' }, { status: 422 });
      }
      const r = await conciliarAsistencia(asistenciaId, registroId);
      if (r.ok) pedirSincronizacionDeAsistencias(); // la hoja lleva el nombre conciliado
      return r.ok ? NextResponse.json(r) : NextResponse.json({ mensaje: r.mensaje }, { status: 409 });
    }

    if (accion === 'quitar') {
      const id = String(cuerpo?.id ?? '');
      if (!esUuid(id)) return NextResponse.json({ mensaje: 'Petición no válida.' }, { status: 422 });
      if (!(await eliminarAsistencia(id))) return NextResponse.json({ mensaje: 'Esa asistencia ya no existe.' }, { status: 404 });
      pedirSincronizacionDeAsistencias();
      return NextResponse.json({ ok: true });
    }

    // La sesión de prueba: para ver cómo se captura antes del Congreso. No cuenta para nadie y se borra con un clic.
    if (accion === 'activar_prueba') return NextResponse.json({ prueba: await activarPrueba(urlSitio()) });
    if (accion === 'borrar_prueba') {
      const borradas = await borrarPrueba();
      // La hoja de Google no lleva la sesión de prueba (sólo la gente que asistió a un día del Congreso), así que no hay nada
      // que quitar de ella.
      return NextResponse.json({ borradas, prueba: await estadoDePrueba(urlSitio()) });
    }

    // Congelar la pestaña de la hoja (se edita a mano: el sistema no la escribe) o volver a dejarla como copia de la base.
    if (accion === 'congelar_hoja') {
      if (typeof cuerpo?.congelada !== 'boolean') return NextResponse.json({ mensaje: 'Falta indicar si se congela.' }, { status: 422 });
      await ponerHojaCongelada(cuerpo.congelada, usuario.id);
      return NextResponse.json({ congelada: cuerpo.congelada });
    }

    // Pasar la asistencia a la hoja ahora, sin esperar a la sincronización de cada 10 minutos.
    if (accion === 'sincronizar_hoja') {
      if (!googleConfigurado() || !process.env.GOOGLE_SHEETS_ID) {
        return NextResponse.json({ mensaje: 'Google Sheets no está configurado.' }, { status: 503 });
      }
      try {
        return NextResponse.json({ hoja: await sincronizarYAnotar() });
      } catch (error) {
        // Aquí sí se dice la causa de verdad —permiso, cuota, hoja borrada—: quien pulsa el botón es quien puede arreglarla.
        console.error('No se pudo pasar la asistencia a la hoja:', error);
        const motivo = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ mensaje: `No se pudo escribir en la hoja de Google: ${motivo}` }, { status: 502 });
      }
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
