import { NextRequest, NextResponse } from 'next/server';
import { consultar, unaFila } from '@/lib/bd/conexion';
import { leerConfiguracion } from '@/lib/servidor/configuracion';
import { leerDatosCongreso } from '@/lib/servidor/contenido';
import { enviarCorreoRegistro } from '@/lib/servidor/correo';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import {
  debeRecibirRecordatorio, normalizarRecordatorios, recordatorioDeHoy, diasHasta,
} from '@/lib/recordatorios';
import { traducir } from '@/lib/contenido';
import { purgarIntentos } from '@/lib/servidor/antiabuso';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LOTE = 200;

/**
 * Envía el recordatorio que corresponde al día de hoy.
 *
 * Lo dispara el trabajo programado, que se autentica con CRON_SECRET;
 * también puede lanzarlo a mano un organizador desde el panel. Cada envío queda
 * asentado con una restricción única, así que repetir la llamada el mismo día
 * no vuelve a escribir a nadie.
 */
async function ejecutar(forzarClave?: string) {
  // El cron diario aprovecha para borrar los intentos de registro que ya no
  // cuentan para el límite por dirección de origen.
  await purgarIntentos();

  const [configuracion, congreso] = await Promise.all([leerConfiguracion(), leerDatosCongreso()]);

  const filaConfig = await unaFila<{ valor: unknown }>(
    `select valor from configuracion where clave = 'recordatorios'`,
  );

  const recordatorios = normalizarRecordatorios(filaConfig?.valor);
  const recordatorio = forzarClave
    ? recordatorios.find((r) => r.clave === forzarClave) ?? null
    : recordatorioDeHoy(recordatorios, congreso.fecha_inicio);

  if (!recordatorio) {
    return { enviados: 0, omitidos: 0, fallidos: 0, recordatorio: null as string | null };
  }

  // Quien ya lo recibió queda fuera en la propia consulta: con miles de
  // registros, filtrarlo en memoria obligaría a traérselos todos.
  const pendientes = await consultar<Record<string, unknown> & { id: string; estado: string }>(
    `select r.* from registros r
      where r.correo is not null
        and not exists (
          select 1 from envios_recordatorio e
           where e.registro_id = r.id and e.clave = $1
        )
      order by r.creado_en
      limit $2`,
    [recordatorio.clave, LOTE],
  ).then((filas) => filas.filter((r) => debeRecibirRecordatorio(r.estado)));

  const yaEnviados = await unaFila<{ total: string }>(
    'select count(*)::text as total from envios_recordatorio where clave = $1',
    [recordatorio.clave],
  );
  const enviadosPrevios = Number(yaEnviados?.total ?? 0);

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
    await consultar(
      `insert into envios_recordatorio (registro_id, clave, error)
       values ($1, $2, $3)
       on conflict (registro_id, clave) do nothing`,
      [registro.id, recordatorio.clave, resultado.enviado ? null : resultado.error ?? 'Error desconocido'],
    );

    if (resultado.enviado) enviados += 1;
    else fallidos += 1;
  }

  return {
    enviados,
    fallidos,
    omitidos: enviadosPrevios,
    recordatorio: recordatorio.clave,
  };
}

/** Punto de entrada del trabajo programado. */
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
