import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { conActor, unaFila } from '@/lib/bd/conexion';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { enviarCorreoRegistro, type ClavePlantilla } from '@/lib/servidor/correo';
import { ESTADOS_PONENCIA, evaluarDictamen, plantillaDeDictamen } from '@/lib/dictamen';

export const dynamic = 'force-dynamic';

const esquema = z.object({
  estado_ponencia: z.enum(ESTADOS_PONENCIA),
  comentarios: z.string().trim().max(5000).default(''),
  avisar: z.boolean().default(true),
});

/** Registra el dictamen de una ponencia y, si procede, avisa a quien la envió. */
export async function PATCH(peticion: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;

  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarRegistros) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const analisis = esquema.safeParse(await peticion.json().catch(() => null));
  if (!analisis.success) {
    return NextResponse.json({ mensaje: 'Dictamen no válido.' }, { status: 422 });
  }

  const previo = await unaFila<{ titulo_ponencia: string | null; resumen_ponencia: string | null }>(
    'select titulo_ponencia, resumen_ponencia from registros where id = $1',
    [id],
  );
  if (!previo) return NextResponse.json({ mensaje: 'Registro no encontrado.' }, { status: 404 });

  const veredicto = evaluarDictamen({
    estado: analisis.data.estado_ponencia,
    comentarios: analisis.data.comentarios,
    tienePonencia: Boolean(
      (previo.titulo_ponencia ?? '').trim() || (previo.resumen_ponencia ?? '').trim(),
    ),
  });
  if (!veredicto.permitido) {
    return NextResponse.json({ mensaje: veredicto.motivo }, { status: 409 });
  }

  // La escritura lleva el actor puesto para que la auditoría registre quién
  // dictaminó.
  const [registro] = await conActor<Record<string, unknown> & { estado_ponencia: string; folio: string }>(
    usuario.id,
    `update registros
        set estado_ponencia = $1, dictamen_comentarios = $2,
            dictamen_por = $3, dictamen_en = now()
      where id = $4
      returning *`,
    [
      analisis.data.estado_ponencia,
      analisis.data.comentarios || null,
      usuario.id,
      id,
    ],
  );

  if (!registro) {
    return NextResponse.json({ mensaje: 'Registro no encontrado.' }, { status: 404 });
  }

  let correo: { enviado: boolean; error?: string } = { enviado: false };
  const plantilla = plantillaDeDictamen(analisis.data.estado_ponencia);
  if (analisis.data.avisar && plantilla) {
    const configuracion = await leerConfiguracion();
    correo = await enviarCorreoRegistro({
      clave: plantilla as ClavePlantilla,
      registro,
      correoContacto: configuracion.correo_contacto,
      fechaLimite: configuracion.fecha_limite_registro,
      urlAgenda: configuracion.url_agenda,
    });
  }

  return NextResponse.json({
    estado_ponencia: registro.estado_ponencia,
    folio: registro.folio,
    correo,
  });
}
