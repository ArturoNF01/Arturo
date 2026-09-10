import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { armarInsercion, conActor, consultar } from '@/lib/bd/conexion';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';
import { sembrarContenido } from '@/lib/servidor/contenido';

export const dynamic = 'force-dynamic';

/** Tablas de contenido editable y el rol mínimo que puede escribirlas. */
const TABLAS = {
  ejes_tematicos: 'organizador',
  faqs: 'organizador',
  // El aviso sostiene el consentimiento y su versión: sólo superadministración.
  aviso_privacidad: 'superadmin',
} as const;

type Tabla = keyof typeof TABLAS;

const multilingue = z.record(z.enum(['es', 'en', 'pt']), z.string().max(20000));
const multilingueLista = z.record(z.enum(['es', 'en', 'pt']), z.array(z.string().max(20000)).max(30));

const esquemas: Record<Tabla, z.ZodTypeAny> = {
  ejes_tematicos: z.object({
    clave: z.string().trim().regex(/^[a-z0-9_]+$/, 'Sólo minúsculas, números y guion bajo').max(60),
    nombre: multilingue,
    descripcion: multilingue.optional().default({}),
    orden: z.number().int().min(0).max(999).default(0),
    activo: z.boolean().default(true),
  }),
  faqs: z.object({
    clave: z.string().trim().regex(/^[a-z0-9_-]+$/).max(60),
    categoria: multilingue,
    pregunta: multilingue,
    respuesta: multilingue,
    orden: z.number().int().min(0).max(999).default(0),
    activa: z.boolean().default(true),
    provisional: z.boolean().default(false),
  }),
  aviso_privacidad: z.object({
    clave: z.string().trim().regex(/^[a-z0-9_]+$/).max(60),
    titulo: multilingue,
    parrafos: multilingueLista,
    orden: z.number().int().min(0).max(999).default(0),
    activo: z.boolean().default(true),
  }),
};

function tablaValida(valor: string | null): valor is Tabla {
  return valor !== null && valor in TABLAS;
}

export async function GET(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });

  const tabla = peticion.nextUrl.searchParams.get('tabla');
  if (!tablaValida(tabla)) {
    return NextResponse.json({ mensaje: 'Tabla no admitida.' }, { status: 400 });
  }

  try {
    // `tabla` viene de una lista blanca, nunca directamente del usuario.
    const filas = await consultar(`select * from ${tabla} order by orden`);
    return NextResponse.json(filas);
  } catch (error) {
    console.error('No se pudo leer el contenido:', error);
    return NextResponse.json({ mensaje: 'No fue posible leer el contenido.' }, { status: 500 });
  }
}

/** Alta o modificación de una fila, identificada por su clave. */
export async function PUT(peticion: NextRequest) {
  const usuario = await usuarioActual();
  const tabla = peticion.nextUrl.searchParams.get('tabla');
  if (!tablaValida(tabla)) {
    return NextResponse.json({ mensaje: 'Tabla no admitida.' }, { status: 400 });
  }
  if (!usuario || !permisos(usuario.rol)[TABLAS[tabla] === 'superadmin' ? 'gestionarUsuarios' : 'editarConfiguracion']) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const analisis = esquemas[tabla].safeParse(await peticion.json().catch(() => null));
  if (!analisis.success) {
    return NextResponse.json(
      { mensaje: analisis.error.issues[0]?.message ?? 'Contenido no válido.' },
      { status: 422 },
    );
  }

  const { columnas, marcadores, valores } = armarInsercion(analisis.data);
  const actualizables = Object.keys(analisis.data).filter((c) => c !== 'clave');

  try {
    await conActor(
      usuario.id,
      `insert into ${tabla} (${columnas}) values (${marcadores})
       on conflict (clave) do update set
         ${actualizables.map((c) => `${c} = excluded.${c}`).join(', ')}`,
      valores,
    );
  } catch (error) {
    console.error('No se pudo guardar el contenido:', error);
    return NextResponse.json({ mensaje: 'No fue posible guardar el contenido.' }, { status: 500 });
  }

  return NextResponse.json({ guardado: true });
}

export async function DELETE(peticion: NextRequest) {
  const usuario = await usuarioActual();
  const tabla = peticion.nextUrl.searchParams.get('tabla');
  const clave = peticion.nextUrl.searchParams.get('clave');

  if (!tablaValida(tabla) || !clave) {
    return NextResponse.json({ mensaje: 'Petición incompleta.' }, { status: 400 });
  }
  if (!usuario || !permisos(usuario.rol).editarConfiguracion) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  try {
    await conActor(usuario.id, `delete from ${tabla} where clave = $1`, [clave]);
  } catch (error) {
    console.error('No se pudo eliminar el contenido:', error);
    return NextResponse.json({ mensaje: 'No fue posible eliminar la fila.' }, { status: 500 });
  }

  return NextResponse.json({ eliminado: true });
}

/** Copia las propuestas del código a la base para dejarlas editables. */
export async function POST() {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).editarConfiguracion) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  try {
    return NextResponse.json(await sembrarContenido());
  } catch (error) {
    return NextResponse.json(
      { mensaje: error instanceof Error ? error.message : 'No fue posible sembrar el contenido.' },
      { status: 500 },
    );
  }
}
