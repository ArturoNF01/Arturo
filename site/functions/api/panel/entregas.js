import { PREGUNTAS, CONFIG } from '../../../lib/cuestionario.js';
import { exigeSesion, json } from '../../../lib/sesion.js';

export async function onRequestGet({ request, env }) {
  const noAutorizado = await exigeSesion(request, env);
  if (noAutorizado) return noAutorizado;

  const { results } = await env.DB.prepare(
    `SELECT id, nombre, pais, aciertos, total, calificacion, aprobado,
            duracion_seg, por_tiempo, respuestas, enviado_en
       FROM entregas
      ORDER BY enviado_en DESC
      LIMIT 1000`
  ).all();

  const entregas = (results || []).map((f) => ({
    id: f.id,
    nombre: f.nombre,
    pais: f.pais,
    aciertos: f.aciertos,
    total: f.total,
    calificacion: f.calificacion,
    aprobado: Boolean(f.aprobado),
    duracionSeg: f.duracion_seg,
    porTiempo: Boolean(f.por_tiempo),
    respuestas: JSON.parse(f.respuestas),
    enviadoEn: f.enviado_en
  }));

  const total = entregas.length;
  const resumen = {
    total,
    promedio: total ? Math.round(entregas.reduce((s, e) => s + e.calificacion, 0) / total * 10) / 10 : null,
    aprobados: total ? Math.round(entregas.filter((e) => e.aprobado).length / total * 100) : null,
    tiempoMedio: total ? Math.round(entregas.reduce((s, e) => s + e.duracionSeg, 0) / total) : null,
    aprobatoria: CONFIG.aprobatoria
  };

  const reactivos = PREGUNTAS.map((q, i) => {
    const aciertos = entregas.filter((e) => e.respuestas[i] === q.correcta).length;
    return {
      numero: i + 1,
      enunciado: q.pregunta.replace(/<[^>]+>/g, ''),
      aciertos,
      porcentaje: total ? Math.round(aciertos / total * 100) : 0
    };
  });

  return json({ resumen, entregas, reactivos });
}
