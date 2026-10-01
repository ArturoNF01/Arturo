"""Genera los cuadros 1-9 del capítulo 1 como tablas HTML (vector, texto real).

Fidelidad: los textos y las cifras se reproducen tal cual el manuscrito, sin
reformatear ni corregir.
  - Cuadros 4 a 8: celdas de las tablas del DOCX (datos/capitulo-1.json).
  - Cuadros 1, 2, 3 y 9 (imágenes en el DOCX): transcripción literal en
    datos/cuadros-imagen.json, verificada cifra por cifra contra el Excel.
Estilo: plantilla/libro.css (table.cuadro), heredado del libro de referencia.

Uso: python guiones/cuadros_cap1.py
"""
import html
import json
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "contenido" / "cuadros"
D = json.loads((RAIZ / "datos" / "capitulo-1.json").read_text(encoding="utf-8"))
IMG = json.loads((RAIZ / "datos" / "cuadros-imagen.json").read_text(encoding="utf-8"))


def e(s):
    return html.escape(str(s), quote=False)


def fila(etiqueta, valores, clase="", sub=False):
    c = f' class="{clase}"' if clase else ""
    td0 = f'<td class="sub">{e(etiqueta)}</td>' if sub else f"<td>{e(etiqueta)}</td>"
    return f"<tr{c}>{td0}" + "".join(f"<td>{e(v)}</td>" for v in valores) + "</tr>"


def grupo(etiqueta, columnas):
    return f'<tr class="grupo"><td colspan="{columnas}">{e(etiqueta)}</td></tr>'


def cabecera_anios(primera, sub):
    return (
        "<thead>"
        f'<tr><th rowspan="2">{e(primera)}</th><th colspan="3">2022</th><th colspan="3">2025</th></tr>'
        "<tr>" + "".join(f"<th>{e(s)}</th>" for s in sub) + "</tr>"
        "</thead>"
    )


def colgroup(primera, n_cols):
    resto = (100 - primera) / n_cols
    return "<colgroup>" + f'<col style="width:{primera}%">' + "".join(
        f'<col style="width:{resto:.2f}%">' for _ in range(n_cols)) + "</colgroup>"


def guardar(nombre, tabla):
    DESTINO.mkdir(parents=True, exist_ok=True)
    (DESTINO / f"{nombre}.html").write_text(tabla + "\n", encoding="utf-8")
    print("✓", nombre)


def filas_imagen(datos, columnas):
    """Filas transcritas: [tipo, etiqueta, valores…]; tipo = fila | sub | total | grupo."""
    out = []
    for f in datos["filas"]:
        tipo, etiqueta, valores = f[0], f[1], f[2:]
        if tipo == "grupo":
            out.append(grupo(etiqueta, columnas))
        else:
            out.append(fila(etiqueta, valores, "total" if tipo == "total" else "", sub=tipo in ("sub", "total")))
    return "".join(out)


def cuadro_imagen(nombre, clase, primera_col):
    d = IMG[nombre.replace("-", "_")]
    tabla = (f'<table class="{clase}">' + colgroup(primera_col, 6) + cabecera_anios(d["cabecera"][0], d["sub"])
             + "<tbody>" + filas_imagen(d, 7) + "</tbody></table>")
    guardar(nombre, tabla)


def cuadro_1():
    # cifras con coma de miles (como el manuscrito): columnas numéricas más anchas
    cuadro_imagen("cuadro-1", "cuadro compacto c1", 32)


def cuadro_2():
    cuadro_imagen("cuadro-2", "cuadro compacto", 34)


def cuadro_3():
    cuadro_imagen("cuadro-3", "cuadro compacto", 34)


def cuadro_anual(datos, clase):
    """Cuadros 4 y 5: la primera fila del DOCX es el encabezado; las filas con una sola
    celda (o el resto vacío) son títulos de grupo; las de etiqueta vacía, totales."""
    cab = "<thead><tr>" + "".join(f"<th>{e(c)}</th>" for c in datos[0]) + "</tr></thead>"
    filas = []
    for celdas in datos[1:]:
        if celdas[0].startswith("Fuente"):
            continue  # va en el pie de la figura
        if len(celdas) == 1 or all(c == "" for c in celdas[1:]):
            filas.append(grupo(celdas[0], 5))
        elif celdas[0] == "":
            filas.append(fila("", celdas[1:], "total", sub=True))
        else:
            filas.append(fila(celdas[0], celdas[1:], sub=True))
    return f'<table class="{clase}">' + colgroup(44, 4) + cab + "<tbody>" + "".join(filas) + "</tbody></table>"


def cuadro_4():
    guardar("cuadro-4", cuadro_anual(D["cuadro_4"], "cuadro"))


def cuadro_5():
    guardar("cuadro-5", cuadro_anual(D["cuadro_5"], "cuadro compacto"))


def cuadro_6():
    d = D["cuadro_6"]
    cab = "<thead><tr>" + "".join(f"<th>{e(c)}</th>" for c in d[0][:5]) + "</tr></thead>"
    filas = [fila(c[0], c[1:5], "total" if c[0] == "Total" else "") for c in d[2:]]
    guardar("cuadro-6", '<table class="cuadro compacto">' + colgroup(40, 4) + cab + "<tbody>" + "".join(filas) + "</tbody></table>")


def cuadro_7():
    d = D["cuadro_7"]
    cab = "<thead><tr>" + "".join(f"<th>{e(c)}</th>" for c in d[1][:4]) + "</tr></thead>"
    filas = [fila(c[0], c[1:4], "total" if c[0] == "Total" else "") for c in d[2:]]
    guardar("cuadro-7", '<table class="cuadro compacto">' + colgroup(46, 3) + cab + "<tbody>" + "".join(filas) + "</tbody></table>")


def cuadro_8():
    d = D["cuadro_8"]
    cab = "<thead><tr>" + "".join(f"<th>{e(c)}</th>" for c in d[0]) + "</tr></thead>"
    filas = []
    for c in d[1:]:
        filas.append(grupo(c[0], 4) if len(c) == 1 else fila(c[0], c[1:], sub=True))
    guardar("cuadro-8", '<table class="cuadro">' + colgroup(46, 3) + cab + "<tbody>" + "".join(filas) + "</tbody></table>")


def cuadro_9():
    d = IMG["cuadro_9"]
    cab = "<thead><tr>" + "".join(f"<th>{e(c)}</th>" for c in d["cabecera"]) + "</tr></thead>"
    guardar("cuadro-9", '<table class="cuadro">' + colgroup(34, 3) + cab + "<tbody>" + filas_imagen(d, 4) + "</tbody></table>")


if __name__ == "__main__":
    for f in (cuadro_1, cuadro_2, cuadro_3, cuadro_4, cuadro_5, cuadro_6, cuadro_7, cuadro_8, cuadro_9):
        f()
