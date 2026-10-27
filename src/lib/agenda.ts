/**
 * La agenda en PDF que corresponde a cada idioma.
 *
 * Hay una versión general y otra en portugués. Con el sitio, o el correo, en
 * portugués se da la segunda; si el comité la dejó vacía en el panel, o el
 * idioma es otro, la general. Un enlace roto no se llega a dar nunca: lo
 * peor que pasa es que quien lee en portugués reciba la general.
 */
export function urlAgendaSegunIdioma(
  urls: { general: string; pt?: string | null },
  idioma: string,
): string {
  return idioma === 'pt' && urls.pt ? urls.pt : urls.general;
}
