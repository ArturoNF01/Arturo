"""Prueba ordenaciones de párrafos y figuras de una sección y aplica la mejor.

Uso (desde la carpeta del proyecto):
    python guiones/probar_orden.py contenido/10-capitulo-1.html "<h2 id=\"s1-4\"" \
        "p1 cuadro-2 p2 grafica-4 p3 p4" "p1 cuadro-2 p2 p3 grafica-4 p4" ...

La sección va desde el bloque que empieza con el marcador dado hasta el
siguiente título (h2/h3). Los párrafos se nombran p1, p2… en su orden actual y
las figuras por su id. Se compone el libro con cada orden y se mide el espacio
vacío (sin contar notas al pie) en las páginas que ocupa la sección.
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import colocar_figuras as cf  # noqa: E402

archivo = cf.RAIZ / sys.argv[1]
marcador = sys.argv[2]
ordenes = sys.argv[3:]
cf.ARCHIVO = archivo

texto = archivo.read_text(encoding="utf-8")
cab, _, resto = texto.partition("\n")
bs = cf.bloques(resto)
ini = next(i for i, b in enumerate(bs) if b.startswith(marcador))
fin = ini + 1
while fin < len(bs) and cf.tipo(bs[fin]) != "titulo" and not bs[fin].startswith('<section class="bibliografia"'):
    fin += 1
seccion = bs[ini + 1:fin]
nombres, n = {}, 0
for b in seccion:
    if cf.tipo(b) == "figura":
        nombres[re.search(r'id="([^"]+)"', b).group(1)] = b
    else:
        n += 1
        nombres[f"p{n}"] = b
print("bloques de la sección:", " ".join(nombres))


def puntuar(orden):
    nuevos = bs[:ini + 1] + [nombres[k] for k in orden.split()] + bs[fin:]
    anclas, pdf = cf.render(cab + "\n" + "\n".join(nuevos))
    # páginas de la sección: de la del título a la del bloque siguiente a la sección
    ids_ini = re.search(r'id="([^"]+)"', bs[ini])
    p0 = anclas.get(ids_ini.group(1), 0) if ids_ini else 0
    sig = re.search(r'id="([^"]+)"', bs[fin]) if fin < len(bs) else None
    p1 = anclas.get(sig.group(1), len(pdf) - 1) if sig else len(pdf) - 1
    huecos = []
    for pag in range(p0, p1):
        h = cf.BASE_CAJA - cf.fondo(pdf[pag])
        huecos.append(max(0, h))
    costo = sum(h * h for h in huecos if h > 14)
    return costo, huecos, nuevos


mejor = None
for orden in ordenes:
    costo, huecos, nuevos = puntuar(orden)
    print(f"{costo:>9.0f}  {orden:<55} huecos: {[round(h) for h in huecos]}")
    if mejor is None or costo < mejor[0]:
        mejor = (costo, orden, nuevos)
archivo.write_text(cab + "\n" + "\n".join(mejor[2]), encoding="utf-8")
print("aplicado:", mejor[1])
