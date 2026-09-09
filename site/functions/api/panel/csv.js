import { exigeSesion } from '../../../lib/sesion.js';

const CAMPOS = ['nombre', 'pais', 'calificacion', 'aciertos', 'total', 'duracion_seg', 'por_tiempo', 'enviado_en'];

export async function onRequestGet({ request, env }) {
  const noAutorizado = await exigeSesion(request, env);
  if (noAutorizado) return noAutorizado;

  const { results } = await env.DB.prepare(
    `SELECT ${CAMPOS.join(', ')} FROM entregas ORDER BY enviado_en DESC`
  ).all();

  const celda = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const filas = (results || []).map((f) => CAMPOS.map((c) => celda(f[c])).join(','));
  const csv = ['Nombre,Pais,Calificacion,Aciertos,Total,DuracionSeg,EnvioAutomatico,EnviadoEn', ...filas].join('\n');

  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="entregas-cuestionario-final.csv"',
      'Cache-Control': 'no-store'
    }
  });
}
