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
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = resolve(RAIZ, 'documentos/anteproyecto/capturas');
const SITIO = process.env.SITIO ?? 'http://localhost:3000';
const CUENTA = process.env.CUENTA ?? '';
const CLAVE = process.env.CLAVE ?? '';

let pagina;
const hechas = [];
let ultimaHuella = '';

/**
 * Guarda lo que hay en pantalla. Sin `fullPage`: interesa el primer golpe de vista.
 *
 * Y comprueba que no salga igual que la anterior. Una captura repetida no
 * rompe nada aquí: rompe el documento, que la publica con un pie describiendo
 * una pantalla que no se ve. Pasó tres veces en la tercera versión —el mapa de
 * la sede, la documentación de invitación y el reparto por perfil— y en ningún
 * caso hubo un error que lo avisara.
 */
async function tomar(nombre, { completa = false, alto = 0 } = {}) {
  // `alto` es para las pantallas largas. Con `fullPage` la imagen sale tan
  // alta que, encajada en el ancho de la columna del documento, sus rótulos
  // no se leen: es una figura que no enseña nada. Una ventana más alta la
  // deja en una proporción que el papel sí aguanta.
  const ventana = pagina.viewportSize();
  if (alto) {
    await pagina.setViewportSize({ width: ventana.width, height: alto });
    await pagina.waitForTimeout(500);
  }
  await pagina.waitForTimeout(700);
  const imagen = await pagina.screenshot({ fullPage: completa });
  if (alto) await pagina.setViewportSize(ventana);
  const huella = createHash('sha1').update(imagen).digest('hex');
  if (huella === ultimaHuella) {
    throw new Error(
      `«${nombre}» salió idéntica a «${hechas.at(-1)}»: la pantalla no se movió. `
      + 'Suele ser un desplazamiento que no encontró su destino o un paso que no validó.',
    );
  }
  ultimaHuella = huella;
  writeFileSync(resolve(DESTINO, `${nombre}.png`), imagen);
  hechas.push(nombre);
  process.stdout.write(`  ${nombre}\n`);
}

