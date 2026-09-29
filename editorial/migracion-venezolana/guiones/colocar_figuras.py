"""Colocación de figuras sin huecos (emula las «flotantes» de la formación manual).

WeasyPrint no mueve figuras: si una no cabe al final de la página, salta a la
siguiente y deja un hueco. Este guion detecta esos huecos y adelanta el texto
que sigue a la figura (la figura pasa detrás del párrafo siguiente), sin cruzar
títulos de sección, y repite hasta que no queden huecos o no haya arreglo.

Uso: python guiones/colocar_figuras.py contenido/10-capitulo-1.html [hueco_max_pt] [--seguras]
El archivo se reescribe con el nuevo orden de bloques.
"""
import pathlib
import re
import sys

import pymupdf
import weasyprint

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import construir  # noqa: E402

RAIZ = construir.RAIZ
SOLO_SEGURAS = "--seguras" in sys.argv  # solo reglas 1 y 2 (no cruza títulos)
ARCHIVO = None
HUECO_MAX = 42
BASE_CAJA = 595.28 - 45 - 2  # base de la caja de texto (margen inferior 45 pt)
MAX_DESPLAZAMIENTO = 4  # bloques que una figura puede alejarse de su posición original


def serie(fid):
    s, n = fid.rsplit("-", 1)
    return s, int(n)


def bloques(texto):
    """Divide el capítulo en bloques de primer nivel (uno o varios renglones)."""
    lineas = texto.split("\n")
    salida, i = [], 0
    while i < len(lineas):
        l = lineas[i]
        for inicio, fin in (("<figure", "</figure>"), ("<header", "</header>"),
                            ('<section class="bibliografia"', None)):
            if l.startswith(inicio):
                if fin is None:  # la bibliografía llega hasta el cierre del capítulo
                    j = len(lineas) - 1
                    while not lineas[j].startswith("</section>"):
                        j -= 1
                    j -= 1
                    while not lineas[j].startswith("</section>"):
                        j -= 1
                else:
                    j = i
                    while not lineas[j].startswith(fin):
                        j += 1
                salida.append("\n".join(lineas[i:j + 1]))
                i = j + 1
                break
        else:
            salida.append(l)
            i += 1
    return salida


def tipo(b):
    if b.startswith("<figure"):
        return "figura"
    if b.startswith("<p"):
        return "parrafo"
    if b.startswith(("<h2", "<h3")):
        return "titulo"
    return "otro"


def render(texto):
    ARCHIVO.write_text(texto, encoding="utf-8")
    html = construir.ensamblar(construir.PIEZAS)
    destino = construir.SALIDA / "_colocacion.html"
    destino.write_text(html, encoding="utf-8")
    doc = weasyprint.HTML(filename=str(destino), base_url=str(construir.SALIDA)).render()
    anclas = {}
    for n, pagina in enumerate(doc.pages):
        for ident in pagina.anchors:
            anclas.setdefault(ident, n)
    pdf = pymupdf.open(stream=doc.write_pdf(), filetype="pdf")
    return anclas, pdf


def tope_notas(pagina):
    """Borde superior del bloque de notas al pie (o None si no hay)."""
    tope = None
    for b in pagina.get_text("dict")["blocks"]:
        if b.get("type") != 0 or not b["lines"] or not b["lines"][0]["spans"]:
            continue
        tams = [s["size"] for l in b["lines"] for s in l["spans"] if s["text"].strip()]
        fuente = b["lines"][0]["spans"][0]["font"]
        if b["bbox"][0] > 54 and tams and max(tams) <= 8.2 and "Crimson" in fuente and b["bbox"][1] > 150:
            tope = b["bbox"][1] if tope is None else min(tope, b["bbox"][1])
    return tope


