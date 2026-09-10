/**
 * Genera, en un solo archivo HTML, una vista previa navegable de todo el
 * sistema: el formulario de registro y el panel de control.
 *
 *   npx tsx guiones/generar-vista-previa.ts           (produce el formulario)
 *   npx tsx guiones/generar-vista-previa-completa.ts  (lo envuelve con el panel)
 *
 * El formulario se incrusta tal cual sale de su propio generador. Las reglas
 * del panel tampoco se reescriben: se incrustan desde los módulos del
 * proyecto, así que lo que la vista previa permite o impide es exactamente lo
 * mismo que permitirá o impedirá el sistema desplegado.
 *
 * Nada de lo que se haga aquí se guarda: al recargar, todo vuelve al estado
 * inicial.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { diccionarios, IDIOMAS } from '../src/i18n';
import { EJES_POR_DEFECTO, CONGRESO_POR_DEFECTO } from '../src/lib/contenido';
import {
  ESTADOS_PONENCIA, calcularAvance, comentariosObligatorios, dictamenResuelto, evaluarDictamen,
} from '../src/lib/dictamen';
import {
  ESTADOS, evaluarCambio, ocupaLugar, transicionesDesde, transicionPermitida,
} from '../src/lib/estados';
import { RECORDATORIOS_POR_DEFECTO, diasHasta, recordatorioDeHoy } from '../src/lib/recordatorios';

/**
 * Puerta de la vista previa. No es un control de acceso: cualquiera que abra
 * el código de la página lo puede sortear, y por eso aquí sólo hay datos
 * inventados. El panel real se protege con Supabase.
 */
const USUARIO_DEMO = 'Admin';
const CLAVE_DEMO_SHA256 = '8b9b91c7c9aaa240f40008963d99b17c433aadf6855a8fccb9e6b1c71f53f306';

/** Reglas reales del proyecto, incrustadas como código. */
const REGLAS = [
  `const ESTADOS_PONENCIA = ${JSON.stringify(ESTADOS_PONENCIA)};`,
  `const ESTADOS = ${JSON.stringify(ESTADOS)};`,
  `const TRANSICIONES = ${JSON.stringify(
    Object.fromEntries(ESTADOS.map((e) => [e, transicionesDesde(e)])),
  )};`,
  `function transicionesDesde(estado) { return TRANSICIONES[estado] || []; }`,
  dictamenResuelto.toString(),
  comentariosObligatorios.toString(),
  calcularAvance.toString(),
  evaluarDictamen.toString(),
  ocupaLugar.toString(),
  transicionPermitida.toString(),
  evaluarCambio.toString(),
  diasHasta.toString(),
  recordatorioDeHoy.toString(),
].join('\n');

const nombreEje = (clave: string) => EJES_POR_DEFECTO.find((e) => e.clave === clave)!.nombre;

