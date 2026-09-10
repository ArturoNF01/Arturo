/**
 * Genera una vista previa interactiva del formulario en un solo archivo HTML,
 * a partir de los diccionarios, los perfiles y las opciones reales del
 * proyecto. Sirve para que el comité recorra el formulario y revise campos y
 * redacción sin desplegar nada.
 *
 *   npx tsx guiones/generar-vista-previa.ts
 *
 * La vista previa no guarda nada: al terminar muestra el resumen de lo
 * capturado en pantalla, en lugar de escribir en Supabase.
 */
import { writeFileSync } from 'node:fs';
import { diccionarios, IDIOMAS } from '../src/i18n';
import { PERFILES } from '../src/lib/perfiles';
import { OPCIONES } from '../src/lib/opciones';
import { CONGRESO_POR_DEFECTO, EJES_POR_DEFECTO } from '../src/lib/contenido';

const datos = {
  diccionarios,
  idiomas: IDIOMAS,
  perfiles: PERFILES,
  opciones: OPCIONES,
  congreso: CONGRESO_POR_DEFECTO,
  ejes: EJES_POR_DEFECTO.map((e) => ({ clave: e.clave, nombre: e.nombre })),
};

const html = `<title>Registro · Congreso CIESS</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root {
  --ground: #f4f6fa;
  --surface: #ffffff;
  --surface-2: #eef2f8;
  --line: #d5dde9;
  --line-soft: #e6ecf4;
  --ink: #101d2e;
  --ink-2: #4a5b71;
  --ink-3: #7b8ba1;
  --brand: #2e5c8a;
  --brand-soft: rgba(46, 92, 138, 0.1);
  --sobre-brand: #ffffff;
  --gold: #8a6d12;
  --gold-soft: rgba(201, 162, 39, 0.14);
  --ok: #1b7a53;
  --sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --serif: 'Source Serif 4', 'Iowan Old Style', Palatino, Georgia, serif;
  --mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #0b1622; --surface: #131f2e; --surface-2: #0f1a27;
    --line: #26374b; --line-soft: #1c2b3c;
    --ink: #e8eef7; --ink-2: #a3b4c9; --ink-3: #7a8da4;
    --brand: #6ea3dd; --brand-soft: rgba(110, 163, 221, 0.14);
    --sobre-brand: #0b1622;
    --gold: #d9b445; --gold-soft: rgba(201, 162, 39, 0.16);
    --ok: #4cc08d;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --ground: #0b1622; --surface: #131f2e; --surface-2: #0f1a27;
  --line: #26374b; --line-soft: #1c2b3c;
  --ink: #e8eef7; --ink-2: #a3b4c9; --ink-3: #7a8da4;
  --brand: #6ea3dd; --brand-soft: rgba(110, 163, 221, 0.14);
  --gold: #d9b445; --gold-soft: rgba(201, 162, 39, 0.16);
  --ok: #4cc08d;
  color-scheme: dark;
}

* { box-sizing: border-box; }
body {
  margin: 0; background: var(--ground); color: var(--ink);
  font-family: var(--sans); font-size: 15px; line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: 4px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }

.aviso {
  background: var(--gold-soft); border-bottom: 1px solid var(--line);
  padding: 10px 20px; font-size: 13px; color: var(--ink-2); text-align: center;
}
.aviso strong { color: var(--ink); font-weight: 600; }

.barra {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 12px 20px; border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--ground) 92%, transparent);
  backdrop-filter: blur(8px);
}
.marca { display: flex; align-items: center; gap: 10px; margin-right: auto; min-width: 0; }
.sello {
  width: 34px; height: 34px; flex: none; border-radius: 8px; background: var(--brand);
  color: var(--sobre-brand); display: grid; place-items: center;
  font-family: var(--serif); font-weight: 700; font-size: 16px;
}
.marca b { font-size: 14px; font-weight: 600; display: block; }
.marca span { font-size: 12px; color: var(--ink-3); }

.grupo-btn { display: flex; gap: 2px; padding: 2px; border: 1px solid var(--line); border-radius: 8px; }
.grupo-btn button {
  border: 0; background: none; font: inherit; font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-3);
  padding: 5px 10px; border-radius: 6px; cursor: pointer;
}
.grupo-btn button[aria-pressed="true"] { background: var(--brand); color: var(--sobre-brand); }
.icono-btn {
  border: 1px solid var(--line); background: none; color: var(--ink-2);
  width: 34px; height: 34px; border-radius: 8px; cursor: pointer;
  display: grid; place-items: center;
}

main { max-width: 900px; margin: 0 auto; padding: 28px 20px 80px; }

.portada { margin-bottom: 26px; }
.eyebrow {
  font-size: 11px; font-weight: 600; letter-spacing: 0.11em; text-transform: uppercase;
  color: var(--brand); margin: 0 0 8px;
}
h1 {
  font-family: var(--serif); font-weight: 600; font-size: clamp(26px, 3.6vw, 36px);
  line-height: 1.2; margin: 0 0 10px; text-wrap: balance; max-width: 30ch;
}
.subtitulo { color: var(--ink-2); margin: 0; font-size: 14px; }
.datos-clave { display: flex; flex-wrap: wrap; gap: 8px 28px; margin-top: 16px; }
.datos-clave div { font-size: 14px; }
.datos-clave dt {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--ink-3);
}
.datos-clave dd { margin: 2px 0 0; font-weight: 500; }

.rail { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 14px; }
.rail::-webkit-scrollbar { height: 6px; }
.rail::-webkit-scrollbar-thumb { background: var(--line); border-radius: 99px; }
.rail button {
  flex: none; border: 1px solid transparent; background: none; font: inherit; font-size: 12.5px;
  color: var(--ink-3); padding: 5px 11px; border-radius: 99px; cursor: pointer; white-space: nowrap;
}
.rail button[data-estado="actual"] { background: var(--brand); color: var(--sobre-brand); font-weight: 600; }
.rail button[data-estado="hecho"] { background: var(--brand-soft); color: var(--brand); }
.rail button[disabled] { opacity: 0.45; cursor: default; }

.tarjeta {
  background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
  padding: 26px;
}
.tarjeta > header { border-bottom: 1px solid var(--line-soft); padding-bottom: 16px; margin-bottom: 22px; }
.tarjeta h2 { font-family: var(--serif); font-size: 20px; font-weight: 600; margin: 0; }
.tarjeta header p { margin: 7px 0 0; font-size: 13.5px; color: var(--ink-2); }

.campos { display: grid; gap: 20px; }
.par { display: grid; gap: 20px; grid-template-columns: 1fr 1fr; }
.trio { display: grid; gap: 20px; grid-template-columns: 1fr 1fr 1fr; }
@media (max-width: 640px) { .par, .trio { grid-template-columns: 1fr; } }

label.campo { display: block; }
.etiqueta { display: block; font-size: 13.5px; font-weight: 500; margin-bottom: 6px; }
.req { color: #d1495b; margin-left: 3px; }
:root[data-theme="dark"] .req, :root:not([data-theme="light"]) .req { color: #ff8a95; }
.ayuda { font-size: 12.5px; color: var(--ink-3); margin: 6px 0 0; }
.ayuda.contador { text-align: right; font-variant-numeric: tabular-nums; }
.ayuda.excedido { color: #d1495b; }

input[type="text"], input[type="email"], input[type="tel"], input[type="date"],
input[type="time"], select, textarea {
  width: 100%; font: inherit; font-size: 14px; color: var(--ink);
  background: var(--surface-2); border: 1px solid var(--line); border-radius: 9px;
  padding: 9px 11px;
}
textarea { resize: vertical; min-height: 84px; line-height: 1.5; }
input:focus, select:focus, textarea:focus { border-color: var(--brand); outline: none; box-shadow: 0 0 0 3px var(--brand-soft); }

fieldset { border: 0; margin: 0; padding: 0; }
legend { font-size: 13.5px; font-weight: 500; margin-bottom: 8px; padding: 0; }
.opciones { display: grid; gap: 8px; }
.opciones.dos { grid-template-columns: 1fr 1fr; }
@media (max-width: 640px) { .opciones.dos { grid-template-columns: 1fr; } }
.opcion {
  display: flex; gap: 10px; align-items: flex-start; cursor: pointer;
  border: 1px solid var(--line); border-radius: 10px; padding: 11px 13px; font-size: 14px;
  transition: border-color 0.12s, background 0.12s;
}
.opcion:hover { border-color: var(--brand); }
.opcion input { margin: 3px 0 0; accent-color: var(--brand); flex: none; }
.opcion:has(input:checked) { border-color: var(--brand); background: var(--brand-soft); }
.opcion small { display: block; color: var(--ink-3); font-size: 12.5px; margin-top: 2px; }

.perfiles-grupo + .perfiles-grupo { margin-top: 22px; }
.perfiles-grupo h3 {
  font-size: 11px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase;
  color: var(--ink-3); margin: 0 0 9px;
}
.rejilla-perfiles { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
@media (max-width: 640px) { .rejilla-perfiles { grid-template-columns: 1fr; } }
.perfil {
  text-align: left; font: inherit; font-size: 14px; font-weight: 500; color: var(--ink);
  background: none; border: 1px solid var(--line); border-radius: 10px;
  padding: 13px 14px; cursor: pointer; transition: border-color 0.12s, background 0.12s;
}
.perfil:hover { border-color: var(--brand); }
.perfil[aria-pressed="true"] { border-color: var(--brand); background: var(--brand-soft); }
.perfil span { display: block; font-size: 12px; font-weight: 400; color: var(--ink-3); margin-top: 3px; }

.efecto {
  margin-top: 22px; padding: 14px 16px; border-radius: 10px;
  background: var(--surface-2); border: 1px solid var(--line-soft);
  font-size: 13.5px; color: var(--ink-2);
}
.efecto b { color: var(--ink); font-weight: 600; }
.efecto ul { margin: 8px 0 0; padding-left: 18px; }
.efecto li { margin-top: 3px; }

.pie-form { display: flex; gap: 12px; margin-top: 22px; align-items: center; }
.btn {
  font: inherit; font-size: 14px; font-weight: 600; border-radius: 10px;
  padding: 10px 20px; cursor: pointer; border: 1px solid transparent;
}
.btn-principal { background: var(--brand); color: var(--sobre-brand); }
.btn-principal:disabled { opacity: 0.45; cursor: default; }
.btn-secundario { background: none; border-color: var(--line); color: var(--ink); }
.btn-secundario:disabled { opacity: 0.4; cursor: default; }
.paso-indicador { margin-left: auto; font-size: 12.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }

.resumen dl { display: grid; gap: 14px 26px; grid-template-columns: 1fr 1fr; margin: 0; }
@media (max-width: 640px) { .resumen dl { grid-template-columns: 1fr; } }
.resumen dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-3); }
.resumen dd { margin: 2px 0 0; font-size: 14px; word-break: break-word; }
.resumen section { border-top: 1px solid var(--line-soft); padding-top: 18px; margin-top: 18px; }
.resumen h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--brand); margin: 0 0 12px; }
.folio { font-family: var(--mono); font-size: 17px; font-weight: 500; }
.sello-ok {
  display: inline-flex; align-items: center; gap: 8px; color: var(--ok);
  font-weight: 600; font-size: 14px; margin-bottom: 4px;
}
.nota-pie { margin-top: 26px; font-size: 12.5px; color: var(--ink-3); text-align: center; }
</style>

<div class="aviso">
  <strong>Vista previa para revisión.</strong>
  Recorre el formulario real con sus siete perfiles y sus tres idiomas. No guarda datos ni envía correos.
</div>

<div class="barra">
  <div class="marca">
    <span class="sello">C</span>
    <span><b id="marca-titulo"></b><span>CIESS · CISS</span></span>
  </div>
  <div class="grupo-btn" id="selector-idioma" role="group"></div>
  <button class="icono-btn" id="btn-tema" type="button"></button>
</div>

<main>
  <div class="portada">
    <p class="eyebrow" id="organiza"></p>
    <h1 id="titulo-congreso"></h1>
    <p class="subtitulo" id="sede-fechas"></p>
    <dl class="datos-clave" id="datos-clave"></dl>
  </div>

  <nav class="rail" id="rail" aria-label="Pasos"></nav>
  <div class="tarjeta" id="tarjeta"></div>

  <div class="pie-form">
    <button class="btn btn-secundario" id="btn-atras" type="button"></button>
    <button class="btn btn-principal" id="btn-siguiente" type="button"></button>
    <span class="paso-indicador" id="indicador"></span>
  </div>

  <p class="nota-pie" id="nota-pie"></p>
</main>

<script id="datos" type="application/json">${JSON.stringify(datos)}</script>
<script>
const D = JSON.parse(document.getElementById('datos').textContent);
let idioma = 'es';
let indicePaso = 0;
const v = { perfil: '', modalidad: 'presencial', _alojamiento: '', requiere_traslado: 'no' };
let enviado = false;

const t = () => D.diccionarios[idioma];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tr = (m) => (m && (m[idioma] ?? m.es)) || '';
const inter = (p, o) => String(p).replace(/\\{(\\w+)\\}/g, (m, k) => (k in o ? o[k] : m));
const perfil = () => D.perfiles.find((p) => p.clave === v.perfil);
const ops = (g) => D.opciones[g].map((valor, i) => ({ valor, etiqueta: t().formulario.opciones[g][i] }));
const etiquetaDe = (g, valor) => {
  const i = D.opciones[g].indexOf(valor);
  return i >= 0 ? t().formulario.opciones[g][i] : (valor || '');
};

/** Misma regla que src/lib/perfiles.ts */
function pasosVisibles() {
  const p = perfil();
  const pasos = ['perfil'];
  if (!p) return pasos;
  const presencial = v.modalidad === 'presencial';
  pasos.push('identificacion');
  if (p.requiereAcademico) pasos.push('academico');
  if (p.requiereSemblanza) pasos.push('semblanza');
  if (p.requiereLogistica) pasos.push('documentacion');
  if (presencial || p.requiereAcademico) pasos.push('sala');
  if (p.requiereLogistica && presencial) pasos.push('alojamiento', 'traslados');
  pasos.push('cierre', 'privacidad');
  return pasos;
}

function campoVisible(campo) {
  const p = perfil();
  if (!p) return false;
  const presencial = v.modalidad === 'presencial';
  switch (campo) {
    case 'nombre_personificador': case 'nombre_constancia': return p.requiereSemblanza;
    case 'orcid': return p.requiereAcademico;
    case 'nacionalidad': case 'procedencia': return p.requiereLogistica || presencial;
    case 'regimen_alimentario': case 'alergias': case 'contacto_emergencia': return presencial;
    case 'apoyo_traslado': case 'datos_viatico': return p.requiereLogistica && presencial;
    default: return true;
  }
}

// ---- Constructores de campo -------------------------------------------------
const campoTexto = (clave, etiqueta, o = {}) => \`
  <label class="campo">
    <span class="etiqueta">\${esc(etiqueta)}\${o.req ? '<span class="req">*</span>' : ''}</span>
    <input type="\${o.tipo || 'text'}" data-campo="\${clave}" value="\${esc(v[clave] || '')}">
    \${o.ayuda ? \`<p class="ayuda">\${esc(o.ayuda)}</p>\` : ''}
  </label>\`;

const campoArea = (clave, etiqueta, o = {}) => {
  const texto = v[clave] || '';
  const palabras = texto.trim() ? texto.trim().split(/\\s+/).length : 0;
  let contador = '';
  if (o.maximo) {
    const excede = texto.length > o.maximo;
    const cuenta = inter(t().formulario.validacion.caracteres, { n: texto.length, max: o.maximo });
    const conPalabras = o.maxPalabras
      ? inter(t().formulario.validacion.semblanzaPalabras, { n: palabras, max: o.maxPalabras }) + ' · ' + cuenta
      : cuenta;
    contador = \`<p class="ayuda contador\${excede ? ' excedido' : ''}">\${esc(conPalabras)}</p>\`;
  }
  return \`
    <label class="campo">
      <span class="etiqueta">\${esc(etiqueta)}\${o.req ? '<span class="req">*</span>' : ''}</span>
      <textarea data-campo="\${clave}" rows="\${o.filas || 4}">\${esc(texto)}</textarea>
      \${o.ayuda ? \`<p class="ayuda">\${esc(o.ayuda)}</p>\` : ''}\${contador}
    </label>\`;
};

const campoSelect = (clave, etiqueta, opciones, o = {}) => \`
  <label class="campo">
    <span class="etiqueta">\${esc(etiqueta)}</span>
    <select data-campo="\${clave}">
      <option value="">—</option>
      \${opciones.map((op) => \`<option value="\${esc(op.valor)}"\${v[clave] === op.valor ? ' selected' : ''}>\${esc(op.etiqueta)}</option>\`).join('')}
    </select>
    \${o.ayuda ? \`<p class="ayuda">\${esc(o.ayuda)}</p>\` : ''}
  </label>\`;

const campoRadio = (clave, etiqueta, opciones, o = {}) => \`
  <fieldset>
    <legend>\${esc(etiqueta)}\${o.req ? '<span class="req">*</span>' : ''}</legend>
    <div class="opciones\${o.dos ? ' dos' : ''}">
      \${opciones.map((op) => \`
        <label class="opcion">
          <input type="radio" name="\${clave}" data-radio="\${clave}" value="\${esc(op.valor)}"\${v[clave] === op.valor ? ' checked' : ''}>
          <span>\${esc(op.etiqueta)}</span>
        </label>\`).join('')}
    </div>
    \${o.ayuda ? \`<p class="ayuda">\${esc(o.ayuda)}</p>\` : ''}
  </fieldset>\`;

const campoChecks = (clave, etiqueta, opciones) => {
  const marcados = v[clave] || [];
  return \`
    <fieldset>
      <legend>\${esc(etiqueta)}</legend>
      <div class="opciones">
        \${opciones.map((op) => \`
          <label class="opcion">
            <input type="checkbox" data-check="\${clave}" value="\${esc(op.valor)}"\${marcados.includes(op.valor) ? ' checked' : ''}>
            <span>\${esc(op.etiqueta)}</span>
          </label>\`).join('')}
      </div>
    </fieldset>\`;
};

// ---- Pasos ------------------------------------------------------------------
function pintarPerfil() {
  const c = t().formulario.campos;
  const grupos = ['interno', 'externo'].map((grupo) => \`
    <div class="perfiles-grupo">
      <h3>\${esc(t().perfiles.grupos[grupo])}</h3>
      <div class="rejilla-perfiles">
        \${D.perfiles.filter((p) => p.grupo === grupo).map((p) => {
          const n = pasosPara(p, p.modalidadDefault).length;
          return \`<button class="perfil" type="button" data-perfil="\${p.clave}" aria-pressed="\${v.perfil === p.clave}">
            \${esc(t().perfiles[p.clave])}
            <span>\${n} \${n === 1 ? 'paso' : 'pasos'}</span>
          </button>\`;
        }).join('')}
      </div>
    </div>\`).join('');

  const p = perfil();
  let modalidad = '';
  if (p) {
    const disponibles = [['presencial', p.permitePresencial], ['en_linea', p.permiteEnLinea]]
      .filter(([, ok]) => ok)
      .map(([m]) => ({ valor: m, etiqueta: t().modalidad[m] }));
    modalidad = \`<div style="margin-top:22px">\${campoRadio('modalidad', t().modalidad.titulo, disponibles, { dos: true })}</div>\`;
  }

  const efecto = p ? \`
    <div class="efecto">
      <b>\${esc(t().perfiles[p.clave])}</b> \${esc(v.modalidad === 'en_linea' ? '· ' + t().modalidad.en_linea : '· ' + t().modalidad.presencial)}
      <ul>
        <li>\${pasosVisibles().length} \${pasosVisibles().length === 1 ? 'paso' : 'pasos'}: \${pasosVisibles().map((s) => esc(t().formulario.pasos[s])).join(' · ')}</li>
        \${p.requiereAcademico ? '' : '<li>Sin sección de participación académica ni resumen de ponencia.</li>'}
        \${p.requiereSemblanza ? \`<li>Pide semblanza de \${D.congreso.limite_semblanza_palabras} palabras, personificador y fotografía.</li>\` : ''}
        \${p.requiereLogistica && v.modalidad === 'presencial' ? '<li>Incluye alojamiento, traslados y documentación de invitación.</li>' : '<li>Sin alojamiento ni traslados.</li>'}
      </ul>
    </div>\` : '';

  return { titulo: t().perfiles.titulo, ayuda: t().perfiles.ayuda, cuerpo: grupos + modalidad + efecto };
}

function pasosPara(p, modalidad) {
  const guardado = [v.perfil, v.modalidad];
  v.perfil = p.clave; v.modalidad = modalidad;
  const r = pasosVisibles();
  v.perfil = guardado[0]; v.modalidad = guardado[1];
  return r;
}

function pintarPaso(paso) {
  const c = t().formulario.campos;
  const s = t().formulario.secciones;
  const g = D.congreso;

  if (paso === 'perfil') return pintarPerfil();

  if (paso === 'identificacion') return { titulo: s.identificacion, ayuda: s.identificacionAyuda, cuerpo: \`
    <div class="campos">
      <div class="par">\${campoTexto('apellidos', c.apellidos, { req: true })}\${campoTexto('nombres', c.nombres, { req: true })}</div>
      \${campoVisible('nombre_personificador') ? campoTexto('nombre_personificador', c.nombrePersonificador, { req: true, ayuda: c.nombrePersonificadorAyuda }) : ''}
      \${campoVisible('nombre_constancia') ? campoTexto('nombre_constancia', c.nombreConstancia, { ayuda: c.nombreConstanciaAyuda }) : ''}
      \${campoSelect('genero', c.genero, ops('genero'))}
      <div class="par">\${campoTexto('correo', c.correo, { req: true, tipo: 'email' })}\${campoTexto('telefono_whatsapp', c.telefono, { tipo: 'tel', ayuda: c.telefonoAyuda })}</div>
      <div class="par">\${campoTexto('institucion', c.institucion, { req: true })}\${campoTexto('cargo', c.cargo)}</div>
      \${campoVisible('procedencia') ? campoRadio('procedencia', c.procedencia, ops('procedencia'), { ayuda: c.procedenciaAyuda }) : ''}
      <div class="trio">\${campoTexto('pais_residencia', c.pais, { req: true })}\${campoTexto('entidad_federativa', c.entidad, { ayuda: c.entidadAyuda })}\${campoTexto('ciudad_residencia', c.ciudad)}</div>
      <div class="par">
        \${campoVisible('nacionalidad') ? campoTexto('nacionalidad', c.nacionalidad, { ayuda: c.nacionalidadAyuda }) : ''}
        \${campoVisible('orcid') ? campoTexto('orcid', c.orcid, { ayuda: c.orcidAyuda }) : ''}
      </div>
    </div>\` };

  if (paso === 'academico') return { titulo: s.academico, cuerpo: \`
    <div class="campos">
      \${campoRadio('modalidad_participacion', c.modalidadParticipacion, ops('roles'), { dos: true })}
      \${campoSelect('eje_tematico', c.ejeTematico, D.ejes.map((e) => ({ valor: e.clave, etiqueta: tr(e.nombre) })))}
      \${campoTexto('titulo_ponencia', c.tituloPonencia, { ayuda: c.tituloPonenciaAyuda })}
      \${campoArea('resumen_ponencia', c.resumen, { filas: 7, maximo: g.limite_resumen_caracteres, ayuda: inter(c.resumenAyuda, { max: g.limite_resumen_caracteres }) })}
      \${campoTexto('palabras_clave', c.palabrasClave)}
      \${campoArea('coautoria', c.coautoria, { filas: 3, ayuda: c.coautoriaAyuda })}
    </div>\` };

  if (paso === 'semblanza') return { titulo: s.semblanza, ayuda: s.semblanzaAyuda, cuerpo: \`
    <div class="campos">
      \${campoArea('semblanza', c.semblanza, { filas: 6, maximo: g.limite_semblanza_caracteres, maxPalabras: g.limite_semblanza_palabras, ayuda: inter(c.semblanzaAyuda, { palabras: g.limite_semblanza_palabras, caracteres: g.limite_semblanza_caracteres }) })}
      \${campoTexto('linea_investigacion', c.lineaInvestigacion)}
      <div class="efecto">\${esc(c.foto)} · \${esc(inter(c.fotoAyuda, { mb: g.foto_megabytes_maximo }))}</div>
      \${campoChecks('autorizaciones', c.autorizaciones, ops('autorizaciones'))}
    </div>\` };

  if (paso === 'documentacion') return { titulo: s.documentacion, ayuda: s.documentacionAyuda, cuerpo: \`
    <div class="campos">
      \${campoChecks('documentacion_solicitada', c.documentacionSolicitada, ops('documentacion'))}
      \${campoTexto('nombre_pasaporte', c.nombrePasaporte, { ayuda: c.nombrePasaporteAyuda })}
      \${campoArea('destinatario_oficio', c.destinatarioOficio, { filas: 3, ayuda: c.destinatarioOficioAyuda })}
    </div>\` };

  if (paso === 'sala') return { titulo: s.sala, cuerpo: \`
    <div class="campos">
      \${campoChecks('requerimientos_tecnicos', c.requerimientosTecnicos, ops('tecnicos'))}
      \${campoArea('requerimientos_accesibilidad', c.accesibilidad, { filas: 3, ayuda: c.accesibilidadAyuda })}
    </div>\` };

  if (paso === 'alojamiento') {
    const pide = v._alojamiento === 'si';
    return { titulo: s.alojamiento, ayuda: s.alojamientoAyuda, cuerpo: \`
      <div class="campos">
        \${campoRadio('_alojamiento', c.requiereAlojamiento, ops('alojamiento'))}
        \${pide ? \`
          <div class="par">\${campoTexto('fecha_entrada_hotel', c.fechaEntradaHotel, { tipo: 'date' })}\${campoTexto('fecha_salida_hotel', c.fechaSalidaHotel, { tipo: 'date' })}</div>
          \${campoSelect('tipo_habitacion', c.tipoHabitacion, ops('habitacion'))}
          \${campoTexto('comparte_habitacion_con', c.comparteCon)}\` : ''}
      </div>\` };
  }

  if (paso === 'traslados') {
    const pide = v.requiere_traslado && v.requiere_traslado !== 'no';
    return { titulo: s.traslados, ayuda: s.trasladosAyuda, cuerpo: \`
      <div class="campos">
        \${campoRadio('requiere_traslado', c.requiereTraslado, ops('traslado'), { dos: true })}
        \${pide ? \`
          \${campoRadio('medio_arribo', c.medioArribo, ops('medioArribo'), { ayuda: c.medioArriboAyuda })}
          <div class="par">\${campoTexto('ciudad_origen', c.ciudadOrigen)}\${campoTexto('terminal_origen', c.terminalOrigen)}</div>
          <div class="par">\${campoTexto('fecha_llegada', c.fechaLlegada, { tipo: 'date' })}\${campoTexto('hora_llegada', c.horaLlegada, { tipo: 'time' })}\${campoTexto('aerolinea_llegada', c.aerolineaLlegada)}\${campoTexto('vuelo_llegada', c.vueloLlegada)}</div>
          <div class="par">\${campoTexto('fecha_salida', c.fechaSalida, { tipo: 'date' })}\${campoTexto('hora_salida', c.horaSalida, { tipo: 'time' })}\${campoTexto('aerolinea_salida', c.aerolineaSalida)}\${campoTexto('vuelo_salida', c.vueloSalida)}</div>
          \${campoArea('observaciones_traslado', c.observacionesTraslado, { filas: 3, ayuda: c.observacionesTrasladoAyuda })}\` : ''}
      </div>\` };
  }

  if (paso === 'cierre') return { titulo: s.cierre, cuerpo: \`
    <div class="campos">
      \${campoVisible('regimen_alimentario') ? campoRadio('regimen_alimentario', c.regimenAlimentario, ops('regimen'), { dos: true }) : ''}
      \${campoVisible('alergias') ? campoArea('alergias', c.alergias, { filas: 2, ayuda: c.alergiasAyuda }) : ''}
      \${campoVisible('contacto_emergencia') ? campoTexto('contacto_emergencia', c.contactoEmergencia) : ''}
      \${campoVisible('datos_viatico') ? campoArea('datos_viatico', c.datosViatico, { filas: 3, ayuda: c.datosViaticoAyuda }) : ''}
      \${campoArea('datos_facturacion', c.datosFacturacion, { filas: 3 })}
      \${campoArea('comentarios', c.comentarios, { filas: 3 })}
    </div>\` };

  if (paso === 'privacidad') return { titulo: t().privacidad.titulo, ayuda: t().privacidad.marcoLegal, cuerpo: \`
    <div class="campos">
      <div class="opciones">
        <label class="opcion">
          <input type="checkbox" data-bool="consentimiento_datos"\${v.consentimiento_datos ? ' checked' : ''}>
          <span>\${esc(t().privacidad.aceptar)}</span>
        </label>
        <label class="opcion">
          <input type="checkbox" data-bool="consentimiento_comunicaciones"\${v.consentimiento_comunicaciones ? ' checked' : ''}>
          <span>\${esc(t().privacidad.comunicaciones)}</span>
        </label>
      </div>
    </div>\` };

  return { titulo: '', cuerpo: '' };
}

// ---- Resumen final ----------------------------------------------------------
function pintarResumen() {
  const c = t().formulario.campos;
  const bloques = [
    [t().formulario.secciones.identificacion, [
      ['apellidos', c.apellidos], ['nombres', c.nombres],
      ['nombre_personificador', c.nombrePersonificador], ['genero', c.genero, 'genero'],
      ['correo', c.correo], ['telefono_whatsapp', c.telefono],
      ['institucion', c.institucion], ['cargo', c.cargo],
      ['procedencia', c.procedencia, 'procedencia'], ['pais_residencia', c.pais],
      ['entidad_federativa', c.entidad], ['ciudad_residencia', c.ciudad],
      ['nacionalidad', c.nacionalidad], ['orcid', c.orcid],
    ]],
    [t().formulario.secciones.academico, [
      ['modalidad_participacion', c.modalidadParticipacion, 'roles'],
      ['eje_tematico', c.ejeTematico, 'eje'], ['titulo_ponencia', c.tituloPonencia],
      ['resumen_ponencia', c.resumen], ['palabras_clave', c.palabrasClave], ['coautoria', c.coautoria],
    ]],
    [t().formulario.secciones.semblanza, [
      ['semblanza', c.semblanza], ['linea_investigacion', c.lineaInvestigacion],
      ['autorizaciones', c.autorizaciones, 'autorizaciones'],
    ]],
    [t().formulario.secciones.documentacion, [
      ['documentacion_solicitada', c.documentacionSolicitada, 'documentacion'],
      ['nombre_pasaporte', c.nombrePasaporte], ['destinatario_oficio', c.destinatarioOficio],
    ]],
    [t().formulario.secciones.sala, [
      ['requerimientos_tecnicos', c.requerimientosTecnicos, 'tecnicos'],
      ['requerimientos_accesibilidad', c.accesibilidad],
    ]],
    [t().formulario.secciones.alojamiento, [
      ['fecha_entrada_hotel', c.fechaEntradaHotel], ['fecha_salida_hotel', c.fechaSalidaHotel],
      ['tipo_habitacion', c.tipoHabitacion, 'habitacion'], ['comparte_habitacion_con', c.comparteCon],
    ]],
    [t().formulario.secciones.traslados, [
      ['requiere_traslado', c.requiereTraslado, 'traslado'], ['medio_arribo', c.medioArribo, 'medioArribo'],
      ['ciudad_origen', c.ciudadOrigen], ['terminal_origen', c.terminalOrigen],
      ['fecha_llegada', c.fechaLlegada], ['hora_llegada', c.horaLlegada],
      ['aerolinea_llegada', c.aerolineaLlegada], ['vuelo_llegada', c.vueloLlegada],
      ['fecha_salida', c.fechaSalida], ['hora_salida', c.horaSalida],
      ['aerolinea_salida', c.aerolineaSalida], ['vuelo_salida', c.vueloSalida],
      ['observaciones_traslado', c.observacionesTraslado],
    ]],
    [t().formulario.secciones.cierre, [
      ['regimen_alimentario', c.regimenAlimentario, 'regimen'], ['alergias', c.alergias],
      ['contacto_emergencia', c.contactoEmergencia], ['datos_viatico', c.datosViatico],
      ['datos_facturacion', c.datosFacturacion], ['comentarios', c.comentarios],
    ]],
  ];

  const valor = (clave, grupo) => {
    const bruto = v[clave];
    if (bruto === undefined || bruto === null || bruto === '') return '';
    if (Array.isArray(bruto)) return bruto.length ? bruto.map((x) => etiquetaDe(grupo, x)).join(' · ') : '';
    if (grupo === 'eje') { const e = D.ejes.find((x) => x.clave === bruto); return e ? tr(e.nombre) : bruto; }
    return grupo ? etiquetaDe(grupo, bruto) : String(bruto);
  };

  const secciones = bloques.map(([titulo, filas]) => {
    const visibles = filas.filter(([clave, , grupo]) => valor(clave, grupo) !== '');
    if (!visibles.length) return '';
    return \`<section><h3>\${esc(titulo)}</h3><dl>\${visibles.map(([clave, etiqueta, grupo]) =>
      \`<div><dt>\${esc(etiqueta)}</dt><dd>\${esc(valor(clave, grupo))}</dd></div>\`).join('')}</dl></section>\`;
  }).join('');

  const p = perfil();
  const folio = 'REG-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-VP01';

  return { titulo: t().confirmacion.titulo, ayuda: t().confirmacion.subtitulo, cuerpo: \`
    <div class="resumen">
      <p class="sello-ok">✓ \${esc(t().confirmacion.titulo)}</p>
      <dl style="margin-bottom:18px">
        <div><dt>\${esc(t().confirmacion.folio)}</dt><dd class="folio">\${folio}</dd></div>
        <div><dt>\${esc(t().perfiles.titulo)}</dt><dd>\${esc(p ? t().perfiles[p.clave] : '')} · \${esc(t().modalidad[v.modalidad])}</dd></div>
      </dl>
      \${secciones || '<p class="ayuda">Sin datos capturados: recorra el formulario para ver aquí el resumen.</p>'}
    </div>\` };
}

// ---- Render -----------------------------------------------------------------
function render() {
  const pasos = pasosVisibles();
  indicePaso = Math.min(indicePaso, pasos.length - 1);
  const pasoActual = pasos[indicePaso];
  const esUltimo = pasos.length > 1 && indicePaso >= pasos.length - 1;

  document.getElementById('marca-titulo').textContent = tr(D.congreso.nombre_corto);
  document.getElementById('organiza').textContent = t().congreso.organiza;
  document.getElementById('titulo-congreso').textContent = tr(D.congreso.nombre);
  document.getElementById('sede-fechas').textContent = tr(D.congreso.sede) + ' · ' + tr(D.congreso.fechas);
  document.getElementById('datos-clave').innerHTML = \`
    <div><dt>\${esc(t().formulario.fechaLimite)}</dt><dd>2026-05-15</dd></div>
    <div><dt>\${esc(t().formulario.contacto)}</dt><dd>congreso@ciss-bienestar.org</dd></div>
    <div><dt>\${esc(t().modalidad.cuposDisponibles)}</dt><dd>300</dd></div>\`;

  document.getElementById('rail').innerHTML = enviado ? '' : pasos.map((paso, i) => \`
    <button type="button" data-ir="\${i}" \${i > indicePaso ? 'disabled' : ''}
      data-estado="\${i === indicePaso ? 'actual' : i < indicePaso ? 'hecho' : 'pendiente'}">
      \${i + 1}. \${esc(t().formulario.pasos[paso])}
    </button>\`).join('');

  const { titulo, ayuda, cuerpo } = enviado ? pintarResumen() : pintarPaso(pasoActual);
  document.getElementById('tarjeta').innerHTML =
    \`<header><h2>\${esc(titulo)}</h2>\${ayuda ? \`<p>\${esc(ayuda)}</p>\` : ''}</header>\${cuerpo}\`;

  const atras = document.getElementById('btn-atras');
  const siguiente = document.getElementById('btn-siguiente');
  atras.textContent = enviado ? t().acciones.volver : t().acciones.anterior;
  atras.disabled = !enviado && indicePaso === 0;
  siguiente.textContent = enviado ? t().acciones.limpiar : esUltimo ? t().acciones.enviar : t().acciones.siguiente;
  siguiente.disabled = !enviado && pasoActual === 'perfil' && !v.perfil;
  document.getElementById('indicador').textContent = enviado
    ? '' : \`\${t().formulario.paso} \${indicePaso + 1} \${t().formulario.de} \${pasos.length}\`;

  document.getElementById('nota-pie').textContent =
    'Vista previa generada del código del sistema · ' + t().privacidad.marcoLegal;

  document.getElementById('selector-idioma').innerHTML = D.idiomas.map((cod) =>
    \`<button type="button" data-idioma="\${cod}" aria-pressed="\${idioma === cod}">\${cod}</button>\`).join('');
  const oscuro = document.documentElement.getAttribute('data-theme') === 'dark'
    || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  document.getElementById('btn-tema').textContent = oscuro ? '☀' : '☾';
  document.getElementById('btn-tema').title = oscuro ? t().tema.claro : t().tema.oscuro;
}

// ---- Eventos ----------------------------------------------------------------
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.campo) {
    v[el.dataset.campo] = el.value;
    if (el.tagName === 'TEXTAREA') {
      const pos = el.selectionStart; render();
      const nuevo = document.querySelector(\`[data-campo="\${el.dataset.campo}"]\`);
      if (nuevo) { nuevo.focus(); nuevo.setSelectionRange(pos, pos); }
    }
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.radio) {
    v[el.dataset.radio] = el.value;
    if (el.dataset.radio === 'modalidad') indicePaso = 0;
    render();
  } else if (el.dataset.check) {
    const clave = el.dataset.check;
    const lista = v[clave] || [];
    v[clave] = el.checked ? [...lista, el.value] : lista.filter((x) => x !== el.value);
  } else if (el.dataset.bool) {
    v[el.dataset.bool] = el.checked;
  } else if (el.dataset.campo) {
    v[el.dataset.campo] = el.value;
  }
});

document.addEventListener('click', (e) => {
  const perfilBtn = e.target.closest('[data-perfil]');
  if (perfilBtn) {
    const p = D.perfiles.find((x) => x.clave === perfilBtn.dataset.perfil);
    v.perfil = p.clave;
    v.modalidad = p.permitePresencial ? p.modalidadDefault : 'en_linea';
    render();
    return;
  }
  const ir = e.target.closest('[data-ir]');
  if (ir) { indicePaso = Number(ir.dataset.ir); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const idi = e.target.closest('[data-idioma]');
  if (idi) { idioma = idi.dataset.idioma; render(); return; }
  if (e.target.closest('#btn-tema')) {
    const oscuroAhora = document.documentElement.getAttribute('data-theme') === 'dark'
      || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', oscuroAhora ? 'light' : 'dark');
    render();
  }
});

document.getElementById('btn-siguiente').addEventListener('click', () => {
  const pasos = pasosVisibles();
  if (enviado) {
    for (const k of Object.keys(v)) delete v[k];
    Object.assign(v, { perfil: '', modalidad: 'presencial', _alojamiento: '', requiere_traslado: 'no' });
    enviado = false; indicePaso = 0;
  } else if (pasos.length > 1 && indicePaso >= pasos.length - 1) {
    enviado = true;
  } else {
    indicePaso += 1;
  }
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('btn-atras').addEventListener('click', () => {
  if (enviado) { enviado = false; } else { indicePaso = Math.max(0, indicePaso - 1); }
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

render();
</script>`;

writeFileSync('vista-previa-formulario.html', html);
console.log(`vista-previa-formulario.html · ${(html.length / 1024).toFixed(0)} KB`);
