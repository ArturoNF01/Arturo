import {
  borraCookie, creaCookie, credencialesConfiguradas, exigeSesion,
  igualdadSegura, json, sesionValida, usuarioPanel
} from '../../lib/sesion.js';

export async function onRequestGet({ request, env }) {
  const sesion = await sesionValida(request, env);
  return json({ activa: Boolean(sesion), usuario: sesion ? sesion.usuario : null });
}

export async function onRequestPost({ request, env }) {
  if (!credencialesConfiguradas(env)) {
    return json({
      error: 'sin_configurar',
      mensaje: 'Falta definir el secreto PANEL_PASSWORD en el proyecto de Cloudflare Pages.'
    }, { status: 503 });
  }

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return json({ error: 'peticion_invalida' }, { status: 400 });
  }

  const usuarioOk = igualdadSegura(String(cuerpo.usuario || '').trim(), usuarioPanel(env));
  const claveOk = igualdadSegura(String(cuerpo.clave || ''), env.PANEL_PASSWORD);

  // Retraso fijo: encarece el ensayo automatizado de contraseñas.
  await new Promise((r) => setTimeout(r, 400));

  if (!usuarioOk || !claveOk) {
    return json({ error: 'credenciales_invalidas' }, { status: 401 });
  }

  return json({ activa: true, usuario: usuarioPanel(env) }, {
    headers: { 'Set-Cookie': await creaCookie(env, usuarioPanel(env)) }
  });
}

export async function onRequestDelete({ request, env }) {
  const noAutorizado = await exigeSesion(request, env);
  if (noAutorizado) return noAutorizado;
  return json({ activa: false }, { headers: { 'Set-Cookie': borraCookie() } });
}
