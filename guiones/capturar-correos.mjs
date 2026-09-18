/**
 * Convierte en imágenes los correos compuestos por `npm run vista-correos`.
 *
 *   node guiones/capturar-correos.mjs
 *
 * Van al doble de resolución, como el resto de las capturas del anteproyecto:
 * impresas a la mitad de tamaño se ven nítidas en papel.
 */
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = resolve(RAIZ, 'documentos/anteproyecto/correos');
const DESTINO = resolve(RAIZ, 'documentos/anteproyecto/capturas');

// El orden es el de la guía: primero el acuse, que es el que todos reciben.
const NUMEROS = {
  'confirmacion_registro': '25-correo-acuse',
  'lista_espera': '26-correo-lista-espera',
  'recordatorio': '27-correo-recordatorio',
  'ponencia_aceptada': '28-correo-dictamen',
};

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error('Primero: npm run vista-correos');
    process.exit(1);
  }

  const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
  // El ancho ajustado al correo —620 px de tarjeta más su margen— y el alto
  // corto: con `fullPage` la captura se estira hasta el contenido, así que la
  // imagen sale sin franjas muertas a los lados ni media hoja vacía debajo.
  // Importa porque en el anteproyecto estas figuras van a tamaño reducido: lo
  // que sobra en la captura se come el texto del correo en el papel.
  const pagina = await navegador.newPage({
    viewport: { width: 660, height: 300 },
    deviceScaleFactor: 2,
  });

  let hechas = 0;
  for (const archivo of readdirSync(ORIGEN).filter((f) => f.endsWith('.html'))) {
    const clave = archivo.replace('.html', '');
    const nombre = NUMEROS[clave];
    if (!nombre) continue;

    await pagina.goto(`file://${resolve(ORIGEN, archivo)}`, { waitUntil: 'networkidle' });
    await pagina.waitForTimeout(300);
    const salida = resolve(DESTINO, `${nombre}.png`);
    await pagina.screenshot({ path: salida, fullPage: true });
    console.log(`  ${nombre}.png`);
    hechas += 1;
  }

  await navegador.close();
  console.log(`\n${hechas} capturas en documentos/anteproyecto/capturas/`);
}

main().catch((error) => {
  console.error('Falló la captura:', error.message);
  process.exit(1);
});
