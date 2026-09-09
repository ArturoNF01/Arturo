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
          CIESS · Centro Interamericano de Estudios de Seguridad Social<br>
          CISS · Conferencia Interamericana de Seguridad Social
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
