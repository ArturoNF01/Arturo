"""Recupera las figuras de un PDF ya maquetado del libro como SVG vectoriales.

Respaldo para cuando falten los datos con que se dibujaron (p. ej., las figuras del
capítulo 1 sin datos/capitulo-1.json): toma cada figura del PDF final anterior y la
deja en figuras/svg/ con el nombre que espera el HTML (mapa-1, grafica-2, diagrama-1…).

Cómo la encuentra: en cada página busca el pie «Gráfica N.», «Mapa N.» o
«Diagrama N.» (título de la figura) y la siguiente línea «Fuente:», «Nota:» o
«*Nota:»; la figura es lo que queda entre los dos, recortado a lo que de verdad
tiene dibujo o texto. El texto se convierte en trazos para que se vea idéntico.

Uso:
  python guiones/figuras_de_pdf.py LIBRO.pdf PRIMERA ULTIMA [--prefijo c1-] [--destino figuras/svg]
  (PRIMERA y ULTIMA: páginas del PDF, contando desde 1)
Revisa siempre el resultado a ojo (guiones/hojas_contacto.py o abriendo los SVG).
"""
import argparse
import pathlib
import re
import unicodedata

import pymupdf

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PIE = re.compile(r"^(Gráfica|Gráfico|Mapa|Diagrama|Anexo)\s+(\d+)\.")
FIN = re.compile(r"^\*?(Fuente|Nota)\s*:")


def lineas(pagina):
    out = []
    for b in pagina.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            t = "".join(s["text"] for s in ln["spans"]).strip()
            if t:
                out.append((pymupdf.Rect(ln["bbox"]), t))
    return sorted(out, key=lambda x: (x[0].y0, x[0].x0))


def nombre(tipo, n, prefijo):
    base = unicodedata.normalize("NFKD", tipo.lower()).encode("ascii", "ignore").decode()
    return f"{prefijo}{base}-{n}"


def recortes(pagina):
    """[(nombre_base, Rect)] de las figuras de la página."""
    ls = lineas(pagina)
    figuras = []
    for i, (r, t) in enumerate(ls):
        m = PIE.match(t)
        if not m:
            continue
        # el título puede ocupar varias líneas: avanza mientras las líneas estén pegadas
        fondo = r.y1
        j = i + 1
        while j < len(ls) and ls[j][0].y0 - fondo < 3 and not FIN.match(ls[j][1]):
            fondo = max(fondo, ls[j][0].y1); j += 1
        tope = next((rr.y0 for rr, tt in ls[j:] if FIN.match(tt) and rr.y0 > fondo), None)
        if tope is None:
            continue
        banda = pymupdf.Rect(0, fondo + 0.5, pagina.rect.width, tope - 0.5)
        caja = pymupdf.Rect()
        for d in pagina.get_drawings():
            if d["rect"].intersects(banda):
                caja |= d["rect"] & banda
        for rr, tt in ls:
            if banda.contains(rr):
                caja |= rr
        if not caja.is_empty and caja.height > 20:
            figuras.append(((m.group(1), m.group(2)), caja + (-0.5, -0.5, 0.5, 0.5)))
    return figuras


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("primera", type=int)
    ap.add_argument("ultima", type=int)
    ap.add_argument("--prefijo", default="")
    ap.add_argument("--destino", default=str(RAIZ / "figuras" / "svg"))
    a = ap.parse_args()
    src = pymupdf.open(a.pdf)
    destino = pathlib.Path(a.destino)
    destino.mkdir(parents=True, exist_ok=True)
    vistos = set()
    for pno in range(a.primera - 1, min(a.ultima, src.page_count)):
        for (tipo, n), caja in recortes(src[pno]):
            base = nombre(tipo, n, a.prefijo)
            if base in vistos:
                print(f"  aviso: {base} aparece otra vez en la p. {pno + 1}; se conserva la primera")
                continue
            vistos.add(base)
            doc = pymupdf.open()
            pag = doc.new_page(width=caja.width, height=caja.height)
            pag.show_pdf_page(pag.rect, src, pno, clip=caja)
            svg = pag.get_svg_image(text_as_path=True)
            # tamaño en puntos, como las demás figuras del libro
            svg = re.sub(r'width="[\d.]+(pt)?" height="[\d.]+(pt)?"',
                         f'width="{caja.width:.2f}pt" height="{caja.height:.2f}pt"', svg, count=1)
            (destino / f"{base}.svg").write_text(svg, encoding="utf-8")
            print(f"p. {pno + 1:>3}  {base:14} {caja.width:6.1f} × {caja.height:6.1f} pt")


if __name__ == "__main__":
    main()
