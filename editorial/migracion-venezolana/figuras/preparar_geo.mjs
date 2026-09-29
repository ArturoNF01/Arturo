// Prepara la geometría de departamentos de Colombia para el mapa 2.
// Fuente: Natural Earth 1:10m Admin 1 – States, Provinces (dominio público).
// Uso: node figuras/preparar_geo.mjs ruta/ne_10m_admin_1_colombia.geojson
import fs from "node:fs";
import { topology } from "topojson-server";
import { presimplify, simplify, quantile } from "topojson-simplify";

const entrada = process.argv[2];
const gj = JSON.parse(fs.readFileSync(entrada, "utf8"));
gj.features = gj.features
  .filter((f) => f.properties.nombre) // descarta el área sin nombre (CO-X01~)
  .map((f) => ({
    type: "Feature",
    properties: { nombre: f.properties.nombre_es || f.properties.nombre, clave: f.properties.nombre },
    geometry: f.geometry,
  }));
let topo = topology({ departamentos: gj }, 1e5);
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, 0.35));
const salida = "datos/geo/colombia-departamentos.topo.json";
fs.writeFileSync(salida, JSON.stringify(topo));
console.log(salida, (fs.statSync(salida).size / 1024).toFixed(0) + " KB", gj.features.length, "departamentos");
