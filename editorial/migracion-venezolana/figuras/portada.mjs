// Capa vectorial de la portada: mapa en línea blanca sobre la fotografía, con las
// rutas desde Venezuela hacia las principales ciudades de Colombia. Fondo
// transparente: la foto (virada en azules) va debajo, en el HTML.
import fs from "node:fs";
import path from "node:path";
import * as topojson from "topojson-client";
import { RAIZ, C, texto, documento, d3 } from "./lib.mjs";

const leer = (r) => JSON.parse(fs.readFileSync(path.join(RAIZ, r), "utf8"));
const r2 = (v) => Math.round(v * 100) / 100;

// Mismas medidas que .portada-foto en plantilla/libro.css
export const ANCHO_FOTO = 368.5;
export const ALTO_FOTO = 352;

// Ciudades de destino y peso (% de la población venezolana del departamento, mapa 2)
const CIUDADES = [
  { nombre: "Bogotá", lonlat: [-74.08, 4.61], peso: 18.4, rotulo: [10, 13] },
  { nombre: "Medellín", lonlat: [-75.57, 6.24], peso: 15.6, rotulo: [-8, -6] },
  { nombre: "Cali", lonlat: [-76.53, 3.45], peso: 9.2, rotulo: [5, 11] },
  { nombre: "Cúcuta", lonlat: [-72.5, 7.89], peso: 8.8, rotulo: [8, -5] },
  { nombre: "Barranquilla", lonlat: [-74.8, 10.96], peso: 7.4, rotulo: [-7, -6] },
  { nombre: "Bucaramanga", lonlat: [-73.12, 7.12], peso: 5.1, rotulo: [-7, -5] },
];
const ORIGEN = [-66.9, 10.49]; // Caracas

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
  const contorno = topojson.merge(topo, topo.objects.departamentos.geometries.filter(sinIslas));
  const w = leer("node_modules/world-atlas/countries-10m.json");
  const paises = topojson.feature(w, w.objects.countries).features.filter((f) => {
    if (d3.geoArea(f) > 1) return false;
    const [[x0, y0], [x1, y1]] = d3.geoBounds(f);
    return x1 > -92 && x0 < -52 && y1 > -12 && y0 < 22 && x0 < x1;
  });
  const venezuela = paises.find((f) => f.properties.name === "Venezuela");
  const proy = d3.geoTransverseMercator().rotate([71.3, -6.2])
    .fitExtent([[58, 26], [252, H - 22]], { type: "FeatureCollection", features: deptos });
  proy.clipExtent([[0, 0], [W, H]]);
  const camino = d3.geoPath(proy);
  const B = "#ffffff";
  const p = [];

  // Países vecinos y Venezuela
  for (const f of paises) {
    if (f.properties.name === "Colombia" || f === venezuela) continue;
    const d = camino(f);
    if (d) p.push(`<path d="${d}" fill="none" stroke="${B}" stroke-opacity="0.28" stroke-width="0.4" stroke-linejoin="round"/>`);
  }
  p.push(`<path d="${camino(venezuela)}" fill="${B}" fill-opacity="0.07" stroke="${B}" stroke-opacity="0.6" stroke-width="0.6" stroke-linejoin="round"/>`);
  // Colombia: departamentos y contorno nacional
  for (const f of deptos) {
    p.push(`<path d="${camino(f)}" fill="none" stroke="${B}" stroke-opacity="0.2" stroke-width="0.3" stroke-linejoin="round"/>`);
  }
  p.push(`<path d="${camino(contorno)}" fill="${B}" fill-opacity="0.06" stroke="${B}" stroke-width="0.85" stroke-linejoin="round"/>`);

  // Rutas: arcos punteados desde Caracas; el grosor sigue el peso de cada ciudad
  const [ox, oy] = proy(ORIGEN);
  for (const c of [...CIUDADES].sort((a, b) => a.peso - b.peso)) {
    const [cx, cy] = proy(c.lonlat);
    const dx = cx - ox, dy = cy - oy, largo = Math.hypot(dx, dy);
    const qx = (ox + cx) / 2 + (dy / largo) * 0.26 * largo;
    const qy = (oy + cy) / 2 - (dx / largo) * 0.26 * largo;
    const grosor = 0.9 + c.peso * 0.1;
    // el arco se detiene antes del anillo de la ciudad y del origen
    const [a0, a1, a2] = recortarArco([ox, oy], [qx, qy], [cx, cy], 4.5, (1.6 + c.peso * 0.12) * 2 + 2);
    p.push(`<path d="M${r2(a0[0])},${r2(a0[1])} Q${r2(a1[0])},${r2(a1[1])} ${r2(a2[0])},${r2(a2[1])}" fill="none" stroke="${B}" stroke-width="${r2(grosor)}" stroke-linecap="round" stroke-dasharray="0 ${r2(grosor * 2.2 + 1)}"/>`);
  }
  // Ciudades: punto con anillo; Caracas como origen
  for (const c of CIUDADES) {
    const [cx, cy] = proy(c.lonlat);
    const rr = 1.6 + c.peso * 0.12;
    p.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rr * 2)}" fill="none" stroke="${B}" stroke-width="0.6"/>`);
    p.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rr)}" fill="${B}"/>`);
    const [tx, ty] = c.rotulo;
    p.push(texto(cx + tx, cy + ty, c.nombre.toUpperCase(), {
      tam: 6, peso: 600, color: B, ancla: tx < 0 ? "end" : "start", espaciado: 0.7,
    }));
  }
  p.push(`<circle cx="${r2(ox)}" cy="${r2(oy)}" r="2.4" fill="none" stroke="${B}" stroke-width="1"/>`);
  p.push(texto(ox + 5, oy - 4, "CARACAS", { tam: 6, peso: 600, color: B, espaciado: 0.7 }));
  // Nombres de país: posición y cuerpo acordados con diseño (revisión de portada)
  p.push(texto(219.9, 121, "VENEZUELA", { tam: 15, peso: 700, color: B, espaciado: 3.2 }));
  p.push(texto(106.3, 229.5, "COLOMBIA", { tam: 15, peso: 700, color: B, espaciado: 3.2 }));

  return documento(W, H, p.join("\n"), { titulo: "Mapa de la portada" });
}
