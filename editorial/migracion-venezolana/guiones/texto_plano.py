"""Texto plano del DOCX (párrafos, celdas, notas, SmartArt, gráfico nativo) y numeración automática.

Uso: python guiones/texto_plano.py insumos/capitulo-2.docx analisis/
Ojo: el «número automático» de las listas de Word es aproximado; para verlo como Word,
renderiza el DOCX: soffice --headless --convert-to pdf insumos/capitulo-3.docx
Escribe: parrafos.txt (índice<TAB>estilo<TAB>número automático<TAB>texto), notas.txt,
smartart.txt, grafico_nativo.txt y tablas.txt.
"""
import re
import sys
import zipfile

from lxml import etree

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS = {"w": W[1:-1]}
ruta, salida = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(ruta)
doc = etree.fromstring(z.read("word/document.xml"))
est = etree.fromstring(z.read("word/styles.xml"))
nombres = {s.get(W + "styleId"): s.find("w:name", NS).get(W + "val")
           for s in est.findall("w:style", NS) if s.find("w:name", NS) is not None}
# numeración de estilos (heading con numPr en el estilo)
num_estilo = {}
for s in est.findall("w:style", NS):
    np_ = s.find("w:pPr/w:numPr", NS)
    if np_ is not None:
        nid = np_.find("w:numId", NS)
        lvl = np_.find("w:ilvl", NS)
        num_estilo[s.get(W + "styleId")] = (nid.get(W + "val") if nid is not None else None,
                                           int(lvl.get(W + "val")) if lvl is not None else 0)
numx = etree.fromstring(z.read("word/numbering.xml"))
abstract = {}
for a in numx.findall("w:abstractNum", NS):
    niveles = {}
    for lv in a.findall("w:lvl", NS):
        il = int(lv.get(W + "ilvl"))
        st = lv.find("w:start", NS)
        lt = lv.find("w:lvlText", NS)
        fmt = lv.find("w:numFmt", NS)
        niveles[il] = (int(st.get(W + "val")) if st is not None else 1,
                       lt.get(W + "val") if lt is not None else "",
                       fmt.get(W + "val") if fmt is not None else "decimal")
    abstract[a.get(W + "abstractNumId")] = niveles
nums = {}
overrides = {}
for n in numx.findall("w:num", NS):
    nid = n.get(W + "numId")
    nums[nid] = n.find("w:abstractNumId", NS).get(W + "val")
    for o in n.findall("w:lvlOverride", NS):
        so = o.find("w:startOverride", NS)
        if so is not None:
            overrides[(nid, int(o.get(W + "ilvl")))] = int(so.get(W + "val"))
contadores = {}


def numero(p):
    ppr = p.find("w:pPr", NS)
    nid, il = None, 0
    if ppr is not None:
        np_ = ppr.find("w:numPr", NS)
        ps = ppr.find("w:pStyle", NS)
        if np_ is not None:
            a = np_.find("w:numId", NS)
            b = np_.find("w:ilvl", NS)
            nid = a.get(W + "val") if a is not None else None
            il = int(b.get(W + "val")) if b is not None else 0
            if nid is None and ps is not None and ps.get(W + "val") in num_estilo:
                nid = num_estilo[ps.get(W + "val")][0]
        elif ps is not None and ps.get(W + "val") in num_estilo:
            nid, il = num_estilo[ps.get(W + "val")]
    if not nid or nid == "0" or nid not in nums:
        return ""
    absid = nums[nid]
    niveles = abstract.get(absid, {})
    c = contadores.setdefault(absid, {})
    inicio = overrides.get((nid, il), niveles.get(il, (1, "", ""))[0])
    c[il] = c.get(il, inicio - 1) + 1
    for k in list(c):
        if k > il:
            del c[k]
    plantilla = niveles.get(il, (1, "", ""))[1]
    def rep(m):
        k = int(m.group(1)) - 1
        return str(c.get(k, niveles.get(k, (1,))[0]))
    return re.sub(r"%(\d)", rep, plantilla)


def texto(el, notas=True):
    out = []
    for n in el.iter():
        if n.tag == W + "t":
            out.append(n.text or "")
        elif n.tag == W + "tab":
            out.append("\t")
        elif n.tag == W + "br":
            out.append(" ")
        elif n.tag == W + "footnoteReference" and notas:
            out.append(f"[^{n.get(W + 'id')}]")
    return "".join(out)


par, tablas = [], []
for i, el in enumerate(doc.find("w:body", NS)):
    if el.tag == W + "p":
        ps = el.find("w:pPr/w:pStyle", NS)
        st = nombres.get(ps.get(W + "val"), "") if ps is not None else ""
        par.append(f"{i}\t{st}\t{numero(el)}\t{texto(el)}")
    elif el.tag == W + "tbl":
        tablas.append(f"=== tabla en bloque {i}")
        for tr in el.findall("w:tr", NS):
            tablas.append(" | ".join(texto(tc).strip() for tc in tr.findall("w:tc", NS)))
        par.append(f"{i}\tTABLA\t\t[tabla]")
open(f"{salida}/parrafos.txt", "w", encoding="utf-8").write("\n".join(par))
open(f"{salida}/tablas.txt", "w", encoding="utf-8").write("\n".join(tablas))
fn = etree.fromstring(z.read("word/footnotes.xml"))
notas = [f"[^{n.get(W + 'id')}] {texto(n, False).strip()}" for n in fn.findall("w:footnote", NS)
         if n.get(W + "type") not in ("separator", "continuationSeparator", "continuationNotice")]
open(f"{salida}/notas.txt", "w", encoding="utf-8").write("\n".join(notas))
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
sa = []
for nombre in sorted(n for n in z.namelist() if n.startswith("word/diagrams/data")):
    d = etree.fromstring(z.read(nombre))
    sa.append(f"=== {nombre}")
    for pt in d.iter("{http://schemas.openxmlformats.org/drawingml/2006/diagram}pt"):
        t = "".join(x.text or "" for x in pt.iter(A + "t")).strip()
        if t:
            sa.append(f"[{pt.get('type', 'node')}] {t}")
open(f"{salida}/smartart.txt", "w", encoding="utf-8").write("\n".join(sa))
C = "{http://schemas.openxmlformats.org/drawingml/2006/chart}"
gr = []
for nombre in sorted(n for n in z.namelist() if n.startswith("word/charts/chart")):
    d = etree.fromstring(z.read(nombre))
    gr.append(f"=== {nombre}")
    for ser in d.iter(C + "ser"):
        nom = "".join(x.text or "" for x in ser.find(C + "tx").iter(C + "v")) if ser.find(C + "tx") is not None else ""
        cats = [x.text for x in ser.find(C + "cat").iter(C + "v")] if ser.find(C + "cat") is not None else []
        vals = [x.text for x in ser.find(C + "val").iter(C + "v")] if ser.find(C + "val") is not None else []
        gr.append(f"serie: {nom}")
        for c, v in zip(cats, vals):
            gr.append(f"  {c}\t{v}")
    for tipo in ("barChart", "lineChart", "pieChart"):
        for b in d.iter(C + tipo):
            bd = b.find(C + "barDir")
            gr.append(f"tipo: {tipo} {bd.get('val') if bd is not None else ''}")
open(f"{salida}/grafico_nativo.txt", "w", encoding="utf-8").write("\n".join(gr))
print(len(par), "párrafos;", len(notas), "notas")
