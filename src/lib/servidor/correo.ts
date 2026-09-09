import 'server-only';
import { Resend } from 'resend';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { CONFIG, urlSitio } from '@/lib/config';
import { etiquetaDe } from '@/lib/opciones';
import { obtenerDiccionario } from '@/i18n';
import { nombrePerfil } from '@/lib/perfiles';

export interface DatosCorreo {
  clave: 'confirmacion_registro' | 'edicion_registro' | 'lista_espera';
  registro: Record<string, any>;
  correoContacto: string;
  fechaLimite: string;
  urlAgenda: string;
}

/** Sustituye las variables {{clave}} de una plantilla. */
export function aplicarPlantilla(plantilla: string, variables: Record<string, string>): string {
  return plantilla.replace(/\{\{\s*(\w+)\s*\}\}/g, (coincidencia, clave: string) =>
    clave in variables ? variables[clave] : coincidencia,
  );
}

export function variablesDeRegistro(datos: DatosCorreo): Record<string, string> {
  const { registro: r } = datos;
  const idioma = (r.idioma as string) ?? 'es';
  const t = obtenerDiccionario(idioma);
  const modalidad = r.modalidad === 'en_linea' ? t.modalidad.en_linea : t.modalidad.presencial;

  return {
    folio: String(r.folio ?? ''),
    nombre: `${r.nombres ?? ''} ${r.apellidos ?? ''}`.trim(),
    perfil: nombrePerfil(String(r.perfil ?? ''), t),
    modalidad,
    correo: String(r.correo ?? ''),
    institucion: String(r.institucion ?? ''),
    rol: etiquetaDe('roles', r.modalidad_participacion, t),
    fecha: new Date().toLocaleDateString(t.meta.codigo, { timeZone: CONFIG.zonaHoraria }),
    fecha_limite: datos.fechaLimite,
    url_edicion: `${urlSitio()}/confirmacion/${r.id}?token=${r.token_edicion}`,
    url_agenda: datos.urlAgenda,
    correo_contacto: datos.correoContacto,
  };
}

/** Envía un correo a partir de la plantilla guardada en el panel. */
export async function enviarCorreoRegistro(datos: DatosCorreo): Promise<{ enviado: boolean; error?: string }> {
  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;
  const destino = String(datos.registro.correo ?? '');

  if (!clave || !remitente) return { enviado: false, error: 'Resend no está configurado.' };
  if (!destino) return { enviado: false, error: 'El registro no tiene correo.' };

  const idioma = (datos.registro.idioma as string) ?? 'es';
  const supabase = crearClienteAdmin();
  const { data: plantilla } = await supabase
    .from('plantillas_correo')
    .select('asunto, cuerpo_html')
    .eq('clave', datos.clave)
    .eq('idioma', idioma)
    .eq('activa', true)
    .maybeSingle();

  if (!plantilla) return { enviado: false, error: `Sin plantilla ${datos.clave}/${idioma}.` };

  const variables = variablesDeRegistro(datos);
  const t = obtenerDiccionario(idioma);

  try {
    const resend = new Resend(clave);
    const { error } = await resend.emails.send({
      from: remitente,
      to: destino,
      replyTo: datos.correoContacto,
      subject: aplicarPlantilla(plantilla.asunto, variables),
      html: envolverHtml(aplicarPlantilla(plantilla.cuerpo_html, variables), t.congreso.titulo),
    });
    if (error) return { enviado: false, error: error.message };
    return { enviado: true };
  } catch (error) {
    return { enviado: false, error: error instanceof Error ? error.message : 'Error de envío.' };
  }
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
