"""Rasteriza SVG de figuras/svg para revisarlas (no forma parte del libro).

Uso: python guiones/vista_previa.py destino.png [nombre ...]
"""
import pathlib
import re
import sys

import pymupdf
import weasyprint

RAIZ = pathlib.Path(__file__).resolve().parent.parent
destino = pathlib.Path(sys.argv[1])
nombres = sys.argv[2:]
svgs = sorted((RAIZ / "figuras/svg").glob("*.svg"))
if nombres:
    svgs = [s for s in svgs if s.stem in nombres]
bloques = []
for s in svgs:
    contenido = re.sub(r"<[?]xml[^>]*>", "", s.read_text(encoding="utf-8"))
    bloques.append(f'<div class="f"><p>{s.stem}</p>{contenido}</div>')
html = f"""<html><head><style>
@page {{ size: 300pt 5000pt; margin: 8pt; }}
body {{ margin:0; }} .f {{ margin-bottom: 14pt; border: 0.3pt dotted #f0a; }}
.f p {{ font: 7pt sans-serif; color: #c06; margin: 0 0 2pt; }} svg {{ display:block; }}
</style></head><body>{''.join(bloques)}</body></html>"""
pdf = weasyprint.HTML(string=html, base_url=str(RAIZ)).write_pdf()
doc = pymupdf.open(stream=pdf, filetype="pdf")
pag = doc[0]
# recorta al contenido
texto_y = max((b[3] for b in pag.get_text("blocks")), default=500)
dibujos_y = max((d["rect"].y1 for d in pag.get_drawings()), default=500)
alto = min(max(texto_y, dibujos_y) + 10, pag.rect.height)
pix = pag.get_pixmap(dpi=200, clip=pymupdf.Rect(0, 0, 300, alto))
pix.save(destino)
print(destino, pix.width, pix.height)
