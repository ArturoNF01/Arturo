// Mapas 1 y 2 del capítulo 1 (vector). Geografía: Natural Earth (dominio público)
// vía world-atlas (países) y datos/geo/colombia-departamentos.topo.json.
import fs from "node:fs";
import path from "node:path";
import * as topojson from "topojson-client";
// Rótulos, leyendas y cifras: los del manuscrito (datos/figuras-original.json), sin cambios.
import { RAIZ, ANCHO, C, texto, rect, linea, medir, partir, documento, original, d3 } from "./lib.mjs";

const O = original();

const leerJSON = (ruta) => JSON.parse(fs.readFileSync(path.join(RAIZ, ruta), "utf8"));
const r2 = (v) => Math.round(v * 100) / 100;

function paises(resolucion) {
  const w = leerJSON(`node_modules/world-atlas/countries-${resolucion}.json`);
  return topojson.feature(w, w.objects.countries).features;
}

const TRAMA = `<pattern id="trama" patternUnits="userSpaceOnUse" width="2.6" height="2.6" patternTransform="rotate(45)">
<rect width="2.6" height="2.6" fill="#f4f5f6"/><line x1="0" y1="0" x2="0" y2="2.6" stroke="${C.grisClaro}" stroke-width="0.55"/></pattern>`;

/* ----------------------------------------------------------------- Mapa 1 */
const NOMBRE_ATLAS = { "Dominican Republic": "Dominican Rep." };

// Punto de anclaje (lon, lat), posición de la etiqueta (lon, lat) y alineación
const ETIQUETAS_M1 = {
  "Colombia": { p: [-73.6, 5.2], e: [-76.5, 14.6], a: "middle" },
  "Peru": { p: [-75.2, -9.8], e: [-88.5, -11.2], a: "end" },
  "United States of America": { p: [-98.5, 39.2], e: [-98.5, 41.2], a: "middle", dentro: true },
  "Spain": { p: [-3.7, 40.3], e: [-14.5, 46.2], a: "end" },
  "Brazil": { p: [-49, -10.5], e: [-49, -8.6], a: "middle", dentro: true },
  "Ecuador": { p: [-78.3, -1.4], e: [-88.5, -2.2], a: "end" },
  "Chile": { p: [-70.8, -32.5], e: [-88.5, -33.2], a: "end" },
  "Argentina": { p: [-64.5, -36], e: [-47.5, -41.5], a: "start" },
  "Panama": { p: [-80.2, 8.5], e: [-88.5, 7.4], a: "end" },
  "Dominican Republic": { p: [-70.4, 18.9], e: [-62.5, 24.5], a: "start" },
  "Mexico": { p: [-102.5, 23.8], e: [-113.5, 18.2], a: "end" },
};

