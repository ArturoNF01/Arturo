import { calificar, normalizaNombre, CONFIG } from '../../lib/cuestionario.js';
import { json } from '../../lib/sesion.js';

export async function onRequestPost({ request, env }) {
  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return json({ error: 'peticion_invalida' }, { status: 400 });
  }

  const nombre = String(cuerpo.nombre || '').trim().slice(0, 120);
  const pais = String(cuerpo.pais || '').trim().slice(0, 60);
  const claveParticipante = normalizaNombre(nombre);

  if (claveParticipante.length < 3 || !pais) {
    return json({ error: 'datos_incompletos', mensaje: 'Indique su nombre completo y su país.' }, { status: 400 });
  }

  // El servidor califica: la clave de respuestas nunca llega al navegador.
  const resultado = calificar(cuerpo.respuestas);
  const duracionSeg = Math.max(0, Math.min(Number(cuerpo.duracionSeg) || 0, CONFIG.minutos * 60 + 120));
  const porTiempo = cuerpo.porTiempo ? 1 : 0;
  const enviadoEn = new Date().toISOString();
  const id = crypto.randomUUID();

  try {
    await env.DB.prepare(
      `INSERT INTO entregas
         (id, nombre, nombre_normalizado, pais, aciertos, total, calificacion,
          aprobado, duracion_seg, por_tiempo, respuestas, enviado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, nombre, claveParticipante, pais, resultado.aciertos, resultado.total,
      resultado.calificacion, resultado.aprobado ? 1 : 0, duracionSeg, porTiempo,
      JSON.stringify(resultado.respuestas), enviadoEn
    ).run();
  } catch (e) {
    if (String(e && e.message).includes('UNIQUE')) {
      return json({
        error: 'intento_agotado',
        mensaje: 'Este participante ya registró su intento; el cuestionario admite uno solo.'
      }, { status: 409 });
    }
    throw e;
  }

  return json({
    id,
    nombre,
    pais,
    aciertos: resultado.aciertos,
    total: resultado.total,
    calificacion: resultado.calificacion,
    aprobado: resultado.aprobado,
    aprobatoria: CONFIG.aprobatoria,
    duracionSeg,
    porTiempo: Boolean(porTiempo),
    enviadoEn,
    detalle: resultado.detalle
  }, { status: 201 });
}
