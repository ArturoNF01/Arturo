/**
 * Compara, fila por fila, lo que hay en la base con lo que hay en la hoja.
 *
 *   npm run cotejar-hoja              # el resumen
 *   npm run cotejar-hoja -- --todo    # además, cada folio descuadrado
 *
 * No escribe nada, ni en la base ni en la hoja: sólo mira y cuenta. Cuando
 * la hoja deja de llenarse, lo que hace falta es saber tres cosas —desde
 * cuándo, a cuántos registros alcanza y por qué—, y las tres están en el
 * propio sistema: cada registro guarda cuándo se copió y, si falló, el
 * motivo exacto que devolvió Google.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

const TODO = process.argv.includes('--todo');

function titulo(texto: string) {
  console.log(`\n\x1b[1m── ${texto}\x1b[0m`);
}

/** Una lista larga se corta, salvo que se pida verla entera. */
function enumerar(valores: string[], tope = 10): string {
  if (valores.length === 0) return '';
  const visibles = TODO ? valores : valores.slice(0, tope);
  const resto = valores.length - visibles.length;
  return `     ${visibles.join(', ')}${resto > 0 ? ` … y ${resto} más (--todo las enseña)` : ''}`;
}

async function principal() {
  const { consultar } = await import('../src/lib/bd/conexion');
  const { HOJAS, filasDeRegistro } = await import('../src/lib/normalizacion');
  const { cotejarCeldas, cotejarEncabezados, cotejarFolios } = await import('../src/lib/cotejo');
  const { clienteSheets, googleConfigurado } = await import('../src/lib/servidor/google');

  if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL.'); process.exit(1); }
  const idLibro = process.env.GOOGLE_SHEETS_ID;
  if (!googleConfigurado() || !idLibro) {
    console.error('Google no está conectado: faltan las variables en el .env.');
    process.exit(1);
  }

  const sheets = clienteSheets();

  // ---- 1. Los encabezados --------------------------------------------
  titulo('Encabezados de la hoja');
  const nombres = Object.keys(HOJAS);
  // En la misma llamada va la primera columna entera: con ella se sabe no
  // sólo si los títulos son los de ahora, sino *dónde* están. Una pestaña a
  // la que se le borraron los encabezados recibe la primera fila de datos en
  // A1 y las siguientes la van empujando hacia abajo, hasta que los títulos
  // acaban al final de la hoja, debajo de todo.
  const primeras = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: idLibro,
    ranges: [...nombres.map((n) => `${n}!1:1`), ...nombres.map((n) => `${n}!A:A`)],
  });

  const enLaHoja: Record<string, string[]> = {};
  const columnaA: Record<string, string[]> = {};
  for (const [i, nombre] of nombres.entries()) {
    enLaHoja[nombre] = (primeras.data.valueRanges?.[i]?.values?.[0] ?? []) as string[];
    columnaA[nombre] = ((primeras.data.valueRanges?.[nombres.length + i]?.values ?? []) as string[][])
      .map((f) => String(f?.[0] ?? ''));
  }
  const desfases = cotejarEncabezados(enLaHoja);

  /** En qué fila está la de títulos, si no es la primera. 0 = no aparece. */
  const filaDeTitulos = (nombre: string): number => {
    const primera = HOJAS[nombre][0];
    const indice = columnaA[nombre].findIndex((celda) => celda === primera);
    return indice + 1;
  };

  const sueltos: string[] = [];
  for (const nombre of nombres) {
    const desfase = desfases.find((d) => d.pestana === nombre);
    const fila = filaDeTitulos(nombre);
    if (!desfase) {
      const vacia = enLaHoja[nombre].length === 0;
      if (vacia && fila > 1) {
        console.log(`  \x1b[33m${nombre}: los títulos están en la fila ${fila}, debajo de los datos\x1b[0m`);
        console.log('     la primera fila se quedó en blanco y Google fue escribiendo encima');
        sueltos.push(nombre);
        continue;
      }
      console.log(`  ${nombre}: ${vacia ? 'vacía, se escribirá sola' : `al día (${HOJAS[nombre].length} columnas)`}`);
      continue;
    }
    // Si los títulos aparecen más abajo, el problema no es que las columnas
    // sean otras: es que la fila 1 dejó de ser la de los títulos y lo que
    // hay en ella es un registro. Decirlo así ahorra media hora de
    // desconcierto —«tiene 30 columnas y el sistema espera 30»—.
    if (fila > 1) {
      console.log(`  \x1b[33m${nombre}: los títulos están en la fila ${fila}, no en la 1\x1b[0m`);
      console.log(`     lo que hay en la fila 1 es un registro: ${desfase.sobran.slice(0, 3).join(', ')}…`);
      sueltos.push(nombre);
      continue;
    }
    console.log(`  \x1b[33m${nombre}: desfasada\x1b[0m — la hoja tiene ${desfase.tiene} columnas y el sistema espera ${desfase.espera}`);
    if (desfase.faltan.length) console.log(`     le faltan: ${desfase.faltan.join(', ')}`);
    if (desfase.sobran.length) console.log(`     le sobran: ${desfase.sobran.join(', ')}`);
  }
  // Los que ya se contaron como «títulos fuera de sitio» no se repiten.
  const desfasadas = desfases.filter((d) => !sueltos.includes(d.pestana)).length + sueltos.length;

  // ---- 2. Qué dice el propio sistema ----------------------------------
  titulo('Lo que el sistema anotó de cada registro');
  const [conteo] = await consultar<{ total: string; copiados: string; pendientes: string; con_error: string }>(
    `select count(*) as total,
            count(*) filter (where sheets_sincronizado_en is not null) as copiados,
            count(*) filter (where sheets_sincronizado_en is null)     as pendientes,
            count(*) filter (where sheets_error is not null)           as con_error
       from registros`,
  );
  console.log(`  Registros en la base: ${conteo.total}`);
  console.log(`  Copiados a la hoja:   ${conteo.copiados}`);
  console.log(`  Sin copiar:           ${conteo.pendientes}`);

  const motivos = await consultar<{ motivo: string; cuantos: string; desde: string; hasta: string }>(
    `select sheets_error as motivo, count(*) as cuantos,
            min(creado_en)::date::text as desde, max(creado_en)::date::text as hasta
       from registros where sheets_error is not null
      group by sheets_error order by count(*) desc`,
  );
  if (motivos.length === 0) {
    console.log('  Ningún registro guarda un motivo de fallo.');
  } else {
    console.log('\n  Motivos guardados:');
    for (const m of motivos) {
      console.log(`   \x1b[33m${m.cuantos} registros\x1b[0m, del ${m.desde} al ${m.hasta}:`);
      console.log(`     ${m.motivo}`);
    }
  }

  const [corte] = await consultar<{ ultimo: string | null; primero_sin: string | null }>(
    `select max(sheets_sincronizado_en)::text as ultimo,
            (select min(creado_en)::text from registros where sheets_sincronizado_en is null)
              as primero_sin
       from registros`,
  );
  if (corte.ultimo) console.log(`\n  Última copia con éxito:        ${corte.ultimo}`);
  if (corte.primero_sin) console.log(`  Primer registro sin copiar:    ${corte.primero_sin}`);

  // ---- 3. Fila por fila ------------------------------------------------
  titulo('Cotejo fila por fila de REG_Respuestas');
  const registros = await consultar<Record<string, unknown>>(
    'select * from registros order by creado_en',
  );
  const columnaFolio = await sheets.spreadsheets.values.get({
    spreadsheetId: idLibro,
    // La columna B: la A lleva el número de orden.
    range: 'REG_Respuestas!B2:B',
  });
  const foliosHoja = (columnaFolio.data.values ?? []).map((f) => String(f?.[0] ?? ''));

  const descuadre = cotejarFolios(registros.map((r) => String(r.folio)), foliosHoja);
  const { faltanEnHoja, sobranEnHoja } = descuadre;
  const repetidos = descuadre.repetidosEnHoja.map((r) => `${r.folio} (×${r.veces})`);

  console.log(`  Filas en la hoja:     ${foliosHoja.length}`);
  console.log(`  Registros en la base: ${registros.length}`);
  console.log(`  ${faltanEnHoja.length === 0 ? '✓' : '\x1b[33m✗\x1b[0m'} En la base y no en la hoja: ${faltanEnHoja.length}`);
  if (faltanEnHoja.length) console.log(enumerar(faltanEnHoja));
  console.log(`  ${sobranEnHoja.length === 0 ? '✓' : '\x1b[33m✗\x1b[0m'} En la hoja y no en la base: ${sobranEnHoja.length}`);
  if (sobranEnHoja.length) console.log(enumerar(sobranEnHoja));
  console.log(`  ${repetidos.length === 0 ? '✓' : '\x1b[33m✗\x1b[0m'} Repetidos en la hoja:       ${repetidos.length}`);
  if (repetidos.length) console.log(enumerar(repetidos));

  // ---- 4. Celda por celda, de los que sí están en las dos --------------
  // Una fila presente pero desplazada es peor que una que falta: la que
  // falta se ve, la desplazada se lee como si fuera buena.
  if (desfasadas === 0) {
    const completa = await sheets.spreadsheets.values.get({
      spreadsheetId: idLibro,
      range: 'REG_Respuestas!A2:ZZ',
    });
    const porFolio = new Map<string, string[]>();
    for (const fila of (completa.data.values ?? []) as string[][]) {
      const folio = String(fila[1] ?? '').trim();
      if (folio && !porFolio.has(folio)) porFolio.set(folio, fila);
    }

    const distintos: string[] = [];
    for (const r of registros) {
      const enHoja = porFolio.get(String(r.folio));
      if (!enHoja) continue;
      const columnas = cotejarCeldas(filasDeRegistro(r).REG_Respuestas[0], enHoja);
      if (columnas.length) distintos.push(`${r.folio} (${columnas.join(', ')})`);
    }
    console.log(`  ${distintos.length === 0 ? '✓' : '\x1b[33m✗\x1b[0m'} Con alguna celda distinta:  ${distintos.length}`);
    if (distintos.length) console.log(enumerar(distintos));
  } else {
    console.log('  (el cotejo celda por celda se salta: con los encabezados desfasados');
    console.log('   todas las columnas saldrían distintas y el dato no diría nada)');
  }

  // ---- 5. Qué hacer ----------------------------------------------------
  titulo('Qué hacer');
  if (sueltos.length > 0) {
    console.log(`  Los títulos de ${sueltos.join(', ')} no están en la primera fila: quedaron`);
    console.log('  debajo de los datos. Esa hoja no se puede leer ni arreglar a mano fila a');
    console.log('  fila. Se reescribe entera, que es un minuto:');
    console.log('    sudo bash /opt/congreso/guiones/servidor/poner-al-dia.sh --rehacer');
  } else if (desfasadas > 0) {
    console.log('  La hoja tiene las columnas de una versión anterior. Mientras sigan así,');
    console.log('  el sistema se niega a escribir: una fila con las columnas corridas se lee');
    console.log('  como buena y no hay forma de notarlo meses después.');
    console.log('\n  Se arregla reescribiendo el libro entero:');
    console.log('    sudo bash /opt/congreso/guiones/servidor/poner-al-dia.sh --rehacer');
  } else if (Number(conteo.pendientes) > 0) {
    console.log('  Los encabezados están bien y quedan registros sin copiar. Reintentar:');
    console.log('    cd /opt/congreso && sudo -u congreso npm run sincronizar');
    console.log('  Si vuelve a fallar, el motivo de arriba dice por qué.');
  } else {
    console.log('  Nada que hacer: la hoja y la base coinciden.');
  }
  console.log('');
  process.exit(desfasadas > 0 || faltanEnHoja.length > 0 || sobranEnHoja.length > 0 ? 1 : 0);
}

principal().catch((error) => {
  console.error('\nFalló el cotejo:', error instanceof Error ? error.message : error);
  process.exit(1);
});
