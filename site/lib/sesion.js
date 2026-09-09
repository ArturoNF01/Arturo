// Sesión del panel: cookie firmada con HMAC-SHA256 mediante Web Crypto.
// Ni la contraseña ni el secreto viajan al navegador.

const COOKIE = 'sesion_panel';
const VIGENCIA_SEG = 8 * 60 * 60; // 8 horas

const enc = new TextEncoder();

function base64url(bytes) {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function firma(valor, secreto) {
  const clave = await crypto.subtle.importKey(
    'raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return base64url(await crypto.subtle.sign('HMAC', clave, enc.encode(valor)));
}

/** Comparación en tiempo constante: no filtra en qué carácter falló. */
export function igualdadSegura(a, b) {
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  let dif = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) dif |= (x[i] || 0) ^ (y[i] || 0);
  return dif === 0;
}

export function secretoSesion(env) {
  // Si no se define SESSION_SECRET, la contraseña del panel sirve de semilla:
  // el sitio funciona igual y las sesiones se invalidan al rotarla.
  return env.SESSION_SECRET || env.PANEL_PASSWORD || '';
}

export function usuarioPanel(env) {
  return env.PANEL_USUARIO || 'Admin';
}

export function credencialesConfiguradas(env) {
  return Boolean(env.PANEL_PASSWORD);
}

export async function creaCookie(env, usuario) {
  const expira = Math.floor(Date.now() / 1000) + VIGENCIA_SEG;
  const cuerpo = `${usuario}.${expira}`;
  const token = `${cuerpo}.${await firma(cuerpo, secretoSesion(env))}`;
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${VIGENCIA_SEG}`;
}

export function borraCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function sesionValida(request, env) {
  const crudo = request.headers.get('Cookie') || '';
  const par = crudo.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!par) return null;

  const token = decodeURIComponent(par.slice(COOKIE.length + 1));
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const [usuario, expira, sello] = partes;
  const esperado = await firma(`${usuario}.${expira}`, secretoSesion(env));
  if (!igualdadSegura(sello, esperado)) return null;
  if (Number(expira) * 1000 < Date.now()) return null;
  return { usuario };
}

export function json(datos, init = {}) {
  return new Response(JSON.stringify(datos), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(init.headers || {})
    }
  });
}

export async function exigeSesion(request, env) {
  const sesion = await sesionValida(request, env);
  if (!sesion) return json({ error: 'no_autorizado' }, { status: 401 });
  return null;
}
