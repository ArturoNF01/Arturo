/**
 * Carga el .env del proyecto para los guiones sueltos.
 *
 * Next.js lo hace solo al arrancar; un guion lanzado a mano, no. Y pasar la
 * llave privada de Google por la línea de órdenes no sirve: lleva espacios
 * («BEGIN PRIVATE KEY») y el intérprete la parte en pedazos. Por eso se lee
 * el archivo tal cual.
 */
import { readFileSync } from 'node:fs';

/** Devuelve los pares del texto de un .env, sin tocar process.env. */
export function leerEnv(texto: string): Record<string, string> {
  const pares: Record<string, string> = {};

  for (const linea of texto.split('\n')) {
    if (linea.trimStart().startsWith('#')) continue;
    const corte = linea.indexOf('=');
    if (corte < 1) continue;

    const clave = linea.slice(0, corte).trim();
    let valor = linea.slice(corte + 1).trim();
    if (
      valor.length >= 2 &&
      ((valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'")))
    ) {
      valor = valor.slice(1, -1);
    }
    pares[clave] = valor;
  }

  return pares;
}

/**
 * Vuelca el archivo en process.env. Lo que ya venga del entorno manda: así se
 * puede apuntar un guion a otra base sin editar el .env del servidor.
 */
export function cargarEntorno(ruta: string): void {
  let texto: string;
  try {
    texto = readFileSync(ruta, 'utf8');
  } catch {
    return; // sin archivo: se usa lo que haya en el entorno
  }

  for (const [clave, valor] of Object.entries(leerEnv(texto))) {
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}
