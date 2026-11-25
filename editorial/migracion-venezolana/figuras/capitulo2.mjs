// Figuras del capítulo 2 (gráficas 1-9 y Anexo 1), redibujadas con la línea del libro
// a partir de datos/capitulo-2.json (series recuperadas y validadas de los PDF de R).
// Los rótulos (ejes, leyendas, paneles) salen del JSON («textos»), tal cual el original;
// el título va en el pie del libro, no dentro de la figura.
// Uso: node figuras/generar.mjs c2-grafica-1 … c2-anexo-1
import fs from "node:fs";
import path from "node:path";
import { RAIZ, ANCHO, C, SERIE, texto, rect, linea, medir, documento, d3 } from "./lib.mjs";

const TAM_EJE = 5.8;
const TAM_ROT = 6.0;
const GRIS = C.grisTexto;

export function datos2() {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, "datos", "capitulo-2.json"), "utf8"));
}

// Escenarios: mismo color y mismo orden en todo el capítulo
const ESCENARIOS = ["Alto", "Base", "Bajo"];
const COLOR_ESC = { Alto: C.oscuro, Base: C.azul, Bajo: C.claro };
// Grupos de edad: de claro (joven) a oscuro (mayor)
const COLOR_EDAD = { "0–14": C.claro, "15–29": C.medio, "30–64": C.azul, "65+": C.noche };
const COLOR_PEA = { "15–29": C.hielo, "30–39": C.celeste, "40–49": C.medio, "50–64": C.oscuro, "65+": C.noche };

// Estándar numérico del libro: punto decimal y coma de miles
const fmt = (v, dec = 1) => d3.format(`,.${dec}f`)(v).replace("-", "−");
const guion = (s) => String(s).replace(/−/g, "–"); // rangos de edad con raya corta
const r2 = (v) => Math.round(v * 100) / 100;

function trazo(puntos, color, ancho = 1.1, extra = "") {
  const d = puntos.filter((q) => q && Number.isFinite(q[1])).map((q, i) => `${i ? "L" : "M"}${r2(q[0])},${r2(q[1])}`).join("");
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${ancho}" stroke-linejoin="round" stroke-linecap="round"${extra ? " " + extra : ""}/>`;
}
const punto = (x, y, r, color) => `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r}" fill="${color}"/>`;
const DISC = `stroke-dasharray="2.6 1.8"`;
const PUNT = `stroke-dasharray="0.1 1.9"`;