const PONENCIAS = [
  {
    id: 'p1', folio: 'CG-000123', nombre: 'María Fernanda Ríos Salgado', institucion: 'IMSS',
    pais: 'México', perfil: 'conferencista', idioma: 'es', creado: '2026-04-02',
    eje: 'cobertura_informalidad',
    titulo: 'Cobertura universal en contextos de informalidad laboral',
    resumen: 'Analiza los mecanismos de afiliación no contributiva ensayados en cinco países de la región entre 2015 y 2025, y contrasta su cobertura efectiva con el gasto público asociado. Combina registros administrativos de los institutos nacionales con encuestas de hogares armonizadas.',
    palabras: 'cobertura; informalidad; financiamiento', coautoria: 'Con Luis A. Peña (UNAM)',
    estado: 'sin_dictamen', comentarios: '', porCorreo: '', enFecha: '',
  },
  {
    id: 'p2', folio: 'CG-000131', nombre: 'João Almeida Costa', institucion: 'Fiocruz',
    pais: 'Brasil', perfil: 'panelista', idioma: 'pt', creado: '2026-04-05',
    eje: 'sostenibilidad_pensiones',
    titulo: 'Envelhecimento populacional e sustentabilidade previdenciária',
    resumen: 'Projeções demográficas aplicadas ao regime geral brasileiro, com um modelo de sensibilidade a três cenários de produtividade e duas hipóteses de migração líquida.',
    palabras: 'envelhecimento; previdência; projeções', coautoria: '',
    estado: 'aceptada_con_cambios',
    comentarios: 'Ampliar la sección metodológica y precisar la fuente de las proyecciones demográficas.',
    porCorreo: 'comite@ciess.org', enFecha: '2026-04-18',
  },
  {
    id: 'p3', folio: 'CG-000144', nombre: 'Ana Lucía Mendoza Fuentes',
    institucion: 'Universidad de Chile', pais: 'Chile', perfil: 'participante_externo',
    idioma: 'es', creado: '2026-04-09', eje: 'salud_cuidados_envejecimiento',
    titulo: 'Gasto de bolsillo en salud y protección financiera de los hogares',
    resumen: 'Medición del gasto catastrófico en hogares del primer quintil y su relación con la cobertura efectiva de medicamentos ambulatorios, con datos de 2018 a 2025.',
    palabras: 'salud; gasto de bolsillo; equidad', coautoria: '',
    estado: 'aceptada', comentarios: '', porCorreo: 'comite@ciess.org', enFecha: '2026-04-20',
  },
  {
    id: 'p4', folio: 'CG-000158', nombre: 'Carlos Berríos Andrade', institucion: 'CISS',
    pais: 'Costa Rica', perfil: 'funcionario_ciss', idioma: 'es', creado: '2026-04-11',
    eje: 'digitalizacion_gobernanza',
    titulo: 'Interoperabilidad de registros y calidad del dato en la afiliación',
    resumen: 'Propone un marco de gobernanza del dato para institutos de seguridad social, con indicadores de calidad medibles y una ruta de adopción por etapas.',
    palabras: 'datos; gobernanza; interoperabilidad', coautoria: 'Con Rita Salas (CISS)',
    estado: 'en_revision', comentarios: '', porCorreo: '', enFecha: '',
  },
  {
    id: 'p5', folio: 'CG-000167', nombre: 'Patricia Nogueira Lima',
    institucion: 'Universidade de Lisboa', pais: 'Portugal', perfil: 'conferencista',
    idioma: 'pt', creado: '2026-04-14', eje: 'desigualdad_genero',
    titulo: 'Trabalho de cuidado não remunerado e lacunas previdenciárias de gênero',
    resumen: 'Estima o efeito do cuidado não remunerado sobre a densidade contributiva das mulheres e simula duas políticas de compensação de períodos.',
    palabras: 'gênero; cuidado; densidade contributiva', coautoria: '',
    estado: 'sin_dictamen', comentarios: '', porCorreo: '', enFecha: '',
  },
  {
    id: 'p6', folio: 'CG-000172', nombre: 'Diego Ferrán Iturbe',
    institucion: 'Universidad de Buenos Aires', pais: 'Argentina', perfil: 'panelista',
    idioma: 'es', creado: '2026-04-17', eje: 'migracion_portabilidad',
    titulo: 'Portabilidad de derechos en corredores migratorios del Cono Sur',
    resumen: 'Revisa los convenios bilaterales vigentes y documenta los tiempos reales de reconocimiento de períodos cotizados en el exterior.',
    palabras: 'migración; portabilidad; convenios', coautoria: '',
    estado: 'sin_dictamen', comentarios: '', porCorreo: '', enFecha: '',
  },
];

