"""Convierte un capítulo en DOCX con estilos de Word en el HTML maquetado del libro.

Para manuscritos que usan los estilos de Word (Título, Título 1, Título 2):
  Título            -> apertura del capítulo (etiqueta «Capítulo N» + h1)
  Título 1 numerado -> h2 «N.k. …» con id sN-k (entra al índice)
  Título 1 «Referencias»/«Bibliografía» -> sección de bibliografía
  Título 2          -> h3 sin numerar (como en el capítulo 1)
  Párrafo sangrado que empieza con comillas -> testimonio con su atribución
  «Tabla N. …» + tabla + «Fuente: …» -> figura con cuadro de texto
Las notas al pie quedan en línea (<span class="nota">) y la llamada se une a la
palabra anterior para que no quede sola en una línea.

Uso:
  python guiones/capitulo_docx.py 3 insumos/Cap3.docx contenido/30-capitulo-3.html \\
      --cornisa "Experiencias y perspectivas de la población|migrante venezolana en Colombia"
(«|» parte la cornisa en dos líneas)
"""
import argparse
import html
import re
import tempfile
import zipfile

from lxml import etree

from extraer_docx import NS, W, limpiar, notas_al_pie, parrafo_html, texto_run

ZWSP = "​"


def estilos(tmp):
    """styleId -> nombre del estilo (los ids cambian con el idioma de Word)."""
    raiz = etree.parse(f"{tmp}/word/styles.xml").getroot()
    return {s.get(W + "styleId"): s.find("w:name", NS).get(W + "val")
            for s in raiz.findall("w:style", NS) if s.find("w:name", NS) is not None}


def estilo_de(p, mapa):
    e = p.find("w:pPr/w:pStyle", NS)
    return mapa.get(e.get(W + "val"), "") if e is not None else ""


def sangria_izquierda(p):
    ind = p.find("w:pPr/w:ind", NS)
    if ind is None:
        return 0
    return int(ind.get(W + "left") or ind.get(W + "start") or 0)


def unir_llamadas(t):
    """Une cada nota con la palabra anterior: <span class="llamada">palabra<nota/></span>."""
    return re.sub(r'([^\s<>]+)(<span class="nota">.*?</span>)',
                  r'<span class="llamada">\1\2</span>', t)


def urls(t):
    """URL partibles: espacio de ancho cero tras / . - _ para cortar sin guion."""
    def corta(m):
        u = m.group(0)
        return '<span class="url">' + re.sub(r"([/._-])(?=.)", r"\1" + ZWSP, u) + "</span>"
    return re.sub(r"https?://[^\s<]+[^\s<.,;)]", corta, t)


def sin_numero(texto):
    return re.sub(r"^\d+(\.\d+)*\.?\s+", "", texto).strip()


def testimonio(contenido):
    """Separa cita y atribución («… ” — Mujer, GF Medellín»)."""
    plano = re.sub(r"</?em>", "", contenido)
    cita, _, quien = plano.rpartition("—")
    if not cita:
        return f'<blockquote class="testimonio"><p>{plano.strip()}</p></blockquote>'
    quien = re.sub(r"\s+", " ", quien).strip().rstrip(".")
    return (f'<blockquote class="testimonio"><p>{cita.strip()}</p>'
            f'<p class="atribucion">{quien}</p></blockquote>')


def celda(tc, notas):
    return " ".join(limpiar(parrafo_html(p, notas)).strip() for p in tc.findall("w:p", NS)).strip()


