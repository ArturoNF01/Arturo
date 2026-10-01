"""Prepara la fotografía de la portada: recorte y virado en los azules del libro.

Lee figuras/foto-portada.json. La foto se recorta a la caja de la portada y se pasa
a escala de grises. Tratamiento "gris": grises oscurecidos, con una sombra más
densa arriba para que se lean el mapa y los nombres. Tratamiento "azul": virado
en tres tintas del libro. Si todavía no hay foto, se genera un fondo provisional
con una nota con la foto que falta.

Cristal: con la máscara del mapa (figuras/svg/portada-mascara.svg) el interior de
los países se vuelve «cristal esmerilado»: la foto desenfocada, teñida y aclarada, con un
brillo en diagonal, un borde interior luminoso y una sombra suave por fuera que
despega el mapa del fondo. Los contornos nítidos van encima, en vector.

Uso: python guiones/fotos_portada.py   (construir.py lo llama solo)
"""
import json
import math
import pathlib

import pymupdf
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CONFIG = RAIZ / "figuras" / "foto-portada.json"
DESTINO = RAIZ / "fotos" / "portada-foto.jpg"

# Tintas del virado (de sombras a luces), tomadas de la paleta del libro
TINTAS = [(0.0, "#0b1a42"), (0.38, "#00427a"), (0.7, "#5082b5"), (1.0, "#e6ecf5")]


def _rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def _tabla(canal):
    salida = []
    for g in range(256):
        t = g / 255
        for (t0, c0), (t1, c1) in zip(TINTAS, TINTAS[1:]):
            if t0 <= t <= t1:
                a, b = _rgb(c0)[canal], _rgb(c1)[canal]
                salida.append(round(a + (t - t0) / (t1 - t0) * (b - a)))
                break
    return salida


TABLAS = [_tabla(i) for i in range(3)]


def virar(gris):
    return Image.merge("RGB", [gris.point(t) for t in TABLAS])


def gris(img, cfg):
    """Grises comprimidos entre `negro` y `blanco`, con sombra superior en degradado."""
    negro, blanco = cfg.get("negro", 14), cfg.get("blanco", 180)
    img = img.point(lambda v: round(negro + v * (blanco - negro) / 255))
    sombra, alto_sombra = cfg.get("sombra_superior", 0.7), cfg.get("alto_sombra", 0.45)
    capa = Image.new("L", (1, img.height))
    for y in range(img.height):
        t = min(1.0, y / (alto_sombra * img.height))
        t = t * t * (3 - 2 * t)  # suavizado
        capa.putpixel((0, y), round(255 * (sombra + (1 - sombra) * t)))
    img = ImageChops.multiply(img, capa.resize(img.size))
    return Image.merge("RGB", [img, img, img])


def mascara(ruta_svg, tamano):
    """Rasteriza la máscara SVG (blanco = dentro del mapa) al tamaño de la foto."""
    pagina = pymupdf.open(ruta_svg)[0]
    zoom = pymupdf.Matrix(tamano[0] / pagina.rect.width, tamano[1] / pagina.rect.height)
    pm = pagina.get_pixmap(matrix=zoom, alpha=False, colorspace=pymupdf.csGRAY)
    return Image.frombytes("L", (pm.width, pm.height), pm.samples).resize(tamano)


