import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { conActor, consultar, unaFila } from '@/lib/bd/conexion';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { esUuid } from '@/lib/esquema';
import { leerConfiguracion, lugaresPresencialesRestantes } from '@/lib/servidor/configuracion';
import { enviarCorreoRegistro, type ClavePlantilla } from '@/lib/servidor/correo';
import { ESTADOS, evaluarCambio, plantillaDeEstado, type EstadoRegistro } from '@/lib/estados';

export const dynamic = 'force-dynamic';

const esquema = z.object({
  estado: z.enum(ESTADOS),
  /** Avisar al participante por correo, en su idioma. */
  avisar: z.boolean().default(true),
});

/**
 * Cambia el estado de un registro. La escritura lleva el actor puesto
 * para que RLS valide el rol y el disparador de auditoría deje constancia de
 * quién lo hizo; el aviso por correo sale después, con la clave de servicio.
 */
export async function PATCH(peticion: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  if (!esUuid(id)) {
    return NextResponse.json({ mensaje: 'Registro no encontrado.' }, { status: 404 });
  }

  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarRegistros) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const analisis = esquema.safeParse(await peticion.json().catch(() => null));
  if (!analisis.success) {
    return NextResponse.json({ mensaje: 'Estado no válido.' }, { status: 422 });
  }

  const previo = await unaFila<Record<string, unknown> & { estado: string; modalidad: 'presencial' | 'en_linea' }>(
    'select * from registros where id = $1',
    [id],
  );

  if (!previo) return NextResponse.json({ mensaje: 'Registro no encontrado.' }, { status: 404 });

  const configuracion = await leerConfiguracion();
  const veredicto = evaluarCambio({
    desde: previo.estado as EstadoRegistro,
    hasta: analisis.data.estado,
    modalidad: previo.modalidad,
    lugaresLibres: lugaresPresencialesRestantes(configuracion),
  });

  if (!veredicto.permitido) {
    return NextResponse.json({ mensaje: veredicto.motivo }, { status: 409 });
  }

  const [registro] = await conActor<Record<string, unknown> & { estado: string; folio: string }>(
    usuario.id,
    'update registros set estado = $1 where id = $2 returning *',
    [analisis.data.estado, id],
  );

  if (!registro) {
    return NextResponse.json({ mensaje: 'Registro no encontrado.' }, { status: 404 });
  }

  let correo: { enviado: boolean; error?: string } = { enviado: false };
  const plantilla = plantillaDeEstado(analisis.data.estado);
  if (analisis.data.avisar && plantilla) {
    correo = await enviarCorreoRegistro({
      clave: plantilla as ClavePlantilla,
      registro,
      correoContacto: configuracion.correo_contacto,
      fechaLimite: configuracion.fecha_limite_registro,
      urlAgenda: configuracion.url_agenda,
    });
    if (correo.enviado) {
      await consultar('update registros set correo_enviado_en = now() where id = $1', [id]);
    }
  }

  return NextResponse.json({
    estado: registro.estado,
    folio: registro.folio,
    correo,
    variacionCupo: veredicto.variacionCupo,
  });
}