const REGISTROS = [
  { id: 'r1', folio: 'CG-000101', nombre: 'Elena Vargas Cruz', institucion: 'IMSS', pais: 'México', perfil: 'espectador_presencial', modalidad: 'presencial', estado: 'confirmado', creado: '2026-03-28' },
  { id: 'r2', folio: 'CG-000108', nombre: 'Rodrigo Salinas Peña', institucion: 'CIESS', pais: 'México', perfil: 'funcionario_ciess', modalidad: 'presencial', estado: 'confirmado', creado: '2026-03-29' },
  { id: 'r3', folio: 'CG-000115', nombre: 'Mariana Duarte Silva', institucion: 'INSS', pais: 'Brasil', perfil: 'participante_externo', modalidad: 'presencial', estado: 'en_proceso', creado: '2026-04-01' },
  { id: 'r4', folio: 'CG-000123', nombre: 'María Fernanda Ríos Salgado', institucion: 'IMSS', pais: 'México', perfil: 'conferencista', modalidad: 'presencial', estado: 'confirmado', creado: '2026-04-02' },
  { id: 'r5', folio: 'CG-000129', nombre: 'Tomás Alarcón Vidal', institucion: 'Superintendencia de Pensiones', pais: 'Chile', perfil: 'espectador_linea', modalidad: 'en_linea', estado: 'confirmado', creado: '2026-04-04' },
  { id: 'r6', folio: 'CG-000136', nombre: 'Sofía Guzmán Robles', institucion: 'CCSS', pais: 'Costa Rica', perfil: 'espectador_presencial', modalidad: 'presencial', estado: 'lista_espera', creado: '2026-04-06' },
  { id: 'r7', folio: 'CG-000141', nombre: 'Andrés Bermúdez Toro', institucion: 'Colpensiones', pais: 'Colombia', perfil: 'espectador_presencial', modalidad: 'presencial', estado: 'lista_espera', creado: '2026-04-07' },
  { id: 'r8', folio: 'CG-000149', nombre: 'Verónica Iriarte Nuño', institucion: 'ANSES', pais: 'Argentina', perfil: 'espectador_presencial', modalidad: 'presencial', estado: 'lista_espera', creado: '2026-04-08' },
];

const datos = {
  diccionarios,
  idiomas: IDIOMAS,
  ponencias: PONENCIAS.map((p) => ({ ...p, ejeNombre: nombreEje(p.eje) })),
  registros: REGISTROS,
  recordatorios: RECORDATORIOS_POR_DEFECTO,
  congreso: {
    fecha_inicio: CONGRESO_POR_DEFECTO.fecha_inicio,
    sede: CONGRESO_POR_DEFECTO.sede,
    fechas: CONGRESO_POR_DEFECTO.fechas,
    nombre_corto: CONGRESO_POR_DEFECTO.nombre_corto,
  },
  // Cupo apretado a propósito: con cuatro lugares presenciales y cuatro
  // ocupados se ve la regla que impide confirmar por encima del aforo.
  cupoPresencial: 4,
  correoContacto: 'congreso@ciess.org',
  // Día simulado: 30 antes del congreso, para que el recordatorio del día se
  // vea sin esperar a junio.
  hoy: '2026-05-04',
  usuario: USUARIO_DEMO,
  claveSha: CLAVE_DEMO_SHA256,
};

const formulario = readFileSync('vista-previa-formulario.html', 'utf8');

const guionNavegador = readFileSync('guiones/navegador/panel-vista-previa.js', 'utf8');

/** El formulario viaja en un iframe, tal cual lo genera su propio guion. */
const formularioEnvuelto = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${formulario}</body></html>`;

const html = `<title>Congreso CIESS 2026</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Mono:wght@400;500&display=swap">
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
  --brand-ink: #ffffff;
  --brand-soft: rgba(46, 92, 138, 0.1);
  --ok: #1b7a53;
  --ok-soft: rgba(27, 122, 83, 0.13);
  --aviso: #8a6d12;
  --aviso-soft: rgba(201, 162, 39, 0.18);
  --alto: #a3323f;
  --alto-soft: rgba(163, 50, 63, 0.13);
  --info: #2b6f9c;
  --info-soft: rgba(43, 111, 156, 0.13);
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
    --brand: #6ea3dd; --brand-ink: #0b1622; --brand-soft: rgba(110, 163, 221, 0.16);
    --ok: #4cc08d; --ok-soft: rgba(76, 192, 141, 0.16);
    --aviso: #d9b445; --aviso-soft: rgba(217, 180, 69, 0.16);
    --alto: #e08592; --alto-soft: rgba(224, 133, 146, 0.16);
    --info: #79b6e4; --info-soft: rgba(121, 182, 228, 0.16);
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --ground: #0b1622; --surface: #131f2e; --surface-2: #0f1a27;
  --line: #26374b; --line-soft: #1c2b3c;
  --ink: #e8eef7; --ink-2: #a3b4c9; --ink-3: #7a8da4;
  --brand: #6ea3dd; --brand-ink: #0b1622; --brand-soft: rgba(110, 163, 221, 0.16);
  --ok: #4cc08d; --ok-soft: rgba(76, 192, 141, 0.16);
  --aviso: #d9b445; --aviso-soft: rgba(217, 180, 69, 0.16);
  --alto: #e08592; --alto-soft: rgba(224, 133, 146, 0.16);
  --info: #79b6e4; --info-soft: rgba(121, 182, 228, 0.16);
  color-scheme: dark;
}

