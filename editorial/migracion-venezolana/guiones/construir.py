"""Ensambla el libro y genera el PDF con WeasyPrint.

Uso (desde la carpeta del proyecto):
    python guiones/construir.py            # libro completo -> salida/
    python guiones/construir.py --figuras  # además, un PDF vectorial por figura

Orden de las piezas: el de la lista PIEZAS. Para sumar capítulos basta con
crear contenido/NN-capitulo-N.html y añadirlo a la lista; el índice se
pagina solo (target-counter).
"""
import argparse
import pathlib
import re
import sys

import weasyprint

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "salida"

PORTADA = "contenido/00-portada.html"

PIEZAS = [
    "contenido/01-preliminares.html",
    "contenido/02-indice.html",
    "contenido/10-capitulo-1.html",
]

NOMBRE_PDF = "acceso-seguridad-social-migrantes-venezolanos.pdf"


def incrustar_svg(html: str) -> str:
    """Sustituye <img data-svg="ruta.svg"> por el SVG en línea.

    En línea, el SVG conserva el texto como texto (seleccionable) y usa las
    mismas fuentes del documento.
    """
    def repl(m):
        ruta = RAIZ / m.group(1)
        svg = ruta.read_text(encoding="utf-8")
        svg = re.sub(r"<\?xml[^>]*>\s*", "", svg)
        return svg

    return re.sub(r'<img data-svg="([^"]+)"[^>]*>', repl, html)


def incluir(html: str) -> str:
    """Sustituye <div data-incluir="ruta.html"></div> por el contenido del archivo."""
    return re.sub(r'<div data-incluir="([^"]+)"></div>',
                  lambda m: (RAIZ / m.group(1)).read_text(encoding="utf-8"), html)


def ensamblar(piezas=PIEZAS) -> str:
    cuerpo = []
    for pieza in piezas:
        ruta = RAIZ / pieza
        if not ruta.exists():
            print(f"  (omitida, no existe) {pieza}", file=sys.stderr)
            continue
        cuerpo.append(ruta.read_text(encoding="utf-8"))
    html = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>¿Cómo es el acceso a seguridad social de la población migrante venezolana en las principales ciudades de Colombia?</title>
<meta name="author" content="CISS · CIESS · CODESS">
<link rel="stylesheet" href="../plantilla/libro.css">
</head>
<body>
{''.join(cuerpo)}
</body>
</html>
"""
    return incrustar_svg(incluir(html))


def renderizar(piezas, nombre):
    html = ensamblar(piezas)
    destino_html = SALIDA / f"{nombre}.html"
    destino_html.write_text(html, encoding="utf-8")
    doc = weasyprint.HTML(filename=str(destino_html), base_url=str(SALIDA)).render()
    destino = SALIDA / f"{nombre}.pdf"
    doc.write_pdf(str(destino))
    print(f"{len(doc.pages):>3} pp. -> {destino.relative_to(RAIZ)}")
    return destino


def construir_libro():
    """Portada e interiores por separado (imprenta) y unidos (edición digital).

    Los interiores empiezan en la portadilla, p. 1 (impar), como en el libro
    de referencia; la portada no se cuenta.
    """
    from pypdf import PdfWriter

    SALIDA.mkdir(exist_ok=True)
    portada = renderizar([PORTADA], "portada")
    interiores = renderizar(PIEZAS, "interiores")
    union = PdfWriter()
    for parte in (portada, interiores):
        union.append(str(parte))
    union.add_metadata({
        "/Title": "¿Cómo es el acceso a seguridad social de la población migrante venezolana en las principales ciudades de Colombia?",
        "/Author": "CISS · CIESS · CODESS",
    })
    destino = SALIDA / NOMBRE_PDF
    with open(destino, "wb") as f:
        union.write(f)
    print(f"edición digital -> {destino.relative_to(RAIZ)}")
    return destino


def construir_figuras():
    """Un PDF vectorial por figura (para colocar en InDesign/Illustrator)."""
    destino = SALIDA / "figuras-pdf"
    destino.mkdir(parents=True, exist_ok=True)
    for svg in sorted((RAIZ / "figuras" / "svg").glob("*.svg")):
        contenido = svg.read_text(encoding="utf-8")
        m = re.search(r'width="([\d.]+)pt" height="([\d.]+)pt"', contenido)
        if not m:
            continue
        ancho, alto = m.groups()
        html = f"""<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="../../plantilla/libro.css">
<style>@page {{ size: {ancho}pt {alto}pt; margin: 0; }}
@page {{ @top-left-corner {{ content: none; background: none; }} @top-right-corner {{ content: none; background: none; }}
@top-left {{ content: none; }} @top-right {{ content: none; }} }}
body {{ margin: 0; }} svg {{ display: block; }}</style></head>
<body>{re.sub(r"<[?]xml[^>]*>", "", contenido)}</body></html>"""
        weasyprint.HTML(string=html, base_url=str(destino)).write_pdf(str(destino / (svg.stem + ".pdf")))
    print(f"figuras -> {destino.relative_to(RAIZ)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--figuras", action="store_true", help="exportar también cada figura en PDF")
    args = ap.parse_args()
    construir_libro()
    if args.figuras:
        construir_figuras()
