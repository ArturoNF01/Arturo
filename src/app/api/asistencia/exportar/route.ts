import { NextRequest, NextResponse } from 'next/server';
import { aCsv, diaDeClave, sesionPorClave } from '@/lib/asistencia';
import { asistentesDeSesion, todasLasAsistencias } from '@/lib/servidor/asistencia';
import { permisos, usuarioActual } from '@/lib/servidor/sesion';

export const dynamic = 'force-dynamic';

const HORA = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'medium',
});

/**
 * La asistencia en CSV, completa o de un día (`?sesion=jueves`). Lleva nombre y correo, y la descarga quien
 * la ve en el panel (desde el rol de lector). La exportación de los registros es otra, con su propio permiso.
 */
export async function GET(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).exportarAsistencia) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const sesion = peticion.nextUrl.searchParams.get('sesion');
  if (sesion && !sesionPorClave(sesion)) return NextResponse.json({ mensaje: 'Sesión no válida.' }, { status: 422 });

  try {
    const filas = sesion ? await asistentesDeSesion(sesion) : await todasLasAsistencias();
    const csv = aCsv([
      ['N.º', 'Nombre', 'Correo', 'Día', 'Modalidad', 'Hora de registro', 'Folio', 'Identificación'],
      ...filas.map((f, i) => [
        i + 1, f.nombre, f.correo, diaDeClave(f.sesion),
        f.via === 'presencial' ? 'Presencial' : 'En línea',
        HORA.format(new Date(f.creada_en)), f.folio ?? '',
        { correo: 'Por correo', nombre: 'Por nombre', conciliada: 'Conciliada', ninguno: 'Sin registro' }[f.identificado_por],
      ]),
    ]);
    // El BOM hace que Excel abra el CSV con los acentos bien.
    return new NextResponse(`﻿${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="asistencia_${sesion ?? 'completa'}_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error('No se pudo exportar la asistencia:', error);
    return NextResponse.json({ mensaje: 'No fue posible exportar la asistencia.' }, { status: 500 });
  }
}
