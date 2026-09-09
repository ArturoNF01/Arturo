import { NextRequest, NextResponse } from 'next/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { leerDatosCongreso } from '@/lib/servidor/contenido';
import { enviarCorreoRegistro } from '@/lib/servidor/correo';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import {
  debeRecibirRecordatorio, normalizarRecordatorios, recordatorioDeHoy, diasHasta,
} from '@/lib/recordatorios';
import { traducir } from '@/lib/contenido';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LOTE = 200;

/**
 * Envía el recordatorio que corresponde al día de hoy.
 *
 * Lo dispara el cron de Vercel, que se autentica con CRON_SECRET; también
 * puede lanzarlo a mano un organizador desde el panel. Cada envío queda
 * asentado con una restricción única, así que repetir la llamada el mismo día
 * no vuelve a escribir a nadie.
 */
async function ejecutar(forzarClave?: string) {
  const [configuracion, congreso] = await Promise.all([leerConfiguracion(), leerDatosCongreso()]);

  const admin = crearClienteAdmin();
  const { data: filaConfig } = await admin
    .from('configuracion')
    .select('valor')
    .eq('clave', 'recordatorios')
    .maybeSingle();

  const recordatorios = normalizarRecordatorios(filaConfig?.valor);
  const recordatorio = forzarClave
    ? recordatorios.find((r) => r.clave === forzarClave) ?? null
    : recordatorioDeHoy(recordatorios, congreso.fecha_inicio);

  if (!recordatorio) {
    return { enviados: 0, omitidos: 0, fallidos: 0, recordatorio: null as string | null };
  }

  const { data: registros } = await admin
    .from('registros')
    .select('*')
    .not('correo', 'is', null)
    .limit(2000);

  const { data: yaEnviados } = await admin
    .from('envios_recordatorio')
    .select('registro_id')
    .eq('clave', recordatorio.clave);

  const enviadosPrevios = new Set((yaEnviados ?? []).map((f) => f.registro_id as string));
  const pendientes = (registros ?? [])
    .filter((r) => debeRecibirRecordatorio(r.estado) && !enviadosPrevios.has(r.id))
    .slice(0, LOTE);

  const diasFaltantes = diasHasta(congreso.fecha_inicio) ?? recordatorio.dias_antes;
  let enviados = 0;
  let fallidos = 0;

  for (const registro of pendientes) {
    const idioma = (registro.idioma as 'es' | 'en' | 'pt') ?? 'es';
    const resultado = await enviarCorreoRegistro({
      clave: 'recordatorio',
      registro: {
        ...registro,
        // Variables propias del recordatorio, para no rehacer la plantilla.
        dias_faltantes: String(Math.max(0, diasFaltantes)),
        sede: traducir(congreso.sede, idioma),
        fechas: traducir(congreso.fechas, idioma),
      },
      correoContacto: configuracion.correo_contacto,
      fechaLimite: configuracion.fecha_limite_registro,
      urlAgenda: configuracion.url_agenda,
    });

    // El envío se asienta pase lo que pase: así un fallo puntual queda
    // registrado y no se reintenta en bucle contra la misma dirección.
    await admin.from('envios_recordatorio').insert({
      registro_id: registro.id,
      clave: recordatorio.clave,
      error: resultado.enviado ? null : resultado.error ?? 'Error desconocido',
    });

    if (resultado.enviado) enviados += 1;
    else fallidos += 1;
  }

  return {
    enviados,
    fallidos,
    omitidos: enviadosPrevios.size,
    recordatorio: recordatorio.clave,
  };
}

/** Punto de entrada del cron de Vercel. */
export async function GET(peticion: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  const cabecera = peticion.headers.get('authorization');

  if (!secreto) {
    return NextResponse.json({ mensaje: 'Falta CRON_SECRET.' }, { status: 503 });
  }
  if (cabecera !== `Bearer ${secreto}`) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 401 });
  }

  try {
    return NextResponse.json(await ejecutar());
  } catch (error) {
    console.error('Recordatorios fallidos:', error);
    return NextResponse.json({ mensaje: 'Error al enviar los recordatorios.' }, { status: 500 });
  }
}

/** Envío manual desde el panel, para adelantar o repetir un recordatorio. */
export async function POST(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarConfiguracion) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const cuerpo = (await peticion.json().catch(() => ({}))) as { clave?: string };
  try {
    return NextResponse.json(await ejecutar(cuerpo.clave));
  } catch (error) {
    console.error('Recordatorios fallidos:', error);
    return NextResponse.json({ mensaje: 'Error al enviar los recordatorios.' }, { status: 500 });
  }
}
