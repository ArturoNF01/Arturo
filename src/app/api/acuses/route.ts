import { NextRequest, NextResponse } from 'next/server';
import { consultar } from '@/lib/bd/conexion';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { enviarCorreoRegistro } from '@/lib/servidor/correo';
import { leerConfiguracion } from '@/lib/servidor/configuracion';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LOTE_MAXIMO = 100;

/**
 * Vuelve a mandar los acuses que no salieron.
 *
 * Hace falta porque el acuse se intenta una sola vez, al registrarse, y hasta
 * ahora un fallo en ese instante era definitivo: si el correo no estaba
 * conectado —o Resend devolvía un error pasajero— esa persona se quedaba sin
 * su acuse para siempre, aunque el problema se arreglara diez minutos
 * después. El motivo quedaba guardado en la fila y nadie podía actuar sobre
 * él. Esto cierra el círculo: arreglado el envío, el comité reintenta desde
 * el panel y los acuses pendientes salen.
 *
 * Sin `id` reintenta todos los que quedaron sin acuse; con `id`, uno solo.
 */
export async function POST(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarConfiguracion) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  if (!process.env.RESEND_API_KEY || !process.env.CORREO_REMITENTE) {
    return NextResponse.json(
      { mensaje: 'El correo no está conectado: falta la clave de Resend en el servidor.' },
      { status: 503 },
    );
  }

  const cuerpo = (await peticion.json().catch(() => ({}))) as { id?: string };

  let registros: (Record<string, unknown> & { id: string; folio: string; estado: string })[];
  try {
    registros = cuerpo.id
      ? await consultar('select * from registros where id = $1 limit 1', [cuerpo.id])
      : await consultar(
          `select * from registros
            where correo_enviado_en is null
            order by creado_en
            limit $1`,
          [LOTE_MAXIMO],
        );
  } catch (error) {
    console.error('No se pudieron leer los registros sin acuse:', error);
    return NextResponse.json({ mensaje: 'No fue posible leer los registros.' }, { status: 500 });
  }

  const configuracion = await leerConfiguracion();
  let enviados = 0;
  const fallidos: { folio: string; error: string }[] = [];

  for (const registro of registros) {
    // La plantilla depende del estado actual, no del que tenía al
    // registrarse: a quien pasó a lista de espera no se le puede mandar
    // ahora un acuse que le da por confirmado.
    const resultado = await enviarCorreoRegistro({
      clave: registro.estado === 'lista_espera' ? 'lista_espera' : 'confirmacion_registro',
      registro,
      correoContacto: configuracion.correo_contacto,
      fechaLimite: configuracion.fecha_limite_registro,
      urlAgenda: configuracion.url_agenda,
    });

    if (resultado.enviado) {
      await consultar(
        'update registros set correo_enviado_en = now(), correo_error = null where id = $1',
        [registro.id],
      );
      enviados += 1;
    } else {
      const motivo = resultado.error ?? 'Error de envío.';
      await consultar('update registros set correo_error = $2 where id = $1', [
        registro.id,
        motivo,
      ]);
      fallidos.push({ folio: registro.folio, error: motivo });
    }
  }

  return NextResponse.json({ enviados, fallidos });
}
