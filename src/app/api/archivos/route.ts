import { NextRequest, NextResponse } from 'next/server';
import { googleConfigurado, subirArchivoADrive, type CarpetaDrive } from '@/lib/servidor/google';
import { leerDatosCongreso } from '@/lib/servidor/contenido';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Qué acepta cada destino y cómo se nombra lo que llega.
 *
 * La lista vive aquí y no en el navegador: el formulario también comprueba,
 * pero sólo para no hacer esperar a nadie. Quien mande una petición a mano
 * se encuentra esta misma puerta.
 */
const DESTINOS: Record<CarpetaDrive, { tipos: string[]; prefijo: string }> = {
  fotografia: { tipos: ['image/jpeg', 'image/png'], prefijo: 'retrato' },
  semblanza:  { tipos: ['application/pdf'], prefijo: 'semblanza' },
  boleto:     { tipos: ['application/pdf', 'image/jpeg'], prefijo: 'boleto' },
};

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

export async function POST(peticion: NextRequest) {
  if (!googleConfigurado()) {
    return NextResponse.json(
      { mensaje: 'La carga de archivos aún no está configurada.' },
      { status: 503 },
    );
  }

  const { foto_megabytes_maximo: maximoMb } = await leerDatosCongreso();
  const formulario = await peticion.formData();
  const archivo = formulario.get('archivo');
  const destino = String(formulario.get('destino') ?? 'fotografia') as CarpetaDrive;

  if (!DESTINOS[destino]) {
    return NextResponse.json({ mensaje: 'Destino de archivo desconocido.' }, { status: 400 });
  }
  if (!(archivo instanceof File)) {
    return NextResponse.json({ mensaje: 'No se recibió ningún archivo.' }, { status: 400 });
  }

  const { tipos, prefijo } = DESTINOS[destino];
  if (!tipos.includes(archivo.type)) {
    const nombres = tipos.map((t) => EXTENSIONES[t]?.toUpperCase() ?? t).join(' o ');
    return NextResponse.json({ mensaje: `Solo se aceptan archivos ${nombres}.` }, { status: 415 });
  }
  if (archivo.size > maximoMb * 1024 * 1024) {
    return NextResponse.json({ mensaje: `El archivo supera ${maximoMb} MB.` }, { status: 413 });
  }

  const extension = EXTENSIONES[archivo.type] ?? 'bin';
  const marca = new Date().toISOString().replace(/[:.]/g, '-');
  const nombreLimpio = archivo.name.replace(/[^\w.\-]/g, '_').slice(0, 60);

  try {
    const resultado = await subirArchivoADrive({
      nombre: `${prefijo}_${marca}_${nombreLimpio || `archivo.${extension}`}`,
      tipo: archivo.type,
      contenido: Buffer.from(await archivo.arrayBuffer()),
      carpeta: destino,
    });
    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    console.error('Carga a Drive fallida:', error);
    return NextResponse.json({ mensaje: 'No fue posible subir el archivo.' }, { status: 502 });
  }
}
