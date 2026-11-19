import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { consultar } from '@/lib/bd/conexion';
import { aCsv } from '@/lib/asistencia';

/**
 * Borrar las asistencias «sin registro» (`@/lib/sin-registro` dice cuáles). Es de lo poco que se borra de verdad aquí, y no se
 * deshace desde el panel: antes de borrar se guarda una copia de cada fila en un CSV, con todas sus columnas, para poder volver a
 * ponerlas si hiciera falta. Nunca toca un registro.
 */

const COLUMNAS = ['id', 'sesion', 'via', 'origen', 'identificado_por', 'nombre', 'correo', 'capturado_nombre', 'capturado_correo', 'creada_en'] as const;

/** Guarda en `carpeta` una copia de esas asistencias, y devuelve la ruta del archivo. Con permiso sólo para su dueño: hay nombres y correos. */
export async function respaldarAsistencias(ids: readonly string[], carpeta: string, ahora: Date = new Date()): Promise<string> {
  const filas = await consultar<Record<(typeof COLUMNAS)[number], string | null>>(
    `select id::text, sesion, via, origen, identificado_por, nombre, correo, capturado_nombre, capturado_correo, creada_en::text
       from asistencias where id = any($1::uuid[]) order by creada_en, id`,
    [[...ids]],
  );
  await mkdir(carpeta, { recursive: true, mode: 0o700 });
  const marca = ahora.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const ruta = join(carpeta, `asistencias-sin-registro-${marca}.csv`);
  // Con la marca de orden de bytes, Excel abre los acentos bien.
  await writeFile(ruta, `﻿${aCsv([[...COLUMNAS], ...filas.map((f) => COLUMNAS.map((c) => f[c] ?? ''))])}\r\n`, { mode: 0o600 });
  return ruta;
}

/**
 * Borra esas asistencias, y sólo si siguen «sin registro»: una que alguien haya ligado a un registro entre la vista previa y el
 * borrado ya es de alguien y se queda. Devuelve cuántas borró.
 */
export async function eliminarAsistenciasSinRegistro(ids: readonly string[]): Promise<number> {
  const borradas = await consultar<{ id: string }>(
    'delete from asistencias where id = any($1::uuid[]) and registro_id is null returning id',
    [[...ids]],
  );
  return borradas.length;
}
