// Genera todas las figuras vectoriales del capítulo 1 en figuras/svg/.
// Uso: npm run figuras   (o: node figuras/generar.mjs [nombre ...])
import { datos, guardar } from "./lib.mjs";
import * as G from "./graficas.mjs";
import * as M from "./mapas.mjs";
import { portada, portadaMascara } from "./portada.mjs";

const FIGURAS = {
  "mapa-1": M.mapa1,
  "grafica-1": G.grafica1,
  "diagrama-1": G.diagrama1,
  "mapa-2": M.mapa2,
  "grafica-2": G.grafica2,
  "grafica-3": G.grafica3,
  "grafica-4": G.grafica4,
  "grafica-5": G.grafica5,
  "grafica-6": G.grafica6,
  "grafica-7": G.grafica7,
  "grafica-8": G.grafica8,
  "grafica-9": G.grafica9,
  "portada-mapa": portada,
  "portada-mascara": portadaMascara,
};

// Las figuras de la portada no necesitan datos/capitulo-1.json (privado, no versionado).
const SIN_DATOS = new Set(["portada-mapa", "portada-mascara"]);
let D = null;
try {
  D = datos();
} catch {
  console.warn("⚠ Falta datos/capitulo-1.json (python guiones/datos_cap1.py): solo se generan las figuras de la portada.");
}
const pedidas = process.argv.slice(2);
for (const [nombre, fn] of Object.entries(FIGURAS)) {
  if (pedidas.length && !pedidas.includes(nombre)) continue;
  if (!D && !SIN_DATOS.has(nombre)) {
    console.warn("  omitida:", nombre);
    continue;
  }
  guardar(nombre, fn(D ?? {}));
  console.log("✓", nombre);
}
