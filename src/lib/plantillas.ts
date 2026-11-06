/**
 * Plantillas de correo: sustitución de variables y envoltura HTML.
 * Lógica pura, sin dependencias del servidor, para poder probarla.
 */

/** Sustituye las variables {{clave}} de una plantilla. */
export function aplicarPlantilla(plantilla: string, variables: Record<string, string>): string {
  return plantilla.replace(/\{\{\s*(\w+)\s*\}\}/g, (coincidencia, clave: string) =>
    clave in variables ? variables[clave] : coincidencia,
  );
}

/**
 * La envoltura de todos los correos del Congreso: replica el estilo del PDF que preparó el comité
 * —banner azul marino con la curva dorada y el nombre del Congreso, los logos de la RIUSS y del
 * CIESS a la derecha, cuerpo justificado y el adorno azul y dorado abajo a la derecha—, pero
 * como correo y no como adjunto. Es la de los acuses, los dictámenes, el recordatorio, el
 * comunicado y los enlaces de acceso al panel: ninguno lleva ya otra.
 *
 * Está hecha como los correos de verdad, no como una página: tablas, estilos en línea y tres
 * imágenes alojadas en el sitio (`/correo/…`). Por eso hay que pasarle la dirección del sitio, y
 * por eso el banner lleva un texto alternativo con el mismo nombre: quien tiene las imágenes
 * bloqueadas sigue leyendo de qué es el correo.
 *
 * Lo único que va en una hoja de estilos es lo que sólo ahí se puede decir: el ajuste al celular.
 * Banner y logos van lado a lado y en una pantalla estrecha se apilan —el banner a todo el ancho,
 * para que se lea el nombre del Congreso—, y el texto justificado pasa a alinearse a la izquierda,
 * porque en una columna de 300 px la justificación abre huecos entre palabras. Los clientes que no
 * leen esa hoja (varios de escritorio) muestran la versión ancha, que sigue siendo correcta.
 *
 * Tipografía: Work Sans, como el sitio y el PDF, con Arial de respaldo —casi ningún cliente de
 * correo descarga fuentes—.
 */
