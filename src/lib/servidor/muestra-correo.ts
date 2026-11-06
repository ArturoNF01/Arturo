import 'server-only';
import { urlSitio } from '@/lib/config';
import { traducir } from '@/lib/contenido';
import { obtenerDiccionario } from '@/i18n';
import { componerCorreo } from '@/lib/plantillas';
import { leerConfiguracion } from './configuracion';
import { leerDatosCongreso } from './contenido';
import { variablesDeRegistro } from './correo';

/**
 * Un correo armado con datos de muestra, para la vista previa del panel y para los
 * correos de prueba.
 *
 * Se arma con las mismas piezas que el envío de verdad —las variables de un
 * registro, los bloques con HTML y la misma envoltura—, sólo que sobre un registro
 * ficticio. Antes la prueba rellenaba unas cuantas variables sueltas y los bloques
 * (`{{zoom_bloque}}`, `{{constancia_bloque}}`, `{{agenda_bloque}}`) llegaban como
 * texto con llaves: el comité no podía juzgar el aspecto real del correo.
 */
export async function correoDeMuestra({
  clave, idioma, plantilla, usuario,
}: {
  clave: string;
  idioma: 'es' | 'en' | 'pt';
  plantilla: { asunto: string; cuerpo_html: string };
  usuario: { nombre?: string | null; correo: string };
}): Promise<{ asunto: string; html: string }> {
  const [configuracion, congreso] = await Promise.all([leerConfiguracion(), leerDatosCongreso()]);
  const t = obtenerDiccionario(idioma);

  const variables = variablesDeRegistro({
    clave: clave as never,
    registro: {
      id: 'demo',
      token_edicion: 'demo',
      folio: 'REG-00000000-DEMO',
      nombres: usuario.nombre ?? usuario.correo,
      apellidos: '',
      perfil: 'ponente',
      modalidad: 'en_linea',
      idioma,
      correo: usuario.correo,
      institucion: 'CIESS',
      titulo_ponencia: 'Título de la ponencia (ejemplo)',
      dias_faltantes: '7',
      sede: traducir(congreso.sede, idioma),
      fechas: traducir(congreso.fechas, idioma),
    },
    correoContacto: configuracion.correo_contacto,
    fechaLimite: configuracion.fecha_limite_registro,
    urlAgenda: configuracion.url_agenda,
    urlAgendaPt: configuracion.url_agenda_pt,
    urlAgendaEn: configuracion.url_agenda_en,
    urlSesionZoom: configuracion.url_sesion_zoom,
    programaPublicado: configuracion.programa_publicado,
  });

  return componerCorreo(clave, plantilla, variables, {
    titulo: t.congreso.titulo, urlBase: urlSitio(), idioma,
  });
}
