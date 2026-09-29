// Ilustración vectorial de la portada: rutas migratorias de Venezuela hacia las
// principales ciudades de Colombia y una familia que migra con una persona mayor
// (migración, vejez y protección social). Paleta del libro de referencia.
import fs from "node:fs";
import path from "node:path";
import * as topojson from "topojson-client";
import { RAIZ, C, texto, documento, d3 } from "./lib.mjs";

const leer = (r) => JSON.parse(fs.readFileSync(path.join(RAIZ, r), "utf8"));
const r2 = (v) => Math.round(v * 100) / 100;

// Ciudades de destino y peso (% de la población venezolana del departamento, mapa 2)
const CIUDADES = [
  { nombre: "Bogotá", lonlat: [-74.08, 4.61], peso: 18.4 },
  { nombre: "Medellín", lonlat: [-75.57, 6.24], peso: 15.6 },
  { nombre: "Cali", lonlat: [-76.53, 3.45], peso: 9.2 },
  { nombre: "Cúcuta", lonlat: [-72.5, 7.89], peso: 8.8 },
  { nombre: "Barranquilla", lonlat: [-74.8, 10.96], peso: 7.4 },
  { nombre: "Bucaramanga", lonlat: [-73.12, 7.12], peso: 5.1 },
];
const ORIGEN = [-66.9, 10.49]; // Caracas

