/**
 * La agenda en PDF que corresponde a cada idioma.
 *
 * Hay una versión general (en español) y una en inglés y otra en portugués.
 * Con el sitio, o el correo, en inglés o portugués se da la suya; si el comité
 * la dejó vacía en el panel, o el idioma es el español, la general. Un enlace
 * roto no se llega a dar nunca: lo peor que pasa es que quien lee en otro
 * idioma reciba la general.
 */
export function urlAgendaSegunIdioma(
  urls: { general: string; pt?: string | null; en?: string | null },
  idioma: string,
): string {
  if (idioma === 'pt' && urls.pt) return urls.pt;
  if (idioma === 'en' && urls.en) return urls.en;
  return urls.general;
}
