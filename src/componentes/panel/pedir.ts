/**
 * Las dos ayudas con que las pantallas de asistencia del panel hablan con `/api/asistencia/panel`.
 *
 * `pedir` nunca lanza: si no hay red o la respuesta no es JSON, devuelve `ok: false` y la pantalla dice que no se pudo.
 * Aun con un error HTTP devuelve lo que contestó el servidor (`datos`), porque a veces trae el motivo.
 */
export async function pedir<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; datos: T | null; mensaje?: string }> {
  try {
    const r = await fetch(url, init);
    const datos = (await r.json().catch(() => null)) as (T & { mensaje?: string }) | null;
    return { ok: r.ok, datos, mensaje: datos?.mensaje };
  } catch {
    return { ok: false, datos: null };
  }
}

/** Un POST con cuerpo JSON. */
export const post = (cuerpo: Record<string, unknown>) =>
  ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }) satisfies RequestInit;
