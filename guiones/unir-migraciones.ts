/**
 * Une las migraciones en un solo archivo, en orden, para poder pegarlas de
 * una vez en el editor SQL de Supabase.
 *
 *   npx tsx guiones/unir-migraciones.ts
 *
 * El archivo resultante es equivalente a ejecutarlas una por una: cada
 * migración ya está escrita para poder repetirse sin romper nada.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CARPETA = 'supabase/migrations';
const SALIDA = 'supabase/todas-las-migraciones.sql';

const archivos = readdirSync(CARPETA).filter((n) => n.endsWith('.sql')).sort();

const partes = archivos.map((nombre) => {
  const contenido = readFileSync(join(CARPETA, nombre), 'utf8').trimEnd();
  return [
    '-- ####################################################################',
    `-- ${nombre}`,
    '-- ####################################################################',
    '',
    contenido,
    '',
  ].join('\n');
});

const cabecera = `-- =====================================================================
-- 1er Congreso · Esquema completo de la base de datos
--
-- Generado con: npx tsx guiones/unir-migraciones.ts
-- No editar a mano: los cambios se hacen en supabase/migrations/.
--
-- Cómo usarlo: copiar todo este archivo y pegarlo en el editor SQL de
-- Supabase (SQL Editor → New query → pegar → Run). Se puede ejecutar más de
-- una vez sin romper nada.
--
-- Incluye, en orden: ${archivos.join(', ')}
-- =====================================================================

`;

writeFileSync(SALIDA, cabecera + partes.join('\n'));
console.log(`${SALIDA} · ${archivos.length} migraciones · ${Math.round((cabecera + partes.join('\n')).length / 1024)} KB`);
