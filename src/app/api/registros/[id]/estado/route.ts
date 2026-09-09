import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
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
 * Cambia el estado de un registro. La escritura va con la sesión del usuario
 * para que RLS valide el rol y el disparador de auditoría deje constancia de
 * quién lo hizo; el aviso por correo sale después, con la clave de servicio.
 */
export async function PATCH(peticion: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;

  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarRegistros) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const analisis = esquema.safeParse(await peticion.json().catch(() => null));
  if (!analisis.success) {
    return NextResponse.json({ mensaje: 'Estado no válido.' }, { status: 422 });
  }

  const admin = crearClienteAdmin();
  const { data: previo } = await admin
    .from('registros')
    .select('*')
    .eq('id', id)
    .maybeSingle();

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

  const supabase = await crearClienteServidor();
  const { data: registro, error } = await supabase
    .from('registros')
    .update({ estado: analisis.data.estado })
    .eq('id', id)
    .select()
    .single();

  if (error || !registro) {
    return NextResponse.json({ mensaje: 'Su perfil no permite esta acción.' }, { status: 403 });
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
      await admin
        .from('registros')
        .update({ correo_enviado_en: new Date().toISOString() })
        .eq('id', id);
    }
  }

  return NextResponse.json({
    estado: registro.estado,
    folio: registro.folio,
    correo,
    variacionCupo: veredicto.variacionCupo,
  });
}