export function envolverCorreo(
  contenido: string,
  { titulo, urlBase, idioma = 'es' }: { titulo: string; urlBase: string; idioma?: string },
): string {
  const base = urlBase.replace(/\/+$/, '');
  const fuente = "'Work Sans',Arial,Helvetica,sans-serif";
  return `<!doctype html>
<html lang="${idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${titulo}</title>
<style>
@media only screen and (max-width:480px){
  .m-bloque{display:block!important;width:100%!important;}
  .m-logos{text-align:left!important;padding:14px 20px 0!important;}
  .m-logos img{max-width:240px!important;margin:0!important;}
  .m-cuerpo{padding:22px 20px 8px!important;text-align:left!important;}
}
</style></head>
<body style="margin:0;padding:0;background:#eef2f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f8;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:${fuente};color:#111111;">
        <tr><td style="padding:0;line-height:0;font-size:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td class="m-bloque" width="62%" valign="middle" align="left" style="padding:0;line-height:0;font-size:0;">
              <img src="${base}/correo/comunicado-cabecera.png" width="384" height="97" alt="${titulo}"
                   style="display:block;width:100%;max-width:400px;height:auto;border:0;background:#002269;color:#ffffff;font-family:${fuente};font-size:15px;font-weight:bold;line-height:1.3;">
            </td>
            <td class="m-bloque m-logos" width="38%" valign="middle" align="right" style="padding:0;line-height:0;font-size:0;">
              <img src="${base}/correo/comunicado-logos.png" width="236" height="80" alt="RIUSS · CIESS"
                   style="display:block;width:100%;max-width:260px;height:auto;border:0;margin-left:auto;">
            </td>
          </tr></table>
        </td></tr>
        <tr><td class="m-cuerpo" style="padding:30px 32px 16px;font-family:${fuente};font-size:16px;line-height:1.65;color:#111111;text-align:justify;">${contenido}</td></tr>
        <tr><td align="right" style="padding:0;line-height:0;font-size:0;">
          <img src="${base}/correo/comunicado-pie.png" width="340" height="121" alt=""
               style="display:block;width:100%;max-width:340px;height:auto;border:0;margin-left:auto;">
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * El título que encabeza el correo: lo primero del asunto, antes del « · » que lo
 * une con el nombre del Congreso («Registro recibido · 1er Congreso…» → «Registro recibido»).
 * Así el título y el asunto no pueden decir cosas distintas, y quien edite el asunto en el panel
 * cambia también el título.
 */
export function tituloDeAsunto(asunto: string): string {
  return asunto.split(' · ')[0].trim();
}

const ES_SALUDO = /[:,]$/;
const ES_FIRMA = /^(comit[eéê]|organizing committee|review committee)/i;
const ESTILO_P = 'margin:0 0 16px;';
const ESTILO_ENLACE = 'color:#467886;text-decoration:underline;word-break:break-word;';
const ESTILO_TITULO = 'margin:0 0 20px;font-size:26px;line-height:1.25;font-weight:bold;color:#002269;text-align:left;';

const textoPlano = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/**
 * Pone a un cuerpo de plantilla el aspecto del comunicado —título azul marino, saludo y firma en
 * dorado, párrafos con aire y enlaces en el verde azulado del PDF— sin cambiarle una palabra.
 *
 * Los textos de las plantillas viven en la base y el comité los reescribe desde el panel, así que
 * el estilo no puede depender de que el texto lo traiga ya puesto: se aplica al componer el
 * correo. Sólo toca lo que no trae estilo propio —un `<p>` o un `<a>` sin atributos—, de modo que
 * el comunicado, que ya viene vestido, y los bloques que arma el sistema (sala de Zoom, constancia,
 * agenda) pasan intactos, y aplicarlo dos veces no cambia nada.
 *
 * El título sólo se añade si el cuerpo no trae el suyo (`<h1`). El saludo es el primer párrafo si
 * acaba en «:» o «,» y es corto; la firma, el último que empieza por «Comité…». Si el comité
 * reescribe el texto y ya no cumple, simplemente queda como un párrafo más: nada se rompe.
 */
export function estilizarCuerpo(html: string, { titulo }: { titulo?: string } = {}): string {
  let cuerpo = html
    .replace(/<ul>/g, `<ul style="${ESTILO_P}padding-left:22px;">`)
    .replace(/<a\s(?![^>]*\bstyle=)/g, `<a style="${ESTILO_ENLACE}" `);

  const parrafos = [...cuerpo.matchAll(/<p>([\s\S]*?)<\/p>/g)];
  const primero = parrafos[0];
  const ultimo = parrafos[parrafos.length - 1];
  const saludo =
    primero && cuerpo.trimStart().startsWith('<p>') &&
    textoPlano(primero[1]).length <= 80 && ES_SALUDO.test(textoPlano(primero[1]))
      ? primero : undefined;
  const firma = ultimo && ultimo !== saludo && ES_FIRMA.test(textoPlano(ultimo[1])) ? ultimo : undefined;

  let i = 0;
  cuerpo = cuerpo.replace(/<p>([\s\S]*?)<\/p>/g, (_todo, dentro: string) => {
    const este = parrafos[i++];
    if (este === saludo) return `<p style="margin:0 0 18px;font-weight:bold;color:#a08536;">${dentro}</p>`;
    if (este === firma) {
      const [linea1, ...resto] = dentro.split(/<br\s*\/?>/i);
      const abajo = resto.length ? `<br/><span style="color:#a08536;">${resto.join('<br/>')}</span>` : '';
      return `<p style="margin:0 0 24px;font-weight:bold;"><span style="color:#002269;">${linea1}</span>${abajo}</p>`;
    }
    // Con un enlace largo dentro, la justificación abre huecos enormes en la línea: a la izquierda.
    const alinear = /<a[\s>]/i.test(dentro) ? 'text-align:left;' : '';
    return `<p style="${ESTILO_P}${alinear}">${dentro}</p>`;
  });

  if (titulo && !/<h1[\s>]/i.test(cuerpo)) cuerpo = `<h1 style="${ESTILO_TITULO}">${titulo}</h1>\n${cuerpo}`;
  return cuerpo;
}

/**
 * El correo ya armado —asunto y HTML— a partir de una plantilla y sus variables.
 *
 * Lo usan el envío, la vista previa del panel y el correo de prueba, y es la
 * misma función a propósito: lo que el comité aprueba en la vista previa tiene
 * que ser, byte por byte, lo que reciba la gente. Si cada camino armara el suyo,
 * tarde o temprano dejarían de coincidir.
 */
export function componerCorreo(
  plantilla: { asunto: string; cuerpo_html: string },
  variables: Record<string, string>,
  { titulo, urlBase, idioma }: { titulo: string; urlBase: string; idioma?: string },
): { asunto: string; html: string } {
  const asunto = aplicarPlantilla(plantilla.asunto, variables);
  const cuerpo = estilizarCuerpo(aplicarPlantilla(plantilla.cuerpo_html, variables), { titulo: tituloDeAsunto(asunto) });
  return { asunto, html: envolverCorreo(cuerpo, { titulo, urlBase, idioma }) };
}

/**
 * Las direcciones de un campo de «enviar prueba a»: separadas por coma, punto y
 * coma, espacio o salto de línea. Sin repetidas, en minúsculas y con un tope, para
 * que un correo de prueba no se convierta en un envío masivo.
 */
export const MAXIMO_DESTINATARIOS_DE_PRUEBA = 10;

export function destinatariosDePrueba(
  texto: string,
  maximo: number = MAXIMO_DESTINATARIOS_DE_PRUEBA,
): { validos: string[]; invalidos: string[]; excede: boolean } {
  const partes = texto.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
  const validos: string[] = [];
  const invalidos: string[] = [];
  for (const parte of partes) {
    const direccion = parte.toLowerCase();
    if (!/^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/.test(direccion)) invalidos.push(parte);
    else if (!validos.includes(direccion)) validos.push(direccion);
  }
  return { validos, invalidos, excede: validos.length > maximo };
}