/** Rejilla horizontal con marcas a la izquierda (solo si `conMarcas`). */
function rejillaY(y, x0, x1, ticks, f, conMarcas = true) {
  return ticks.map((t) => linea(x0, y(t), x1, y(t), t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3)
    + (conMarcas ? texto(x0 - 2.5, y(t) + 2, f(t), { tam: TAM_EJE, color: GRIS, ancla: "end" }) : "")).join("");
}
function marcasX(x, y0, ticks, f = (t) => t, o = {}) {
  return ticks.map((t) => texto(x(t), y0 + 7, f(t), { tam: TAM_EJE, color: GRIS, ancla: "middle", ...o })).join("");
}
/** Marcas de año dentro de un panel estrecho: la primera alineada a la izquierda, la última a la derecha. */
function marcasPanel(x, y0, ticks) {
  return ticks.map((t, i) => texto(x(t), y0 + 7, t, {
    tam: TAM_EJE, color: GRIS, ancla: i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle" })).join("");
}
/** Rótulo de la figura de R con el separador decimal del libro. */
const rotR = (s) => String(s).replace(/(\d),(\d)/g, "$1.$2");
function rotuloEjeY(x, yCentro, s) {
  return texto(x, yCentro, s, { tam: TAM_EJE, color: GRIS, ancla: "middle", rot: -90 });
}
function cabecera(x, y, s, o = {}) {
  return texto(x, y, s, { tam: 6.2, peso: 700, color: C.oscuro, ancla: "middle", ...o });
}
/** Leyenda de líneas: [{etiqueta, color, ancho, extra}] centrada en `cx`. */
function leyendaLineas(cx, y, items, tam = 6) {
  const largo = 11, sep = 9;
  const anchos = items.map((it) => largo + 3 + medir(it.etiqueta, tam));
  let x = cx - (anchos.reduce((a, b) => a + b, 0) + sep * (items.length - 1)) / 2;
  return items.map((it, i) => {
    let s;
    if (it.caja) s = rect(x, y - 4.6, 7, 5, it.color) + texto(x + 10, y, it.etiqueta, { tam, color: C.texto });
    else s = trazo([[x, y - 2], [x + largo, y - 2]], it.color, it.ancho || 1.2, it.extra || "")
      + (it.punto ? punto(x + largo / 2, y - 2, 1.2, it.color) : "")
      + texto(x + largo + 3, y, it.etiqueta, { tam, color: C.texto });
    x += anchos[i] + sep;
    return s;
  }).join("");
}
/** Etiquetas al final de las líneas, sin encimarse. items: [{y, texto, color}] */
function etiquetasFinales(x, items, minSep = 6.6, tam = TAM_ROT) {
  const ord = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < ord.length; i++) if (ord[i].y - ord[i - 1].y < minSep) ord[i].y = ord[i - 1].y + minSep;
  return ord.map((it) => texto(x, it.y + 2, it.texto, { tam, peso: 600, color: it.color })).join("");
}
function documento2(alto, partes, titulo) {
  return documento(ANCHO, alto, partes.join("\n"), { titulo });
}
const pieTitulo = (g, n) => `Capítulo 2, ${n}`;

/* ------------------------------------------------------------ Gráfica 1 */
export function grafica1(D) {
  const g = D.grafica_1, tx = g.textos;
  const edades = g.edades.map(guion);
  const W = ANCHO, izq = 26, der = 22, sep = 8, sup = 26, altoP = 92, sepF = 10;
  const anchoP = (W - izq - der - sep) / 2;
  const y = d3.scaleLinear().domain([-2.6, 4.2]);
  const ticks = [-2, 0, 2, 4];
  const est = {
    [g.series[0]]: { color: C.grisMedio, ancho: 0.8, extra: "", r: 0.9 },
    [g.series[1]]: { color: C.medio, ancho: 0.9, extra: DISC, r: 0.9 },
    [g.series[2]]: { color: C.oscuro, ancho: 1.5, extra: "", r: 1.1 },
  };
  const p = [leyendaLineas(W / 2, 7, g.series.map((s) => ({ etiqueta: s, color: est[s].color, ancho: est[s].ancho + 0.2, extra: est[s].extra, punto: true })))];
  tx.columnas.forEach((col, c) => p.push(cabecera(izq + c * (anchoP + sep) + anchoP / 2, sup - 6, col)));
  tx.filas.forEach((fila, f) => {
    const y0 = sup + f * (altoP + sepF);
    y.range([y0 + altoP, y0]);
    p.push(texto(W - der + 12, y0 + altoP / 2, fila, { tam: 6.2, peso: 700, color: C.oscuro, ancla: "middle", rot: 90 }));
    tx.columnas.forEach((col, c) => {
      const x0 = izq + c * (anchoP + sep);
      const x = d3.scalePoint().domain(edades).range([x0 + 6, x0 + anchoP - 6]);
      p.push(rejillaY(y, x0, x0 + anchoP, ticks, (t) => fmt(t, 0), c === 0));
      for (const s of g.series) {
        const v = g.paneles[col][fila][s], e = est[s];
        const pts = v.map((val, i) => [x(edades[i]), y(val)]);
        p.push(trazo(pts, e.color, e.ancho, e.extra));
        pts.forEach((q) => p.push(punto(q[0], q[1], e.r, e.color)));
      }
      if (f === tx.filas.length - 1) p.push(marcasX(x, y0 + altoP, edades));
    });
  });
  const yInf = sup + 2 * altoP + sepF;
  p.push(rotuloEjeY(7, sup + (yInf - sup) / 2, tx.eje_y));
  p.push(texto(izq + (W - izq - der) / 2, yInf + 16, tx.eje_x, { tam: TAM_EJE, color: GRIS, ancla: "middle" }));
  return documento2(yInf + 19, p, pieTitulo(g, "gráfica 1"));
}

/* ------------------------------------------------------------ Gráfica 2 */
export function grafica2(D) {
  const g = D.grafica_2, tx = g.textos;
  const edades = g.edades.map(guion);
  const anios = Object.keys(g.barras);
  const tono = d3.scaleLinear().domain([0, anios.length - 1]).range([C.hielo, C.noche]).interpolate(d3.interpolateRgb);
  const color = Object.fromEntries(anios.map((a, i) => [a, tono(i)]));
  const W = ANCHO, izq = 22, der = 4, sep = 8, sup = 42, altoP = 112;
  const anchoP = (W - izq - der - sep) / 2;
  const y = d3.scaleLinear().domain([0, 50]).range([sup + altoP, sup]);
  const p = [texto(W / 2, 22, tx.titulo_r, { tam: 6.4, peso: 700, color: C.oscuro, ancla: "middle" })];
  // leyenda de años (rampa)
  const lx = 22;
  p.push(texto(lx - 4, 8, tx.leyenda_titulo, { tam: 6, peso: 600, color: C.texto, ancla: "end" }));
  anios.forEach((a, i) => {
    const x = lx + i * 29;
    p.push(trazo([[x, 6], [x + 9, 6]], color[a], a === anios[anios.length - 1] ? 1.6 : 1.1));
    p.push(texto(x + 11, 8, a, { tam: 5.8, color: C.texto }));
  });
  tx.paneles.forEach((sexo, k) => {
    const x0 = izq + k * (anchoP + sep);
    const x = d3.scalePoint().domain(edades).range([x0 + 6, x0 + anchoP - 6]);
    p.push(cabecera(x0 + anchoP / 2, sup - 6, sexo));
    p.push(rejillaY(y, x0, x0 + anchoP, [0, 10, 20, 30, 40, 50], (t) => t, k === 0));
    anios.forEach((a, i) => {
      const ultimo = i === anios.length - 1;
      const pts = g.lineas[sexo][a].map((v, j) => [x(edades[j]), y(v)]);
      p.push(trazo(pts, color[a], ultimo ? 1.5 : 0.9));
      pts.forEach((q) => p.push(punto(q[0], q[1], ultimo ? 1.0 : 0.7, color[a])));
    });
    p.push(marcasX(x, sup + altoP, edades));
  });
  p.push(rotuloEjeY(6, sup + altoP / 2, tx.eje_y));
  p.push(texto(izq + (W - izq - der) / 2, sup + altoP + 16, tx.eje_x, { tam: TAM_EJE, color: GRIS, ancla: "middle" }));
  // barras: inmigrantes recientes por año
  const yb0 = sup + altoP + 36, altoB = 62;
  p.push(texto(W / 2, yb0 - 8, tx.titulo_barras_r, { tam: 6.4, peso: 700, color: C.oscuro, ancla: "middle" }));
  const xb = d3.scaleBand().domain(anios).range([izq, W - der]).paddingInner(0.25).paddingOuter(0.1);
  const maxB = d3.max(Object.values(g.barras));
  const yb = d3.scaleLinear().domain([0, maxB * 1.12]).range([yb0 + altoB, yb0]);
  p.push(linea(izq, yb(0), W - der, yb(0), C.gris, 0.45));
  anios.forEach((a) => {
    const v = g.barras[a];
    p.push(rect(xb(a), yb(v), xb.bandwidth(), yb(0) - yb(v), color[a]));
    p.push(texto(xb(a) + xb.bandwidth() / 2, yb(v) - 2, fmt(v, 0), { tam: 5.4, color: C.texto, ancla: "middle" }));
    p.push(texto(xb(a) + xb.bandwidth() / 2, yb(0) + 7, a, { tam: TAM_EJE, color: GRIS, ancla: "middle" }));
  });
  p.push(texto(izq + (W - izq - der) / 2, yb(0) + 15, tx.eje_x_barras, { tam: TAM_EJE, color: GRIS, ancla: "middle" }));
  return documento2(yb(0) + 18, p, pieTitulo(g, "gráfica 2"));
}

/* ------------------------------------------------------------ Gráfica 3 */
export function grafica3(D) {
  const g = D.grafica_3, tx = g.textos;
  const W = ANCHO, izq = 26, der = 34, sup = 16, alto = 150;
  const x = d3.scaleLinear().domain([2025, 2060]).range([izq, W - der]);
  const y = d3.scaleLinear().domain([1, 3.6]).range([sup + alto, sup]);
  const p = [rejillaY(y, izq, W - der, [1, 1.5, 2, 2.5, 3, 3.5], (t) => fmt(t, 1))];
  p.push(leyendaLineas(W / 2, 7, ESCENARIOS.map((e) => ({ etiqueta: e, color: COLOR_ESC[e], ancho: 1.4 }))));
  const rot = tx.rotulos_r;
  for (const e of ESCENARIOS) {
    p.push(trazo(g.anios.map((a, i) => [x(a), y(g[e][i])]), COLOR_ESC[e], 1.4));
    for (const a of Object.keys(rot[e]).map(Number)) {
      const v = g[e][a - 2025];
      p.push(punto(x(a), y(v), 1.1, COLOR_ESC[e]));
      const arriba = e !== "Bajo";
      p.push(texto(x(a), y(v) + (arriba ? -3.5 : 7.5), fmt(v, 1), { tam: 5.6, peso: 600, color: COLOR_ESC[e], ancla: "middle", halo: "#fff" }));
    }
  }
  p.push(punto(x(2025), y(g.Alto[0]), 1.3, C.texto));
  p.push(texto(x(2025) + 2, y(g.Alto[0]) - 4, fmt(g.Alto[0], 1), { tam: 5.6, peso: 600, color: C.texto, halo: "#fff" }));
  p.push(etiquetasFinales(W - der + 4, ESCENARIOS.map((e) => ({ y: y(g[e][g[e].length - 1]), texto: e, color: COLOR_ESC[e] }))));
  p.push(marcasX(x, sup + alto, [2025, 2030, 2035, 2040, 2045, 2050, 2055, 2060]));
  p.push(rotuloEjeY(6, sup + alto / 2, tx.eje_y));
  p.push(texto(izq + (W - izq - der) / 2, sup + alto + 16, tx.eje_x, { tam: TAM_EJE, color: GRIS, ancla: "middle" }));
  return documento2(sup + alto + 19, p, pieTitulo(g, "gráfica 3"));
}

/* ------------------------------------------------------------ Gráfica 4 */
export function grafica4(D) {
  const g = D.grafica_4, tx = g.textos;
  const grupos = tx.leyenda;
  const W = ANCHO, izq = 24, der = 3, sep = 7, altoP = 74;
  const anchoP = (W - izq - der - 2 * sep) / 3;
  const filas = [
    { clave: "volumen", eje: tx.eje_y_volumen, dom: [0, 2.1], ticks: [0, 0.5, 1, 1.5, 2], f: (t) => fmt(t, 1), dec: 2, suf: "" },
    { clave: "composicion", eje: tx.eje_y_composicion, dom: [0, 65], ticks: [0, 20, 40, 60], f: (t) => `${t}%`, dec: 1, suf: "%" },
  ];
  const p = [leyendaLineas(W / 2, 7, grupos.map((k) => ({ etiqueta: k, color: COLOR_EDAD[k], ancho: k === "65+" ? 1.6 : 1.2 })))];
  let y0 = 26;
  filas.forEach((fila, f) => {
    p.push(texto(izq - 20, y0 - 9, tx.bloques_r[f], { tam: 6.4, peso: 700, color: C.oscuro }));
    const y = d3.scaleLinear().domain(fila.dom).range([y0 + altoP, y0]);
    ESCENARIOS.forEach((e, c) => {
      const x0 = izq + c * (anchoP + sep);
      const x = d3.scaleLinear().domain([2025, 2060]).range([x0 + 2, x0 + anchoP - 2]);
      if (f === 0) p.push(cabecera(x0 + anchoP / 2, y0 - 2, e, { tam: 6 }));
      p.push(rejillaY(y, x0, x0 + anchoP, fila.ticks, fila.f, c === 0));
      for (const k of grupos) {
        p.push(trazo(g.anios.map((a, i) => [x(a), y(g[fila.clave][e][k][i])]), COLOR_EDAD[k], k === "65+" ? 1.5 : 1.1));
      }
      // 65+ en 2060 y años de cruce de 65+ con 0–14 y 15–29: rótulos de la figura original
      const v65 = g[fila.clave][e]["65+"];
      p.push(punto(x(2060), y(v65[v65.length - 1]), 1.1, COLOR_EDAD["65+"]));
      p.push(texto(x(2060) - 1, y(v65[v65.length - 1]) - 3.2, rotR(tx.rotulos_valores_r[fila.clave][e]["65+"]["2060"]), { tam: 5.4, peso: 700, color: COLOR_EDAD["65+"], ancla: "end", halo: "#fff" }));
      g.cruces_65[e].forEach((c65, j) => {
        const i = Math.floor(c65 - 2025);
        const yy = y(v65[i] + (v65[i + 1] - v65[i]) * (c65 - 2025 - i));
        p.push(punto(x(c65), yy, 1.1, COLOR_EDAD["65+"]));
        p.push(texto(x(c65), yy + 7.5, tx.rotulos_cruces_r[e][j], { tam: 5.2, color: COLOR_EDAD["65+"], ancla: "middle", halo: "#fff" }));
      });
      p.push(marcasPanel(x, y0 + altoP, [2025, 2040, 2060]));
    });
    p.push(rotuloEjeY(5, y0 + altoP / 2, fila.eje));
    y0 += altoP + 32;
  });
  const yF = y0 - 32;
  p.push(texto(izq + (W - izq - der) / 2, yF + 15, tx.eje_x, { tam: TAM_EJE, color: GRIS, ancla: "middle" }));
  return documento2(yF + 18, p, pieTitulo(g, "gráfica 4"));
}

/* ------------------------------------------------------------ Gráfica 5 */
export function grafica5(D) {
  const g = D.grafica_5, tx = g.textos;
  const W = ANCHO, izq = 30, der = 26, sup = 16, alto = 140;
  const x = d3.scaleLinear().domain([2017, 2060]).range([izq, W - der]);
  const y = d3.scaleLinear().domain([0, 62]).range([sup + alto, sup]);
  const p = [rejillaY(y, izq, W - der, [0, 20, 40, 60], (t) => fmt(t, 1))];
  const rec = g.reconstruccion;
  p.push(leyendaLineas(W / 2, 7, ESCENARIOS.map((e) => ({ etiqueta: e, color: COLOR_ESC[e], ancho: 1.4 }))));
  p.push(linea(x(2025), sup, x(2025), sup + alto, C.grisMedio, 0.5, `stroke-dasharray="1.5 1.5"`));
  p.push(trazo(rec.anios.map((a, i) => [x(a), y(rec.valores[i])]), C.texto, 1.4));
  for (const e of ESCENARIOS) p.push(trazo(g.escenarios.anios.map((a, i) => [x(a), y(g.escenarios[e][i])]), COLOR_ESC[e], 1.4));
  p.push(etiquetasFinales(W - der + 4, ESCENARIOS.map((e) => ({ y: y(g.escenarios[e][g.escenarios[e].length - 1]), texto: e, color: COLOR_ESC[e] }))));
  p.push(marcasX(x, sup + alto, [2017, 2020, 2025, 2030, 2040, 2050, 2060]));
  p.push(rotuloEjeY(6, sup + alto / 2, tx.eje_y));
  p.push(texto(izq + (W - izq - der) / 2, sup + alto + 16, tx.eje_x, { tam: TAM_EJE, color: GRIS, ancla: "middle" }));
  return documento2(sup + alto + 19, p, pieTitulo(g, "gráfica 5"));
}

/* ------------------------------------------------------------ Gráfica 6 */
export function grafica6(D) {
  const g = D.grafica_6, tx = g.textos;
  const edades = g.edades.map(guion);
  const W = ANCHO, sep = 6, colEdad = 15, sup = 44, filaAlto = 15, n = edades.length;
  const anchoP = (W - 2 * sep) / 3, mitad = (anchoP - colEdad) / 2;
  const xs = d3.scaleLinear().domain([0, 22]).range([0, mitad - 1]);
  const oscH = "#0b4f82", oscM = C.medio;
  const p = [];
  const nombres = { Alto: tx.paneles_r[1], Base: tx.paneles_r[2], Bajo: tx.paneles_r[0] };
  p.push(leyendaLineas(W / 2, 7, [
    { etiqueta: tx.leyenda[2], color: C.grisMedio, caja: true },
    { etiqueta: tx.leyenda[0], color: C.texto, ancho: 1.1 },
    { etiqueta: tx.leyenda[1], color: C.texto, ancho: 1.3, extra: PUNT },
  ], 5.6));
  p.push(leyendaLineas(W / 2, 15.5, [
    { etiqueta: tx.leyenda[3], color: SERIE.hombres, caja: true },
    { etiqueta: tx.leyenda[4], color: SERIE.mujeres, caja: true },
  ], 5.6));
  ESCENARIOS.forEach((e, k) => {
    const x0 = k * (anchoP + sep), eje = x0 + mitad, ejeM = eje + colEdad;
    const med = g.edad_mediana[e];
    p.push(cabecera(x0 + anchoP / 2, sup - 17, nombres[e], { tam: 5.8 }));
    p.push(texto(x0 + anchoP / 2, sup - 10.5, tx.panel_linea_2, { tam: 5.2, color: GRIS, ancla: "middle" }));
    p.push(texto(x0 + anchoP / 2, sup - 4.5, `2025: ${fmt(med["2025"])} | 2040: ${fmt(med["2040"])} | 2060: ${fmt(med["2060"])}`, { tam: 5.2, color: GRIS, ancla: "middle" }));
    for (const t of [0, 10, 20]) {
      p.push(linea(eje - xs(t), sup - 1, eje - xs(t), sup + n * filaAlto, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
      p.push(linea(ejeM + xs(t), sup - 1, ejeM + xs(t), sup + n * filaAlto, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
      p.push(texto(eje - xs(t), sup + n * filaAlto + 7, `${fmt(t, 0)}%`, { tam: 5.4, color: GRIS, ancla: "middle" }));
      p.push(texto(ejeM + xs(t), sup + n * filaAlto + 7, `${fmt(t, 0)}%`, { tam: 5.4, color: GRIS, ancla: "middle" }));
    }
    const yFila = (i) => sup + (n - 1 - i) * filaAlto;
    edades.forEach((ed, i) => {
      const yy = yFila(i);
      p.push(rect(eje - xs(g["2025"].Hombres[i]), yy + 1.5, xs(g["2025"].Hombres[i]), filaAlto - 3, SERIE.hombres, `fill-opacity="0.75"`));
      p.push(rect(ejeM, yy + 1.5, xs(g["2025"].Mujeres[i]), filaAlto - 3, SERIE.mujeres, `fill-opacity="0.85"`));
      p.push(texto(eje + colEdad / 2, yy + filaAlto / 2 + 2, ed, { tam: 5.2, color: GRIS, ancla: "middle" }));
    });
    for (const [anio, extra, anc] of [["2040", "", 1.1], ["2060", PUNT, 1.4]]) {
      const lin = g.escenarios[e][anio];
      p.push(trazo(lin.Hombres.map((v, i) => [eje - xs(v), yFila(i) + filaAlto / 2]), oscH, anc, extra));
      p.push(trazo(lin.Mujeres.map((v, i) => [ejeM + xs(v), yFila(i) + filaAlto / 2]), oscM, anc, extra));
    }
  });
  const yF = sup + n * filaAlto;
  p.push(texto(W / 2, yF + 16, tx.eje_x, { tam: TAM_EJE, color: GRIS, ancla: "middle" }));
  return documento2(yF + 19, p, pieTitulo(g, "gráfica 6"));
}

/* ------------------------------------------------------------ Gráfica 7 */
export function grafica7(D) {
  const g = D.grafica_7, tx = g.textos;
  const W = ANCHO, izq = 22, der = 26, sup = 22, altoP = 70, sepF = 22;
  const x = d3.scaleLinear().domain([2021, 2060]).range([izq, W - der]);
  const dominios = { Hombres: [76, 92], Mujeres: [44, 64] };
  const ticks = { Hombres: [76, 80, 84, 88, 92], Mujeres: [45, 50, 55, 60] };
  const p = [leyendaLineas(W / 2, 7, [{ etiqueta: tx.leyenda_historico || "Histórico", color: C.texto, ancho: 1.4 }, ...ESCENARIOS.map((e) => ({ etiqueta: e, color: COLOR_ESC[e], ancho: 1.4 }))])];
  tx.paneles.forEach((sexo, f) => {
    const y0 = sup + f * (altoP + sepF);
    const y = d3.scaleLinear().domain(dominios[sexo]).range([y0 + altoP, y0]);
    p.push(texto(izq, y0 - 5, sexo, { tam: 6.2, peso: 700, color: C.oscuro }));
    p.push(rejillaY(y, izq, W - der, ticks[sexo], (t) => t));
    p.push(linea(x(2025), y0, x(2025), y0 + altoP, C.grisMedio, 0.5, `stroke-dasharray="1.5 1.5"`));
    const h = g[sexo].historico;
    p.push(trazo(Object.keys(h).map((a) => [x(+a), y(h[a])]), C.texto, 1.4));
    for (const e of ESCENARIOS) p.push(trazo(g.anios.map((a, i) => [x(a), y(g[sexo][e][i])]), COLOR_ESC[e], 1.3));
    p.push(etiquetasFinales(W - der + 4, ESCENARIOS.map((e) => ({ y: y(g[sexo][e][g[sexo][e].length - 1]), texto: e, color: COLOR_ESC[e] })), 6.4));
    p.push(marcasX(x, y0 + altoP, [2021, 2025, 2030, 2040, 2050, 2060]));
  });
  const yF = sup + 2 * altoP + sepF;
  p.push(rotuloEjeY(6, sup + (yF - sup) / 2, tx.eje_y));
  p.push(texto(izq + (W - izq - der) / 2, yF + 16, tx.eje_x, { tam: TAM_EJE, color: GRIS, ancla: "middle" }));
  return documento2(yF + 19, p, pieTitulo(g, "gráfica 7"));
}

/* ------------------------------------------------------------ Gráfica 8 */
export function grafica8(D) {
  const g = D.grafica_8, tx = g.textos;
  const W = ANCHO, izq = 24, der = 16, sep = 6, sup = 26, altoP = 72, sepF = 12;
  const anchoP = (W - izq - der - 2 * sep) / 3;
  const y = d3.scaleLinear().domain([0, 1.3]);
  const est = { PEA: { color: C.oscuro, extra: "" }, PNEA: { color: C.medio, extra: DISC } };
  const p = [leyendaLineas(W / 2, 7, tx.leyenda.map((s) => ({ etiqueta: s, color: est[s].color, ancho: 1.4, extra: est[s].extra })))];
  tx.filas.forEach((sexo, f) => {
    const y0 = sup + f * (altoP + sepF);
    y.range([y0 + altoP, y0]);
    p.push(texto(W - der + 9, y0 + altoP / 2, sexo, { tam: 6.2, peso: 700, color: C.oscuro, ancla: "middle", rot: 90 }));
    ESCENARIOS.forEach((e, c) => {
      const x0 = izq + c * (anchoP + sep);
      const x = d3.scaleLinear().domain([2025, 2060]).range([x0 + 2, x0 + anchoP - 2]);
      if (f === 0) p.push(cabecera(x0 + anchoP / 2, y0 - 4, e, { tam: 6 }));
      p.push(rejillaY(y, x0, x0 + anchoP, [0, 0.25, 0.5, 0.75, 1, 1.25], (t) => fmt(t, 2), c === 0));
      for (const s of tx.leyenda) p.push(trazo(g.anios.map((a, i) => [x(a), y(g[sexo][e][s][i])]), est[s].color, 1.3, est[s].extra));
      if (f === tx.filas.length - 1) p.push(marcasPanel(x, y0 + altoP, [2025, 2040, 2060]));
    });
  });
  const yF = sup + 2 * altoP + sepF;
  p.push(rotuloEjeY(5, sup + (yF - sup) / 2, tx.eje_y));
  p.push(texto(izq + (W - izq - der) / 2, yF + 16, tx.eje_x, { tam: TAM_EJE, color: GRIS, ancla: "middle" }));
  return documento2(yF + 19, p, pieTitulo(g, "gráfica 8"));
}

/* ------------------------------------------------------------ Gráfica 9 */
export function grafica9(D) {
  const g = D.grafica_9, tx = g.textos;
  const grupos = g.grupos.map(guion);
  const W = ANCHO, izq = 24, der = 16, sep = 6, sup = 28, altoP = 74, sepF = 12;
  const anchoP = (W - izq - der - 2 * sep) / 3;
  const y = d3.scaleLinear().domain([0, 100]);
  const p = [leyendaLineas(W / 2, 7, grupos.map((k) => ({ etiqueta: k, color: COLOR_PEA[k], caja: true })), 5.8)];
  tx.filas.forEach((sexo, f) => {
    const y0 = sup + f * (altoP + sepF);
    y.range([y0 + altoP, y0]);
    p.push(texto(W - der + 9, y0 + altoP / 2, sexo, { tam: 6.2, peso: 700, color: C.oscuro, ancla: "middle", rot: 90 }));
    ESCENARIOS.forEach((e, c) => {
      const x0 = izq + c * (anchoP + sep);
      const x = d3.scaleLinear().domain([2025, 2060]).range([x0, x0 + anchoP]);
      if (f === 0) p.push(cabecera(x0 + anchoP / 2, y0 - 4, e, { tam: 6 }));
      const serie = g[sexo][e];
      let base = g.anios.map(() => 0);
      g.grupos.forEach((k, gi) => {
        const tope = base.map((b, i) => b + serie[k][i]);
        const area = d3.area().x((d, i) => x(g.anios[i])).y0((d, i) => y(base[i])).y1((d, i) => y(tope[i]))(g.anios);
        p.push(`<path d="${area}" fill="${COLOR_PEA[grupos[gi]]}"/>`);
        base = tope;
      });
      p.push(rejillaY(y, x0, x0 + anchoP, [0, 25, 50, 75, 100], (t) => `${t}%`, c === 0).replace(/stroke="#d5d7da"/g, `stroke="#ffffff"`));
      [2040, 2060].forEach((anio, j) => {
        p.push(texto(x(anio) - (anio === 2060 ? 1 : 0), y0 + 6, `65+: ${rotR(tx.rotulos_65_r[sexo][e][j])}`, { tam: 5.0, peso: 600, color: "#ffffff", ancla: anio === 2060 ? "end" : "middle" }));
      });
      if (f === tx.filas.length - 1) p.push(marcasPanel(x, y0 + altoP, [2025, 2040, 2060]));
    });
  });
  const yF = sup + 2 * altoP + sepF;
  p.push(rotuloEjeY(5, sup + (yF - sup) / 2, tx.eje_y));
  p.push(texto(izq + (W - izq - der) / 2, yF + 16, tx.eje_x, { tam: TAM_EJE, color: GRIS, ancla: "middle" }));
  return documento2(yF + 19, p, pieTitulo(g, "gráfica 9"));
}

/* ------------------------------------------------------------ Anexo 1 */
export function anexo1(D) {
  const g = D.anexo_1, tx = g.textos;
  const grupos = tx.leyenda;
  const W = ANCHO, izq = 18, sep = 34, der = 30, sup = 40, alto = 136;
  const anchoP = (W - izq - der - sep) / 2;
  const paneles = [
    { clave: "volumen", eje: tx.eje_y_volumen, dom: [0, 30], ticks: [0, 10, 20, 30], f: (t) => t, suf: "" },
    { clave: "composicion", eje: tx.eje_y_composicion, dom: [0, 55], ticks: [0, 10, 20, 30, 40, 50], f: (t) => `${t}%`, suf: "%" },
  ];
  const p = [leyendaLineas(W / 2, 7, grupos.map((k) => ({ etiqueta: k, color: COLOR_EDAD[k], ancho: k === "65+" ? 1.6 : 1.2 })))];
  paneles.forEach((pn, k) => {
    const x0 = izq + k * (anchoP + sep);
    const x = d3.scaleLinear().domain([2025, 2060]).range([x0, x0 + anchoP]);
    const y = d3.scaleLinear().domain(pn.dom).range([sup + alto, sup]);
    p.push(texto(x0 - izq + 4, sup - 15, tx.paneles[k], { tam: 6.2, peso: 700, color: C.oscuro }));
    p.push(texto(x0 - izq + 4, sup - 5, pn.eje, { tam: TAM_EJE, color: GRIS }));
    p.push(rejillaY(y, x0, x0 + anchoP, pn.ticks, pn.f));
    for (const gr of grupos) p.push(trazo(g.anios.map((a, i) => [x(a), y(g[pn.clave][gr][i])]), COLOR_EDAD[gr], gr === "65+" ? 1.5 : 1.1));
    const v65 = g[pn.clave]["65+"];
    g.cruces_65[pn.clave].forEach((c65, j) => {
      const i = Math.floor(c65 - 2025);
      const yy = y(v65[i] + (v65[i + 1] - v65[i]) * (c65 - 2025 - i));
      p.push(punto(x(c65), yy, 1.1, COLOR_EDAD["65+"]));
      p.push(texto(x(c65), yy - 4, tx.rotulos_cruces_r[j], { tam: 5.4, peso: 600, color: COLOR_EDAD["65+"], ancla: "middle", halo: "#fff" }));
    });
    p.push(etiquetasFinales(x0 + anchoP + 2, grupos.map((gr) => ({ y: y(g[pn.clave][gr][g.anios.length - 1]), texto: rotR(tx.rotulos_finales_r[pn.clave][gr]), color: COLOR_EDAD[gr] })), 6.4, 5.4));
    p.push(marcasPanel(x, sup + alto, [2025, 2035, 2045, 2060]));
    p.push(texto(x0 + anchoP / 2, sup + alto + 15, tx.eje_x, { tam: TAM_EJE, color: GRIS, ancla: "middle" }));
  });
  return documento2(sup + alto + 18, p, pieTitulo(g, "anexo 1"));
}

export const FIGURAS_C2 = {
  "c2-grafica-1": grafica1, "c2-grafica-2": grafica2, "c2-grafica-3": grafica3, "c2-grafica-4": grafica4,
  "c2-grafica-5": grafica5, "c2-grafica-6": grafica6, "c2-grafica-7": grafica7, "c2-grafica-8": grafica8,
  "c2-grafica-9": grafica9, "c2-anexo-1": anexo1,
};
