/* eslint-disable @next/next/no-img-element */

/**
 * Logotipos institucionales: CIESS y RIUSS, juntos en una sola imagen
 * horizontal.
 *
 * Al ser dos marcas en un mismo archivo hay dos cuidados. El primero, no
 * deformarlas: se fija únicamente la altura y el ancho se deja automático,
 * con «object-contain», de modo que la proporción se respeta sea cual sea
 * la del archivo. El segundo, que en pantallas estrechas una imagen tan
 * ancha no empuje al resto: por eso el tope de ancho.
 *
 * Son dos archivos, uno por tema, y se montan los dos: CSS oculta el que no
 * toca. Elegir en JavaScript llegaría tarde y haría parpadear el logotipo.
 *
 * Viven en home.ciess.org, que administra el propio CIESS, igual que el
 * video de fondo. Para no depender de ese sitio basta con guardarlos en
 * «public» y cambiar estas dos direcciones.
 */
/** Sitios de las dos instituciones que convocan. */
export const ENLACE_CIESS = 'https://home.ciess.org/';
export const ENLACE_RIUSS =
  'https://home.ciess.org/red-interamericaa-de-universidades-para-la-seguridad-social/';

const CLARO = 'https://home.ciess.org/wp-content/uploads/2026/09/Logos-CIESS-RIUSS-2026.png';
const OSCURO = 'https://home.ciess.org/wp-content/uploads/2026/09/Logos-CIESS-RIUSS-2026-W.png';

export function LogoCiess({
  className = 'h-9',
  /** En fondos siempre oscuros no hay que alternar nada. */
  forzar,
}: {
  className?: string;
  forzar?: 'claro' | 'oscuro';
}) {
  // Corto a propósito: si la imagen no carga, este texto ocupa su lugar, y
  // los nombres completos desbordarían el encabezado.
  const alt = 'CIESS · RIUSS';
  // «w-auto» y «object-contain» son los que impiden que se deformen; el tope
  // de ancho evita que en un móvil la imagen se coma la fila entera.
  const comunes = `${className} w-auto max-w-full object-contain`;

  if (forzar) {
    return <img src={forzar === 'oscuro' ? OSCURO : CLARO} alt={alt} className={comunes} />;
  }

  return (
    <>
      <img src={CLARO} alt={alt} className={`${comunes} dark:hidden`} />
      <img src={OSCURO} alt="" aria-hidden className={`${comunes} hidden dark:block`} />
    </>
  );
}
