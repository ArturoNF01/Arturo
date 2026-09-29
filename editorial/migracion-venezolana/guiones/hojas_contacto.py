"""Hojas de contacto del PDF para revisión visual (pliegos enfrentados).

Uso: python guiones/hojas_contacto.py salida/libro.pdf destino_prefijo [dpi] [paginas_por_hoja]
"""
import sys

import pymupdf
from PIL import Image, ImageDraw

pdf, prefijo = sys.argv[1], sys.argv[2]
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 60
por_hoja = int(sys.argv[4]) if len(sys.argv) > 4 else 12
doc = pymupdf.open(pdf)
imgs = [Image.frombytes("RGB", (p.get_pixmap(dpi=dpi).width, p.get_pixmap(dpi=dpi).height),
                        p.get_pixmap(dpi=dpi).samples) for p in doc]
w, h = imgs[0].size
cols = 6
for k in range(0, len(imgs), por_hoja):
    lote = imgs[k:k + por_hoja]
    filas = (len(lote) + cols - 1) // cols
    hoja = Image.new("RGB", (cols * w + (cols + 1) * 8, filas * (h + 22) + 8), "#7a7a7a")
    d = ImageDraw.Draw(hoja)
    for i, im in enumerate(lote):
        x = 8 + (i % cols) * (w + 8)
        y = 8 + (i // cols) * (h + 22)
        hoja.paste(im, (x, y + 14))
        d.text((x, y), f"PDF {k + i + 1}", fill="white")
    hoja.save(f"{prefijo}{k // por_hoja + 1}.png")
    print(f"{prefijo}{k // por_hoja + 1}.png")
