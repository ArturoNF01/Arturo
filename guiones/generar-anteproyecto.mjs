/**
 * Imprime el anteproyecto a PDF con el Chromium que el proyecto ya usa.
 *
 *   node guiones/generar-anteproyecto.mjs
 *
 * Las tipografías se incrustan en el CSS como base64 antes de imprimir: el
 * documento tiene que verse igual dentro de diez años, sin depender de que un
 * servidor de tipografías siga en pie. Si `fuentes.css` no está, se construye.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = resolve(RAIZ, 'documentos/anteproyecto');
const SALIDA = resolve(RAIZ, 'documentos/Anteproyecto-Registro-Congreso-CIESS.pdf');

const FUENTES =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700' +
  '&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400' +
  '&family=JetBrains+Mono:wght@400;500&display=swap';

/** Descarga las caras latinas y las deja incrustadas en documentos/anteproyecto. */
async function construirFuentes() {
  const destino = resolve(DOC, 'fuentes.css');
  if (existsSync(destino)) return;

  console.log('Incrustando las tipografías…');
  const css = await (await fetch(FUENTES, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' },
  })).text();

  const salida = [];
  for (const bloque of css.split(/(?=\/\* )/)) {
    if (!bloque.includes('@font-face')) continue;
    // Sólo los tramos latinos: el resto son alfabetos que el documento no usa.
    const tramo = bloque.match(/\/\* ([^*]+) \*\//)?.[1]?.trim();
    if (tramo !== 'latin' && tramo !== 'latin-ext') continue;

    const url = bloque.match(/url\((https:\/\/[^)]+)\)/)[1];
    const datos = Buffer.from(await (await fetch(url)).arrayBuffer()).toString('base64');
    salida.push(
      bloque.slice(bloque.indexOf('@font-face'))
        .replace(`url(${url})`, `url(data:font/woff2;base64,${datos})`),
    );
  }
  writeFileSync(destino, salida.join('\n'));
  console.log(`  ${salida.length} caras · ${Math.round(readFileSync(destino).length / 1024)} KB`);
}

async function main() {
  mkdirSync(dirname(SALIDA), { recursive: true });
  await construirFuentes();

  const navegador = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? undefined,
  });
  const pagina = await navegador.newPage();

  const fallos = [];
  pagina.on('requestfailed', (p) => fallos.push(p.url().slice(0, 100)));

  await pagina.goto(`file://${resolve(DOC, 'anteproyecto.html')}`, { waitUntil: 'networkidle' });
  // Sin esperar a las tipografías, la primera página sale con la de reserva.
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForTimeout(2000);

  await pagina.pdf({
    path: SALIDA,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await navegador.close();

  if (fallos.length) {
    console.error('\nNo cargaron:', [...new Set(fallos)].slice(0, 5).join('\n  '));
    process.exit(1);
  }
  console.log(`\nListo: ${SALIDA}`);
}

main().catch((error) => {
  console.error('Falló la generación:', error.message);
  process.exit(1);
});