* { box-sizing: border-box; }
/* Una clase con display propio le gana a la regla del navegador para
   [hidden]; sin esto, la puerta seguiría en la página después de entrar. */
[hidden] { display: none !important; }
body {
  margin: 0; background: var(--ground); color: var(--ink);
  font-family: var(--sans); font-size: 15px; line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3 { font-family: var(--serif); text-wrap: balance; margin: 0; }
.folio { font-family: var(--mono); font-size: 0.82em; color: var(--ink-3); }

/* ------------------------------------------------------------- la puerta */
.puerta {
  min-height: 100svh; display: grid; place-items: center; padding: 32px 16px;
  background:
    radial-gradient(60rem 40rem at 15% -10%, var(--brand-soft), transparent 60%),
    var(--ground);
}
.puerta-caja {
  width: min(28rem, 100%); background: var(--surface); border: 1px solid var(--line);
  border-radius: 14px; padding: 28px; display: grid; gap: 18px;
  box-shadow: 0 18px 48px rgba(16, 29, 46, 0.12);
}
.marca { display: flex; align-items: center; gap: 10px; }
.marca-sello {
  width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px;
  background: var(--brand); color: var(--brand-ink); font-weight: 600; font-size: 15px;
}
.marca span { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); }
.puerta h1 { font-size: 21px; line-height: 1.25; }
.puerta-sede { color: var(--ink-2); font-size: 13px; margin: 4px 0 0; }
.campo-bloque { display: grid; gap: 5px; }
.etiqueta { font-size: 12px; font-weight: 600; letter-spacing: 0.02em; color: var(--ink-2); }
input[type="text"], input[type="password"], input[type="number"], textarea {
  width: 100%; font: inherit; color: var(--ink); background: var(--surface-2);
  border: 1px solid var(--line); border-radius: 9px; padding: 9px 11px;
}
textarea { resize: vertical; }
:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.ayuda { font-size: 12.5px; color: var(--ink-3); margin: 4px 0 0; }
.error { color: var(--alto); font-size: 13px; min-height: 1.2em; margin: 0; }

.btn {
  font: inherit; font-weight: 500; cursor: pointer; border-radius: 9px;
  border: 1px solid var(--line); background: var(--surface-2); color: var(--ink);
  padding: 9px 14px; transition: border-color .15s, background .15s;
}
.btn:hover { border-color: var(--brand); }
.btn-principal { background: var(--brand); color: var(--brand-ink); border-color: var(--brand); }
.btn-chico { padding: 5px 10px; font-size: 12.5px; }
.enlace-suave {
  background: none; border: 0; color: var(--brand); font: inherit; cursor: pointer;
  text-decoration: underline; text-underline-offset: 3px; padding: 0;
}
.nota-demo {
  font-size: 12px; color: var(--ink-3); border-top: 1px solid var(--line-soft);
  padding-top: 14px; margin: 0;
}

