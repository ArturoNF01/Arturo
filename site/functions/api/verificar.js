import { normalizaNombre } from '../../lib/cuestionario.js';
import { json } from '../../lib/sesion.js';

// ¿Este participante ya agotó su intento? Se consulta antes de iniciar
// para no dejar que responda 20 reactivos y perderlos al enviar.
export async function onRequestGet({ request, env }) {
  const nombre = new URL(request.url).searchParams.get('nombre') || '';
  const clave = normalizaNombre(nombre);
  if (clave.length < 3) return json({ existe: false });

  const fila = await env.DB
    .prepare('SELECT calificacion, enviado_en FROM entregas WHERE nombre_normalizado = ?')
    .bind(clave)
    .first();

  return json(fila
    ? { existe: true, calificacion: fila.calificacion, enviadoEn: fila.enviado_en }
    : { existe: false });
}
