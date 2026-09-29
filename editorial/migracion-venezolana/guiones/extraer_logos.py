"""Extrae en SVG vectorial los logotipos CISS y CIESS del archivo de Illustrator.

El .ai (compatible con PDF) trae tres filas: a color sobre blanco, sobre verde y
en una tinta sobre negro. Se convierten los trazos (curvas, líneas, rectángulos)
a trayectorias SVG sin fondo, con el origen en la esquina del logotipo.

Uso: python guiones/extraer_logos.py ["insumos/Logos CISS - CIESS.ai"]
"""
import pathlib
import sys

import pymupdf

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "insumos" / "Logos CISS - CIESS.ai"
DESTINO = RAIZ / "logos"

VERDE, DORADO, CREMA = "#0a281c", "#c7ae6f", "#f5f5ed"
GRIS = "#808285"


def hexa(c):
    return "#%02x%02x%02x" % tuple(round(v * 255) for v in c)


def f(v):
    return f"{v:.3f}".rstrip("0").rstrip(".")


def trayectoria(dibujo, ox, oy):
    """Convierte los elementos de un dibujo de PyMuPDF en el atributo d de SVG."""
    partes, actual = [], None

    def p(pt):
        return f"{f(pt.x - ox)},{f(pt.y - oy)}"

    for it in dibujo["items"]:
        if it[0] == "re":
            r = it[1]
            partes.append(f"M{f(r.x0 - ox)},{f(r.y0 - oy)}H{f(r.x1 - ox)}V{f(r.y1 - oy)}H{f(r.x0 - ox)}Z")
            actual = None
            continue
        ini = it[1]
        if actual is None or abs(ini.x - actual.x) > 1e-3 or abs(ini.y - actual.y) > 1e-3:
            if partes and not partes[-1].endswith("Z"):
                partes.append("Z")
            partes.append("M" + p(ini))
        if it[0] == "l":
            partes.append("L" + p(it[2]))
            actual = it[2]
        elif it[0] == "c":
            partes.append("C" + " ".join(p(q) for q in it[2:5]))
            actual = it[4]
        elif it[0] == "qu":
            q = it[1]
            partes.append(f"L{p(q.ur)}L{p(q.lr)}L{p(q.ll)}Z")
            actual = None
    if partes and not partes[-1].endswith("Z"):
        partes.append("Z")
    return "".join(partes)


def svg(dibujos, colores, titulo):
    """colores: función que recibe el color original y devuelve el de salida."""
    caja = pymupdf.Rect(dibujos[0]["rect"])
    for d in dibujos:
        caja |= d["rect"]
    ox, oy = caja.x0, caja.y0
    w, h = caja.width, caja.height
    cuerpo = []
    for d in dibujos:
        regla = ' fill-rule="evenodd"' if d.get("even_odd") else ""
        cuerpo.append(f'<path fill="{colores(hexa(d["fill"]))}"{regla} d="{trayectoria(d, ox, oy)}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}" '
            f'width="{f(w)}pt" height="{f(h)}pt">\n<title>{titulo}</title>\n'
            + "\n".join(cuerpo) + "\n</svg>\n")


def main():
    origen = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ORIGEN
    pagina = pymupdf.open(origen)[0]
    fila_alto = pagina.rect.height / 3
    grupos = {}
    for d in pagina.get_drawings():
        if d["type"] != "f" or d["rect"].width > pagina.rect.width * 0.5:
            continue  # fondos de las filas
        fila = int(d["rect"].y0 // fila_alto)
        lado = "ciss" if d["rect"].x1 < pagina.rect.width / 2 - 20 else "ciess"
        grupos.setdefault((fila, lado), []).append(d)

    nombres = {"ciss": "CISS · Conferencia Interamericana de Seguridad Social",
               "ciess": "CIESS · Centro Interamericano de Estudios de Seguridad Social"}
    for lado in ("ciss", "ciess"):
        # A color: en el original, dos renglones del CIESS vienen en negro puro y el
        # resto del texto en verde; se unifica en verde, como en el logotipo CISS.
        color = svg(grupos[(0, lado)], lambda c: VERDE if c == "#000000" else c, nombres[lado])
        (DESTINO / f"{lado}-color.svg").write_text(color, encoding="utf-8")
        # Sobre fondo oscuro: texto en crema, símbolo dorado
        (DESTINO / f"{lado}-sobre-oscuro.svg").write_text(svg(grupos[(1, lado)], lambda c: c, nombres[lado]), encoding="utf-8")
        # Una tinta: crema (fondos oscuros) y gris (fondos claros)
        (DESTINO / f"{lado}-blanco.svg").write_text(svg(grupos[(2, lado)], lambda c: CREMA, nombres[lado]), encoding="utf-8")
        (DESTINO / f"{lado}-gris.svg").write_text(svg(grupos[(2, lado)], lambda c: GRIS, nombres[lado]), encoding="utf-8")
        print(lado, len(grupos[(0, lado)]), "trazos")


if __name__ == "__main__":
    main()
