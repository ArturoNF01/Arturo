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

/** Envoltura HTML sobria y compatible con clientes de correo. */
export function envolverHtml(contenido: string, titulo: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#f2f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;
                    font-family:Arial,Helvetica,sans-serif;color:#16283d;">
        <tr><td style="background:#2e5c8a;padding:20px 28px;color:#ffffff;font-size:14px;font-weight:bold;">
          ${titulo}
        </td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6;">${contenido}</td></tr>
        <tr><td style="padding:18px 28px;background:#f2f5f9;font-size:12px;color:#5b6b7f;">
          CIESS · Centro Interamericano de Estudios de Seguridad Social
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Las plantillas que llevan el diseño del comunicado del Congreso en vez de la
 * envoltura sobria de los acuses: la cabecera azul y dorada del PDF del comité y
 * su adorno de pie. Las demás no cambian de aspecto.
 */
const CON_DISEÑO_DE_COMUNICADO: ReadonlySet<string> = new Set(['comunicado']);

/**
 * La envoltura del comunicado: replica el estilo del PDF que preparó el comité
 * —banner azul marino con la curva dorada y el nombre del Congreso, título en
 * negritas, cuerpo en una sola columna y el adorno azul y dorado abajo a la
 * derecha—, pero como correo y no como adjunto.
 *
 * Está hecha como los correos de verdad, no como una página: tablas, estilos en
 * línea y dos imágenes alojadas en el sitio (`/correo/…`). Por eso hay que pasarle
 * la dirección del sitio, y por eso el banner lleva un texto alternativo con el
 * mismo nombre: quien tiene las imágenes bloqueadas sigue leyendo de qué es el correo.
 *
 * Tipografía: Work Sans, como el sitio y el PDF, con Arial de respaldo —casi ningún
 * cliente de correo descarga fuentes—.
 */
export function envolverComunicado(
  contenido: string,
  { titulo, urlBase, idioma = 'es' }: { titulo: string; urlBase: string; idioma?: string },
): string {
  const base = urlBase.replace(/\/+$/, '');
  const fuente = "'Work Sans',Arial,Helvetica,sans-serif";
  return `<!doctype html>
<html lang="${idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#eef2f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f8;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:${fuente};color:#111111;">
        <tr><td align="left" style="padding:0;line-height:0;font-size:0;">
          <img src="${base}/correo/comunicado-cabecera.png" width="400" height="101" alt="${titulo}"
               style="display:block;width:100%;max-width:400px;height:auto;border:0;background:#012269;color:#ffffff;font-family:${fuente};font-size:15px;font-weight:bold;line-height:1.3;">
        </td></tr>
        <tr><td style="padding:30px 32px 16px;font-family:${fuente};font-size:16px;line-height:1.65;color:#111111;">${contenido}</td></tr>
        <tr><td align="right" style="padding:0;line-height:0;font-size:0;">
          <img src="${base}/correo/comunicado-pie.png" width="340" height="121" alt=""
               style="display:block;width:100%;max-width:340px;height:auto;border:0;margin-left:auto;">
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** La envoltura que le toca a cada plantilla. */
export function envolverSegunClave(
  clave: string,
  contenido: string,
  { titulo, urlBase, idioma }: { titulo: string; urlBase: string; idioma?: string },
): string {
  return CON_DISEÑO_DE_COMUNICADO.has(clave)
    ? envolverComunicado(contenido, { titulo, urlBase, idioma })
    : envolverHtml(contenido, titulo);
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
  clave: string,
  plantilla: { asunto: string; cuerpo_html: string },
  variables: Record<string, string>,
  { titulo, urlBase, idioma }: { titulo: string; urlBase: string; idioma?: string },
): { asunto: string; html: string } {
  return {
    asunto: aplicarPlantilla(plantilla.asunto, variables),
    html: envolverSegunClave(clave, aplicarPlantilla(plantilla.cuerpo_html, variables), { titulo, urlBase, idioma }),
  };
}

/**
 * Las direcciones de un campo de «enviar prueba a»: separadas por coma, punto y
 * coma, espacio o salto de línea. Sin repetidas, en minúsculas y con un tope, para
 * que un correo de prueba no se convierta en un envío masivo.
 */
export const MAXIMO_DESTINATARIOS_DE_PRUEBA = 10;

export function destinatariosDePrueba(
  texto: string,
): { validos: string[]; invalidos: string[]; excede: boolean } {
  const partes = texto.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
  const validos: string[] = [];
  const invalidos: string[] = [];
  for (const parte of partes) {
    const direccion = parte.toLowerCase();
    if (!/^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/.test(direccion)) invalidos.push(parte);
    else if (!validos.includes(direccion)) validos.push(direccion);
  }
  return { validos, invalidos, excede: validos.length > MAXIMO_DESTINATARIOS_DE_PRUEBA };
}
