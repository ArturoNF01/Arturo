"""Genera los cuadros 1-9 del capítulo 1 como tablas HTML (vector, texto real).

Lee datos/capitulo-1.json y escribe contenido/cuadros/cuadro-N.html.
Estilo: plantilla/libro.css (table.cuadro), heredado de las tablas del libro
de referencia: encabezado azul #1e6ea6, filas alternas #e0e5f1 / #b2c3de.

Uso: python guiones/cuadros_cap1.py
"""
import html
import json
import pathlib
from decimal import ROUND_HALF_UP, Decimal

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "contenido" / "cuadros"
D = json.loads((RAIZ / "datos" / "capitulo-1.json").read_text(encoding="utf-8"))

FINO = " "  # espacio fino irrompible (Source Sans 3 lo incluye)


def n(v, dec=2):
    if v is None or v == "":
        return ""
    v = float(v)
    # redondeo aritmético (como Excel), no «al par» de Python
    s = str(Decimal(repr(abs(v))).quantize(Decimal(1).scaleb(-dec), rounding=ROUND_HALF_UP))
    ent, _, frac = s.partition(".")
    grupos = []
    while len(ent) > 3:
        grupos.insert(0, ent[-3:])
        ent = ent[:-3]
    grupos.insert(0, ent)
    return ("−" if v < 0 else "") + FINO.join(grupos) + ("." + frac if frac else "")


def e(s):
    return html.escape(str(s), quote=False)


def fila(etiqueta, valores, clase="", sub=False):
    c = f' class="{clase}"' if clase else ""
    td0 = f'<td class="sub">{e(etiqueta)}</td>' if sub else f"<td>{e(etiqueta)}</td>"
    return f"<tr{c}>{td0}" + "".join(f"<td>{v}</td>" for v in valores) + "</tr>"


def grupo(etiqueta, columnas):
    return f'<tr class="grupo"><td colspan="{columnas}">{e(etiqueta)}</td></tr>'