/* --------------------------------------------------------------- el marco */
.barra {
  position: sticky; top: 0; z-index: 30; display: flex; align-items: center;
  gap: 12px; flex-wrap: wrap; padding: 10px 16px;
  background: var(--surface); border-bottom: 1px solid var(--line);
}
.pestanas { display: flex; gap: 4px; }
.pestana {
  font: inherit; font-weight: 500; cursor: pointer; padding: 7px 13px;
  border-radius: 999px; border: 1px solid transparent; background: none; color: var(--ink-2);
}
.pestana.activa { background: var(--brand); color: var(--brand-ink); }
.derecha { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.mini {
  font: inherit; font-size: 11.5px; font-weight: 600; letter-spacing: .04em; cursor: pointer;
  border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-2);
  border-radius: 7px; padding: 4px 8px;
}
.mini.activa { background: var(--brand); color: var(--brand-ink); border-color: var(--brand); }

.marco-formulario { border: 0; width: 100%; height: calc(100svh - 57px); display: block; }

.panel { display: grid; grid-template-columns: 15rem 1fr; align-items: start; }
@media (max-width: 860px) { .panel { grid-template-columns: 1fr; } }
.rail {
  position: sticky; top: 57px; display: flex; flex-direction: column; gap: 2px;
  padding: 14px 10px; border-right: 1px solid var(--line); background: var(--surface);
  min-height: calc(100svh - 57px);
}
@media (max-width: 860px) {
  .rail {
    position: static; flex-direction: row; overflow-x: auto; min-height: 0;
    border-right: 0; border-bottom: 1px solid var(--line);
  }
}
.rail-btn {
  font: inherit; font-weight: 500; text-align: left; cursor: pointer; white-space: nowrap;
  border: 0; background: none; color: var(--ink-2); border-radius: 8px; padding: 9px 12px;
}
.rail-btn.activa { background: var(--brand-soft); color: var(--brand); }
.cuerpo { padding: 22px 18px 60px; min-width: 0; }
@media (min-width: 861px) { .cuerpo { padding: 26px 26px 72px; } }

.cab-seccion { margin-bottom: 18px; }
.cab-seccion h2 { font-size: 20px; }
.cab-seccion .ayuda { max-width: 62ch; }

.tiras { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); margin-bottom: 16px; }
.tira { background: var(--surface); border: 1px solid var(--line); border-radius: 11px; padding: 13px 15px; }
.tira-et { margin: 0; font-size: 11px; letter-spacing: .07em; text-transform: uppercase; color: var(--ink-3); }
.tira-val { margin: 3px 0 0; font-size: 25px; font-weight: 600; font-variant-numeric: tabular-nums; }

.barra-filtros { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin-bottom: 18px; }
.chip {
  font: inherit; font-size: 12.5px; cursor: pointer; border-radius: 999px; padding: 5px 11px;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink-2);
}
.chip-activo { background: var(--brand); color: var(--brand-ink); border-color: var(--brand); }
.casilla { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--ink-2); cursor: pointer; }
.casilla input { accent-color: var(--brand); width: 15px; height: 15px; }
.barra-filtros .casilla { margin-left: auto; }