/** Pictogramas (trazo redondeado, estilo señalética). Miran a la izquierda: van hacia Colombia. */
function persona(x, y, esc, tipo, color) {
  const g = [];
  const L = (pts, w) => `<polyline points="${pts.map((p) => p.map((v) => r2(v)).join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const P = (d, w) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (tipo === "mayor") {
    // persona mayor, ligeramente encorvada, con bastón
    g.push(`<circle cx="-3" cy="6.2" r="5.4" fill="${color}"/>`);
    g.push(P("M-1,14.5 C1.5,20 3,26 3.2,33", 6));
    g.push(L([[3.2, 33], [-2.5, 43], [-4.5, 53]], 5.6));
    g.push(L([[3.2, 33], [7.5, 43], [9.5, 53]], 5.6));
    g.push(L([[-0.5, 17], [-7, 25], [-10.5, 30]], 4.2));
    g.push(P("M-10.5,30 L-12.5,53", 2.2));
    g.push(P("M-10.5,30 C-10.5,26.5 -6.8,26.2 -7,29.4", 2.2));
    g.push(L([[0.5, 17.5], [5.5, 26]], 4.2));
  } else if (tipo === "adulta") {
    // persona adulta que arrastra una maleta
    g.push(`<circle cx="0" cy="5.6" r="5.6" fill="${color}"/>`);
    g.push(L([[0, 14], [0.8, 33]], 6.2));
    g.push(L([[0.8, 33], [-6.5, 43], [-9, 53]], 5.8));
    g.push(L([[0.8, 33], [6, 43], [8, 53]], 5.8));
    g.push(L([[-0.5, 17], [-6, 25.5], [-9.5, 30.5]], 4.4));
    g.push(L([[1, 17], [7, 24], [12, 27]], 4.4));
    g.push(P("M12,27 L16.5,36.5", 1.8));
    g.push(`<rect x="13.2" y="35.5" width="11.5" height="15.2" rx="2.2" fill="${color}"/>`);
    g.push(`<circle cx="15.6" cy="52.2" r="1.5" fill="${color}"/><circle cx="22.3" cy="52.2" r="1.5" fill="${color}"/>`);
  } else {
    // niña o niño
    g.push(`<circle cx="0" cy="4.4" r="4.4" fill="${color}"/>`);
    g.push(L([[0, 11], [0.4, 24]], 5));
    g.push(L([[0.4, 24], [-4.5, 31], [-6, 37]], 4.6));
    g.push(L([[0.4, 24], [4.2, 31], [5.6, 37]], 4.6));
    g.push(L([[-0.3, 13.5], [-4.5, 19.5], [-7, 23]], 3.6));
    g.push(L([[0.5, 13.5], [5.5, 17.5], [9.5, 18.5]], 3.6));
  }
  return `<g transform="translate(${r2(x)} ${r2(y)}) scale(${esc})">${g.join("")}</g>`;
}

export function portada() {
  const W = 368.5, H = 318;
  const topo = leer("datos/geo/colombia-departamentos.topo.json");
  const deptos = topojson.feature(topo, topo.objects.departamentos).features
    .filter((f) => !String(f.properties.clave).includes("San Andr"));
  const w = leer("node_modules/world-atlas/countries-10m.json");
  const paises = topojson.feature(w, w.objects.countries).features.filter((f) => {
    if (d3.geoArea(f) > 1) return false;
    const [[x0, y0], [x1, y1]] = d3.geoBounds(f);
    return x1 > -92 && x0 < -52 && y1 > -12 && y0 < 22 && x0 < x1;
  });
  const venezuela = paises.find((f) => f.properties.name === "Venezuela");
  const colombia = { type: "FeatureCollection", features: deptos };
  const proy = d3.geoTransverseMercator().rotate([71.3, -6.2]).fitExtent([[16, 10], [236, H - 30]], colombia);
  proy.clipExtent([[0, 0], [W, H]]);
  const camino = d3.geoPath(proy);

  const p = [];
  // Fondo: bandas horizontales de bruma a blanco (vector, sin degradado rasterizado)
  const bandas = 24;
  const cielo = d3.interpolateRgb(C.bruma, "#f7f9fc");
  for (let k = 0; k < bandas; k++) {
    p.push(`<rect x="0" y="${r2((H / bandas) * k)}" width="${W}" height="${r2(H / bandas + 0.3)}" fill="${cielo(k / (bandas - 1))}"/>`);
  }
  // Países vecinos
  for (const f of paises) {
    if (f.properties.name === "Colombia" || f.properties.name === "Venezuela") continue;
    const d = camino(f);
    if (d) p.push(`<path d="${d}" fill="#ffffff" fill-opacity="0.55" stroke="${C.hielo}" stroke-width="0.4"/>`);
  }
  // Venezuela
  p.push(`<path d="${camino(venezuela)}" fill="${C.hielo}" stroke="#fff" stroke-width="0.6"/>`);
  // Colombia por departamentos, en azules según la población venezolana (mapa 2)
  const pesos = { "BOGOTA": 18.4, "ANTIOQUIA": 15.6, "VALLE DEL CAUCA": 9.2, "NORTE DE SANTANDER": 8.8, "CUNDINAMARCA": 7.7,
    "ATLANTICO": 7.4, "SANTANDER": 5.1, "LA GUAJIRA": 4.4, "BOLIVAR": 3.4, "MAGDALENA": 2.8, "CESAR": 2.7, "META": 2.3,
    "RISARALDA": 2.0, "BOYACA": 1.8 };
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const tono = d3.scaleThreshold().domain([2, 4, 7.5, 15]).range([C.palido, C.claro, C.medio, C.azul, C.oscuro]);
  for (const f of deptos) {
    const v = pesos[norm(String(f.properties.clave))];
    p.push(`<path d="${camino(f)}" fill="${v ? tono(v) : C.bruma}" stroke="#fff" stroke-width="0.55" stroke-linejoin="round"/>`);
  }
  // Contorno nacional
  const contorno = topojson.merge(topo, topo.objects.departamentos.geometries.filter((g) => !String(g.properties.clave).includes("San Andr")));
  p.push(`<path d="${camino(contorno)}" fill="none" stroke="${C.azul}" stroke-width="0.9" stroke-linejoin="round"/>`);
  // Rutas: arcos desde Caracas hacia cada ciudad
  const [ox, oy] = proy(ORIGEN);
  for (const c of [...CIUDADES].sort((a, b) => a.peso - b.peso)) {
    const [cx, cy] = proy(c.lonlat);
    const mx = (ox + cx) / 2, my = (oy + cy) / 2;
    const dx = cx - ox, dy = cy - oy, largo = Math.hypot(dx, dy);
    const curv = 0.28 * largo;
    const qx = mx + (-dy / largo) * curv * -1, qy = my + (dx / largo) * curv * -1;
    const grosor = 0.8 + c.peso * 0.16;
    p.push(`<path d="M${r2(ox)},${r2(oy)} Q${r2(qx)},${r2(qy)} ${r2(cx)},${r2(cy)}" fill="none" stroke="#fff" stroke-width="${r2(grosor + 1.6)}" stroke-linecap="round" stroke-opacity="0.9"/>`);
    p.push(`<path d="M${r2(ox)},${r2(oy)} Q${r2(qx)},${r2(qy)} ${r2(cx)},${r2(cy)}" fill="none" stroke="${C.noche}" stroke-width="${r2(grosor)}" stroke-linecap="round" stroke-dasharray="${r2(grosor * 0.15)} ${r2(grosor * 1.5 + 1.2)}"/>`);
  }
  // Ciudades: anillos concéntricos (tiempo, edad)
  for (const c of CIUDADES) {
    const [cx, cy] = proy(c.lonlat);
    const rr = 2.2 + c.peso * 0.22;
    p.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rr * 2.1)}" fill="none" stroke="#fff" stroke-width="0.7" stroke-opacity="0.9"/>`);
    p.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rr * 1.45)}" fill="none" stroke="#fff" stroke-width="0.9"/>`);
    p.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rr * 0.75)}" fill="#fff"/>`);
    p.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rr * 0.42)}" fill="${C.noche}"/>`);
  }
  // Origen
  p.push(`<circle cx="${r2(ox)}" cy="${r2(oy)}" r="3.2" fill="${C.noche}" stroke="#fff" stroke-width="1"/>`);
  // Rótulos de ciudades
  const desplazar = { "Bogotá": [6, 10], "Medellín": [-6, -7], "Cali": [-6, 8], "Cúcuta": [7, -5], "Barranquilla": [-5, -6], "Bucaramanga": [7, 7] };
  for (const c of CIUDADES) {
    const [cx, cy] = proy(c.lonlat);
    const [dx, dy] = desplazar[c.nombre];
    p.push(texto(cx + dx, cy + dy, c.nombre.toUpperCase(), {
      tam: 5.6, peso: 700, color: C.noche, ancla: dx < 0 ? "end" : "start", espaciado: 0.5, halo: "#fff",
    }));
  }
  const [vx, vy] = proy([-66.4, 7.6]);
  p.push(texto(vx, vy, "VENEZUELA", { tam: 7, peso: 600, color: "#fff", ancla: "middle", espaciado: 1.6 }));
  const [kx, ky] = proy([-72.6, 1.2]);
  p.push(texto(kx, ky, "COLOMBIA", { tam: 7, peso: 600, color: C.azul, ancla: "middle", espaciado: 1.6 }));

  // Familia que migra (de Venezuela hacia Colombia: caminan hacia la izquierda)
  const suelo = H - 6;
  p.push(`<rect x="0" y="${r2(suelo)}" width="${W}" height="6" fill="${C.noche}"/>`);
  p.push(persona(W - 128, suelo - 53 * 1.08, 1.08, "mayor", C.noche));
  p.push(persona(W - 94, suelo - 37 * 1.08, 1.08, "nino", C.noche));
  p.push(persona(W - 66, suelo - 53 * 1.15, 1.15, "adulta", C.noche));

  return documento(W, H, p.join("\n"), { titulo: "Ilustración de portada" });
}
