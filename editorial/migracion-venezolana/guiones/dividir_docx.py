"""Divide un manuscrito DOCX con varios capítulos en un DOCX por capítulo.

Cada capítulo empieza en el párrafo cuyo texto es exactamente «Capítulo N»
(con o sin estilo de Word). Lo anterior al primero (título, «Índice»,
«Presentación»…) va a capitulo-0.docx. Cada archivo conserva estilos,
numeración, imágenes, gráficos y SmartArt del original; solo cambian el cuerpo
(los bloques del capítulo y la sección final) y las notas al pie (solo las
que se llaman desde ese capítulo). El texto no se toca.

Así guiones/capitulo_docx.py y guiones/auditar_texto.py trabajan capítulo a
capítulo sin cambios.

Uso: python guiones/dividir_docx.py "insumos/Capitulos 1-3.docx" insumos/
     -> insumos/capitulo-0.docx … capitulo-3.docx
"""
import argparse
import pathlib
import re
import zipfile

from lxml import etree

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS = {"w": W[1:-1]}
ESPECIALES = ("separator", "continuationSeparator", "continuationNotice")


def texto(el):
    return "".join(t.text or "" for t in el.iter(W + "t"))


def tramos(cuerpo):
    """{capítulo: [índices de bloques]}; «0» = antes del primer capítulo."""
    hijos = list(cuerpo)
    out, actual = {}, "0"
    for i, h in enumerate(hijos):
        if h.tag == W + "sectPr":
            continue
        if h.tag == W + "p":
            m = re.fullmatch(r"\s*Capítulo\s+(\d+)\s*", texto(h))
            if m:
                actual = m.group(1)
        out.setdefault(actual, []).append(i)
    return out


def escribir(origen, destino, documento, notas):
    with zipfile.ZipFile(origen) as zin, zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename == "word/document.xml":
                zout.writestr(item, documento)
            elif item.filename == "word/footnotes.xml" and notas is not None:
                zout.writestr(item, notas)
            else:
                zout.writestr(item, zin.read(item.filename))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("docx")
    ap.add_argument("carpeta")
    ap.add_argument("--prefijo", default="capitulo-")
    a = ap.parse_args()
    carpeta = pathlib.Path(a.carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(a.docx) as z:
        doc_xml = z.read("word/document.xml")
        notas_xml = z.read("word/footnotes.xml") if "word/footnotes.xml" in z.namelist() else None

    cuerpo0 = etree.fromstring(doc_xml).find("w:body", NS)
    for cap, indices in tramos(cuerpo0).items():
        raiz = etree.fromstring(doc_xml)
        cuerpo = raiz.find("w:body", NS)
        hijos = list(cuerpo)
        conservar = set(indices)
        for i, h in enumerate(hijos):
            if h.tag != W + "sectPr" and i not in conservar:
                cuerpo.remove(h)
        ids = {r.get(W + "id") for r in cuerpo.iter(W + "footnoteReference")}
        notas = None
        if notas_xml is not None:
            fn = etree.fromstring(notas_xml)
            for f in fn.findall("w:footnote", NS):
                if f.get(W + "type") not in ESPECIALES and f.get(W + "id") not in ids:
                    fn.remove(f)
            notas = etree.tostring(fn, xml_declaration=True, encoding="UTF-8", standalone=True)
        destino = carpeta / f"{a.prefijo}{cap}.docx"
        escribir(a.docx, destino,
                 etree.tostring(raiz, xml_declaration=True, encoding="UTF-8", standalone=True), notas)
        parrafos = sum(1 for h in cuerpo if h.tag == W + "p" and texto(h).strip())
        tablas = sum(1 for h in cuerpo if h.tag == W + "tbl")
        print(f"capítulo {cap}: {parrafos} párrafos con texto, {tablas} tablas, {len(ids)} notas -> {destino}")


if __name__ == "__main__":
    main()
