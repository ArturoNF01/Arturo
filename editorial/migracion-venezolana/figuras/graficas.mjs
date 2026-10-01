// Gráficas 1-9 y diagrama 1 del capítulo 1, redibujadas en vector.
// Los textos (etiquetas, títulos, leyendas, cifras) son los del manuscrito, sin cambios:
// datos/figuras-original.json. Solo cambia el dibujo (vector, colores y letra del libro).
import { ANCHO, C, SERIE, texto, rect, linea, leyenda, medir, partir, numero, documento, guardar, ajustes, original, d3 } from "./lib.mjs";

const O = original();

const TAM_EJE = 6.2;
const TAM_ETIQ = 6.5;

function ejeY(escala, x0, x1, ticks, fmt, o = {}) {
  const { rotulo = null, yRotulo = 0 } = o;
  const partes = [];
  for (const t of ticks) {
    const y = escala(t);
    partes.push(linea(x0, y, x1, y, t === 0 ? C.gris : C.reticula, t === 0 ? 0.5 : 0.3));
    partes.push(texto(x0 - 3, y + 2.1, fmt(t), { tam: TAM_EJE, color: C.grisTexto, ancla: "end" }));
  }
  if (rotulo) partes.push(texto(x0 - 3, yRotulo, rotulo, { tam: TAM_EJE, color: C.grisTexto, ancla: "end", peso: 600 }));
  return partes.join("");
}