def fondo(pagina):
    """Base del contenido principal de la página (sin cornisa ni notas al pie)."""
    notas = tope_notas(pagina)
    limite = (notas - 4) if notas else 560
    ys = []
    for b in pagina.get_text("dict")["blocks"]:
        if b.get("type") != 0 or b["bbox"][1] < 45 or b["bbox"][1] >= limite:
            continue
        ys.append(b["bbox"][3])
    for d in pagina.get_drawings():
        r = d["rect"]
        if r.y0 > 45 and r.y0 < limite and r.height < 500 and not (r.width < 2 and r.x0 < 46):
            ys.append(r.y1)
    return max(ys) if ys else 0


def main():
    global ARCHIVO, HUECO_MAX
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    ARCHIVO = RAIZ / args[0]
    HUECO_MAX = float(args[1]) if len(args) > 1 else 42
    texto = ARCHIVO.read_text(encoding="utf-8")
    cab, _, resto = texto.partition("\n")
    bs = bloques(resto)
    original = {re.search(r'id="([^"]+)"', b).group(1): i for i, b in enumerate(bs) if tipo(b) == "figura"}
    movidas = {k: 0 for k in original}
    probados = set()
    intentos = 0
    while intentos < 60:
        intentos += 1
        anclas, pdf = render(cab + "\n" + "\n".join(bs))
        arreglo = False
        for i, b in enumerate(bs):
            if tipo(b) != "figura":
                continue
            fid = re.search(r'id="([^"]+)"', b).group(1)
            pag = anclas.get(fid)
            if pag is None or pag == 0:
                continue
            hueco = BASE_CAJA - fondo(pdf[pag - 1])
            if hueco <= HUECO_MAX:
                continue
            if i + 1 >= len(bs) or movidas[fid] >= MAX_DESPLAZAMIENTO:
                continue
            siguiente = bs[i + 1]
            # 1) adelantar el párrafo siguiente para llenar la página anterior
            if tipo(siguiente) == "parrafo":
                bs[i], bs[i + 1] = siguiente, b
                movidas[fid] += 1
                print(f"  {fid}: hueco de {hueco:.0f} pt en p. {pag} → se adelanta un párrafo")
                arreglo = True
                break
            if tipo(siguiente) != "figura":
                continue
            # 2) adelantar la figura siguiente si es de otra serie (se conserva la
            #    numeración de cada serie) y ese cambio no se probó antes
            otra = re.search(r'id="([^"]+)"', siguiente).group(1)
            if serie(otra)[0] != serie(fid)[0] and (otra, fid) not in probados:
                probados.add((fid, otra))
                bs[i], bs[i + 1] = siguiente, b
                movidas[fid] += 1
                print(f"  {fid}: hueco de {hueco:.0f} pt en p. {pag} → se adelanta {otra}")
                arreglo = True
                break
            if SOLO_SEGURAS:
                continue
            # 3) ninguna figura cabe: adelantar el párrafo que sigue al grupo de figuras
            j = i + 1
            while j < len(bs) and tipo(bs[j]) == "figura":
                j += 1
            if j < len(bs) and tipo(bs[j]) == "parrafo":
                parrafo = bs.pop(j)
                bs.insert(i, parrafo)
                for k in range(i + 1, j + 1):
                    movidas[re.search(r'id="([^"]+)"', bs[k]).group(1)] += 1
                print(f"  {fid}: hueco de {hueco:.0f} pt en p. {pag} → se adelanta el párrafo tras el grupo")
                arreglo = True
                break
            # 4) tras el grupo empieza otra sección: adelantar título + primer párrafo
            if j + 1 < len(bs) and tipo(bs[j]) == "titulo" and tipo(bs[j + 1]) == "parrafo":
                titulo, parrafo = bs.pop(j), bs.pop(j)
                bs[i:i] = [titulo, parrafo]
                for k in range(i + 2, j + 2):
                    movidas[re.search(r'id="([^"]+)"', bs[k]).group(1)] += 2
                print(f"  {fid}: hueco de {hueco:.0f} pt en p. {pag} → se adelanta el inicio de la sección siguiente")
                arreglo = True
                break
        if not arreglo:
            break
    ARCHIVO.write_text(cab + "\n" + "\n".join(bs), encoding="utf-8")
    print(f"listo tras {intentos} composiciones")


if __name__ == "__main__":
    main()
