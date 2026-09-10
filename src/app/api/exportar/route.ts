import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { consultar } from '@/lib/bd/conexion';
import { usuarioActual, permisos } from '@/lib/servidor/sesion';

export const dynamic = 'force-dynamic';

const FORMATOS = ['csv', 'xlsx', 'json'] as const;
type Formato = (typeof FORMATOS)[number];

export async function GET(peticion: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario || !permisos(usuario.rol).exportar) {
    return NextResponse.json({ mensaje: 'No autorizado.' }, { status: 403 });
  }

  const formato = (peticion.nextUrl.searchParams.get('formato') ?? 'csv') as Formato;
  if (!FORMATOS.includes(formato)) {
    return NextResponse.json({ mensaje: 'Formato no admitido.' }, { status: 400 });
  }

  let crudas: Record<string, unknown>[];
  try {
    crudas = await consultar('select * from registros order by creado_en desc');
  } catch (error) {
    console.error('No se pudo exportar:', error);
    return NextResponse.json({ mensaje: 'No fue posible leer los registros.' }, { status: 500 });
  }

  const filas = crudas.map((fila) => {
    const plano: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(fila)) {
      // El token de edición no sale nunca en una exportación.
      if (clave === 'token_edicion') continue;
      plano[clave] = Array.isArray(valor) ? valor.join('; ') : valor;
    }
    return plano;
  });

  const marca = new Date().toISOString().slice(0, 10);
  const nombre = `registros_congreso_${marca}`;

  if (formato === 'json') {
    return new NextResponse(JSON.stringify(filas, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nombre}.json"`,
      },
    });
  }

  const hoja = XLSX.utils.json_to_sheet(filas);

  if (formato === 'csv') {
    // El BOM hace que Excel abra el CSV con los acentos correctos.
    const csv = `﻿${XLSX.utils.sheet_to_csv(hoja)}`;
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nombre}.csv"`,
      },
    });
  }

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Registros');
  const binario = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new NextResponse(new Uint8Array(binario), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}.xlsx"`,
    },
  });
}
