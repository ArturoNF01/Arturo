"""Prepara la fotografía de la portada: recorte y virado en los azules del libro.

Lee figuras/foto-portada.json. La foto se recorta a la caja de la portada, se pasa
a escala de grises y se vira en tres tintas (azul noche, azul oscuro, azul medio)
hacia un blanco azulado. Si todavía no hay foto, se genera un fondo provisional
con la misma paleta y una nota con la foto que falta.

Uso: python guiones/fotos_portada.py   (construir.py lo llama solo)
"""
import json
import math
import pathlib

from PIL import Image, ImageDraw, ImageFont, ImageOps

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
        img, falta = virar(recortar(foto, ancho, alto, cfg["foco"], cfg.get("zoom", 1.0))), None
    else:
        img, falta = provisional(ancho, alto, escala, cfg["tema"].split(";")[0]), cfg["archivo"]
    DESTINO.parent.mkdir(exist_ok=True)
    img.save(DESTINO, quality=92, dpi=(cfg["dpi"], cfg["dpi"]))
    return falta


if __name__ == "__main__":
    falta = componer()
    print(f"foto -> {DESTINO.relative_to(RAIZ)}" + (f"  (falta {falta}: fondo provisional)" if falta else ""))
