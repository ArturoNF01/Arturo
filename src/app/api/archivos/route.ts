import { NextRequest, NextResponse } from 'next/server';
import { googleConfigurado, subirArchivoADrive } from '@/lib/servidor/google';
import { leerDatosCongreso } from '@/lib/servidor/contenido';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png'];

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

  if (!(archivo instanceof File)) {
    return NextResponse.json({ mensaje: 'No se recibió ningún archivo.' }, { status: 400 });
  }
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return NextResponse.json({ mensaje: 'Solo se aceptan imágenes JPG o PNG.' }, { status: 415 });
  }
  if (archivo.size > maximoMb * 1024 * 1024) {
    return NextResponse.json({ mensaje: `El archivo supera ${maximoMb} MB.` }, { status: 413 });
  }

  const extension = archivo.type === 'image/png' ? 'png' : 'jpg';
  const marca = new Date().toISOString().replace(/[:.]/g, '-');
  const nombreLimpio = archivo.name.replace(/[^\w.\-]/g, '_').slice(0, 60);

  try {
    const resultado = await subirArchivoADrive({
      nombre: `retrato_${marca}_${nombreLimpio || `foto.${extension}`}`,
      tipo: archivo.type,
      contenido: Buffer.from(await archivo.arrayBuffer()),
    });
    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    console.error('Carga a Drive fallida:', error);
    return NextResponse.json({ mensaje: 'No fue posible subir el archivo.' }, { status: 502 });
  }
}
