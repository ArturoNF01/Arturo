"""Vuelca la estructura de un DOCX: estilos, títulos, figuras, tablas, notas, gráficos nativos.

Uso: python guiones/estructura_docx.py insumos/capitulo-2.docx analisis/estructura.txt
"""
import re
import sys
import zipfile

from lxml import etree

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS = {"w": W[1:-1]}
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

ruta, destino = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(ruta)
doc = etree.fromstring(z.read("word/document.xml"))
estilos = etree.fromstring(z.read("word/styles.xml"))
mapa = {s.get(W + "styleId"): (s.find("w:name", NS).get(W + "val") if s.find("w:name", NS) is not None else "")
        for s in estilos.findall("w:style", NS)}
rels = etree.fromstring(z.read("word/_rels/document.xml.rels"))
relmap = {r.get("Id"): r.get("Target") for r in rels}


def texto(el, notas=True):
    out = []
    for n in el.iter():
        if n.tag == W + "t":
            out.append(n.text or "")
        elif n.tag in (W + "tab",):
            out.append("\t")
        elif n.tag == W + "br":
            out.append(" ")
        elif n.tag == W + "footnoteReference" and notas:
            out.append(f"[^{n.get(W + 'id')}]")
        elif n.tag == W + "endnoteReference" and notas:
            out.append(f"[^e{n.get(W + 'id')}]")
    return "".join(out)


lineas = []
cuerpo = doc.find("w:body", NS)
k = 0
for hijo in cuerpo:
    tag = hijo.tag.split("}")[1]
    if tag == "p":
        ps = hijo.find("w:pPr/w:pStyle", NS)
        est = mapa.get(ps.get(W + "val"), ps.get(W + "val")) if ps is not None else ""
        num = hijo.find("w:pPr/w:numPr", NS) is not None
        ind = hijo.find("w:pPr/w:ind", NS)
        izq = (ind.get(W + "left") or ind.get(W + "start") or "") if ind is not None else ""
        t = texto(hijo)
        extras = []
        for b in hijo.iter("{http://schemas.openxmlformats.org/drawingml/2006/main}blip"):
            extras.append("IMG:" + relmap.get(b.get(R + "embed"), "?"))
        for c in hijo.iter("{http://schemas.openxmlformats.org/drawingml/2006/chart}chart"):
            extras.append("CHART:" + relmap.get(c.get(R + "id"), "?"))
        for d in hijo.iter("{http://schemas.openxmlformats.org/drawingml/2006/diagram}relIds"):
            extras.append("SMARTART:" + relmap.get(d.get(R + "dm"), "?"))
        if t.strip() or extras or num:
            lineas.append(f"{k:4d} P [{est}]{' NUM' if num else ''}{' ind=' + izq if izq else ''} {' '.join(extras)} | {t.strip()}")
    elif tag == "tbl":
        filas = hijo.findall("w:tr", NS)
        ncol = max((len(f.findall("w:tc", NS)) for f in filas), default=0)
        cab = [texto(tc).strip()[:30] for tc in filas[0].findall("w:tc", NS)] if filas else []
        imgs = [relmap.get(b.get(R + "embed"), "?") for b in hijo.iter("{http://schemas.openxmlformats.org/drawingml/2006/main}blip")]
        lineas.append(f"{k:4d} TABLA {len(filas)}x{ncol} {'IMGS:' + ','.join(imgs) if imgs else ''} | {' | '.join(cab)}")
        for f in filas[1:4]:
            lineas.append("          · " + " | ".join(texto(tc).strip()[:30] for tc in f.findall("w:tc", NS)))
    elif tag == "sectPr":
        pg = hijo.find("w:pgSz", NS)
        lineas.append(f"{k:4d} SECCIÓN {pg.get(W + 'w') if pg is not None else ''}x{pg.get(W + 'h') if pg is not None else ''}")
    k += 1

# Notas al pie
fn = etree.fromstring(z.read("word/footnotes.xml"))
notas = [(n.get(W + "id"), texto(n, False).strip()) for n in fn.findall("w:footnote", NS)
         if n.get(W + "type") not in ("separator", "continuationSeparator", "continuationNotice")]
lineas.append(f"\n=== NOTAS AL PIE ({len(notas)})")
for i, t in notas:
    lineas.append(f"[^{i}] {t}")
try:
    en = etree.fromstring(z.read("word/endnotes.xml"))
    ens = [(n.get(W + "id"), texto(n, False).strip()) for n in en.findall("w:endnote", NS)
           if n.get(W + "type") not in ("separator", "continuationSeparator", "continuationNotice") and texto(n, False).strip()]
    lineas.append(f"\n=== NOTAS FINALES ({len(ens)})")
    for i, t in ens:
        lineas.append(f"[^e{i}] {t}")
except KeyError:
    pass
open(destino, "w", encoding="utf-8").write("\n".join(lineas))
print(len(lineas), "líneas")
