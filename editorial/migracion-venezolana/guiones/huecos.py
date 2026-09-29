"""Informa páginas con espacio vacío al pie (para ajustar la colocación de figuras).

Uso: python guiones/huecos.py salida/interiores.pdf [umbral_pt]
"""
import sys

import pymupdf

doc = pymupdf.open(sys.argv[1])
umbral = float(sys.argv[2]) if len(sys.argv) > 2 else 40
LIMITE = 595.28 - 45  # base de la caja de texto
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from rellenar_huecos import espacio_libre  # noqa: E402

for i, p in enumerate(doc):
    hueco = espacio_libre(p)
    if hueco > umbral:
        texto = p.get_text().strip().split("\n")
        print(f"p. {i + 1:>3}  hueco {hueco:5.0f} pt   última línea: {texto[-1][:60] if texto else ''}")
