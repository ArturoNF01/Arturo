import 'server-only';
import { Resend } from 'resend';
import { unaFila } from '@/lib/bd/conexion';
import { CONFIG, urlSitio } from '@/lib/config';
import { etiquetaDe } from '@/lib/opciones';
import { obtenerDiccionario } from '@/i18n';
import { nombrePerfil } from '@/lib/perfiles';
import { leerEjes } from './contenido';
import { traducir } from '@/lib/contenido';
import { aplicarPlantilla, envolverHtml } from '@/lib/plantillas';

export type ClavePlantilla =
  | 'confirmacion_registro'
  | 'edicion_registro'
  | 'lista_espera'
  | 'registro_confirmado'
  | 'registro_cancelado'
  | 'ponencia_aceptada'
  | 'ponencia_aceptada_con_cambios'
  | 'ponencia_rechazada'
  | 'recordatorio';

export interface DatosCorreo {
  clave: ClavePlantilla;
  registro: Record<string, unknown>;
  correoContacto: string;
  fechaLimite: string;
  urlAgenda: string;
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
    rol: etiquetaDe('roles', r.modalidad_participacion as string | null, t),
    fecha: new Date().toLocaleDateString(t.meta.codigo, { timeZone: CONFIG.zonaHoraria }),
    titulo_ponencia: String(r.titulo_ponencia ?? ''),
    eje_tematico: String(r.eje_tematico ?? ''),
    // Bloque ya formateado: una plantilla no debería tener que decidir si
    // hay comentarios o no.
    comentarios_bloque: r.dictamen_comentarios
      ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #2e5c8a;background:#f2f5f9;">${
          String(r.dictamen_comentarios).replace(/[&<>]/g, (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c,
          ).replace(/\n/g, '<br>')
        }</blockquote>`
      : '',
    dias_faltantes: String(r.dias_faltantes ?? ''),
    sede: String(r.sede ?? ''),
    fechas: String(r.fechas ?? ''),
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

  // El eje se guarda por clave; en el correo debe leerse su nombre, y en el
  // idioma de quien lo recibe.
  const { filas: ejes } = await leerEjes();
  const eje = ejes.find((e) => e.clave === datos.registro.eje_tematico);
  const datosConEje: DatosCorreo = eje
    ? { ...datos, registro: { ...datos.registro, eje_tematico: traducir(eje.nombre, idioma as 'es') } }
    : datos;

  const plantilla = await unaFila<{ asunto: string; cuerpo_html: string }>(
    `select asunto, cuerpo_html from plantillas_correo
      where clave = $1 and idioma = $2 and activa
      limit 1`,
    [datos.clave, idioma],
  );

  if (!plantilla) return { enviado: false, error: `Sin plantilla ${datos.clave}/${idioma}.` };

  const variables = variablesDeRegistro(datosConEje);
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

/**
 * Envía un correo que no sale de una plantilla del panel: el enlace de
 * acceso, que es del sistema y no del congreso.
 */
export async function enviarCorreoSimple({
  para, asunto, html,
}: {
  para: string;
  asunto: string;
  html: string;
}): Promise<{ enviado: boolean; error?: string }> {
  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;
  if (!clave || !remitente) return { enviado: false, error: 'Resend no está configurado.' };

  try {
    const resend = new Resend(clave);
    const { error } = await resend.emails.send({
      from: remitente,
      to: para,
      subject: asunto,
      html: envolverHtml(html, obtenerDiccionario('es').congreso.titulo),
    });
    if (error) return { enviado: false, error: error.message };
    return { enviado: true };
  } catch (error) {
    return { enviado: false, error: error instanceof Error ? error.message : 'Error de envío.' };
  }
}

export { aplicarPlantilla, envolverHtml };
