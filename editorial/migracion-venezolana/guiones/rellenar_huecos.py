"""Rellena huecos al pie de página partiendo el párrafo que sigue a una figura.

Cuando una figura no cabe y salta a la página siguiente, queda un hueco. Como en
la formación manual, se adelantan las primeras líneas del párrafo que va después
de la figura: el párrafo se parte en dos (<p class="corte"> + <p class="continua">),
la última línea de la primera parte se justifica y la segunda parte continúa sin
sangría después de la figura. El texto no cambia.

Uso: python guiones/rellenar_huecos.py contenido/10-capitulo-1.html
"""
import html as htmlmod
import pathlib
import re
import sys

import pymupdf
import weasyprint

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import colocar_figuras as cf  # noqa: E402
import construir  # noqa: E402

INTERLINEA = 14.0
ETIQUETAS_EN_LINEA = ("em", "span", "b", "i", "strong")


def normal(t):
    t = t.replace(" ", " ").replace(" ", " ").replace(" ", " ").replace("​", "")
    return re.sub(r"\s+", " ", t).strip()


def texto_plano(fragmento):
    return normal(htmlmod.unescape(re.sub(r"<[^>]+>", "", fragmento)))


def lineas_de(parrafo_html, con_sangria):
    """Líneas del párrafo compuesto solo, con la misma caja y estilo que en el libro."""
    cuerpo = re.sub(r"^<p[^>]*>", '<p class="sin-sangria">' if not con_sangria else "<p>", parrafo_html)
    doc = f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="../plantilla/libro.css"></head><body>{cuerpo}</body></html>"""
    pdf = weasyprint.HTML(string=doc, base_url=str(construir.SALIDA) + "/").write_pdf()
    d = pymupdf.open(stream=pdf, filetype="pdf")
    lineas = []
    for pag in d:
        for b in pag.get_text("dict")["blocks"]:
            for ln in b.get("lines", []):
                t = "".join(s["text"] for s in ln["spans"])
                if t.strip() and ln["bbox"][1] > 45 and ln["spans"][0]["size"] > 10:
                    lineas.append(t)
    return lineas


def unir(lineas, plano):
    """Une líneas compuestas deshaciendo la división silábica (verificando contra el texto)."""
    acumulado = ""
    for k, ln in enumerate(lineas):
        ln = normal(ln)
        if k == 0:
            candidato = ln
        elif acumulado.endswith("-"):
            sin_guion = acumulado[:-1] + ln   # división silábica
            con_guion = acumulado + ln        # guion real (p. ej., 2017-2018)
            candidato = sin_guion if plano.startswith(sin_guion.removesuffix("-")) else con_guion
        else:
            candidato = acumulado + " " + ln
        # si la línea acaba en guion, se decide con la siguiente
        comprobar = candidato[:-1] if candidato.endswith("-") else candidato
        if not plano.startswith(comprobar):
            return None
        acumulado = candidato
    return acumulado


def partir_html(parrafo_html, n_caracteres):
    """Parte el HTML del párrafo tras `n_caracteres` de texto normalizado."""
    m = re.match(r"^(<p[^>]*>)(.*)</p>$", parrafo_html, re.S)
    apertura, interior = m.group(1), m.group(2)
    pila, vistos, i, previo_espacio = [], 0, 0, True
    while i < len(interior) and vistos < n_caracteres:
        c = interior[i]
        if c == "<":
            fin = interior.index(">", i)
            etiqueta = interior[i:fin + 1]
            nombre = re.match(r"</?\s*([a-zA-Z0-9]+)", etiqueta).group(1)
            if etiqueta.startswith("</"):
                pila.pop()
            elif not etiqueta.endswith("/>"):
                pila.append(etiqueta)
            i = fin + 1
            continue
        if c == "&":
            fin = interior.index(";", i)
            vistos += 1
            previo_espacio = False
            i = fin + 1
            continue
        if c.isspace() or c in "   ":
            if not previo_espacio:
                vistos += 1
            previo_espacio = True
        elif c == "​":
            pass
        else:
            vistos += 1
            previo_espacio = False
        i += 1
    cierre = "".join(f"</{re.match(r'<([a-zA-Z0-9]+)', t).group(1)}>" for t in reversed(pila))
    reapertura = "".join(pila)
    uno = interior[:i].rstrip()
    dos = interior[i:].lstrip()
    clases = re.search(r'class="([^"]*)"', apertura)
    clases = (clases.group(1) + " ") if clases else ""
    return (f'<p class="{clases}corte">{uno}{cierre}</p>', f'<p class="continua">{reapertura}{dos}</p>')


def espacio_libre(pagina):
    """Espacio entre el fin del texto y el inicio de las notas (o la base de la caja)."""
    notas = cf.tope_notas(pagina)
    tope = (notas - 14 - 3) if notas else cf.BASE_CAJA
    return tope - cf.fondo(pagina)


def main():
    archivo = cf.RAIZ / sys.argv[1]
    cf.ARCHIVO = archivo
    texto = archivo.read_text(encoding="utf-8")
    cab, _, resto = texto.partition("\n")
    bs = cf.bloques(resto)
    intentados = set()
    for _ in range(40):
        anclas, pdf = cf.render(cab + "\n" + "\n".join(bs))
        hecho = False
        for i, b in enumerate(bs):
            if cf.tipo(b) != "figura" or i + 1 >= len(bs):
                continue
            fid = re.search(r'id="([^"]+)"', b).group(1)
            pag = anclas.get(fid)
            if not pag or fid in intentados:
                continue
            libre = espacio_libre(pdf[pag - 1])
            n = int((libre - 3) // INTERLINEA)
            siguiente = bs[i + 1]
            if n < 2 or cf.tipo(siguiente) != "parrafo" or 'class="nota"' in siguiente \
                    or "continua" in siguiente or "capitular" in siguiente:
                continue
            anterior = bs[i - 1] if i > 0 else ""
            con_sangria = cf.tipo(anterior) == "parrafo"
            lineas = lineas_de(siguiente, con_sangria)
            m = min(n, len(lineas) - 2)
            while m >= 2 and lineas[m - 1].rstrip().endswith(("-", "‐", "–")):
                m -= 1
            intentados.add(fid)
            if m < 2:
                continue
            plano = texto_plano(siguiente)
            prefijo = unir(lineas[:m], plano)
            if prefijo is None or not plano.startswith(prefijo):
                print(f"  {fid}: no coincide el texto del párrafo; se omite")
                continue
            uno, dos = partir_html(siguiente, len(prefijo))
            bs[i:i + 2] = [uno, b, dos]
            print(f"  {fid}: {libre:.0f} pt libres en p. {pag} → se adelantan {m} líneas del párrafo siguiente")
            hecho = True
            break
        if not hecho:
            break
    archivo.write_text(cab + "\n" + "\n".join(bs), encoding="utf-8")


if __name__ == "__main__":
    main()
