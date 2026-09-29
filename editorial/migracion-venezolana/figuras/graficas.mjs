// Gráficas 1-9 y diagrama 1 del capítulo 1, redibujadas en vector.
import { ANCHO, C, SERIE, texto, rect, linea, leyenda, medir, partir, numero, documento, guardar, ajustes, d3 } from "./lib.mjs";

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
  const etiquetas = { mc: "Registro administrativo (Migración Colombia)", onu: "ONU", geih: "GEIH", r4v: "R4V" };
  const x = d3.scaleBand().domain(g.anios).range([m.izq, W - m.der]).paddingInner(0.16).paddingOuter(0.06);
  const y = d3.scaleLinear().domain([0, 3]).range([H - m.inf, m.sup]);
  const slot = d3.scaleBand().domain(g.series.map((s) => s.clave)).range([0, x.bandwidth()]).paddingInner(0.14);
  const p = [];
  p.push(ejeY(y, m.izq, W - m.der, [0, 0.5, 1, 1.5, 2, 2.5, 3], (t) => t.toFixed(1)));
  p.push(texto(0, m.sup - 8, "Millones de personas", { tam: TAM_EJE, color: C.grisTexto, peso: 600 }));
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
function piramides(paneles, maximo, titulo) {
  const W = ANCHO;
  const sep = 14, colEdad = 17, margen = 3;
  const anchoPanel = (W - sep - 2 * margen) / 2;
  const mitad = (anchoPanel - colEdad) / 2;
  const sup = 30, filaAlto = 7.9, n = 18;
  const H = sup + n * filaAlto + 17;
  const p = [];
  const ley = leyenda(0, 7, [{ color: SERIE.hombres, etiqueta: "Hombres" }, { color: SERIE.mujeres, etiqueta: "Mujeres" }], { tam: 6.5 });
  p.push(ley.svg);
  paneles.forEach((panel, k) => {
    const x0 = margen + k * (anchoPanel + sep);
    const eje = x0 + mitad; // borde interior de los hombres
    const ejeM = eje + colEdad; // borde interior de las mujeres
    const xs = d3.scaleLinear().domain([0, maximo]).range([0, mitad - 1]);
    p.push(texto(x0 + anchoPanel / 2, sup - 9, panel.titulo, { tam: 7.4, peso: 700, color: C.oscuro, ancla: "middle" }));
    // retícula
    for (let t = 0; t <= maximo; t += 2) {
      p.push(linea(eje - xs(t), sup - 2, eje - xs(t), sup + n * filaAlto, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
      p.push(linea(ejeM + xs(t), sup - 2, ejeM + xs(t), sup + n * filaAlto, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
      p.push(texto(eje - xs(t), sup + n * filaAlto + 7.5, t, { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
      p.push(texto(ejeM + xs(t), sup + n * filaAlto + 7.5, t, { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
    }
    p.push(texto(x0 + anchoPanel / 2, sup + n * filaAlto + 15.2, "Porcentaje", { tam: 5.8, color: C.grisTexto, ancla: "middle" }));
    panel.datos.forEach((f, i) => {
      const yy = sup + (n - 1 - i) * filaAlto; // 0-4 abajo
      const alto = filaAlto - 1.5;
      p.push(rect(eje - xs(f.hombres), yy + 0.75, xs(f.hombres), alto, SERIE.hombres));
      p.push(rect(ejeM, yy + 0.75, xs(f.mujeres), alto, SERIE.mujeres));
      p.push(texto(eje + colEdad / 2, yy + filaAlto / 2 + 2, f.edad, { tam: 5.3, color: C.grisTexto, ancla: "middle" }));
    });
  });
  return documento(W, H, p.join("\n"), { titulo });
}

export function grafica2(D) {
  return piramides([
    { titulo: "2022", datos: D.grafica_2["2022"] },
    { titulo: "2025", datos: D.grafica_2["2025"] },
  ], 8, "Gráfica 2. Estructura por edad y sexo de la población venezolana en Colombia, 2022 y 2025");
}

export function grafica3(D) {
  return piramides([
    { titulo: "Otra población inmigrante", datos: D.grafica_3.otros },
    { titulo: "Población colombiana", datos: D.grafica_3.colombiana },
  ], 8, "Gráfica 3. Estructura por edad y sexo de otra población inmigrante y colombiana, 2025");
}

/* ---------------------------------------------------------------- Gráfica 4 */
export function grafica4(D) {
  const filas = [...D.grafica_4].reverse(); // posgrado arriba, como el original
  const nombres = { "Media Técnica": "Media técnica" };
  const W = ANCHO, sup = 30, filaAlto = 19, inf = 14;
  const H = sup + filas.length * filaAlto + inf;
  const colNom = 58, anchoTot = 64, sep = 16;
  const x0T = colNom, x0B = colNom + anchoTot + sep, anchoB = W - x0B - 10;
  const xT = d3.scaleLinear().domain([0, 50]).range([0, anchoTot - 14]);
  const xB = d3.scaleLinear().domain([0, 50]).range([0, anchoB]);
  const p = [];
  const ley = leyenda(x0B, 7, [{ tipo: "punto", color: SERIE.hombres, etiqueta: "Hombres" }, { tipo: "punto", color: SERIE.mujeres, etiqueta: "Mujeres" }]);
  p.push(ley.svg);
  p.push(texto(x0T, sup - 9, "Población total", { tam: 6.6, peso: 700, color: C.oscuro }));
  p.push(texto(x0B, sup - 9, "Diferencia por sexo", { tam: 6.6, peso: 700, color: C.oscuro }));
  const base = sup + filas.length * filaAlto;
  for (const t of [0, 25, 50]) {
    p.push(linea(x0T + xT(t), sup - 3, x0T + xT(t), base, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
    p.push(texto(x0T + xT(t), base + 8, t + "%", { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
  }
  for (const t of [0, 10, 20, 30, 40, 50]) {
    p.push(linea(x0B + xB(t), sup - 3, x0B + xB(t), base, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
    p.push(texto(x0B + xB(t), base + 8, t + "%", { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
  }
  filas.forEach((f, i) => {
    const cy = sup + i * filaAlto + filaAlto / 2;
    p.push(texto(colNom - 5, cy + 2.2, nombres[f.nivel] || f.nivel, { tam: TAM_ETIQ, color: C.texto, ancla: "end" }));
    p.push(rect(x0T, cy - 4.2, xT(f.total), 8.4, C.palido));
    p.push(texto(x0T + xT(f.total) + 2.5, cy + 2.1, numero(f.total, 1) + "%", { tam: 6, color: C.grisTexto }));
    const a = xB(Math.min(f.hombres, f.mujeres)), b = xB(Math.max(f.hombres, f.mujeres));
    p.push(linea(x0B + a, cy, x0B + b, cy, C.grisClaro, 1.4));
    p.push(`<circle cx="${(x0B + xB(f.hombres)).toFixed(2)}" cy="${cy.toFixed(2)}" r="2.6" fill="${SERIE.hombres}" stroke="#fff" stroke-width="0.6"/>`);
    p.push(`<circle cx="${(x0B + xB(f.mujeres)).toFixed(2)}" cy="${cy.toFixed(2)}" r="2.6" fill="${SERIE.mujeres}" stroke="#fff" stroke-width="0.6"/>`);
    // etiquetas: mujeres encima del punto, hombres debajo (evita choques con valores cercanos)
    p.push(texto(x0B + xB(f.mujeres), cy - 4.3, numero(f.mujeres, 2) + "%", { tam: 5.5, color: C.medio, peso: 600, ancla: "middle" }));
    p.push(texto(x0B + xB(f.hombres), cy + 8.9, numero(f.hombres, 2) + "%", { tam: 5.5, color: SERIE.hombres, peso: 600, ancla: "middle" }));
  });
  return documento(W, H, p.join("\n"), { titulo: "Gráfica 4. Nivel educativo de la población venezolana en Colombia según sexo, 2025" });
}

/* ---------------------------------------------------------------- Gráfica 5 */
export function grafica5(D) {
  const ind = D.grafica_5;
  const anios = [2022, 2023, 2024, 2025];
  const W = ANCHO, colNom = 60, sep = 10, sup = 22, fila = ajustes("grafica-5").fila ?? 17, huecoGrupo = 9;
  const anchoPanel = (W - colNom - sep) / 2;
  const x = d3.scaleBand().domain(anios).range([0, anchoPanel]).paddingInner(0.07);
  const yFila = (i) => sup + i * fila + (i >= 2 ? huecoGrupo : 0);
  const H = yFila(3) + fila + 18;
  const rampa = d3.interpolateRgbBasis([C.bruma, C.celeste, C.medio, C.oscuro]);
  const p = [];
  // Leyenda de intensidad (al pie): escala en pasos, 100% vectorial
  const defs = "";
  const ly = yFila(3) + fila + 8;
  p.push(texto(colNom, ly + 4.6, "Menor valor", { tam: 5.8, color: C.grisTexto }));
  const gx = colNom + medir("Menor valor", 5.8) + 4;
  const pasos = 10;
  for (let k = 0; k < pasos; k++) p.push(rect(gx + (70 / pasos) * k, ly, 70 / pasos + 0.05, 5.2, rampa(k / (pasos - 1))));
  p.push(texto(gx + 74, ly + 4.6, "Mayor valor", { tam: 5.8, color: C.grisTexto }));
  ["Mujeres", "Hombres"].forEach((sexo, k) => {
    const x0 = colNom + k * (anchoPanel + sep);
    p.push(texto(x0 + anchoPanel / 2, sup - 13, sexo, { tam: 7.4, peso: 700, color: C.oscuro, ancla: "middle" }));
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
  ind.forEach((it, i) => {
    const yy = yFila(i) + (fila - 1.6) / 2;
    p.push(texto(colNom - 5, yy - 0.6, it.id, { tam: 6.8, peso: 700, color: C.oscuro, ancla: "end" }));
    p.push(texto(colNom - 5, yy + 6.2, it.nombre, { tam: 5.6, color: C.grisTexto, ancla: "end" }));
  });
  return documento(W, H, p.join("\n"), { titulo: "Gráfica 5. Indicadores laborales de la población venezolana en Colombia según sexo, 2022-2025", defs });
}

/* ---------------------------------------------------------------- Gráfica 6 */
export function grafica6(D) {
  // Total ponderado 2025 del cuadro 5 (población venezolana)
  const total = {};
  const c5 = D.cuadro_5;
  const mapa = {
    "Obrero o empleado de empresa particular": "Obrero o empleado de empresa particular",
    "Trabajador por cuenta propia": "Trabajador por cuenta propia",
    "Empleado doméstico": "Empleado doméstico",
    "Trab. familiar sin remuneración": "Trabajador familiar sin remuneración",
    "Patrón o empleador": "Patrón o empleador",
    "Jornalero o peón": "Jornalero o peón",
    "Obrero o empleado del gobierno": "Obrero o empleado del gobierno",
    "Otro": "Otro",
  };
  for (let i = 2; i <= 9; i++) total[mapa[c5[i][0]]] = parseFloat(c5[i][4]);
  const filas = D.grafica_6.map((f) => ({ ...f, total: total[f.posicion] }));
  const W = ANCHO, sup = 17, grupo = 22.5, inf = 13, colNom = 88;
  const H = sup + filas.length * grupo + inf;
  const x = d3.scaleLinear().domain([0, 60]).range([colNom, W - 16]);
  const barra = 5.2;
  const p = [];
  p.push(leyenda(colNom, 7, [
    { color: SERIE.hombres, etiqueta: "Hombres" },
    { color: SERIE.mujeres, etiqueta: "Mujeres" },
    { color: SERIE.total, etiqueta: "Total" },
  ]).svg);
  const base = sup + filas.length * grupo;
  for (const t of [0, 10, 20, 30, 40, 50, 60]) {
    p.push(linea(x(t), sup - 2, x(t), base, t === 0 ? C.gris : C.reticula, t === 0 ? 0.45 : 0.3));
    p.push(texto(x(t), base + 8, t, { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
  }
  filas.forEach((f, i) => {
    const y0 = sup + i * grupo + 2.5;
    const nom = partir(f.posicion, colNom - 8, TAM_ETIQ);
    p.push(texto(colNom - 5, y0 + 9.2 - (nom.length - 1) * 3.8, nom, { tam: TAM_ETIQ, color: C.texto, ancla: "end", interlineado: 7.6 }));
    [["hombres", SERIE.hombres], ["mujeres", SERIE.mujeres], ["total", SERIE.total]].forEach(([k, col], j) => {
      const yy = y0 + j * (barra + 0.6);
      p.push(rect(x(0), yy, x(f[k]) - x(0), barra, col));
      p.push(texto(x(f[k]) + 2, yy + barra - 0.9, numero(f[k], 1), { tam: 5.6, color: C.grisTexto }));
    });
  });
  return documento(W, H, p.join("\n"), { titulo: "Gráfica 6. Población venezolana ocupada según posición en el trabajo por sexo, 2025" });
}

/* ---------------------------------------------------------------- Gráfica 7 */
export function grafica7(D) {
  const filas = D.grafica_7_8;
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
export function grafica8(D) {
  const filas = D.grafica_7_8;
  const W = ANCHO, sup = 14, fila = ajustes("grafica-8").fila ?? 12.6, inf = 13, colNom = 118;
  const H = sup + filas.length * fila + inf;
  const ancho = W - colNom - 2;
  const k = (ancho - 26) / 61; // pt por punto porcentual (-25 a 36)
  const centro = colNom + 13 + 25 * k;
  const p = [];
  const base = sup + filas.length * fila;
  for (const t of [-20, -10, 0, 10, 20, 30]) {
    const xx = centro + t * k;
    p.push(linea(xx, sup - 2, xx, base, t === 0 ? C.gris : C.reticula, t === 0 ? 0.5 : 0.3));
    p.push(texto(xx, base + 8, Math.abs(t), { tam: TAM_EJE, color: C.grisTexto, ancla: "middle" }));
  }
  p.push(texto(centro - 3, sup - 6, "Hombres", { tam: 6.4, peso: 700, color: SERIE.hombres, ancla: "end" }));
  p.push(texto(centro + 3, sup - 6, "Mujeres", { tam: 6.4, peso: 700, color: C.medio }));
  filas.forEach((f, i) => {
    const cy = sup + i * fila + fila / 2;
    p.push(texto(colNom - 5, cy + 2.2, f.rama, { tam: TAM_ETIQ, color: C.texto, ancla: "end" }));
    const gb = Math.min(9, fila * 0.58);
    p.push(rect(centro - f.hombres * k, cy - gb / 2, f.hombres * k, gb, SERIE.hombres));
    p.push(rect(centro, cy - gb / 2, f.mujeres * k, gb, SERIE.mujeres));
    p.push(texto(centro - f.hombres * k - 2.2, cy + 2.1, numero(f.hombres, 1), { tam: 5.6, color: C.grisTexto, ancla: "end" }));
    p.push(texto(centro + f.mujeres * k + 2.2, cy + 2.1, numero(f.mujeres, 1), { tam: 5.6, color: C.grisTexto }));
  });
  return documento(W, H, p.join("\n"), { titulo: "Gráfica 8. Población venezolana ocupada según rama de actividad económica y sexo, 2025" });
}

/* ---------------------------------------------------------------- Gráfica 9 */
export function grafica9(D) {
  const g = D.grafica_9;
  const grupos = ["Venezolana", "Colombiana", "Otra población migrante"];
  const conds = [["Formal", C.azul], ["Informal", C.claro], ["Total población ocupada", C.gris]];
  const W = ANCHO, izq = 26, panelAlto = ajustes("grafica-9").panel ?? 92, sup = 16, sepPanel = 16;
  const H = sup + 2 * panelAlto + sepPanel + 4;
  const p = [];
  p.push(leyenda(izq, 7, conds.map(([n, c]) => ({ color: c, etiqueta: n === "Total población ocupada" ? "Total de la población ocupada" : n }))).svg);
  ["hombres", "mujeres"].forEach((sexo, k) => {
    const y0 = sup + k * (panelAlto + sepPanel);
    const y = d3.scaleLinear().domain([0, 10000]).range([y0 + panelAlto - 13, y0 + 11]);
    const x = d3.scaleBand().domain(grupos).range([izq, W - 2]).paddingInner(0.14).paddingOuter(0.04);
    const s = d3.scaleBand().domain(conds.map((c) => c[0])).range([0, x.bandwidth()]).paddingInner(0.12).paddingOuter(0.12);
    p.push(texto(izq, y0 + 5, sexo === "hombres" ? "Hombres" : "Mujeres", { tam: 7.2, peso: 700, color: C.oscuro }));
    p.push(ejeY(y, izq, W - 2, [0, 2000, 4000, 6000, 8000, 10000], (t) => numero(t, 0)));
    grupos.forEach((gr) => {
      conds.forEach(([c, col]) => {
        const v = g[gr][c][sexo];
        const bx = x(gr) + s(c);
        p.push(rect(bx, y(v), s.bandwidth(), y(0) - y(v), col));
        p.push(texto(bx + s.bandwidth() / 2, y(v) - 2, numero(v, 0), { tam: 5.9, color: C.texto, ancla: "middle" }));
      });
      p.push(texto(x(gr) + x.bandwidth() / 2, y(0) + 8.4, gr === "Otra población migrante" ? "Otra población migrante" : gr, {
        tam: TAM_ETIQ, color: C.texto, ancla: "middle", peso: 600,
      }));
    });
  });
  p.push(texto(izq - 3, sup + 6, "Miles", { tam: TAM_EJE, color: C.grisTexto, ancla: "end", peso: 600 }));
  return documento(W, H, p.join("\n"), { titulo: "Gráfica 9. Promedio mensual de ingreso por trabajo, 2025 (miles de pesos)" });
}
