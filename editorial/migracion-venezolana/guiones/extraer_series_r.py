"""Recupera las series de una gráfica de líneas de R/ggplot exportada a PDF vectorial.

Calibra los ejes con las etiquetas de las marcas (años en X, números en Y) y
convierte cada trazo de color a valores de datos. Validado con una gráfica de
escenarios de un solo panel: los valores coinciden con los rótulos de la figura.

Límites: un solo panel, ejes lineales, etiquetas de Y numéricas simples. Para
paneles múltiples (facetas), etiquetas como «20.0 por 100» o áreas apiladas,
adapta la calibración por panel. Siempre valida contra las cifras del texto y
los rótulos de la propia figura antes de redibujar.

Uso: python guiones/extraer_series_r.py insumos/cap2-graficas/FIGURA.pdf
"""
import collections
import re
import sys

import pymupdf

d = pymupdf.open(sys.argv[1])
p = d[0]
palabras = p.get_text("words")


def num(s):
    s = s.replace("−", "-").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


# Marcas del eje X: años 2020-2060 en una misma fila (la más baja con varios años)
filas = collections.defaultdict(list)
for w in palabras:
    v = num(w[4])
    if v is not None and 2000 <= v <= 2100 and re.fullmatch(r"20\d\d", w[4]):
        filas[round(w[1])].append(((w[0] + w[2]) / 2, v))
fila_x = max(filas.items(), key=lambda kv: (len(kv[1]), kv[0]))[1]
fila_x.sort()
(px0, vx0), (px1, vx1) = fila_x[0], fila_x[-1]
ax = (vx1 - vx0) / (px1 - px0)
# Marcas del eje Y: números alineados a la derecha en una misma columna, a la izquierda del área
cols = collections.defaultdict(list)
for w in palabras:
    v = num(w[4])
    if v is not None and not re.fullmatch(r"20\d\d", w[4]):
        cols[round(w[2])].append(((w[1] + w[3]) / 2, v))
col_y = max(cols.items(), key=lambda kv: len(kv[1]))[1]
col_y.sort()
(py0, vy0), (py1, vy1) = col_y[0], col_y[-1]
ay = (vy1 - vy0) / (py1 - py0)
print(f"eje X: {vx0}..{vx1}  eje Y: {vy0}..{vy1}  ({len(col_y)} marcas)")
series = collections.defaultdict(list)
for dr in p.get_drawings():
    c = dr.get("color")
    if not c or dr.get("fill"):
        continue
    col = "#%02x%02x%02x" % tuple(round(v * 255) for v in c[:3])
    if col in ("#ebebeb", "#ffffff", "#000000"):
        continue
    pts = []
    for it in dr["items"]:
        if it[0] == "l":
            pts += [it[1], it[2]]
    if len(pts) > 6:
        series[col].append(pts)
for col, trazos in series.items():
    pts = max(trazos, key=len)
    vals = [(vx0 + (q.x - px0) * ax, vy0 + (q.y - py0) * ay) for q in pts]
    muestra = [(round(x), round(y, 3)) for x, y in vals if abs(x - round(x / 5) * 5) < 0.15]
    vistos = {}
    for x, y in muestra:
        vistos.setdefault(x, y)
    print(col, sorted(vistos.items()))