.fichas { display: grid; gap: 14px; }
.ficha { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; }
.ficha-cab { display: flex; gap: 12px; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; margin-bottom: 12px; }
.ficha h3 { font-size: 16px; }
.meta { margin: 3px 0 0; font-size: 12.5px; color: var(--ink-3); }
.meta.pie { margin-top: 12px; }
.pastilla { font-size: 11.5px; font-weight: 600; border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
.pastilla-neutro { background: var(--surface-2); color: var(--ink-3); }
.pastilla-info { background: var(--info-soft); color: var(--info); }
.pastilla-ok { background: var(--ok-soft); color: var(--ok); }
.pastilla-aviso { background: var(--aviso-soft); color: var(--aviso); }
.pastilla-alto { background: var(--alto-soft); color: var(--alto); }
.resumen { margin-bottom: 12px; }
.resumen summary { cursor: pointer; font-size: 12.5px; font-weight: 600; color: var(--brand); }
.resumen .cuerpo { padding: 0; margin: 8px 0 0; font-size: 14.5px; max-width: 72ch; }
.acciones { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin-top: 13px; }
.alerta { font-size: 12.5px; color: var(--aviso); }
.vacio { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 26px; color: var(--ink-3); }

.medidor { height: 7px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; }
.medidor span { display: block; height: 100%; background: var(--brand); }
.medidor-pie { margin-bottom: 16px; font-variant-numeric: tabular-nums; }

.tabla-caja { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.tabla { width: 100%; border-collapse: collapse; font-size: 13.5px; min-width: 46rem; }
.tabla th {
  text-align: left; font-size: 11px; letter-spacing: .06em; text-transform: uppercase;
  color: var(--ink-3); font-weight: 600; padding: 11px 14px; border-bottom: 1px solid var(--line);
}
.tabla td { padding: 11px 14px; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
.tabla tr:last-child td { border-bottom: 0; }
.tabla input[type="number"] { width: 5.5rem; }
.acciones-fila { display: flex; flex-wrap: wrap; gap: 6px; }

#avisos { position: fixed; right: 14px; bottom: 14px; z-index: 60; display: grid; gap: 8px; max-width: min(24rem, calc(100vw - 28px)); }
.aviso {
  background: var(--surface); border: 1px solid var(--line); border-left-width: 3px;
  border-radius: 9px; padding: 10px 13px; font-size: 13px;
  box-shadow: 0 10px 30px rgba(16, 29, 46, .16); transition: opacity .5s, transform .5s;
}
.aviso-ok { border-left-color: var(--ok); }
.aviso-info { border-left-color: var(--info); }
.aviso-alto { border-left-color: var(--alto); }
.aviso.sale { opacity: 0; transform: translateY(6px); }
@media (prefers-reduced-motion: reduce) { .aviso { transition: none; } }
</style>

<div class="puerta" id="puerta">
  <div class="puerta-caja">
    <div class="marca">
      <span class="marca-sello">C</span>
      <span>CIESS · CISS</span>
    </div>
    <div>
      <h1 id="puerta-titulo"></h1>
      <p class="puerta-sede" id="puerta-sede"></p>
    </div>

    <form id="forma-acceso" novalidate>
      <div style="display:grid;gap:14px">
        <label class="campo-bloque">
          <span class="etiqueta">Usuario</span>
          <input id="usuario" type="text" autocomplete="username" value="Admin">
        </label>
        <label class="campo-bloque">
          <span class="etiqueta">Contraseña</span>
          <input id="clave" type="password" autocomplete="current-password">
        </label>
        <p class="error" id="error-acceso"></p>
        <button class="btn btn-principal" type="submit">Entrar al panel</button>
      </div>
    </form>

    <p class="ayuda" style="margin:0">
      ¿Sólo quiere ver el formulario? <button class="enlace-suave" id="ver-formulario" type="button">Ábralo sin entrar</button>, como lo verá quien se registre.
    </p>

    <p class="nota-demo">
      Vista previa con datos inventados. Nada se guarda: al recargar, todo vuelve al estado inicial.
      Esta puerta es sólo para la demostración —el panel real se protege con Supabase—, así que no
      reutilice esta contraseña en el sistema desplegado.
    </p>
  </div>
</div>

<div id="app" hidden>
  <header class="barra">
    <div class="marca">
      <span class="marca-sello">C</span>
      <span>CIESS · CISS</span>
    </div>
    <div class="pestanas" id="pestanas"></div>
    <div class="derecha">
      <div class="pestanas" id="idiomas"></div>
      <button class="mini" id="btn-tema" type="button" title="Tema">◐</button>
      <button class="mini" id="btn-salir" type="button">Salir</button>
    </div>
  </header>

  <div id="zona-formulario">
    <iframe class="marco-formulario" id="marco-formulario" title="Formulario de registro"
      srcdoc="${formularioEnvuelto.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe>
  </div>

  <div id="zona-panel" hidden>
    <div class="panel">
      <nav class="rail" id="rail" aria-label="Secciones del panel"></nav>
      <main class="cuerpo" id="cuerpo-panel"></main>
    </div>
  </div>
</div>

<div id="avisos" aria-live="polite"></div>

<script id="datos" type="application/json">${JSON.stringify(datos)}</script>
<script>
${REGLAS}
</script>
<script>
${guionNavegador}
</script>
`;

writeFileSync('vista-previa-congreso.html', html);
console.log(`vista-previa-congreso.html · ${Math.round(html.length / 1024)} KB`);