/* ---------------------------------------------------------------- Gráfica 1 */
export function grafica1(D) {
  const g = D.grafica_1;
  const W = ANCHO, H = 186;
  const m = { izq: 18, der: 2, sup: 34, inf: 13 };
  const colores = { mc: C.oscuro, onu: C.grisMedio, geih: C.claro, r4v: C.azul };
  const etiquetas = O.grafica_1.leyenda;
  const x = d3.scaleBand().domain(g.anios).range([m.izq, W - m.der]).paddingInner(0.16).paddingOuter(0.06);
  const y = d3.scaleLinear().domain([0, 3]).range([H - m.inf, m.sup]);
  const slot = d3.scaleBand().domain(g.series.map((s) => s.clave)).range([0, x.bandwidth()]).paddingInner(0.14);
  const p = [];
  p.push(ejeY(y, m.izq, W - m.der, [0, 0.5, 1, 1.5, 2, 2.5, 3], (t) => t.toFixed(1)));
  p.push(texto(m.izq - 3, m.sup - 8, O.grafica_1.eje, { tam: TAM_EJE, color: C.grisTexto, peso: 600, ancla: "end" }));
  for (const s of g.series) {
    s.valores.forEach((v, i) => {
      if (v == null) return;
      const anio = g.anios[i];
      const bx = x(anio) + slot(s.clave);
      const by = y(v);
      p.push(rect(bx, by, slot.bandwidth(), y(0) - by, colores[s.clave]));
      const et = v < 0.1 ? v.toFixed(2) : v.toFixed(1);
      p.push(texto(bx + slot.bandwidth() / 2 + 1.8, by - 1.6, et, {
        tam: 5.3, color: s.clave === "geih" || s.clave === "onu" ? C.grisTexto : colores[s.clave], rot: -90,
      }));
    });
  }
  for (const a of g.anios) p.push(texto(x(a) + x.bandwidth() / 2, H - m.inf + 8.6, a, { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
  const ley = leyenda(0, 7, g.series.map((s) => ({ color: colores[s.clave], etiqueta: etiquetas[s.clave] })), { tam: 6.4, sep: 9 });
  p.push(ley.svg);
  return documento(W, H, p.join("\n"), { titulo: "Gráfica 1. Población venezolana en Colombia según fuente, 2014-2025" });
}

/* ---------------------------------------------------------------- Diagrama 1 */
export function diagrama1(D) {
  const d = D.diagrama_1;
  const W = ANCHO, H = 122;
  const n = d.length, punta = 7, alto = 24, cy = 61;
  const paso = (W - punta) / n;
  // Intensidad del color según el peso de cada periodo
  const escala = d3.scaleThreshold().domain([1, 4, 10, 50]).range([C.bruma, C.hielo, C.celeste, C.medio, C.oscuro]);
  const p = [];
  d.forEach((e, i) => {
    const x0 = i * paso, x1 = x0 + paso;
    const pts = i === 0
      ? [[x0, cy - alto / 2], [x1 - 1.2, cy - alto / 2], [x1 - 1.2 + punta, cy], [x1 - 1.2, cy + alto / 2], [x0, cy + alto / 2]]
      : [[x0, cy - alto / 2], [x1 - 1.2, cy - alto / 2], [x1 - 1.2 + punta, cy], [x1 - 1.2, cy + alto / 2], [x0, cy + alto / 2], [x0 + punta, cy]];
    const relleno = escala(e.valor);
    p.push(`<polygon points="${pts.map((q) => q.map((v) => v.toFixed(2)).join(",")).join(" ")}" fill="${relleno}"/>`);
    const oscuro = [C.medio, C.oscuro].includes(relleno);
    const cx = x0 + (i === 0 ? 0 : punta) / 2 + paso / 2 - 1.5;
    p.push(texto(cx, cy + 2.6, e.periodo, { tam: 7.2, peso: 700, color: oscuro ? C.blanco : C.oscuro, ancla: "middle" }));
    // Rótulos alternados arriba y abajo
    const arriba = i % 2 === 0;
    const yPin0 = arriba ? cy - alto / 2 - 3 : cy + alto / 2 + 3;
    const yPin1 = arriba ? cy - alto / 2 - 15 : cy + alto / 2 + 15;
    p.push(linea(cx, yPin0, cx, yPin1, C.grisMedio, 0.5));
    p.push(`<circle cx="${cx.toFixed(2)}" cy="${yPin1.toFixed(2)}" r="1.5" fill="${C.azul}"/>`);
    const lineas = partir(e.etapa, paso + 4, 6.6, 600);
    const pct = numero(e.valor, 2) + "%";
    if (arriba) {
      const yPct = yPin1 - 5;
      p.push(texto(cx, yPct, pct, { tam: 9, peso: 700, color: C.azul, ancla: "middle" }));
      const yTit = yPct - 11 - (lineas.length - 1) * 7.6;
      p.push(texto(cx, yTit, lineas, { tam: 6.6, peso: 600, color: C.oscuro, ancla: "middle", interlineado: 7.6 }));
    } else {
      const yTit = yPin1 + 9.5;
      p.push(texto(cx, yTit, lineas, { tam: 6.6, peso: 600, color: C.oscuro, ancla: "middle", interlineado: 7.6 }));
      p.push(texto(cx, yTit + lineas.length * 7.6 + 5, pct, { tam: 9, peso: 700, color: C.azul, ancla: "middle" }));
    }
  });
  return documento(W, H, p.join("\n"), { titulo: "Diagrama 1. Población venezolana residente en Colombia según periodo de llegada, 2025" });
}

/* ------------------------------------------------------ Gráficas 2 y 3 (pirámides) */
// Cada panel lleva el título, el subtítulo y la anotación del manuscrito; la fila de
// mayor divergencia (máxima diferencia entre sexos) se resalta como en el original.
function piramides(paneles, textos, titulo) {
  const W = ANCHO;
  const sep = 14, colEdad = 17, margen = 3;
  const anchoPanel = (W - sep - 2 * margen) / 2;
  const mitad = (anchoPanel - colEdad) / 2;
  const titLineas = Math.max(...textos.paneles.map((t) => partir(t.titulo, anchoPanel, 6.4, 700).length));
  const subLineas = Math.max(...textos.paneles.map((t) => partir(t.subtitulo, anchoPanel, 5.3).length));
  const ySub = 7 + titLineas * 7.4 + 1.2;
  const sup = ySub + subLineas * 6.2 + 4, filaAlto = 7.9, n = 18;
  const H = sup + n * filaAlto + 18;
  const p = [];
  paneles.forEach((panel, k) => {
    const tx = textos.paneles[k];
    const maximo = tx.maximo;
    const x0 = margen + k * (anchoPanel + sep);
    const eje = x0 + mitad; // borde interior de los hombres
    const ejeM = eje + colEdad; // borde interior de las mujeres
    const xs = d3.scaleLinear().domain([0, maximo]).range([0, mitad - 1]);
    p.push(texto(x0, 7, partir(tx.titulo, anchoPanel, 6.4, 700), { tam: 6.4, peso: 700, color: C.oscuro, interlineado: 7.4 }));
    p.push(texto(x0, ySub, partir(tx.subtitulo, anchoPanel, 5.3), { tam: 5.3, color: C.grisTexto, interlineado: 6.2 }));
    // fila de mayor divergencia
    const iMax = panel.datos.reduce((a, f, i, arr) =>
      Math.abs(f.hombres - f.mujeres) > Math.abs(arr[a].hombres - arr[a].mujeres) ? i : a, 0);
    const yMax = sup + (n - 1 - iMax) * filaAlto;
    p.push(rect(x0, yMax, anchoPanel, filaAlto, "#000", `fill-opacity="0.045"`));
    // retícula
    for (let t = 0; t <= maximo; t += 2) {
      p.push(linea(eje - xs(t), sup - 2, eje - xs(t), sup + n * filaAlto, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
      p.push(linea(ejeM + xs(t), sup - 2, ejeM + xs(t), sup + n * filaAlto, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
      p.push(texto(eje - xs(t), sup + n * filaAlto + 7.5, t, { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
      p.push(texto(ejeM + xs(t), sup + n * filaAlto + 7.5, t, { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
    }
    p.push(texto(eje - mitad / 2, sup + n * filaAlto + 15.5, textos.ejes[0], { tam: 5.8, color: C.grisTexto, ancla: "middle" }));
    p.push(texto(ejeM + mitad / 2, sup + n * filaAlto + 15.5, textos.ejes[1], { tam: 5.8, color: C.grisTexto, ancla: "middle" }));
    panel.datos.forEach((f, i) => {
      const yy = sup + (n - 1 - i) * filaAlto; // 0-4 abajo
      const alto = filaAlto - 1.5;
      p.push(rect(eje - xs(f.hombres), yy + 0.75, xs(f.hombres), alto, SERIE.hombres));
      p.push(rect(ejeM, yy + 0.75, xs(f.mujeres), alto, SERIE.mujeres));
      p.push(texto(eje + colEdad / 2, yy + filaAlto / 2 + 2, f.edad, { tam: 5.3, color: C.grisTexto, ancla: "middle" }));
    });
    // anotación: en la zona libre de arriba a la derecha, con guía hasta la fila
    const fMax = panel.datos[iMax];
    const ax = ejeM + xs(fMax.mujeres) + 1.5, ay = yMax + filaAlto / 2;
    const lx = ejeM + xs(maximo * 0.4), lineasA = partir(tx.anotacion, x0 + anchoPanel - lx, 5.4, 600);
    const ly = sup + 2 * filaAlto;
    p.push(`<polyline points="${ax.toFixed(2)},${ay.toFixed(2)} ${(lx - 3).toFixed(2)},${ay.toFixed(2)} ${(lx - 3).toFixed(2)},${(ly - 2).toFixed(2)} ${(lx - 1).toFixed(2)},${(ly - 2).toFixed(2)}" fill="none" stroke="${C.texto}" stroke-width="0.4"/>`);
    p.push(texto(lx, ly, lineasA, { tam: 5.4, peso: 600, color: C.texto, interlineado: 6.3, halo: "#fff" }));
  });
  return documento(W, H, p.join("\n"), { titulo });
}

export function grafica2(D) {
  return piramides([{ datos: D.grafica_2["2022"] }, { datos: D.grafica_2["2025"] }], O.grafica_2,
    "Gráfica 2. Estructura por edad y sexo de la población venezolana en Colombia, 2022 y 2025");
}

export function grafica3(D) {
  return piramides([{ datos: D.grafica_3.otros }, { datos: D.grafica_3.colombiana }], O.grafica_3,
    "Gráfica 3. Estructura por edad y sexo de otra población inmigrante y colombiana, 2025");
}

/* ---------------------------------------------------------------- Gráfica 4 */
export function grafica4(D) {
  const tx = O.grafica_4;
  const filas = tx.filas.map(([nivel, total, mujeres, hombres]) => ({
    nivel, total, mujeres, hombres, vt: parseFloat(total), vm: parseFloat(mujeres), vh: parseFloat(hombres),
  }));
  const W = ANCHO, sup = 30, filaAlto = 19, inf = 14;
  const H = sup + filas.length * filaAlto + inf;
  const colNom = 58, anchoTot = 64, sep = 16;
  const x0T = colNom, x0B = colNom + anchoTot + sep, anchoB = W - x0B - 10;
  const xT = d3.scaleLinear().domain([0, 50]).range([0, anchoTot - 14]);
  const xB = d3.scaleLinear().domain([0, 50]).range([0, anchoB]);
  const p = [];
  const ley = leyenda(x0B, 7, [{ tipo: "punto", color: SERIE.mujeres, etiqueta: tx.leyenda[0] }, { tipo: "punto", color: SERIE.hombres, etiqueta: tx.leyenda[1] }]);
  p.push(ley.svg);
  p.push(texto(x0T, sup - 9, tx.secciones[0], { tam: 6, peso: 700, color: C.oscuro, espaciado: 0.4 }));
  p.push(texto(x0B, sup - 9, tx.secciones[1], { tam: 6, peso: 700, color: C.oscuro, espaciado: 0.4 }));
  const base = sup + filas.length * filaAlto;
  tx.marcas_total.forEach((m) => {
    const t = parseFloat(m);
    p.push(linea(x0T + xT(t), sup - 3, x0T + xT(t), base, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
    p.push(texto(x0T + xT(t), base + 8, m, { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
  });
  tx.marcas_brecha.forEach((m) => {
    const t = parseFloat(m);
    p.push(linea(x0B + xB(t), sup - 3, x0B + xB(t), base, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
    p.push(texto(x0B + xB(t), base + 8, m, { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
  });
  filas.forEach((f, i) => {
    const cy = sup + i * filaAlto + filaAlto / 2;
    p.push(texto(colNom - 5, cy + 2.2, f.nivel, { tam: TAM_ETIQ, color: C.texto, ancla: "end" }));
    p.push(rect(x0T, cy - 4.2, xT(f.vt), 8.4, C.palido));
    p.push(texto(x0T + xT(f.vt) + 2.5, cy + 2.1, f.total, { tam: 6, color: C.grisTexto }));
    const a = xB(Math.min(f.vh, f.vm)), b = xB(Math.max(f.vh, f.vm));
    p.push(linea(x0B + a, cy, x0B + b, cy, C.grisClaro, 1.4));
    p.push(`<circle cx="${(x0B + xB(f.vh)).toFixed(2)}" cy="${cy.toFixed(2)}" r="2.6" fill="${SERIE.hombres}" stroke="#fff" stroke-width="0.6"/>`);
    p.push(`<circle cx="${(x0B + xB(f.vm)).toFixed(2)}" cy="${cy.toFixed(2)}" r="2.6" fill="${SERIE.mujeres}" stroke="#fff" stroke-width="0.6"/>`);
    // mujeres encima del punto, hombres debajo (como en el original)
    p.push(texto(x0B + xB(f.vm), cy - 4.3, f.mujeres, { tam: 5.5, color: C.medio, peso: 600, ancla: "middle" }));
    p.push(texto(x0B + xB(f.vh), cy + 8.9, f.hombres, { tam: 5.5, color: SERIE.hombres, peso: 600, ancla: "middle" }));
  });
  return documento(W, H, p.join("\n"), { titulo: "Gráfica 4. Nivel educativo de la población venezolana en Colombia según sexo, 2025" });
}

/* ---------------------------------------------------------------- Gráfica 5 */
export function grafica5(D) {
  const ind = D.grafica_5;
  const tx = O.grafica_5;
  const anios = [2022, 2023, 2024, 2025];
  const W = ANCHO, colNom = 60, sep = 10, sup = 33, fila = ajustes("grafica-5").fila ?? 17, huecoGrupo = 12;
  const anchoPanel = (W - colNom - sep) / 2;
  const x = d3.scaleBand().domain(anios).range([0, anchoPanel]).paddingInner(0.07);
  const yFila = (i) => sup + i * fila + (i >= 2 ? huecoGrupo : 0);
  const H = yFila(3) + fila + 18;
  const rampa = d3.interpolateRgbBasis([C.bruma, C.celeste, C.medio, C.oscuro]);
  const p = [];
  // Leyenda de intensidad (al pie)
  const ly = yFila(3) + fila + 8;
  p.push(texto(colNom, ly + 4.6, "Menor valor", { tam: 5.8, color: C.grisTexto }));
  const gx = colNom + medir("Menor valor", 5.8) + 4;
  const pasos = 10;
  for (let k = 0; k < pasos; k++) p.push(rect(gx + (70 / pasos) * k, ly, 70 / pasos + 0.05, 5.2, rampa(k / (pasos - 1))));
  p.push(texto(gx + 74, ly + 4.6, "Mayor valor", { tam: 5.8, color: C.grisTexto }));
  // Grupos de indicadores (izquierda)
  p.push(texto(colNom - 5, sup - 3, tx.grupos[0], { tam: 5.2, peso: 700, color: C.grisTexto, ancla: "end", espaciado: 0.5 }));
  p.push(texto(colNom - 5, yFila(2) - 3.2, tx.grupos[1], { tam: 5.2, peso: 700, color: C.grisTexto, ancla: "end", espaciado: 0.5 }));
  ["Mujeres", "Hombres"].forEach((sexo, k) => {
    const x0 = colNom + k * (anchoPanel + sep);
    p.push(texto(x0 + anchoPanel / 2, sup - 23, sexo, { tam: 7.4, peso: 700, color: C.oscuro, ancla: "middle" }));
    anios.forEach((a) => p.push(texto(x0 + x(a) + x.bandwidth() / 2, sup - 3, a, { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" })));
    ind.forEach((it, i) => {
      const valores = [...it.mujeres, ...it.hombres];
      const esc = d3.scaleLinear().domain([d3.min(valores) * 0.85, d3.max(valores)]).range([0, 1]);
      const serie = sexo === "Mujeres" ? it.mujeres : it.hombres;
      serie.forEach((v, j) => {
        const t = esc(v);
        const color = rampa(t);
        const xx = x0 + x(anios[j]), yy = yFila(i);
        p.push(rect(xx, yy, x.bandwidth(), fila - 1.6, color));
        p.push(texto(xx + x.bandwidth() / 2, yy + (fila - 1.6) / 2 + 2.4, numero(v, 1), {
          tam: 6.8, peso: 700, color: t > 0.5 ? C.blanco : C.oscuro, ancla: "middle",
        }));
      });
    });
  });
  // Anotaciones del original: Mujeres, sobre el grupo de presión; Hombres, bajo su título
  p.push(texto(colNom, yFila(2) - 3.2, tx.anotaciones.Mujeres, { tam: 5.2, cursiva: true, color: C.grisTexto }));
  p.push(texto(colNom + anchoPanel + sep, sup - 13, tx.anotaciones.Hombres, { tam: 5.2, cursiva: true, color: C.grisTexto }));
  ind.forEach((it, i) => {
    const yy = yFila(i) + (fila - 1.6) / 2;
    p.push(texto(colNom - 5, yy - 0.6, it.id, { tam: 6.8, peso: 700, color: C.oscuro, ancla: "end" }));
    p.push(texto(colNom - 5, yy + 6.2, it.nombre, { tam: 5.6, color: C.grisTexto, ancla: "end" }));
  });
  return documento(W, H, p.join("\n"), { titulo: "Gráfica 5. Indicadores laborales de la población venezolana en Colombia según sexo, 2022-2025" });
}

/* ---------------------------------------------------------------- Gráfica 6 */
// Etiquetas, cifras y orden del manuscrito (Total = «Total (promedio)» del original).
export function grafica6(D) {
  const tx = O.grafica_6;
  const filas = tx.filas.map(([posicion, h, m, t]) => ({ posicion, h, m, t }));
  const W = ANCHO, sup = 17, grupo = 21, inf = 21, colNom = 86;
  const H = sup + filas.length * grupo + inf;
  const x = d3.scaleLinear().domain([0, 60]).range([colNom, W - 18]);
  const barra = 5;
  const series = [["t", SERIE.total], ["m", SERIE.mujeres], ["h", SERIE.hombres]]; // de arriba abajo, como el original
  const p = [];
  p.push(leyenda(colNom, 7, [
    { color: SERIE.hombres, etiqueta: tx.leyenda[0] },
    { color: SERIE.mujeres, etiqueta: tx.leyenda[1] },
    { color: SERIE.total, etiqueta: tx.leyenda[2] },
  ]).svg);
  const base = sup + filas.length * grupo;
  for (const t of [0, 10, 20, 30, 40, 50, 60]) {
    p.push(linea(x(t), sup - 2, x(t), base, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
    p.push(texto(x(t), base + 8, t, { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
  }
  p.push(texto((x(0) + x(60)) / 2, base + 17, tx.eje, { tam: 6, peso: 600, color: C.grisTexto, ancla: "middle" }));
  filas.forEach((f, i) => {
    const y0 = sup + i * grupo + 2.2;
    const nom = partir(f.posicion, colNom - 8, TAM_ETIQ);
    p.push(texto(colNom - 5, y0 + 9 - (nom.length - 1) * 3.8, nom, { tam: TAM_ETIQ, color: C.texto, ancla: "end", interlineado: 7.6 }));
    series.forEach(([k, col], j) => {
      const yy = y0 + j * (barra + 0.6);
      const v = parseFloat(f[k]);
      p.push(rect(x(0), yy, x(v) - x(0), barra, col));
      p.push(texto(x(v) + 2, yy + barra - 0.8, f[k], { tam: 5.4, color: C.grisTexto }));
    });
  });
  return documento(W, H, p.join("\n"), { titulo: "Gráfica 6. Población venezolana ocupada según posición en el trabajo por sexo, 2025" });
}

/* ---------------------------------------------------------------- Gráfica 7 */
// Sin imagen en el manuscrito: datos y etiquetas de la hoja «Gráfica 7» del Excel;
// las etiquetas truncadas se completan con la redacción del cuadro 6.
export function grafica7(D) {
  const filas = D.grafica_7_8.map((f) => ({ ...f, rama: O.grafica_7.completar[f.rama_excel] ?? f.rama_excel }));
  const W = ANCHO, sup = 6, fila = ajustes("grafica-7").fila ?? 12.6, inf = 13, colNom = 118;
  const H = sup + filas.length * fila + inf;
  const x = d3.scaleLinear().domain([0, 25]).range([colNom, W - 14]);
  const p = [];
  const base = sup + filas.length * fila;
  for (const t of [0, 5, 10, 15, 20, 25]) {
    p.push(linea(x(t), sup - 2, x(t), base, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
    p.push(texto(x(t), base + 8, t, { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
  }
  filas.forEach((f, i) => {
    const cy = sup + i * fila + fila / 2;
    p.push(texto(colNom - 5, cy + 2.2, f.rama, { tam: TAM_ETIQ, color: C.texto, ancla: "end" }));
    const gb = Math.min(9, fila * 0.58);
    p.push(rect(x(0), cy - gb / 2, x(f.total) - x(0), gb, C.azul));
    p.push(texto(x(f.total) + 2.4, cy + 2.1, numero(f.total, 1), { tam: 6, color: C.grisTexto }));
  });
  return documento(W, H, p.join("\n"), { titulo: "Gráfica 7. Población venezolana ocupada según rama de actividad económica, 2025" });
}

/* ---------------------------------------------------------------- Gráfica 8 */
// Por defecto, tal como el manuscrito (etiquetas y cifras de su imagen). La imagen
// original tiene las etiquetas desfasadas respecto de los datos del Excel; con
// figuras/ajustes.json → "grafica-8": {"version": "excel"} se dibuja con el Excel.
export function grafica8(D) {
  const tx = O.grafica_8;
  const excel = (ajustes("grafica-8").version ?? "manuscrito") === "excel";
  const filas = excel
    ? D.grafica_7_8.map((f) => ({ rama: O.grafica_7.completar[f.rama_excel] ?? f.rama_excel, h: f.hombres, m: f.mujeres,
      eh: numero(f.hombres, 1) + "%", em: numero(f.mujeres, 1) + "%" }))
    : tx.filas.map(([rama, h, m]) => ({ rama, h, m, eh: h == null ? null : h.toFixed(1) + "%", em: m == null ? null : m.toFixed(1) + "%" }));
  const W = ANCHO, sup = 6, fila = ajustes("grafica-8").fila ?? 12.6, inf = 30, colNom = 92;
  const H = sup + filas.length * fila + inf;
  const ancho = W - colNom - 2;
  const k = (ancho - 30) / 61; // pt por punto porcentual (-25 a 36)
  const centro = colNom + 15 + 25 * k;
  const p = [];
  const base = sup + filas.length * fila;
  tx.marcas.forEach((m, i) => {
    const t = [-20, -10, 0, 10, 20, 30][i];
    const xx = centro + t * k;
    p.push(linea(xx, sup - 2, xx, base, t === 0 ? C.gris : C.reticula, t === 0 ? 0.5 : 0.3));
    p.push(texto(xx, base + 8, m, { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
  });
  p.push(texto(centro, base + 17, tx.eje, { tam: 6, peso: 600, color: C.grisTexto, ancla: "middle" }));
  p.push(leyenda(W - 2 - medir(tx.leyenda[0], 6) - medir(tx.leyenda[1], 6) - 26, base + 26,
    [{ color: SERIE.hombres, etiqueta: tx.leyenda[0] }, { color: SERIE.mujeres, etiqueta: tx.leyenda[1] }], { tam: 6 }).svg);
  filas.forEach((f, i) => {
    const cy = sup + i * fila + fila / 2;
    p.push(texto(colNom - 5, cy + 2.2, f.rama, { tam: TAM_ETIQ, color: C.texto, ancla: "end" }));
    const gb = Math.min(9, fila * 0.58);
    if (f.h != null) {
      p.push(rect(centro - f.h * k, cy - gb / 2, f.h * k, gb, SERIE.hombres));
      p.push(texto(centro - f.h * k - 2.2, cy + 2.1, f.eh, { tam: 5.4, color: C.grisTexto, ancla: "end" }));
    }
    if (f.m != null) {
      p.push(rect(centro, cy - gb / 2, f.m * k, gb, SERIE.mujeres));
      p.push(texto(centro + f.m * k + 2.2, cy + 2.1, f.em, { tam: 5.4, color: C.grisTexto }));
    }
  });
  return documento(W, H, p.join("\n"), { titulo: "Gráfica 8. Población venezolana ocupada según rama de actividad económica y sexo, 2025" });
}

/* ---------------------------------------------------------------- Gráfica 9 */
// Como el original: rótulo de condición bajo cada barra, cifras con coma de miles
// y eje de 0 («-») a 10,000 en miles.
export function grafica9(D) {
  const g = D.grafica_9;
  const tx = O.grafica_9;
  const colores = { "Formal": C.azul, "Informal": C.claro, "Total población ocupada": C.gris };
  const W = ANCHO, izq = 26, panelAlto = ajustes("grafica-9").panel ?? 110, sup = 4, sepPanel = 10;
  const H = sup + 2 * panelAlto + sepPanel + 2;
  const miles = (v) => Math.round(v).toLocaleString("en-US");
  const p = [];
  ["hombres", "mujeres"].forEach((sexo, k) => {
    const y0 = sup + k * (panelAlto + sepPanel);
    const y = d3.scaleLinear().domain([0, 10000]).range([y0 + panelAlto - 30, y0 + 12]);
    const x = d3.scaleBand().domain(tx.grupos).range([izq, W - 2]).paddingInner(0.12).paddingOuter(0.03);
    const s = d3.scaleBand().domain(tx.condiciones).range([0, x.bandwidth()]).paddingInner(0.16).paddingOuter(0.1);
    p.push(texto((izq + W) / 2, y0 + 5, tx.paneles[k], { tam: 7, peso: 700, color: C.oscuro, ancla: "middle" }));
    tx.marcas.forEach((m, i) => {
      const t = i * 1000, yy = y(t);
      p.push(linea(izq, yy, W - 2, yy, t === 0 ? C.gris : C.reticula, t === 0 ? 0.5 : 0.25));
      p.push(texto(izq - 3, yy + 2, m, { tam: 5.2, color: C.grisTexto, ancla: "end" }));
    });
    p.push(texto(5, (y(0) + y(10000)) / 2, tx.eje, { tam: 5.8, color: C.grisTexto, ancla: "middle", rot: -90 }));
    tx.grupos.forEach((gr) => {
      tx.condiciones.forEach((c) => {
        const v = g[gr][c][sexo];
        const bx = x(gr) + s(c);
        p.push(rect(bx, y(v), s.bandwidth(), y(0) - y(v), colores[c]));
        p.push(texto(bx + s.bandwidth() / 2, y(v) - 2, miles(v), { tam: 5.4, color: C.texto, ancla: "middle" }));
        p.push(texto(bx + s.bandwidth() / 2, y(0) + 6.5, partir(c, s.bandwidth() + 6, 4.8), {
          tam: 4.8, color: C.grisTexto, ancla: "middle", interlineado: 5.4 }));
      });
      const xa = x(gr) + s("Informal"), xb = x(gr) + s("Total población ocupada") + s.bandwidth();
      p.push(texto((xa + xb) / 2, y0 + 19, partir(gr, xb - xa, 6, 700), {
        tam: 6, peso: 700, color: C.texto, ancla: "middle", interlineado: 6.8 }));
    });
  });
  return documento(W, H, p.join("\n"), { titulo: "Gráfica 9. Promedio mensual de ingreso por trabajo, 2025 (miles de pesos)" });
}
