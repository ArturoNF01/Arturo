// Utilidades comunes para dibujar las figuras del libro como SVG vectorial.
// Unidades: 1 unidad del viewBox = 1 punto tipográfico (pt).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import * as d3 from "d3";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, "..");

// Caja de texto del libro: 100 mm
export const ANCHO = 283.46;

// Paleta heredada del libro de referencia
export const C = {
  azul: "#1e6ea6",
  oscuro: "#00427a",
  noche: "#0e2050",
  medio: "#5082b5",
  claro: "#89a6cc",
  celeste: "#9db4d5",
  palido: "#b2c3de",
  hielo: "#c8d4e7",
  bruma: "#e0e5f1",
  niebla: "#edf0f7",
  gris: "#808285",
  grisMedio: "#a7a9ac",
  grisClaro: "#bcbec0",
  grisTexto: "#58595b",
  titulo: "#6d6e71",
  texto: "#333436",
  reticula: "#d5d7da",
  tierra: "#e7e8e9",
  blanco: "#ffffff",
};

// Colores por serie, iguales en todo el capítulo
export const SERIE = {
  hombres: C.azul,
  mujeres: C.claro,
  total: C.gris,
};

export const FUENTE = "Source Sans 3";

const fuentes = {
  400: opentype.loadSync(path.join(RAIZ, "fuentes/SourceSans3-Regular.ttf")),
  600: opentype.loadSync(path.join(RAIZ, "fuentes/SourceSans3-SemiBold.ttf")),
  700: opentype.loadSync(path.join(RAIZ, "fuentes/SourceSans3-Bold.ttf")),
};

/** Ancho de un texto en pt. */
export function medir(texto, tam = 6.5, peso = 400) {
  const f = fuentes[peso] || fuentes[400];
  return f.getAdvanceWidth(String(texto), tam, { kerning: true });
}

/** Parte un texto en líneas que no superen `ancho` pt. */
export function partir(texto, ancho, tam = 6.5, peso = 400) {
  const palabras = String(texto).split(/\s+/);
  const lineas = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? actual + " " + p : p;
    if (medir(prueba, tam, peso) <= ancho || !actual) actual = prueba;
    else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const r2 = (v) => Math.round(v * 100) / 100;

/**
 * Texto SVG. `y` es la línea base. Opciones: tam, peso, color, ancla
 * (start|middle|end), rot (grados), cursiva, espaciado, lineas (interlineado).
 */
export function texto(x, y, contenido, o = {}) {
  const { tam = 6.5, peso = 400, color = C.texto, ancla = "start", rot = 0,
    cursiva = false, espaciado = 0, interlineado = tam * 1.18, halo = null } = o;
  const lineas = Array.isArray(contenido) ? contenido : [contenido];
  const attrs = [
    `x="${r2(x)}"`, `y="${r2(y)}"`, `font-size="${tam}"`, `fill="${color}"`,
  ];
  if (peso !== 400) attrs.push(`font-weight="${peso}"`);
  if (ancla !== "start") attrs.push(`text-anchor="${ancla}"`);
  if (cursiva) attrs.push(`font-style="italic"`);
  if (espaciado) attrs.push(`letter-spacing="${espaciado}"`);
  if (rot) attrs.push(`transform="rotate(${rot} ${r2(x)} ${r2(y)})"`);
  const cuerpo = lineas.length === 1
    ? esc(lineas[0])
    : lineas.map((l, i) => `<tspan x="${r2(x)}" dy="${i === 0 ? 0 : r2(interlineado)}">${esc(l)}</tspan>`).join("");
  const nodo = `<text ${attrs.join(" ")}>${cuerpo}</text>`;
  if (!halo) return nodo;
  const conHalo = nodo.replace("<text ", `<text stroke="${halo}" stroke-width="1.6" stroke-linejoin="round" `);
  return conHalo + nodo;
}

export function rect(x, y, w, h, relleno, extra = "") {
  return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(Math.max(0, w))}" height="${r2(Math.max(0, h))}" fill="${relleno}"${extra ? " " + extra : ""}/>`;
}

export function linea(x1, y1, x2, y2, color = C.reticula, grosor = 0.3, extra = "") {
  return `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${color}" stroke-width="${grosor}"${extra ? " " + extra : ""}/>`;
}

/** Leyenda horizontal con cuadros de color. Devuelve { svg, ancho }. */
export function leyenda(x, y, items, o = {}) {
  const { tam = 6.5, lado = 5.2, sep = 10, color = C.texto } = o;
  let cx = x;
  const partes = [];
  for (const it of items) {
    if (it.tipo === "linea") {
      partes.push(linea(cx, y - lado / 2 + 0.4, cx + lado * 1.8, y - lado / 2 + 0.4, it.color, 1.2));
      cx += lado * 1.8 + 3;
    } else if (it.tipo === "punto") {
      partes.push(`<circle cx="${r2(cx + lado / 2)}" cy="${r2(y - lado / 2 + 0.6)}" r="${r2(lado / 2)}" fill="${it.color}"/>`);
      cx += lado + 3;
    } else if (it.tipo === "trama") {
      partes.push(rect(cx, y - lado + 0.6, lado, lado, "url(#trama)", `stroke="${C.grisMedio}" stroke-width="0.3"`));
      cx += lado + 3;
    } else {
      partes.push(rect(cx, y - lado + 0.6, lado, lado, it.color));
      cx += lado + 3;
    }
    partes.push(texto(cx, y, it.etiqueta, { tam, color }));
    cx += medir(it.etiqueta, tam) + sep;
  }
  return { svg: partes.join(""), ancho: cx - sep - x };
}

// Formato numérico del manuscrito: punto decimal y espacio fino para miles
export const FINO = " ";
export function numero(v, dec = 1) {
  const s = Math.abs(v).toFixed(dec);
  const [ent, frac] = s.split(".");
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, FINO);
  return (v < 0 ? "−" : "") + miles + (frac ? "." + frac : "");
}

export function documento(ancho, alto, cuerpo, { titulo = "", defs = "" } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(ancho)}pt" height="${r2(alto)}pt" viewBox="0 0 ${r2(ancho)} ${r2(alto)}" font-family="${FUENTE}, sans-serif">
${titulo ? `<title>${esc(titulo)}</title>\n` : ""}${defs ? `<defs>${defs}</defs>\n` : ""}${cuerpo}
</svg>
`;
}

export function guardar(nombre, svg) {
  const destino = path.join(RAIZ, "figuras", "svg", nombre + ".svg");
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, svg);
  return destino;
}

/** Ajustes de formación por figura (figuras/ajustes.json). */
export function ajustes(nombre) {
  const ruta = path.join(RAIZ, "figuras", "ajustes.json");
  if (!fs.existsSync(ruta)) return {};
  return JSON.parse(fs.readFileSync(ruta, "utf8"))[nombre] || {};
}

export function datos() {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, "datos", "capitulo-1.json"), "utf8"));
}

export { d3 };

/** Textos literales de las figuras del manuscrito (datos/figuras-original.json). */
export function original() {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, "datos", "figuras-original.json"), "utf8"));
}
