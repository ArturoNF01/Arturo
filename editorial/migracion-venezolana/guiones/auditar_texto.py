"""Audita que el texto maquetado sea idéntico al del manuscrito (nada omitido ni cambiado).

Compara, con espacios normalizados:
  1. Párrafos del cuerpo del DOCX  contra  párrafos del HTML del capítulo
     (las figuras se apartan y los párrafos partidos corte/continua se unen).
  2. Notas al pie del DOCX  contra  <span class="nota"> del HTML, en orden.
  3. Celdas de las tablas del DOCX  contra  celdas de los cuadros del HTML.
  4. Palabras del HTML  contra  palabras del PDF compuesto (texto perdido al componer).

Uso: python guiones/auditar_texto.py insumos/Cap3.docx contenido/30-capitulo-3.html \\
         [salida/interiores.pdf PRIMERA ULTIMA]
"""
import collections
import difflib
import html as htmlmod
import json
import pathlib
import re
import sys
import tempfile
import zipfile

from lxml import etree
from lxml import html as lhtml

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS = {"w": W[1:-1]}
ESPACIOS = "     \t\n\r"


def norm(t):
    t = htmlmod.unescape(t).replace("​", "").replace("­", "")
    for e in ESPACIOS:
        t = t.replace(e, " ")
    return re.sub(r" +", " ", t).strip()


def texto_docx(el, con_notas=False):
    partes = []
    for n in el.iter():
        if n.tag == W + "t":
            partes.append(n.text or "")
        elif n.tag in (W + "tab", W + "br"):
            partes.append(" ")
        elif n.tag == W + "footnoteReference" and con_notas:
            partes.append("[^]")
    return norm("".join(partes))


def leer_docx(ruta):
    tmp = tempfile.mkdtemp()
    zipfile.ZipFile(ruta).extractall(tmp)
    cuerpo = etree.parse(f"{tmp}/word/document.xml").getroot().find("w:body", NS)
    parrafos, celdas = [], []
    for hijo in cuerpo:
        if hijo.tag == W + "p":
            t = texto_docx(hijo)
            if t:
                parrafos.append(t)
        elif hijo.tag == W + "tbl":
            for tc in hijo.iter(W + "tc"):
                t = texto_docx(tc)
                if t:
                    celdas.append(t)
    notas = []
    raiz = etree.parse(f"{tmp}/word/footnotes.xml").getroot()
    for f in raiz.findall("w:footnote", NS):
        if f.get(W + "type") in ("separator", "continuationSeparator", "continuationNotice"):
            continue
        t = texto_docx(f)
        if t:
            notas.append(t)
    return parrafos, notas, celdas


def leer_html(ruta):
    fuente = open(ruta, encoding="utf-8").read()
    raiz = pathlib.Path(__file__).resolve().parent.parent
    fuente = re.sub(r'<div data-incluir="([^"]+)"></div>',
                    lambda m: (raiz / m.group(1)).read_text(encoding="utf-8"), fuente)
    doc = lhtml.fromstring(fuente)
    notas = [norm(n.text_content()) for n in doc.iter("span") if "nota" in (n.get("class") or "").split()]
    # quitar las notas del texto (en el DOCX van aparte); drop_tree conserva la cola
    for n in [n for n in doc.iter("span") if "nota" in (n.get("class") or "").split()]:
        n.drop_tree()
    celdas = [norm(c.text_content()) for c in doc.iter("td", "th") if norm(c.text_content())]
    figuras = []
    for fig in list(doc.iter("figure")):
        for p in fig.iter("p"):
            figuras.append(norm(p.text_content()))
        fig.drop_tree()
    bloques = []
    for el in doc.iter("h1", "h2", "h3", "p", "blockquote", "span"):
        clase = el.get("class") or ""
        if el.tag == "span" and "etiqueta" not in clase:
            continue
        if el.tag == "p" and el.getparent() is not None and el.getparent().tag == "blockquote":
            continue
        if el.tag == "blockquote":  # cita y atribución son dos párrafos
            t = norm(" ".join(p.text_content() for p in el.iter("p")))
        else:
            t = norm(el.text_content())
        if not t:
            continue
        if "continua" in clase and bloques:
            bloques[-1] = norm(bloques[-1] + " " + t)  # párrafo partido por una figura
        else:
            bloques.append(t)
    return bloques, notas, figuras, celdas


def diferencias(a, b):
    """Diferencias palabra a palabra entre dos textos."""
    pa, pb = a.split(" "), b.split(" ")
    sm = difflib.SequenceMatcher(a=pa, b=pb, autojunk=False)
    out = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op != "equal":
            ctx = " ".join(pa[max(0, i1 - 4):i1])
            out.append(f"{op}: «{' '.join(pa[i1:i2])}» → «{' '.join(pb[j1:j2])}»   (tras: …{ctx})")
    return out


def emparejar(origen, destino, nombre):
    """Busca cada unidad del origen en el destino; informa faltantes y cambios."""
    usados = set()
    problemas = 0
    for t in origen:
        libres = [j for j, d in enumerate(destino) if d == t and j not in usados]
        if libres:
            usados.add(libres[0])
            continue
        # mejor candidato
        mejor, k = 0, -1
        for j, d in enumerate(destino):
            if j in usados:
                continue
            r = difflib.SequenceMatcher(a=t, b=d, autojunk=False).quick_ratio()
            if r > mejor:
                mejor, k = r, j
        if mejor > 0.6:
            r = difflib.SequenceMatcher(a=t, b=destino[k], autojunk=False).ratio()
        if k >= 0 and mejor > 0.6 and r > 0.6:
            usados.add(k)
            dif = diferencias(t, destino[k])
            if dif:
                problemas += 1
                print(f"  [{nombre}] CAMBIO en «{t[:70]}…»")
                for d in dif:
                    print("      ", d)
        else:
            problemas += 1
            print(f"  [{nombre}] FALTA: «{t[:160]}»")
    sobrantes = [d for j, d in enumerate(destino) if j not in usados]
    return problemas, sobrantes