export function mapa1(D) {
  const valores = new Map(D.mapa_1.map((d) => [d.pais, d.valor / 1e6]));
  const W = ANCHO;
  const borde = [];
  for (let lon = -132; lon <= 6; lon += 1) borde.push([lon, 50], [lon, -56]);
  for (let lat = -56; lat <= 50; lat += 1) borde.push([-132, lat], [6, lat]);
  const zona = { type: "MultiPoint", coordinates: borde };
  const proy = d3.geoEqualEarth().rotate([62, 0]).fitWidth(W, zona);
  const camino = d3.geoPath(proy);
  const [[, y0], [, y1]] = camino.bounds(zona);
  proy.translate([proy.translate()[0], proy.translate()[1] - y0]);
  const H = Math.ceil(y1 - y0);
  proy.clipExtent([[0, 0], [W, H]]);

  // Seis clases con los cortes de la leyenda del manuscrito (0.1M … 2.9M)
  const tx = O.mapa_1;
  const tonos = ["#c8d4e7", "#9db4d5", "#6f95c3", "#3f78b0", "#1e5f96", "#00427a"];
  const colorDe = (v) => tonos[Math.max(0, Math.min(tonos.length - 1, d3.bisectRight(tx.cortes, v) - 1))];

  const p = [];
  const feats = paises("50m");
  for (const f of feats) {
    const nombre = f.properties.name;
    const clave = Object.keys(NOMBRE_ATLAS).find((k) => NOMBRE_ATLAS[k] === nombre) || nombre;
    const v = valores.get(clave);
    const relleno = v != null ? colorDe(v) : nombre === "Venezuela" ? C.grisMedio : C.tierra;
    const d = camino(f);
    if (d) p.push(`<path d="${d}" fill="${relleno}" stroke="#fff" stroke-width="0.3" stroke-linejoin="round"/>`);
  }
  // Etiquetas con líneas guía
  const capas = { lineas: [], puntos: [], textos: [] };
  for (const [pais, et] of Object.entries(ETIQUETAS_M1)) {
    const v = valores.get(pais);
    const [px, py] = proy(et.p);
    const [ex, ey] = proy(et.e);
    const [nombre, valor] = tx.rotulos[pais];
    if (et.dentro) {
      const claro = tonos.indexOf(colorDe(v)) < 3; // texto oscuro sobre los azules claros
      capas.textos.push(texto(ex, ey, nombre, { tam: 6.2, peso: 600, color: claro ? C.noche : "#fff", ancla: "middle" }));
      capas.textos.push(texto(ex, ey + 7.4, valor, { tam: 6.4, peso: 700, color: claro ? C.noche : "#fff", ancla: "middle" }));
      continue;
    }
    const dxTexto = et.a === "end" ? -2 : et.a === "start" ? 2 : 0;
    // la línea termina en el borde del texto
    const finY = et.a === "middle" ? ey + 9 : ey - 2.4;
    capas.lineas.push(linea(px, py, ex, finY, C.gris, 0.35));
    capas.puntos.push(`<circle cx="${r2(px)}" cy="${r2(py)}" r="1.25" fill="${C.noche}" stroke="#fff" stroke-width="0.45"/>`);
    capas.textos.push(texto(ex + dxTexto, ey - 1.2, nombre, { tam: 6.2, peso: 600, color: C.texto, ancla: et.a, halo: "#fff" }));
    capas.textos.push(texto(ex + dxTexto, ey + 6.4, valor, { tam: 6.4, peso: 700, color: C.azul, ancla: et.a, halo: "#fff" }));
  }
  p.push(...capas.lineas, ...capas.puntos, ...capas.textos);

  // Leyenda del manuscrito: «Población migrante», escala de 0.1M a 2.9M
  const lx = 6, ly = H - 30, paso = 19;
  p.push(texto(lx, ly, tx.leyenda, { tam: 6.2, peso: 700, color: C.oscuro }));
  tonos.forEach((c, i) => p.push(rect(lx + i * paso, ly + 4, paso, 6, c)));
  tx.marcas.forEach((m, i) => p.push(texto(lx + i * paso, ly + 17, m, { tam: 5.2, color: C.grisTexto, ancla: i === 0 ? "start" : i === tx.marcas.length - 1 ? "end" : "middle" })));

  return documento(W, H, p.join("\n"), {
    titulo: "Mapa 1. Población migrante venezolana según país de destino, 2024 (millones de personas)",
  });
}

/* ----------------------------------------------------------------- Mapa 2 */
const normal = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
// Lado de la columna de rótulos para cada departamento
const LADO_M2 = {
  "ATLANTICO": "izq", "BOLIVAR": "izq", "MAGDALENA": "izq", "ANTIOQUIA": "izq", "RISARALDA": "izq",
  "VALLE DEL CAUCA": "izq", "NARINO": "izq",
  "LA GUAJIRA": "der", "CESAR": "der", "NORTE DE SANTANDER": "der", "SANTANDER": "der", "ARAUCA": "der",
  "BOYACA": "der", "CUNDINAMARCA": "der", "BOGOTA": "der", "META": "der",
};
// Puntos de anclaje manuales donde el centroide cae mal (formas cóncavas)
const ANCLA_M2 = {
  "BOLIVAR": [-74.6, 9.0], "MAGDALENA": [-74.3, 10.2], "CUNDINAMARCA": [-74.3, 5.05],
  "BOGOTA": [-74.12, 4.55], "SANTANDER": [-73.4, 6.8], "BOYACA": [-72.9, 5.75],
};

