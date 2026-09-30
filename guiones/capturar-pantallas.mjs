/**
 * Las capturas del anteproyecto, tomadas solas.
 *
 *   SITIO=http://localhost:3000 CUENTA=jefe@x.test CLAVE=... \
 *     node guiones/capturar-pantallas.mjs
 *
 * Se tomaban a mano, y por eso el documento envejecía cada vez que el
 * formulario cambiaba: rehacer veinticuatro pantallas a mano no lo hace
 * nadie por gusto. Aquí se recorren en orden, y volver a tenerlas al día
 * cuesta un comando.
 *
 * Hace falta el sitio corriendo, una base con registros y una cuenta de
 * superadministrador. Las capturas salen al doble de resolución: impresas a
 * la mitad de tamaño se ven nítidas en papel.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = resolve(RAIZ, 'documentos/anteproyecto/capturas');
const SITIO = process.env.SITIO ?? 'http://localhost:3000';
const CUENTA = process.env.CUENTA ?? '';
const CLAVE = process.env.CLAVE ?? '';

let pagina;
const hechas = [];

/** Guarda lo que hay en pantalla. Sin `fullPage`: interesa el primer golpe de vista. */
async function tomar(nombre, { completa = false } = {}) {
  await pagina.waitForTimeout(700);
  await pagina.screenshot({ path: resolve(DESTINO, `${nombre}.png`), fullPage: completa });
  hechas.push(nombre);
  process.stdout.write(`  ${nombre}\n`);
}

async function ir(ruta) {
  await pagina.goto(`${SITIO}${ruta}`, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(900);
}

/** Baja hasta un texto y lo deja arriba, para que la captura lo enseñe. */
async function hasta(texto) {
  const destino = pagina.getByText(texto, { exact: false }).first();
  await destino.scrollIntoViewIfNeeded().catch(() => {});
  await pagina.waitForTimeout(500);
}

async function elegirPerfil(perfil, modalidad) {
  await ir('/registro');
  await pagina.getByText(perfil, { exact: true }).first().click();
  await pagina.waitForTimeout(300);
  await pagina.locator('button', { hasText: modalidad }).last().click();
  await pagina.waitForTimeout(300);
}

async function siguiente() {
  await pagina.getByRole('button', { name: /siguiente/i }).click();
  await pagina.waitForTimeout(500);
}

async function llenarObligatorios(valores) {
  const campos = await pagina.locator('input[required]').all();
  for (let i = 0; i < campos.length; i++) await campos[i].fill(valores[i] ?? 'Dato');
}

async function main() {
  mkdirSync(DESTINO, { recursive: true });
  const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
  const contexto = await navegador.newContext({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 2,
  });
  pagina = await contexto.newPage();
  // El documento va en modo oscuro; el sitio lo recuerda en el navegador.
  await contexto.addInitScript(() => localStorage.removeItem('congreso.tema'));

  console.log('\nSitio público');
  await ir('/');           await tomar('01-portada');
  await hasta('ejes');     await tomar('02-ejes');
  await hasta('Dónde');    await tomar('03-sede-mapa');
  await hasta('Galería');  await tomar('04-mosaico');
  await ir('/instalaciones');       await tomar('05-instalaciones');
  await ir('/faqs');                await tomar('06-faqs');
  await ir('/aviso-privacidad');    await tomar('07-privacidad');

  console.log('\nRegistro');
  await ir('/registro');   await tomar('08-registro-perfil');

  // Público general en línea: el recorrido corto, que es la novedad.
  await elegirPerfil('Público general', 'En línea');
  await tomar('09-registro-publico-en-linea');
  await siguiente();
  await tomar('10-registro-tres-campos');

  // Ponente presencial: el recorrido largo.
  await elegirPerfil('Ponente', 'Presencial');
  await siguiente();
  await llenarObligatorios(['Robles', 'María Fernanda', 'mf.robles@universidad.edu.mx', 'UNAM', 'México']);
  await tomar('11-registro-identificacion');
  await siguiente();   // Su ponencia
  await tomar('12-registro-ponencia');
  await siguiente();   // Semblanza
  await tomar('13-registro-semblanza');
  await siguiente();   // Documentación
  await tomar('14-registro-documentacion');

  console.log('\nPanel');
  await ir('/login');   await tomar('15-login');

  if (!CUENTA || !CLAVE) {
    console.log('\nSin CUENTA y CLAVE: el panel se salta.');
    await navegador.close();
    return;
  }

  await pagina.locator('input[type="email"]').fill(CUENTA);
  await pagina.locator('input[type="password"]').fill(CLAVE);
  await pagina.getByRole('button', { name: /entrar|acceder|iniciar/i }).first().click();
  await pagina.waitForTimeout(3000);

  await ir('/panel');                 await tomar('16-panel-dashboard');
  await hasta('Perfil');              await tomar('17-panel-graficas');
  await ir('/panel/registros');       await tomar('18-panel-registros');

  // La ficha de un registro, abierta.
  await pagina.getByRole('button', { name: /^Ver$/ }).first().click();
  await pagina.waitForTimeout(1600);
  await tomar('19-panel-detalle');
  // Se sale recargando, no pulsando «cerrar»: la ventana se pinta encima de
  // todo y el clic se queda reintentando contra el velo hasta agotar la
  // espera, que es donde esto se quedaba colgado.
  await ir('/panel/registros');

  // Y la selección múltiple, que es lo nuevo de esta versión.
  const casillas = pagina.locator('tbody input[type="checkbox"]');
  for (let i = 0; i < Math.min(3, await casillas.count()); i++) await casillas.nth(i).check();
  await pagina.waitForTimeout(400);
  await tomar('20-panel-seleccion');

  await ir('/panel/analitica');   await tomar('21-panel-analitica');
  await ir('/panel/cupos');       await tomar('22-panel-cupos');
  await hasta('Zoom');            await tomar('23-panel-zoom');
  await ir('/panel/sql');         await tomar('24-panel-sql');
  await ir('/panel/plantillas');  await tomar('25-panel-plantillas');
  await ir('/panel/contenido');   await tomar('26-panel-contenido');
  await ir('/panel/usuarios');    await tomar('27-panel-usuarios');
  await ir('/panel/cuenta');      await tomar('28-panel-cuenta');
  await ir('/panel/auditoria');   await tomar('29-panel-auditoria');

  await navegador.close();
  console.log(`\n${hechas.length} capturas en documentos/anteproyecto/capturas/`);
}

main().catch((error) => {
  console.error('Falló la captura:', error.message);
  process.exit(1);
});
