"""Convierte el manuscrito DOCX de un capítulo en HTML semántico para la maquetación.

Uso:
    python guiones/extraer_docx.py insumos/Cap1_Características.docx contenido/capitulo-1.base.html

El resultado es un punto de partida: títulos (h2/h3), párrafos con cursivas,
negritas y notas al pie en línea (<span class="nota">), marcadores de figura
(<!-- FIGURA: ... -->) y bibliografía. La versión maquetada definitiva se
edita a mano en contenido/capitulo-1.html (orden de figuras, ajustes finos).
"""
import html
import re
import sys

from lxml import etree

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS = {"w": W[1:-1]}

def limpiar(texto: str) -> str:
    """Solo normaliza espacios (espacio duro y espacios repetidos).

    El texto es de una investigación oficial: no se corrige ortografía, puntuación,
    mayúsculas ni formato de cifras. Lo que haya que corregir se anota en
    OBSERVACIONES.md para autoría y corrección de estilo.
    """
    t = texto.replace("\u00a0", " ")
    return re.sub(r"[ \t]{2,}", " ", t)


def texto_run(r) -> str:
    out = []
    for c in r:
        if c.tag == W + "t":
            out.append(c.text or "")
        elif c.tag == W + "tab":
            out.append(" ")
        elif c.tag == W + "br":
            out.append(" ")
    return "".join(out)


def prop(rpr, nombre):
    if rpr is None:
        return False
    e = rpr.find("w:" + nombre, NS)
    return e is not None and e.get(W + "val") not in ("0", "false")


def notas_al_pie(ruta_docx_dir):
    arbol = etree.parse(f"{ruta_docx_dir}/word/footnotes.xml").getroot()
    notas = {}
    for f in arbol.findall("w:footnote", NS):
        fid = f.get(W + "id")
        partes = []
        for p in f.findall(".//w:p", NS):
            partes.append(parrafo_html(p, {}))
        notas[fid] = limpiar(" ".join(partes).strip())
    return notas


def parrafo_html(p, notas) -> str:
    trozos = []
    for r in p.iter(W + "r"):
        rpr = r.find("w:rPr", NS)
        ref = r.find("w:footnoteReference", NS)
        if ref is not None:
            fid = ref.get(W + "id")
            trozos.append(("nota", notas.get(fid, "")))
            continue
        t = texto_run(r)
        if not t:
            continue
        estilo = ("i" if prop(rpr, "i") else "") + ("b" if prop(rpr, "b") else "")
        trozos.append((estilo, t))
    # Fusionar trozos contiguos con el mismo estilo
    fusion = []
    for est, t in trozos:
        if fusion and fusion[-1][0] == est and est != "nota":
            fusion[-1] = (est, fusion[-1][1] + t)
        else:
            fusion.append((est, t))
    salida = []
    for est, t in fusion:
        if est == "nota":
            salida.append(f'<span class="nota">{t}</span>')
            continue
        e = html.escape(t, quote=False)
        if "i" in est and e.strip():
            e = f"<em>{e}</em>"
        salida.append(e)
    return "".join(salida)


def main(docx, destino):
    import tempfile
    import zipfile

    tmp = tempfile.mkdtemp()
    zipfile.ZipFile(docx).extractall(tmp)
    notas = notas_al_pie(tmp)
    cuerpo = etree.parse(f"{tmp}/word/document.xml").getroot().find("w:body", NS)

    lineas = []
    for hijo in cuerpo:
        if hijo.tag == W + "tbl":
            lineas.append("<!-- TABLA/FIGURA EN TABLA DEL DOCX -->")
            continue
        if hijo.tag != W + "p":
            continue
        texto_plano = "".join(texto_run(r) for r in hijo.iter(W + "r")).strip()
        tiene_imagen = bool(hijo.findall(".//{*}blip")) or bool(hijo.findall(".//{*}chart"))
        if tiene_imagen:
            lineas.append("<!-- IMAGEN DEL DOCX -->")
        if not texto_plano:
            continue
        contenido = limpiar(parrafo_html(hijo, notas)).strip()
        plano = limpiar(texto_plano)
        if re.match(r"^(Mapa|Gráfica|Diagrama|Cuadro) \d+\.", plano):
            lineas.append(f"<!-- FIGURA: {html.escape(plano)} -->")
        elif re.match(r"^(Fuente|Nota|\*Nota)", plano):
            lineas.append(f'<p class="fuente">{contenido}</p>')
        elif re.match(r"^1\.\d+\. ", plano):
            lineas.append(f"<h2>{html.escape(plano)}</h2>")
        elif re.match(r"^1\.- ", plano):
            lineas.append(f"<h1>{html.escape(plano[4:])}</h1>")
        elif plano in ("Posición en el trabajo", "Rama de actividad económica",
                       "Inserción en el sector informal", "Ingresos por trabajo",
                       "Bibliografía"):
            lineas.append(f"<h3>{contenido}</h3>")
        else:
            lineas.append(f"<p>{contenido}</p>")
    with open(destino, "w", encoding="utf-8") as f:
        f.write("\n".join(lineas) + "\n")
    print(f"{len(lineas)} bloques -> {destino}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
