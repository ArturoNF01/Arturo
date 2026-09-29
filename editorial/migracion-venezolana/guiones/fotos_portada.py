"""Compone la tira fotográfica de la portada con el virado del libro de referencia.

Lee figuras/fotos-portada.json; cada foto de insumos/fotos/ se recorta al módulo,
se pasa a escala de grises y se vira al sepia suave de la portada de «De un
sistema de pensiones…» (curva medida sobre su tira de retratos). Si falta una
foto, se dibuja un marcador con su número y tema para revisar la retícula.

Uso: python guiones/fotos_portada.py   (construir.py lo llama solo)
"""
import json
import pathlib

from PIL import Image, ImageDraw, ImageFont, ImageOps

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CONFIG = RAIZ / "figuras" / "fotos-portada.json"
DESTINO = RAIZ / "fotos" / "portada-tira.jpg"

# Gris medio -> RGB medidos en la tira de la portada de referencia (tramos de 24 niveles)
CURVA = [(0, 8, 5, 4), (16, 20, 15, 12), (37, 42, 37, 33), (60, 66, 59, 56), (85, 91, 84, 79),
         (108, 115, 108, 102), (132, 139, 131, 125), (155, 164, 155, 148), (180, 189, 179, 172),
         (203, 212, 202, 194), (225, 237, 223, 215), (248, 254, 248, 242), (255, 255, 251, 246)]


def tabla(canal):
    """Tabla de 256 valores para un canal, interpolando la curva medida."""
    salida = []
    for g in range(256):
        for (g0, *c0), (g1, *c1) in zip(CURVA, CURVA[1:]):
            if g0 <= g <= g1:
                t = (g - g0) / (g1 - g0)
                salida.append(round(c0[canal] + t * (c1[canal] - c0[canal])))
                break
    return salida


TABLAS = [tabla(i) for i in range(3)]


def virar(gris):
    return Image.merge("RGB", [gris.point(t) for t in TABLAS])


def recortar(foto, ancho, alto, foco, zoom):
    """Recorta la foto a la proporción del módulo, centrada en `foco`."""
    w, h = foto.size
    proporcion = ancho / alto
    cw, ch = (h * proporcion, h) if w / h > proporcion else (w, w / proporcion)
    cw, ch = cw / zoom, ch / zoom
    cx = min(max(foco[0] * w, cw / 2), w - cw / 2)
    cy = min(max(foco[1] * h, ch / 2), h - ch / 2)
    caja = (round(cx - cw / 2), round(cy - ch / 2), round(cx + cw / 2), round(cy + ch / 2))
    return foto.crop(caja).resize((ancho, alto), Image.LANCZOS)


def marcador(ancho, alto, numero, tema, escala):
    """Módulo provisional: fondo sepia medio con número y tema."""
    img = virar(Image.new("L", (ancho, alto), 150))
    d = ImageDraw.Draw(img)
    grande = ImageFont.truetype(str(RAIZ / "fuentes/SourceSans3-SemiBold.ttf"), round(16 * escala))
    chica = ImageFont.truetype(str(RAIZ / "fuentes/SourceSans3-Regular.ttf"), round(5.5 * escala))
    d.text((ancho / 2, alto * 0.42), str(numero), font=grande, fill="white", anchor="mm")
    lineas, actual = [], ""
    for palabra in tema.split():
        prueba = (actual + " " + palabra).strip()
        if d.textlength(prueba, font=chica) > ancho * 0.86 and actual:
            lineas.append(actual)
            actual = palabra
        else:
            actual = prueba
    lineas.append(actual)
    for k, linea in enumerate(lineas):
        d.text((ancho / 2, alto * 0.68 + k * 6.6 * escala), linea, font=chica, fill="white", anchor="mm")
    return img


def componer():
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    tira, fotos = cfg["tira"], cfg["fotos"]
    escala = tira["dpi"] / 72
    unidades = sum(f["unidades"] for f in fotos)
    modulo = (tira["ancho"] - (unidades - 1) * tira["separacion"]) / unidades
    lienzo = Image.new("RGB", (round(tira["ancho"] * escala), round(tira["alto"] * escala)), "white")
    x, faltan = 0.0, []
    for n, f in enumerate(fotos, 1):
        ancho_pt = f["unidades"] * modulo + (f["unidades"] - 1) * tira["separacion"]
        ancho, alto = round(ancho_pt * escala), lienzo.height
        ruta = RAIZ / f["archivo"]
        if ruta.exists():
            foto = ImageOps.exif_transpose(Image.open(ruta)).convert("L")
            foto = ImageOps.autocontrast(foto, cutoff=0.5)
            modulo_img = virar(recortar(foto, ancho, alto, f["foco"], f.get("zoom", 1.0)))
        else:
            modulo_img = marcador(ancho, alto, n, f["tema"], escala)
            faltan.append(f["archivo"])
        lienzo.paste(modulo_img, (round(x * escala), 0))
        x += ancho_pt + tira["separacion"]
    DESTINO.parent.mkdir(exist_ok=True)
    lienzo.save(DESTINO, quality=92, dpi=(tira["dpi"], tira["dpi"]))
    return faltan


if __name__ == "__main__":
    faltan = componer()
    print(f"tira -> {DESTINO.relative_to(RAIZ)}")
    for f in faltan:
        print(f"  falta {f} (se dejó un marcador)")
