// Capa vectorial de la portada: contornos de Venezuela y Colombia en línea blanca
// sobre la fotografía y una sola ruta de cruce (Caracas → Bogotá). Fondo
// transparente: la foto va debajo, en el HTML.
import fs from "node:fs";
import path from "node:path";
import * as topojson from "topojson-client";
import { RAIZ, texto, documento, d3 } from "./lib.mjs";

const leer = (r) => JSON.parse(fs.readFileSync(path.join(RAIZ, r), "utf8"));
const r2 = (v) => Math.round(v * 100) / 100;

// Mismas medidas que .portada-foto en plantilla/libro.css
export const ANCHO_FOTO = 368.5;
export const ALTO_FOTO = 352;

// Ruta de cruce: de Caracas a Bogotá, principal destino (mapa 2)
const ORIGEN = [-66.9, 10.49];
const DESTINO = [-74.08, 4.61];

/** Recorta una curva cuadrática para que empiece y acabe a cierta distancia de sus extremos. */
function recortarArco(p0, q, p2, desdeInicio, antesDelFin) {
  const punto = (t, a, b, c) => [0, 1].map((i) => (1 - t) ** 2 * a[i] + 2 * (1 - t) * t * b[i] + t * t * c[i]);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  let t1 = 1;
  while (t1 > 0.5 && Math.hypot(...[0, 1].map((i) => punto(t1, p0, q, p2)[i] - p2[i])) < antesDelFin) t1 -= 0.002;
  // parte [0, t1] (De Casteljau)
  const qa = lerp(p0, q, t1), fin = punto(t1, p0, q, p2);
  let t0 = 0;
  while (t0 < 0.5 && Math.hypot(...[0, 1].map((i) => punto(t0, p0, qa, fin)[i] - p0[i])) < desdeInicio) t0 += 0.002;
  // parte [t0, 1] de la curva ya recortada
  const ini = punto(t0, p0, qa, fin), qb = lerp(qa, fin, t0);
  return [ini, qb, fin];
}

export function portada() {
  const W = ANCHO_FOTO, H = ALTO_FOTO;
  const topo = leer("datos/geo/colombia-departamentos.topo.json");
  const sinIslas = (g) => !String(g.properties.clave).includes("San Andr");
  const deptos = topojson.feature(topo, topo.objects.departamentos).features.filter(sinIslas);
  const colombia = topojson.merge(topo, topo.objects.departamentos.geometries.filter(sinIslas));
  const w = leer("node_modules/world-atlas/countries-10m.json");
  const venezuela = topojson.feature(w, w.objects.countries).features.find((f) => f.properties.name === "Venezuela");
  const proy = d3.geoTransverseMercator().rotate([71.3, -6.2])
    .fitExtent([[58, 26], [252, H - 22]], { type: "FeatureCollection", features: deptos });
  proy.clipExtent([[0, 0], [W, H]]);
  const camino = d3.geoPath(proy);
  const B = "#ffffff";
  const p = [];

  // Los dos países, con el mismo trazo
  for (const pais of [venezuela, colombia]) {
    p.push(`<path d="${camino(pais)}" fill="${B}" fill-opacity="0.06" stroke="${B}" stroke-width="1" stroke-linejoin="round"/>`);
  }

  // Ruta de cruce: arco punteado que se detiene antes de los extremos
  const [ox, oy] = proy(ORIGEN), [cx, cy] = proy(DESTINO);
  const dx = cx - ox, dy = cy - oy, largo = Math.hypot(dx, dy);
  const qx = (ox + cx) / 2 - (dy / largo) * 0.22 * largo;
  const qy = (oy + cy) / 2 + (dx / largo) * 0.22 * largo;
  const [a0, a1, a2] = recortarArco([ox, oy], [qx, qy], [cx, cy], 6, 7);
  p.push(`<path d="M${r2(a0[0])},${r2(a0[1])} Q${r2(a1[0])},${r2(a1[1])} ${r2(a2[0])},${r2(a2[1])}" fill="none" stroke="${B}" stroke-width="2.9" stroke-linecap="round" stroke-dasharray="0 7"/>`);
  p.push(`<circle cx="${r2(ox)}" cy="${r2(oy)}" r="3" fill="none" stroke="${B}" stroke-width="1.2"/>`);
  p.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="3.6" fill="${B}"/>`);
  p.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="7" fill="none" stroke="${B}" stroke-width="0.8"/>`);

  // Nombres de país: posición y cuerpo acordados con diseño (revisión de portada)
  p.push(texto(219.9, 121, "VENEZUELA", { tam: 15, peso: 700, color: B, espaciado: 3.2 }));
  p.push(texto(106.3, 229.5, "COLOMBIA", { tam: 15, peso: 700, color: B, espaciado: 3.2 }));

  return documento(W, H, p.join("\n"), { titulo: "Mapa de la portada" });
}
