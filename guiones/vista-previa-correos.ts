/**
 * Compone los correos del sistema tal como salen, y los deja como archivos
 * HTML para verlos o capturarlos.
 *
 *   npm run vista-correos                    # los cuatro principales
 *   npm run vista-correos -- recordatorio    # sólo uno
 *
 * No manda nada ni necesita clave de Resend: usa las mismas funciones que el
 * envío real —la plantilla guardada en el panel, las variables del registro y
 * el envoltorio— y se detiene justo antes de entregárselo a Resend. Así lo que
 * se ve aquí es lo que llega al buzón, y no una maqueta parecida.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

const SALIDA = resolve(RAIZ, 'documentos/anteproyecto/correos');

/** Un registro de ejemplo con los campos que las plantillas nombran. */
const EJEMPLO = {
  id: '8f14e45f-ceea-467a-9c7f-1f3d5a2b6c04',
  folio: 'REG-20261112-A7F3',
  token_edicion: 'b3c1d9e2f4a5',
  nombres: 'María Fernanda',
  apellidos: 'Robles Iturbide',
  correo: 'mf.robles@universidad.edu.mx',
  institucion: 'Universidad Nacional Autónoma de México',
  perfil: 'ponente',
  modalidad: 'presencial',
  modalidad_participacion: 'ponencia',
  idioma: 'es',
  titulo_ponencia: 'Cobertura y suficiencia de las pensiones no contributivas en América Latina',
  eje_tematico: null,
  dias_faltantes: 15,
  sede: 'CIESS · Ciudad de México',
  fechas: '11, 12 y 13 de noviembre de 2026',
};

const CUALES = [
  ['confirmacion_registro', 'El acuse que llega al registrarse'],
  ['lista_espera', 'Cuando los lugares presenciales se agotaron'],
  ['recordatorio', 'El aviso de los días previos'],
  ['ponencia_aceptada', 'El dictamen de una ponencia'],
] as const;

async function principal() {
  const pedido = process.argv[2];
  const { variablesDeRegistro } = await import('../src/lib/servidor/correo');
  const { aplicarPlantilla, envolverHtml } = await import('../src/lib/plantillas');
  const { unaFila } = await import('../src/lib/bd/conexion');
  const { obtenerDiccionario } = await import('../src/i18n');

  mkdirSync(SALIDA, { recursive: true });
  const t = obtenerDiccionario('es');

  for (const [clave, descripcion] of CUALES) {
    if (pedido && pedido !== clave) continue;

    const plantilla = await unaFila<{ asunto: string; cuerpo_html: string }>(
      `select asunto, cuerpo_html from plantillas_correo
        where clave = $1 and idioma = 'es' and activa limit 1`,
      [clave],
    );
    if (!plantilla) {
      console.error(`  sin plantilla ${clave}/es`);
      continue;
    }

    const variables = variablesDeRegistro({
      clave,
      registro: EJEMPLO,
      correoContacto: 'congresodss@ciess.org',
      fechaLimite: '15 de mayo de 2026',
      urlAgenda: 'https://congreso-dss.ciess.org/agenda',
    });

    const asunto = aplicarPlantilla(plantilla.asunto, variables);
    const cuerpo = envolverHtml(aplicarPlantilla(plantilla.cuerpo_html, variables), t.congreso.titulo);

    // Encima del correo va la cabecera que enseñaría un cliente de correo:
    // sin remitente y asunto, una captura del cuerpo no dice de qué correo es.
    const pagina = cuerpo.replace(
      '<tr><td align="center">',
      `<tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:620px;font-family:Arial,Helvetica,sans-serif;margin-bottom:10px;">
        <tr><td style="padding:12px 16px;background:#e7ecf3;border-radius:8px;color:#16283d;font-size:13px;line-height:1.7;">
          <b>De:</b> Congreso CIESS &lt;congreso@ciess.org&gt;<br>
          <b>Para:</b> ${EJEMPLO.correo}<br>
          <b>Asunto:</b> ${asunto}
        </td></tr>
      </table>`,
    );

    const archivo = resolve(SALIDA, `${clave}.html`);
    writeFileSync(archivo, pagina);
    console.log(`${clave.padEnd(24)} ${descripcion}`);
    console.log(`  ${archivo}`);
  }
  process.exit(0);
}

principal().catch((error) => {
  console.error('Falló la vista previa:', error instanceof Error ? error.message : error);
  process.exit(1);
});