async function ir(ruta) {
  await pagina.goto(`${SITIO}${ruta}`, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(900);
}

/**
 * Baja hasta un texto y lo deja arriba, para que la captura lo enseñe.
 *
 * Si el texto no está, se detiene: callarlo dejaba la pantalla donde estaba y
 * la captura salía repetida. De que se haya movido de verdad responde
 * `tomar`, que compara cada imagen con la anterior.
 */
async function hasta(texto) {
  const destino = pagina.getByText(texto, { exact: false }).first();
  if (await destino.count() === 0) {
    throw new Error(`No hay ningún «${texto}» en ${pagina.url()} al que bajar.`);
  }
  await destino.scrollIntoViewIfNeeded();
  await pagina.evaluate((t) => {
    const nodo = [...document.querySelectorAll('h1,h2,h3,h4')].find((n) => n.textContent?.includes(t));
    nodo?.scrollIntoView({ block: 'start' });
  }, texto);
  await pagina.waitForTimeout(600);
}

async function elegirPerfil(perfil, modalidad) {
  await ir('/registro');
  await pagina.getByText(perfil, { exact: true }).first().click();
  await pagina.waitForTimeout(300);
  await pagina.locator('button', { hasText: modalidad }).last().click();
  await pagina.waitForTimeout(300);
}

/** El rótulo del paso en el que estamos parados. */
async function seccion() {
  return (await pagina.locator('section h2, section h3').first().innerText().catch(() => '')).trim();
}

/**
 * Avanza un paso, y comprueba que de verdad avanzó.
 *
 * Sin la comprobación esto fallaba en silencio: si un paso no valida —falta
 * un archivo, falta una autorización— el botón no hace nada, la captura
 * siguiente sale idéntica a la anterior y el documento se entrega con dos
 * figuras iguales y un pie que describe una pantalla que no está. Pasó: la
 * Fig. 12 de la tercera versión repetía la de semblanza.
 */
async function siguiente(esperado) {
  const antes = await seccion();
  await pagina.getByRole('button', { name: /siguiente/i }).click();
  await pagina.waitForTimeout(700);
  const ahora = await seccion();
  if (esperado && !ahora.toLowerCase().includes(esperado.toLowerCase())) {
    throw new Error(
      `El formulario no avanzó de «${antes}» a «${esperado}»: se quedó en «${ahora}». `
      + 'Suele ser un campo obligatorio que el guion no llenó.',
    );
  }
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
    // Para que las fechas que pinta la propia página —«30 de octubre de
    // 2026», «quedan 30 días»— salgan como las verá quien se registre desde
    // México, y no como las vería el servidor donde se toman las capturas.
    // El hueco «mm/dd/yyyy» de los campos de fecha no obedece a esto: lo
    // pone Chromium según el idioma de su interfaz, no el de la página.
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  });
  pagina = await contexto.newPage();
  // El documento va en modo oscuro; el sitio lo recuerda en el navegador.
  await contexto.addInitScript(() => localStorage.removeItem('congreso.tema'));

  console.log('\nSitio público');
  await ir('/');           await tomar('01-portada');
  await hasta('ejes');     await tomar('02-ejes');
  await hasta('Cómo llegar');  await tomar('03-sede-mapa');
  await hasta('Nuestras instalaciones'); await tomar('04-mosaico');
  await ir('/instalaciones');       await tomar('05-instalaciones');
  await ir('/faqs');                await tomar('06-faqs');
  await ir('/aviso-privacidad');    await tomar('07-privacidad');

  console.log('\nRegistro');
  await ir('/registro');   await tomar('08-registro-perfil');

  // Público general en línea: el recorrido corto, que es la novedad.
  await elegirPerfil('Público general', 'En línea');
  await tomar('09-registro-publico-en-linea');
  await siguiente('Identificación');
  await tomar('10-registro-tres-campos');

  // Ponente presencial: el recorrido largo, que es el que enseña todo.
  await elegirPerfil('Ponente', 'Presencial');
  await siguiente('Identificación');
  await llenarObligatorios(['Robles', 'María Fernanda', 'mf.robles@universidad.edu.mx', 'UNAM', 'México']);
  await tomar('11-registro-identificacion');
  await siguiente('Alojamiento');
  // Marcada: lo que esta pantalla tiene que enseñar no es la casilla, sino el
  // aviso que sale al marcarla.
  await pagina.locator('section input[type="checkbox"]').first().check();
  await pagina.waitForTimeout(400);
  await tomar('12-registro-alojamiento');
  await siguiente('Su ponencia');
  await llenarObligatorios(['La seguridad social ante el envejecimiento en América Latina']);
  await tomar('13-registro-ponencia');
  await siguiente('Requerimientos en sala');
  await tomar('14-registro-sala');

  // Y la única pantalla que el público general presencial no comparte con
  // nadie: de dónde viene y qué días está.
  await elegirPerfil('Público general', 'Presencial');
  await siguiente('Identificación');
  await llenarObligatorios(['Serrano', 'Jorge', 'j.serrano@imss.gob.mx', 'IMSS', 'México']);
  await siguiente('Llegada y salida');
  await tomar('15-registro-llegada-salida');

  console.log('\nPanel');
  await ir('/login');   await tomar('16-login');

  if (!CUENTA || !CLAVE) {
    console.log('\nSin CUENTA y CLAVE: el panel se salta.');
    await navegador.close();
    return;
  }

  await pagina.locator('input[type="email"]').fill(CUENTA);
  await pagina.locator('input[type="password"]').fill(CLAVE);
  await pagina.getByRole('button', { name: /entrar|acceder|iniciar/i }).first().click();
  await pagina.waitForTimeout(3000);

  await ir('/panel');                 await tomar('17-panel-dashboard');
  await hasta('Distribución por modalidad'); await tomar('18-panel-graficas');
  await ir('/panel/registros');       await tomar('19-panel-registros');

  // La ficha de un registro, abierta.
  await pagina.getByRole('button', { name: /^Ver$/ }).first().click();
  await pagina.waitForTimeout(1600);
  await tomar('20-panel-detalle');
  // Se sale recargando, no pulsando «cerrar»: la ventana se pinta encima de
  // todo y el clic se queda reintentando contra el velo hasta agotar la
  // espera, que es donde esto se quedaba colgado.
  await ir('/panel/registros');

  // Y la selección múltiple, que es lo nuevo de esta versión.
  const casillas = pagina.locator('tbody input[type="checkbox"]');
  for (let i = 0; i < Math.min(3, await casillas.count()); i++) await casillas.nth(i).check();
  await pagina.waitForTimeout(400);
  await tomar('21-panel-seleccion');

  await ir('/panel/analitica');   await tomar('22-panel-analitica');
  await ir('/panel/cupos');       await tomar('23-panel-cupos');
  await hasta('Zoom');            await tomar('24-panel-zoom');
  await ir('/panel/sql');         await tomar('25-panel-sql');
  await ir('/panel/plantillas');  await tomar('26-panel-plantillas');
  await ir('/panel/contenido');   await tomar('27-panel-contenido');
  await ir('/panel/usuarios');    await tomar('28-panel-usuarios');
  await ir('/panel/cuenta');      await tomar('29-panel-cuenta');
  await ir('/panel/auditoria');   await tomar('30-panel-auditoria');

  await navegador.close();
  console.log(`\n${hechas.length} capturas en documentos/anteproyecto/capturas/`);
}

main().catch((error) => {
  console.error('Falló la captura:', error.message);
  process.exit(1);
});
