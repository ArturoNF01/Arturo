/**
 * Manda un correo de prueba con el mismo código que usa el sitio.
 *
 *   npm run probar-correo -- alguien@ejemplo.org
 *
 * No consulta a Resend si la clave existe: eso diría poco. Envía de verdad,
 * por el mismo camino que un acuse de registro, y así lo que falle aquí es
 * exactamente lo que fallaría en un alta.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

async function principal() {
  const destino = process.argv[2];
  if (!destino || !destino.includes('@')) {
    console.error('Indique a qué dirección: npm run probar-correo -- alguien@ejemplo.org');
    process.exit(1);
  }
  if (!process.env.RESEND_API_KEY) {
    console.error('Falta RESEND_API_KEY en el .env.');
    process.exit(1);
  }
  if (!process.env.CORREO_REMITENTE) {
    console.error('Falta CORREO_REMITENTE en el .env.');
    process.exit(1);
  }

  const { enviarCorreoSimple } = await import('../src/lib/servidor/correo');

  const resultado = await enviarCorreoSimple({
    para: destino,
    asunto: 'Prueba de envío · 1er Congreso de Estudios Interamericanos de Seguridad Social',
    html:
      '<p>Si está leyendo esto, el envío de correo del sistema de registro funciona.</p>' +
      '<p>Los acuses de registro saldrán desde esta misma dirección.</p>',
  });

  if (resultado.enviado) {
    console.log(`Enviado a ${destino} desde ${process.env.CORREO_REMITENTE}`);
    process.exit(0);
  }
  console.error('No se pudo enviar:', resultado.error);
  // El motivo más común, y el que no se adivina leyendo el error de Resend.
  if (/domain|from|verif/i.test(resultado.error ?? '')) {
    console.error('Suele ser el dominio del remitente sin verificar en Resend.');
  }
  process.exit(1);
}

principal().catch((error) => {
  console.error('Falló la prueba:', error instanceof Error ? error.message : error);
  process.exit(1);
});