export function mapa2(D) {

  const topo = leerJSON("datos/geo/colombia-departamentos.topo.json");
  const deptos = topojson.feature(topo, topo.objects.departamentos).features;
  for (const f of deptos) f.properties.clave = normal(f.properties.clave || f.properties.nombre);
  const continente = { type: "FeatureCollection", features: deptos.filter((f) => !f.properties.clave.includes("SAN ANDRES")) };

  const W = ANCHO, H = 300, colIzq = 60, colDer = 70;
  const proy = d3.geoTransverseMercator().rotate([73.5, -4.5]).fitExtent([[colIzq + 4, 6], [W - colDer - 4, H - 8]], continente);
  const camino = d3.geoPath(proy);
  proy.clipExtent([[0, 0], [W, H]]);

  const tx = O.mapa_2;
  // Escala continua del manuscrito: 0% a +18% de la población total (TP)
  const rampa = d3.interpolateRgbBasis(["#e6ecf5", "#9db4d5", "#3f78b0", "#00427a"]);
  const colorDe = (v) => rampa(Math.min(1, v / 18));
  const conDatos = {};
  for (const [k, v] of Object.entries(tx.departamentos)) conDatos[normal(k)] = v;

  const p = [];
  // Países vecinos
  // Solo países cercanos: evita polígonos que cruzan el antimeridiano y cubren todo el marco
  const vecinos = paises("10m").filter((f) => {
    if (f.properties.name === "Colombia" || d3.geoArea(f) > 1) return false; // descarta anillos invertidos
    const [[x0, y0], [x1, y1]] = d3.geoBounds(f);
    return x1 > -90 && x0 < -58 && y1 > -12 && y0 < 20 && x0 < x1;
  });
  for (const f of vecinos) {
    const d = camino(f);
    if (d) p.push(`<path d="${d}" fill="${C.tierra}" stroke="#fff" stroke-width="0.45" stroke-linejoin="round"/>`);
  }
  const posPais = { "PANAMÁ": [-79.4, 8.3], "VENEZUELA": [-67.6, 6.2], "BRASIL": [-67.2, -0.6], "ECUADOR": [-78.6, -1.4], "PERÚ": [-74.0, -3.6] };
  for (const nom of tx.paises) {
    const [x, y] = proy(posPais[nom]);
    p.push(texto(x, y, nom, { tam: 5.6, peso: 700, color: C.grisMedio, ancla: "middle", espaciado: 0.8 }));
  }

  // Departamentos
  for (const f of continente.features) {
    const k = f.properties.clave;
    const d = conDatos[k];
    const relleno = d ? colorDe(parseFloat(d[1].replace("TP:", ""))) : "url(#trama)";
    p.push(`<path d="${camino(f)}" fill="${relleno}" stroke="#fff" stroke-width="0.4" stroke-linejoin="round"/>`);
  }
  // Contorno nacional
  const pais = topojson.merge(topo, topo.objects.departamentos.geometries.filter((g) => !normal(g.properties.clave || g.properties.nombre).includes("SAN ANDRES")));
  p.push(`<path d="${camino(pais)}" fill="none" stroke="${C.titulo}" stroke-width="0.55" stroke-linejoin="round"/>`);

  // Rótulos en columnas con líneas guía
  const lineas = [], puntos = [], textos = [];
  const altoRotulo = 19.5;
  for (const lado of ["izq", "der"]) {
    const items = Object.keys(LADO_M2).filter((k) => LADO_M2[k] === lado).map((k) => {
      const f = continente.features.find((ff) => ff.properties.clave === k);
      const [ax, ay] = ANCLA_M2[k] ? proy(ANCLA_M2[k]) : camino.centroid(f);
      return { k, ax, ay };
    }).sort((a, b) => a.ay - b.ay);
    // distribuir sin solaparse
    let yPrev = -Infinity;
    for (const it of items) {
      it.ey = Math.max(it.ay, yPrev + altoRotulo);
      yPrev = it.ey;
    }
    const exceso = yPrev - (H - 70);
    if (lado === "der" && exceso > 0) for (const it of items) it.ey -= exceso;
    for (const it of items) {
      const xTexto = lado === "izq" ? 2 : W - 2;
      const ancla = lado === "izq" ? "start" : "end";
      const [nombre, lTP, lSD] = conDatos[it.k];
      const ancho = Math.max(medir(nombre, 5.6, 700), medir(lTP, 5.4), medir(lSD, 5.4));
      const xBorde = lado === "izq" ? xTexto + ancho + 2 : xTexto - ancho - 2;
      const yGuia = it.ey - 2;
      const codo = lado === "izq" ? Math.max(xBorde + 3, Math.min(it.ax - 6, xBorde + 10)) : Math.min(xBorde - 3, Math.max(it.ax + 6, xBorde - 10));
      lineas.push(`<polyline points="${r2(xBorde)},${r2(yGuia)} ${r2(codo)},${r2(yGuia)} ${r2(it.ax)},${r2(it.ay)}" fill="none" stroke="${C.texto}" stroke-width="0.3"/>`);
      puntos.push(`<circle cx="${r2(it.ax)}" cy="${r2(it.ay)}" r="1.05" fill="${C.noche}" stroke="#fff" stroke-width="0.4"/>`);
      textos.push(texto(xTexto, it.ey - 3.4, nombre, { tam: 5.6, peso: 700, color: C.oscuro, ancla, espaciado: 0.15, halo: "#fff" }));
      textos.push(texto(xTexto, it.ey + 3.2, lTP, { tam: 5.4, color: C.texto, ancla, halo: "#fff" }));
      textos.push(texto(xTexto, it.ey + 9.4, lSD, { tam: 5.4, color: C.texto, ancla, halo: "#fff" }));
    }
  }
  p.push(...lineas, ...puntos, ...textos);

  // Leyenda del manuscrito (esquina inferior derecha)
  const lx = W - 70, ly = H - 62;
  p.push(texto(lx, ly, tx.leyenda, { tam: 6, peso: 700, color: C.oscuro, espaciado: 0.3 }));
  for (let i = 0; i < 12; i++) p.push(rect(lx + i * 5.6, ly + 4, 5.65, 5.4, rampa(i / 11)));
  p.push(texto(lx, ly + 16, tx.min, { tam: 5.4, color: C.grisTexto }));
  p.push(texto(lx + 67.2, ly + 16, tx.max, { tam: 5.4, color: C.grisTexto, ancla: "end" }));
  tx.claves.forEach(([sigla, desc], i) => {
    const yy = ly + 26 + i * 7.6;
    p.push(texto(lx, yy, sigla, { tam: 5.5, peso: 700, color: C.texto }));
    p.push(texto(lx + medir(sigla, 5.5, 700) + 2, yy, desc, { tam: 5.5, color: C.texto }));
  });
  const yt = ly + 26 + tx.claves.length * 7.6 - 1;
  p.push(rect(lx, yt, 8.4, 5.6, "url(#trama)", `stroke="${C.grisClaro}" stroke-width="0.3"`));
  p.push(texto(lx + 11.5, yt + 4.8, tx.otros, { tam: 5.5, color: C.texto }));

  return documento(W, H, p.join("\n"), {
    titulo: "Mapa 2. Población venezolana en Colombia, total y sin documentos migratorios, según departamento, 2025",
    defs: TRAMA,
  });
}
