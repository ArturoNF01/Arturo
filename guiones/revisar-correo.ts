/**
 * Por qué no salen los acuses.
 *
 *   npm run revisar-correo
 *
 * El acuse pasa por cinco eslabones y basta que falle uno para que no llegue
 * nada: la clave en el servidor, el dominio verificado en Resend, el
 * remitente dentro de ese dominio, la plantilla del panel y el envío. El
 * error que guarda la base es el que devuelve Resend, y suele ser el último
 * de la cadena, no el que falta. Esto los recorre en orden y dice cuál es.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

const VERDE = '\x1b[32m', ROJO = '\x1b[31m', AMBAR = '\x1b[33m', FIN = '\x1b[0m';
const bien = (t: string) => console.log(`  ${VERDE}✓${FIN} ${t}`);
const mal = (t: string) => console.log(`  ${ROJO}✗${FIN} ${t}`);
const ojo = (t: string) => console.log(`  ${AMBAR}!${FIN} ${t}`);
const nota = (t: string) => console.log(`    ${t}`);
const paso = (t: string) => console.log(`\n\x1b[1m${t}\x1b[0m`);

interface Dominio { name: string; status: string; region?: string }

async function principal() {
  let roto = false;
  // Lo que no se pudo mirar no cuenta como mirado: un «todo bien» que
  // esconde dos eslabones sin revisar es peor que no decir nada.
  const sinRevisar: string[] = [];

  // 1 ------------------------------------------------------------------
  paso('1 · La clave y el remitente, en el servidor');
  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;

  if (!clave) {
    mal('Falta RESEND_API_KEY en el .env.');
    nota('Póngala con: sudo bash guiones/servidor/conectar-correo.sh');
    return salir(true);
  }
  // De la clave sólo se enseña la forma; el valor es una credencial.
  bien(`RESEND_API_KEY presente (${clave.slice(0, 3)}…, ${clave.length} caracteres).`);
  if (!clave.startsWith('re_')) {
    mal('No tiene forma de clave de Resend: debería empezar por «re_».');
    roto = true;
  }

  if (!remitente) {
    mal('Falta CORREO_REMITENTE en el .env.');
    return salir(true);
  }
  bien(`CORREO_REMITENTE = ${remitente}`);

  const direccion = remitente.includes('<')
    ? remitente.split('<')[1].replace('>', '').trim()
    : remitente.trim();
  const dominioRemitente = direccion.split('@')[1]?.toLowerCase();
  if (!dominioRemitente) {
    mal(`No se entiende la dirección del remitente: «${remitente}».`);
    nota('Debe ser «Nombre <buzon@dominio.org>» o «buzon@dominio.org».');
    return salir(true);
  }

  // 2 ------------------------------------------------------------------
  paso('2 · El dominio, en Resend');
  let dominios: Dominio[] = [];
  try {
    const respuesta = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${clave}` },
    });
    if (respuesta.status === 401 || respuesta.status === 403) {
      mal('Resend rechaza la clave. Está mal copiada, o se revocó.');
      nota('Cree otra en resend.com → API Keys, con permiso «Sending access».');
      return salir(true);
    }
    if (!respuesta.ok) {
      mal(`Resend respondió ${respuesta.status} al consultar los dominios.`);
      return salir(true);
    }
    const cuerpo = (await respuesta.json()) as { data?: Dominio[] };
    dominios = cuerpo.data ?? [];
  } catch (error) {
    mal(`No se pudo hablar con Resend: ${error instanceof Error ? error.message : error}`);
    nota('¿Tiene el servidor salida a internet por HTTPS?');
    return salir(true);
  }

  if (dominios.length === 0) {
    mal('La cuenta de Resend no tiene ningún dominio dado de alta.');
    nota('resend.com → Domains → Add Domain.');
    return salir(true);
  }

  for (const d of dominios) {
    const etiqueta = `${d.name} · ${d.status}`;
    if (d.status === 'verified') bien(etiqueta);
    else ojo(etiqueta);
  }

  const suyo = dominios.find((d) => d.name.toLowerCase() === dominioRemitente);
  if (!suyo) {
    mal(`El remitente es de «${dominioRemitente}», que no está en esa lista.`);
    nota('Resend sólo deja enviar desde un dominio propio y verificado.');
    roto = true;
  } else if (suyo.status !== 'verified') {
    mal(`«${suyo.name}» está en «${suyo.status}», no verificado.`);
    nota('Los registros DNS están puestos pero falta pulsar Verify, o aún no propagó.');
    nota('resend.com → Domains → ' + suyo.name + ' → Verify DNS Records.');
    roto = true;
  } else {
    bien(`El remitente sale de «${suyo.name}», que sí está verificado.`);
  }

  // 3 ------------------------------------------------------------------
  paso('3 · Las plantillas del acuse');
  try {
    const { consultar } = await import('../src/lib/bd/conexion');
    const filas = await consultar<{ clave: string; idioma: string; activa: boolean }>(
      `select clave, idioma, activa from plantillas_correo
        where clave in ('confirmacion_registro', 'lista_espera')
        order by clave, idioma`,
    );
    for (const c of ['confirmacion_registro', 'lista_espera']) {
      for (const i of ['es', 'en', 'pt']) {
        const f = filas.find((x) => x.clave === c && x.idioma === i);
        if (f?.activa) bien(`${c}/${i}`);
        else { mal(`${c}/${i} ${f ? 'está desactivada' : 'no existe'}.`); roto = true; }
      }
    }

    // 4 ----------------------------------------------------------------
    paso('4 · Lo que dice la base de los últimos acuses');
    const sin = await consultar<{ folio: string; correo: string; correo_error: string | null }>(
      `select folio, correo, correo_error from registros
        where correo_enviado_en is null
        order by creado_en desc limit 5`,
    );
    const con = await consultar<{ n: string }>(
      'select count(*) as n from registros where correo_enviado_en is not null',
    );
    bien(`Acuses que sí salieron: ${con[0]?.n ?? 0}`);
    if (sin.length === 0) bien('No hay ninguno pendiente.');
    else {
      ojo(`Sin acuse: ${sin.length} (se muestran hasta cinco)`);
      for (const r of sin) nota(`${r.folio} · ${r.correo} · ${r.correo_error ?? 'sin motivo apuntado'}`);
    }
  } catch (error) {
    ojo(`No se pudo consultar la base: ${error instanceof Error ? error.message : error}`);
    nota('Los eslabones 3 y 4 quedan sin revisar; los demás valen igual.');
    sinRevisar.push('las plantillas y lo que dice la base');
  }

  // 5 ------------------------------------------------------------------
  paso('5 · Un envío de verdad');
  const destino = process.argv[2];
  if (!destino) {
    nota('Para probar el envío: npm run revisar-correo -- alguien@ejemplo.org');
    sinRevisar.push('el envío de verdad');
  } else {
    const { enviarCorreoSimple } = await import('../src/lib/servidor/correo');
    const r = await enviarCorreoSimple({
      para: destino,
      asunto: 'Prueba de envío · 1er Congreso de Estudios Interamericanos de Seguridad Social',
      html: '<p>Si está leyendo esto, el envío del sistema de registro funciona.</p>',
    });
    if (r.enviado) bien(`Enviado a ${destino}. Revise también la carpeta de no deseados.`);
    else { mal(`No salió: ${r.error}`); roto = true; }
  }

  return salir(roto, sinRevisar);
}

function salir(roto: boolean, sinRevisar: string[] = []): never {
  if (roto) {
    console.log(`\n${ROJO}Hay algo que arreglar: está arriba, en la primera línea con ✗.${FIN}\n`);
  } else if (sinRevisar.length > 0) {
    console.log(`\n${AMBAR}Lo revisado responde. Queda sin comprobar: ${sinRevisar.join(' y ')}.${FIN}\n`);
  } else {
    console.log(`\n${VERDE}Todos los eslabones responden.${FIN}\n`);
  }
  process.exit(roto ? 1 : 0);
}

principal().catch((error) => {
  console.error('Falló la revisión:', error instanceof Error ? error.message : error);
  process.exit(1);
});