def tabla_html(tbl, notas):
    """Cuadro de texto: primera fila = encabezado; cada tema de la primera columna es un
    <tbody> que no se parte entre páginas (el encabezado se repite)."""
    filas = [[celda(tc, notas) for tc in tr.findall("w:tc", NS)] for tr in tbl.findall("w:tr", NS)]
    cab, cuerpo = filas[0], filas[1:]
    grupos = []
    for fila in cuerpo:
        if grupos and grupos[-1][0] == fila[0]:
            grupos[-1][1].append(fila[1:])
        else:
            grupos.append((fila[0], [fila[1:]]))
    out = ['<table class="cuadro texto"><colgroup><col style="width:27%"><col style="width:73%"></colgroup>',
           "<thead><tr>" + "".join(f"<th>{c}</th>" for c in cab) + "</tr></thead>"]
    for k, (tema, filas_tema) in enumerate(grupos):
        out.append('<tbody class="alt">' if k % 2 else "<tbody>")
        for j, resto in enumerate(filas_tema):
            out.append(f'<tr><td class="tema">{tema if j == 0 else ""}</td>'
                       + "".join(f"<td>{c}</td>" for c in resto) + "</tr>")
        out.append("</tbody>")
    out.append("</table>")
    return "".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("numero", type=int)
    ap.add_argument("docx")
    ap.add_argument("destino")
    ap.add_argument("--cornisa", help="título corto para la cornisa («|» = salto de línea)")
    a = ap.parse_args()
    n = a.numero

    tmp = tempfile.mkdtemp()
    zipfile.ZipFile(a.docx).extractall(tmp)
    mapa = estilos(tmp)
    notas = notas_al_pie(tmp)
    cuerpo = etree.parse(f"{tmp}/word/document.xml").getroot().find("w:body", NS)

    out, seccion, en_biblio, capitular_pendiente = [], 0, False, True
    figura = None  # figura de tabla abierta: lista de trozos
    for hijo in cuerpo:
        if hijo.tag == W + "tbl":
            if figura is not None:
                figura.append(tabla_html(hijo, notas))
            continue
        if hijo.tag != W + "p":
            continue
        plano = limpiar("".join(texto_run(r) for r in hijo.iter(W + "r")).strip())
        tiene_nota = hijo.find(".//w:footnoteReference", NS) is not None
        if not plano and not tiene_nota:
            continue
        estilo = estilo_de(hijo, mapa).lower()
        contenido = unir_llamadas(limpiar(parrafo_html(hijo, notas)).strip())

        if estilo == "title":
            titulo = html.escape(plano)
            cornisa = html.escape(a.cornisa or plano).replace("|", "&#10;")
            out.append(f'<section class="capitulo" id="capitulo-{n}">\n<header class="apertura">\n'
                       f'  <span class="etiqueta">Capítulo {n}</span>\n'
                       f'  <h1 id="cap-{n}" data-cornisa="{cornisa}">{titulo}</h1>\n</header>')
            continue
        if estilo == "heading 1":
            if plano.lower() in ("referencias", "bibliografía", "bibliografia"):
                en_biblio = True
                out.append(f'<section class="bibliografia">\n<h2 id="bibliografia-{n}">{html.escape(plano)}</h2>')
                continue
            seccion += 1
            out.append(f'<h2 id="s{n}-{seccion}">{n}.{seccion}. {html.escape(sin_numero(plano))}</h2>')
            continue
        if estilo == "heading 2":
            out.append(f"<h3>{html.escape(sin_numero(plano))}</h3>")
            continue
        if en_biblio:
            out.append(f'<p class="bib">{urls(contenido)}</p>')
            continue
        m = re.match(r"^(Tabla|Cuadro|Gráfica|Mapa|Diagrama) (\d+)\.\s*(.*)$", plano)
        if m:
            figura = [f'<figure id="{m.group(1).lower()}-{n}-{m.group(2)}" class="partible">',
                      f'  <p class="titulo"><b>{m.group(1)} {m.group(2)}.</b> {html.escape(m.group(3))}</p>']
            continue
        if figura is not None and re.match(r"^(Fuente|Nota)", plano):
            etiqueta, _, resto = re.sub(r"</?em>", "", contenido).partition(":")
            figura.append(f'  <p class="pie"><b>{etiqueta.strip()}:</b> {resto.strip()}</p>\n</figure>')
            out.append("\n".join(figura))
            figura = None
            continue
        if sangria_izquierda(hijo) > 0 and plano[:1] in "“\"«":
            out.append(testimonio(contenido))
            continue
        if capitular_pendiente:
            out.append(f'<p class="capitular">{urls(contenido)}</p>')
            capitular_pendiente = False
            continue
        out.append(f"<p>{urls(contenido)}</p>")

    if en_biblio:
        out.append("</section>")
    out.append("</section>")
    with open(a.destino, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"{seccion} secciones, {len(out)} bloques -> {a.destino}")


if __name__ == "__main__":
    main()