def cabecera_anios(primera="Indicador"):
    return (
        "<thead>"
        f'<tr><th rowspan="2">{primera}</th><th colspan="3">2022</th><th colspan="3">2025</th></tr>'
        "<tr><th>Hombre</th><th>Mujer</th><th>Total</th><th>Hombre</th><th>Mujer</th><th>Total</th></tr>"
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


def cuadro_1():
    f = {x["etiqueta"]: x["valores"] for x in D["cuadro_1"]}
    def vals(clave, dec, pct=False):
        v = next(val for k, val in f.items() if k.startswith(clave))
        return [n(x * (100 if pct else 1), dec) if x is not None else "" for x in v]
    filas = [
        fila("Población nacida en Colombia", vals("Población nacida", 0)),
        fila("Población inmigrante de otros países", vals("Población inmigrante de otros países", 0)),
        fila("Población inmigrante de Venezuela", vals("Población inmigrante de Venezuela", 0)),
        fila("Total de población en Colombia", vals("Total de población", 0), "total"),
        fila("Población inmigrante de otros países respecto a la colombiana (%)", vals("Población inmigrante de otros países respecto", 2)),
        fila("Población inmigrante de Venezuela respecto a la colombiana (%)", vals("Población inmigrante de Venezuela respecto", 2)),
        grupo("Indicadores de la población venezolana en Colombia", 7),
        fila("Promedio de edad (años)", vals("Promedio de edad", 0)),
        fila("Relación hombres por mujer (hombres por cada 100 mujeres)", vals("Relación hombres", 2)),
        fila("Relación de niños por mujer (niños por cada 1 000 mujeres)", vals("Relación de niños", 2)),
        fila("Relación de dependencia infantil (niños por cada 100 personas en edad de trabajar)", vals("Relación de dependencia infantil", 2)),
        fila("Relación de dependencia de adultos mayores (por cada 100 personas en edad de trabajar)", vals("Relación de dependencia de adultos", 2)),
        fila("Índice de vejez (adultos mayores por cada 100 niños)", vals("Índice de vejez", 2)),
        grupo("Con nacionalidad colombiana (%)", 7),
        fila("Sí", vals("Si", 2, pct=True), sub=True),
        grupo("Con intención de quedarse en Colombia (%)", 7),
        fila("Sí", vals("Sí", 2, pct=True), sub=True),
    ]
    guardar("cuadro-1", '<table class="cuadro compacto c1">' + colgroup(34, 6) + cabecera_anios() + "<tbody>" + "".join(filas) + "</tbody></table>")


def cuadro_2():
    f = D["cuadro_2"]
    def v(i):
        return [n(x * 100, 2) for x in f[i]["valores"]]
    nombres_nivel = ["Sin escolaridad", "Básica", "Media", "Media técnica", "Universitaria", "Especialidad o posgrado"]
    filas = [grupo("Pertenencia a grupo étnico (%)", 7)]
    for i, nom in zip(range(1, 4), ["Indígena", "Afrodescendiente", "Otro grupo"]):
        filas.append(fila(nom, v(i), sub=True))
    filas.append(fila("Total", v(4), "total", sub=True))
    filas.append(grupo("Analfabetismo, población de 15 años y más (%)", 7))
    filas.append(fila("Sí", v(6), sub=True))
    filas.append(grupo("Nivel educativo, población de 15 años y más (%)", 7))
    for i, nom in zip(range(8, 14), nombres_nivel):
        filas.append(fila(nom, v(i), sub=True))
    filas.append(fila("Total", ["100.00"] * 6, "total", sub=True))
    guardar("cuadro-2", '<table class="cuadro compacto">' + colgroup(34, 6) + cabecera_anios() + "<tbody>" + "".join(filas) + "</tbody></table>")


def cuadro_3():
    f = {x["etiqueta"].strip(): x["valores"] for x in D["cuadro_3"]}
    def v(clave, dec):
        return [n(x, dec) for x in f[clave]]
    filas = [
        fila("Hogares con presencia de población venezolana según sexo de la jefatura", v("Hogares con presencia de población venezolana según sexo del jefe del hogar", 0)),
        fila("Hogares según sexo de la jefatura (%)", v("Hogar según sexo del jefe", 2)),
        fila("Número promedio de integrantes por hogar", v("Número promedio de integrantes por hogar", 2)),
        grupo("Tamaño del hogar (%)", 7),
        fila("Unipersonal (1)", v("Unipersonal (1)", 2), sub=True),
        fila("Pequeño (2-3)", v("Pequeño (2-3)", 2), sub=True),
        fila("Mediano (4-5)", v("Mediano (4-5)", 2), sub=True),
        fila("Grande (6 y más)", v("Grande (6 y más)", 2), sub=True),
        fila("Total", ["100.00"] * 6, "total", sub=True),
        grupo("Tipo de hogar (%)", 7),
        fila("Unipersonal", v("Unipersonal", 2), sub=True),
        fila("Nuclear completo", v("Nuclear completo", 2), sub=True),
        fila("Nuclear monoparental", v("Nuclear monoparental", 2), sub=True),
        fila("Extendido", v("Extendido", 2), sub=True),
        fila("Compuesto", v("Compuesto", 2), sub=True),
        fila("Total", ["100.00"] * 6, "total", sub=True),
        fila("Hogares con personas adultas mayores según sexo de la jefatura (%)", v("Hogares con adultos mayores según sexo del jefe", 2)),
        fila("Relación de dependencia en los hogares (niños y adultos mayores)", v("Relación de dependencia al interior de los hogares (niños y adultos mayores)", 3)),
        fila("Relación de dependencia de adultos mayores en los hogares", v("Relación de adultos mayores al interior de los hogares", 3)),
    ]
    guardar("cuadro-3", '<table class="cuadro compacto">' + colgroup(34, 6) + cabecera_anios() + "<tbody>" + "".join(filas) + "</tbody></table>")


def cuadro_anual(datos, primera, nombre, grupos_titulos, dec=1):
    """Cuadros 4 y 5: bloques por grupo poblacional con columnas 2022-2025."""
    cab = "<thead><tr>" + f"<th>{primera}</th>" + "".join(f"<th>{a}</th>" for a in (2022, 2023, 2024, 2025)) + "</tr></thead>"
    filas = []
    for celdas in datos[1:]:
        if len(celdas) == 1 or all(c == "" for c in celdas[1:]):
            titulo = celdas[0]
            if titulo.startswith("Fuente"):
                continue
            filas.append(grupo(grupos_titulos.get(titulo, titulo), 5))
        elif celdas[0] == "":
            filas.append(fila("Total", [n(c, dec) for c in celdas[1:]], "total", sub=True))
        else:
            filas.append(fila(celdas[0], [n(c, dec) for c in celdas[1:]], sub=True))
    return '<table class="cuadro compacto">' + colgroup(44, 4) + cab + "<tbody>" + "".join(filas) + "</tbody></table>"


def cuadro_4():
    d = [["Indicador"]] + [["Población venezolana"]] + D["cuadro_4"][1:]
    t = cuadro_anual(d, "Indicador", "cuadro-4", {"Población inmigrante otros": "Población inmigrante de otros países"})
    guardar("cuadro-4", t.replace('<table class="cuadro compacto">', '<table class="cuadro">'))


def cuadro_5():
    d = D["cuadro_5"]
    guardar("cuadro-5", cuadro_anual(d, "Posición en el trabajo", "cuadro-5",
                                     {"Población inmigrante otros países": "Población inmigrante de otros países"}, dec=2))


def cuadro_6():
    filas_d = D["cuadro_6"][2:]
    cab = ("<thead><tr><th>Rama de actividad</th><th>Población migrante venezolana</th>"
           "<th>Otros inmigrantes</th><th>Población colombiana</th><th>Total Colombia</th></tr></thead>")
    filas = []
    for c in filas_d:
        c = [x for x in c if x != ""] if c[0] == "Total" else c
        clase = "total" if c[0] == "Total" else ""
        filas.append(fila(c[0], [n(x, 1) for x in c[1:5]], clase))
    guardar("cuadro-6", '<table class="cuadro compacto">' + colgroup(40, 4) + cab + "<tbody>" + "".join(filas) + "</tbody></table>")


def cuadro_7():
    filas_d = D["cuadro_7"][2:]
    cab = ('<thead><tr><th rowspan="2">Rama de actividad</th><th colspan="3">Población migrante venezolana</th></tr>'
           "<tr><th>Hombres</th><th>Mujeres</th><th>Total</th></tr></thead>")
    filas = []
    for c in filas_d:
        clase = "total" if c[0] == "Total" else ""
        filas.append(fila(c[0].strip(), [n(x, 1) for x in c[1:4]], clase))
    guardar("cuadro-7", '<table class="cuadro compacto">' + colgroup(46, 3) + cab + "<tbody>" + "".join(filas) + "</tbody></table>")


def cuadro_8():
    d = D["cuadro_8"]
    cab = "<thead><tr><th></th><th>Hombres</th><th>Mujeres</th><th>Total</th></tr></thead>"
    filas = []
    for c in d[1:]:
        if len(c) == 1:
            filas.append(grupo(c[0], 4))
        else:
            filas.append(fila(c[0], [n(x, 1) for x in c[1:]], sub=True))
    guardar("cuadro-8", '<table class="cuadro">' + colgroup(46, 3) + cab + "<tbody>" + "".join(filas) + "</tbody></table>")


def cuadro_9():
    cab = ("<thead><tr><th>Grupo poblacional</th><th>Población ocupada total</th>"
           "<th>Población ocupada informal</th><th>Población ocupada formal</th></tr></thead>")
    filas = [fila(x["grupo"], [n(x["total"], 1), n(x["informal"], 1), n(x["formal"], 1)]) for x in D["cuadro_9"]]
    guardar("cuadro-9", '<table class="cuadro">' + colgroup(34, 3) + cab + "<tbody>" + "".join(filas) + "</tbody></table>")


if __name__ == "__main__":
    for f in (cuadro_1, cuadro_2, cuadro_3, cuadro_4, cuadro_5, cuadro_6, cuadro_7, cuadro_8, cuadro_9):
        f()
