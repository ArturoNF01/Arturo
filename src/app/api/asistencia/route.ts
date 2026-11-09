import { NextRequest, NextResponse } from 'next/server';
import { huellaDePeticion } from '@/lib/servidor/antiabuso';
import { buscarPersonaPorCorreo, registrarAsistencia } from '@/lib/servidor/asistencia';
import { pedirSincronizacionDeAsistencias } from '@/lib/servidor/sheets-asistencia';

export const dynamic = 'force-dynamic';

/**
 * El límite es holgado a propósito: en la sede, cientos de personas escanean desde la misma red wifi
 * y llegan con la misma dirección. Sólo está para frenar a un programa que pruebe correos sin parar.
 * Vive en memoria: el sitio corre en un solo proceso, y reiniciarlo sólo lo reinicia a cero.
 */
const VENTANA_MS = 10 * 60_000;
// Cada persona hace una búsqueda del correo y un registro, a veces más: 300 personas a la vez son ~1,000 llamadas.
const MAXIMO_POR_HUELLA = 3000;
const intentos = new Map<string, number[]>();

function pasaElLimite(huella: string, ahora: number): boolean {
  const recientes = (intentos.get(huella) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= MAXIMO_POR_HUELLA) {
    intentos.set(huella, recientes);
    return false;
  }
  recientes.push(ahora);
  intentos.set(huella, recientes);
  // Para que el mapa no crezca sin fin con direcciones que no vuelven.
  if (intentos.size > 5000) {
    for (const [clave, tiempos] of intentos) {
      if (tiempos.every((t) => ahora - t >= VENTANA_MS)) intentos.delete(clave);
    }
  }
  return true;
}

/**
 * Registra la asistencia de quien escaneó un QR o abrió el enlace del chat. Es pública —no hay cuenta—:
 * lo que protege es el código (distinto por sesión y por vía), su horario y que sólo se guarda a
 * quien aparece en los registros o queda marcado «sin registro» para que el comité lo concilie.
 */
export async function POST(peticion: NextRequest) {
  const cuerpo = (await peticion.json().catch(() => null)) as Record<string, unknown> | null;
  if (!cuerpo || typeof cuerpo.codigo !== 'string' || typeof cuerpo.correo !== 'string') {
    return NextResponse.json({ ok: false, motivo: 'datos_invalidos' }, { status: 422 });
  }

  if (!pasaElLimite(huellaDePeticion(peticion), Date.now())) {
    return NextResponse.json({ ok: false, motivo: 'limite' }, { status: 429 });
  }

  try {
    // Antes de registrar, la pantalla busca el correo para rellenar el nombre completo. No escribe nada.
    if (cuerpo.accion === 'buscar') {
      return NextResponse.json(await buscarPersonaPorCorreo({ codigo: cuerpo.codigo, correo: cuerpo.correo }));
    }
    const respuesta = await registrarAsistencia({
      codigo: cuerpo.codigo,
      correo: cuerpo.correo,
      nombre: typeof cuerpo.nombre === 'string' ? cuerpo.nombre : undefined,
    });
    // La asistencia ya está en la base. A la hoja pasa unos segundos después, junto con las demás de esa ráfaga.
    if (respuesta.ok && respuesta.estado === 'registrada') pedirSincronizacionDeAsistencias();
    return NextResponse.json(respuesta);
  } catch (error) {
    console.error('No se pudo registrar la asistencia:', error);
    return NextResponse.json({ ok: false, motivo: 'error' }, { status: 500 });
  }
}