def palabras(t):
    return re.findall(r"[\wÁÉÍÓÚÜÑáéíóúüñ]+", t.lower())


def comparar_pdf(html_txt, pdf, primera, ultima):
    import pymupdf
    d = pymupdf.open(pdf)
    lineas = []
    for i in range(primera - 1, ultima):
        for b in d[i].get_text("dict")["blocks"]:
            for ln in b.get("lines", []):
                if ln["bbox"][1] < 60:  # cornisa y folio
                    continue
                lineas.append("".join(s["text"] for s in ln["spans"]))
    texto = ""
    for ln in lineas:
        ln = ln.strip()
        if texto.endswith("-") and ln[:1].islower():
            texto = texto[:-1] + ln  # división silábica
        else:
            texto += " " + ln
    texto = norm(texto)
    # llamadas de nota pegadas a la palabra («Barranquilla8.») y palabras partidas
    # entre páginas o antes de las notas («in-» … «terpretación»)
    sin_llamadas = re.sub(r"(?<=[^\W\d_])\d+", "", texto)
    a = collections.Counter(palabras(html_txt))
    b = collections.Counter(palabras(sin_llamadas))
    b.update(palabras(texto))
    trozos = set(palabras(texto.replace("-", " ")))
    faltan = {}
    for w, n in a.items():
        if n <= b[w]:
            continue
        partida = any(w[:k] in trozos and w[k:] in trozos for k in range(2, len(w) - 1))
        if not partida:
            faltan[w] = n - b[w]
    return faltan


def cambios_aprobados(docx):
    """Cambios al manuscrito aprobados por la institución (datos/cambios-aprobados.json)."""
    ruta = pathlib.Path(__file__).resolve().parent.parent / "datos" / "cambios-aprobados.json"
    if not ruta.exists():
        return [], []
    todos = json.loads(ruta.read_text(encoding="utf-8"))["cambios"]
    mios = [c for c in todos if c["docx"] == pathlib.Path(docx).name]
    return [c for c in mios if "original" in c], [norm(c["añadido"]) for c in mios if "añadido" in c]


def aplicar(unidades, cambios, usados):
    salida = []
    for u in unidades:
        for k, c in enumerate(cambios):
            if c.get("exacto"):
                if u == c["original"]:
                    u = c["nuevo"]; usados.add(k)
            elif c["original"] in u:
                u = u.replace(c["original"], c["nuevo"]); usados.add(k)
        salida.append(u)
    return salida


def main():
    docx, html_ruta = sys.argv[1], sys.argv[2]
    p_docx, n_docx, c_docx = leer_docx(docx)
    cambios, anadidos = cambios_aprobados(docx)
    usados = set()
    p_docx, n_docx, c_docx = (aplicar(x, cambios, usados) for x in (p_docx, n_docx, c_docx))
    if cambios or anadidos:
        print(f"Cambios aprobados aplicados al manuscrito: {len(usados)} de {len(cambios)}; añadidos: {len(anadidos)}")
        for k, c in enumerate(cambios):
            if k not in usados:
                print(f"  ¡No se encontró en el manuscrito!: «{c['original'][:80]}»")
    bloques, n_html, figuras, c_html = leer_html(html_ruta)
    destino = bloques + figuras
    print(f"DOCX: {len(p_docx)} párrafos, {len(n_docx)} notas, {len(c_docx)} celdas")
    print(f"HTML: {len(bloques)} bloques + {len(figuras)} líneas de figura, {len(n_html)} notas, {len(c_html)} celdas")
    print("\n== Párrafos, títulos, pies y referencias")
    prob, sobrantes = emparejar(p_docx, destino, "texto")
    sobrantes = [s for s in sobrantes if s not in anadidos]
    print(f"  {prob} diferencias")
    if sobrantes:
        print("  Texto en el HTML que no está en el DOCX:")
        for s in sobrantes:
            print("     +", s[:160])
    print("\n== Notas al pie")
    if len(n_docx) != len(n_html):
        print(f"  NÚMERO DISTINTO: DOCX {len(n_docx)} / HTML {len(n_html)}")
    for k, (a, b) in enumerate(zip(n_docx, n_html), 1):
        dif = diferencias(a, b)
        if dif:
            print(f"  nota {k}:")
            for d in dif:
                print("      ", d)
    print("\n== Celdas de tablas del DOCX")
    figuras = leer_html(html_ruta)[2]
    # las fuentes que en el DOCX van dentro de la tabla, en el libro van al pie
    faltan = [c for c in c_docx if c not in c_html and c not in figuras]
    print(f"  {len(c_docx) - len(faltan)}/{len(c_docx)} celdas idénticas")
    for c in faltan[:40]:
        print("     ≠", c[:120])
    if len(sys.argv) > 5:
        print("\n== Texto perdido al componer el PDF")
        todo = " ".join(bloques + figuras + n_html + c_html)
        faltan = comparar_pdf(todo, sys.argv[3], int(sys.argv[4]), int(sys.argv[5]))
        print(f"  {sum(faltan.values())} palabras del HTML no aparecen en el PDF")
        for w, n in sorted(faltan.items())[:60]:
            print(f"     {w} ×{n}")


if __name__ == "__main__":
    main()
