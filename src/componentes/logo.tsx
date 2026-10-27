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
 * Es un solo archivo, el de color. En modo oscuro se pinta de blanco con un
 * filtro de CSS: «brightness(0)» deja negro todo lo que no es transparente y
 * «invert(1)» lo pasa a blanco, sin tocar la transparencia. Así no hay una
 * segunda imagen que mantener ni que descargar. Funciona porque el PNG tiene
 * el fondo transparente; si algún día se cambia por uno con fondo, el filtro
 * lo pintaría de blanco entero.
 *
 * Vive en home.ciess.org, que administra el propio CIESS, igual que el
 * video de fondo. Para no depender de ese sitio basta con guardarlo en
 * «public» y cambiar esta dirección.
 */
/** Sitios de las dos instituciones que convocan. */
export const ENLACE_CIESS = 'https://home.ciess.org/';
export const ENLACE_RIUSS =
  'https://home.ciess.org/red-interamericana-de-universidades-para-la-seguridad-social/';

const LOGO = 'https://home.ciess.org/wp-content/uploads/2026/10/Logos-CIESS-RIUSS-2025.png';

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
  // de ancho evita que en un móvil la imagen se coma la fila entera. Los
  // filtros van escritos enteros: Tailwind no ve los que se arman al vuelo.
  const filtro =
    forzar === 'oscuro' ? 'brightness-0 invert' : forzar === 'claro' ? '' : 'dark:brightness-0 dark:invert';

  return <img src={LOGO} alt={alt} className={`${className} w-auto max-w-full object-contain ${filtro}`} />;
}
