/* eslint-disable @next/next/no-img-element */

/**
 * Logotipo institucional del CIESS.
 *
 * Son dos archivos, uno para fondo claro y otro para fondo oscuro. En vez de
 * elegir en JavaScript —que llegaría tarde y haría parpadear el logotipo al
 * cargar— se montan los dos y CSS oculta el que no toca: el cambio de tema es
 * instantáneo y no depende de que la página ya haya arrancado.
 *
 * Viven en home.ciess.org, que administra el propio CIESS, igual que el video
 * de fondo. Si algún día conviene no depender de ese sitio, basta con guardar
 * los dos archivos en «public» y cambiar estas dos direcciones.
 */
const CLARO = 'https://home.ciess.org/wp-content/uploads/2025/12/LOGO___CIESS.png';
const OSCURO = 'https://home.ciess.org/wp-content/uploads/2025/12/LOGO__CIESS.png';

export function LogoCiess({
  className = 'h-9 w-auto',
  /** En fondos siempre oscuros (el login) no hay que alternar nada. */
  forzar,
}: {
  className?: string;
  forzar?: 'claro' | 'oscuro';
}) {
  // Corto a propósito: si la imagen no carga, este texto ocupa su lugar, y
  // el nombre completo desbordaba el encabezado.
  const alt = 'CIESS';

  if (forzar) {
    return <img src={forzar === 'oscuro' ? OSCURO : CLARO} alt={alt} className={className} />;
  }

  return (
    <>
      <img src={CLARO} alt={alt} className={`${className} dark:hidden`} />
      <img src={OSCURO} alt="" aria-hidden className={`${className} hidden dark:block`} />
    </>
  );
}