def cristal(img, cfg, escala):
    """Relleno de cristal esmerilado dentro de la máscara del mapa."""
    c = cfg["cristal"]
    ruta = RAIZ / c["mascara"]
    if not ruta.exists():
        return img
    m = mascara(ruta, img.size)
    pt = lambda v: max(1, round(v * escala))  # noqa: E731
    # 1. Sombra suave por fuera, desplazada hacia abajo a la derecha
    dx, dy = c.get("sombra_desplazamiento", [1.2, 2.0])
    sombra = Image.new("L", img.size, 0)
    sombra.paste(m, (pt(dx), pt(dy)))
    sombra = sombra.filter(ImageFilter.GaussianBlur(pt(c.get("sombra_desenfoque", 4))))
    sombra = sombra.point(lambda v: round(v * c.get("sombra", 0.45)))
    con_sombra = Image.composite(Image.new("RGB", img.size, "black"), img, sombra)
    # 2. Interior: la foto desenfocada y aclarada
    vidrio = img.filter(ImageFilter.GaussianBlur(pt(c.get("desenfoque", 3))))
    vidrio = Image.blend(vidrio, Image.new("RGB", img.size, c.get("tinte", "#ffffff")), c.get("tinte_opacidad", 0.0))
    vidrio = Image.blend(vidrio, Image.new("RGB", img.size, "white"), c.get("blanco", 0.22))
    # 3. Brillo en diagonal (más luz arriba a la izquierda)
    b0, b1 = c.get("brillo", [0.28, 0.04])
    w, h = img.size
    chico = Image.new("L", (64, 64))
    for y in range(64):
        for x in range(64):
            t = min(1.0, (x / 63 * w + y / 63 * h) / (w + h) * 1.25)
            chico.putpixel((x, y), round(255 * (b0 + (b1 - b0) * t)))
    vidrio = Image.composite(Image.new("RGB", img.size, "white"), vidrio, chico.resize(img.size, Image.BICUBIC))
    # 4. Borde interior luminoso (bisel)
    ancho_borde = pt(c.get("borde", 2.2))
    interior = m.filter(ImageFilter.MinFilter(ancho_borde * 2 + 1))
    borde = ImageChops.subtract(m, interior).filter(ImageFilter.GaussianBlur(ancho_borde / 1.5))
    borde = borde.point(lambda v: round(v * c.get("borde_luz", 0.5)))
    vidrio = Image.composite(Image.new("RGB", img.size, "white"), vidrio, borde)
    # 5. Vidrio dentro de la máscara (borde apenas suavizado), sombra fuera
    return Image.composite(vidrio, con_sombra, m.filter(ImageFilter.GaussianBlur(0.6)))


def recortar(foto, ancho, alto, foco, zoom):
    """Recorta la foto a la proporción de la caja, centrada en `foco`."""
    w, h = foto.size
    proporcion = ancho / alto
    cw, ch = (h * proporcion, h) if w / h > proporcion else (w, w / proporcion)
    cw, ch = cw / zoom, ch / zoom
    cx = min(max(foco[0] * w, cw / 2), w - cw / 2)
    cy = min(max(foco[1] * h, ch / 2), h - ch / 2)
    caja = (round(cx - cw / 2), round(cy - ch / 2), round(cx + cw / 2), round(cy + ch / 2))
    return foto.crop(caja).resize((ancho, alto), Image.LANCZOS)


def provisional(ancho, alto, escala, tema):
    """Fondo de relevo: luz suave desde arriba a la derecha, en las mismas tintas."""
    chico = Image.new("L", (ancho // 8, alto // 8))
    px = chico.load()
    for y in range(chico.height):
        for x in range(chico.width):
            d = math.hypot(x / chico.width - 0.85, y / chico.height - 0.1)
            px[x, y] = round(max(0, min(255, 150 - 120 * d)))
    img = virar(chico.resize((ancho, alto), Image.BICUBIC))
    d = ImageDraw.Draw(img)
    fuente = ImageFont.truetype(str(RAIZ / "fuentes/SourceSans3-Regular.ttf"), round(5.5 * escala))
    d.text((round(10 * escala), round(14 * escala)), f"FOTO PROVISIONAL · {tema}",
           font=fuente, fill="#9fb4d3", anchor="ls")
    return img


def componer():
    """Escribe fotos/portada-foto.jpg. Devuelve la ruta de la foto que falta, si falta."""
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    escala = cfg["dpi"] / 72
    ancho, alto = round(cfg["ancho"] * escala), round(cfg["alto"] * escala)
    ruta = RAIZ / cfg["archivo"]
    if ruta.exists():
        foto = ImageOps.exif_transpose(Image.open(ruta)).convert("L")
        foto = ImageOps.autocontrast(foto, cutoff=0.5)
        foto = recortar(foto, ancho, alto, cfg["foco"], cfg.get("zoom", 1.0))
        img = gris(foto, cfg) if cfg.get("tratamiento") == "gris" else virar(foto)
        if cfg.get("cristal"):
            img = cristal(img, cfg, escala)
        falta = None
    else:
        img, falta = provisional(ancho, alto, escala, cfg["tema"].split(";")[0]), cfg["archivo"]
    DESTINO.parent.mkdir(exist_ok=True)
    img.save(DESTINO, quality=92, dpi=(cfg["dpi"], cfg["dpi"]))
    return falta


if __name__ == "__main__":
    falta = componer()
    print(f"foto -> {DESTINO.relative_to(RAIZ)}" + (f"  (falta {falta}: fondo provisional)" if falta else ""))
