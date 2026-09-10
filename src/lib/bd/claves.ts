import 'server-only';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt) as (
  clave: string, sal: Buffer, largo: number, opciones: { N: number; r: number; p: number },
) => Promise<Buffer>;

/**
 * Contraseñas del panel.
 *
 * scrypt viene con Node: no hay dependencia nativa que compilar ni versión
 * que vigilar, y es de las funciones recomendadas para almacenar
 * contraseñas. Los parámetros viajan dentro del propio hash, así que se
 * pueden subir más adelante sin invalidar lo ya guardado.
 */
const N = 16_384;
const R = 8;
const P = 1;
const LARGO = 32;

export async function cifrarClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const derivada = await derivar(clave.normalize('NFKC'), sal, LARGO, { N, r: R, p: P });
  return ['scrypt', N, R, P, sal.toString('base64'), derivada.toString('base64')].join('$');
}

export async function claveCoincide(clave: string, guardado: string | null): Promise<boolean> {
  if (!guardado) return false;
  const partes = guardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, n, r, p, salB64, esperadaB64] = partes;
  try {
    const sal = Buffer.from(salB64, 'base64');
    const esperada = Buffer.from(esperadaB64, 'base64');
    const derivada = await derivar(clave.normalize('NFKC'), sal, esperada.length, {
      N: Number(n), r: Number(r), p: Number(p),
    });
    // Comparación de tiempo constante: comparar con === filtra información
    // sobre cuántos bytes coincidieron.
    return derivada.length === esperada.length && timingSafeEqual(derivada, esperada);
  } catch {
    return false;
  }
}

/** Testigo al azar para una sesión o un enlace de acceso. */
export function generarToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * De la base sólo se guarda la huella del testigo. Quien vea la tabla no
 * puede suplantar a nadie con lo que hay ahí.
 */
export function huellaToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
