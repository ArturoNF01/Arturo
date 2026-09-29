"""Optimiza la paginación del capítulo: reduce los huecos al pie de página.

Recorre los huecos en orden. Para cada hueco que precede a una figura prueba tres
arreglos y se queda con el que más reduce el espacio vacío en esa página y las
tres siguientes (lo que se desplaza después se corrige en los pasos siguientes):
  a) pasar la figura detrás del párrafo siguiente (máximo 2 párrafos de distancia);
  b) partir el párrafo siguiente y adelantar sus primeras líneas (texto intacto);
  c) anticipar la figura antes del párrafo anterior.

Uso: python guiones/optimizar_paginas.py contenido/10-capitulo-1.html
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import colocar_figuras as cf  # noqa: E402
import rellenar_huecos as rh  # noqa: E402

UMBRAL = 20  # pt: huecos menores no cuentan
MAX_DISTANCIA = 2


def fid_de(b):
    m = re.search(r'id="([^"]+)"', b)
    return m.group(1) if m else None


def evaluar(cab, bs):
    anclas, pdf = cf.render(cab + "\n" + "\n".join(bs))
    inicio = anclas.get("cap-1", 0)
    huecos = {}
    for n in range(inicio, len(pdf) - 1):
        h = rh.espacio_libre(pdf[n])
        if h > UMBRAL:
            huecos[n] = h
    costo = sum(h * h for h in huecos.values())
    return costo, huecos, anclas, pdf


def arreglo_mover(bs, i, distancia):
    if i + 1 >= len(bs) or cf.tipo(bs[i + 1]) != "parrafo" or distancia.get(fid_de(bs[i]), 0) >= MAX_DISTANCIA:
        return None
    nuevo = bs[:]
    nuevo[i], nuevo[i + 1] = nuevo[i + 1], nuevo[i]
    return nuevo


def arreglo_anticipar(bs, i, distancia):
    if i < 1 or cf.tipo(bs[i - 1]) != "parrafo" or "capitular" in bs[i - 1] or distancia.get(fid_de(bs[i]), 0) <= -MAX_DISTANCIA:
        return None
    nuevo = bs[:]
    nuevo[i - 1], nuevo[i] = nuevo[i], nuevo[i - 1]
    return nuevo


def local(huecos, pag):
    return sum(v * v for k, v in huecos.items() if pag - 1 <= k <= pag + 2)


def arreglo_partir(bs, i, pdf, pag):
    siguiente = bs[i + 1] if i + 1 < len(bs) else ""
    if cf.tipo(siguiente) != "parrafo" or 'class="nota"' in siguiente or "capitular" in siguiente:
        return None
    libre = rh.espacio_libre(pdf[pag - 1])
    n = int((libre - 3) // rh.INTERLINEA)
    if n < 2:
        return None
    con_sangria = cf.tipo(bs[i - 1]) == "parrafo" and "continua" not in siguiente
    if "continua" in siguiente:
        con_sangria = False
    lineas = rh.lineas_de(siguiente, con_sangria)
    m = min(n, len(lineas) - 2)
    while m >= 2 and rh.normal(lineas[m - 1]).endswith("-"):
        m -= 1
    if m < 2:
        return None
    plano = rh.texto_plano(siguiente)
    prefijo = rh.unir(lineas[:m], plano)
    if prefijo is None:
        return None
    uno, dos = rh.partir_html(siguiente, len(prefijo))
    if "continua" in siguiente:  # la parte que se adelanta sigue siendo continuación
        uno = uno.replace('class="continua corte"', 'class="continua corte"')
    nuevo = bs[:]
    nuevo[i:i + 2] = [uno, nuevo[i], dos]
    return nuevo


def main():
    archivo = cf.RAIZ / sys.argv[1]
    cf.ARCHIVO = archivo
    texto = archivo.read_text(encoding="utf-8")
    cab, _, resto = texto.partition("\n")
    bs = cf.bloques(resto)
    distancia = {}
    descartados = set()
    costo, huecos, anclas, pdf = evaluar(cab, bs)
    print(f"costo inicial {costo:.0f}; huecos: { {k + 1: round(v) for k, v in huecos.items()} }")
    for _ in range(30):
        # figura que abre la página siguiente a un hueco
        objetivo = None
        for i, b in enumerate(bs):
            if cf.tipo(b) != "figura":
                continue
            f = fid_de(b)
            pag = anclas.get(f)
            if pag and (pag - 1) in huecos and (f, pag) not in descartados:
                objetivo = (i, f, pag)
                break
        if objetivo is None:
            break
        i, f, pag = objetivo
        opciones = []
        for nombre, nuevo in (("mover", arreglo_mover(bs, i, distancia)),
                              ("partir", arreglo_partir(bs, i, pdf, pag)),
                              ("anticipar", arreglo_anticipar(bs, i, distancia))):
            if nuevo is None:
                continue
            c, h, a, p = evaluar(cab, nuevo)
            opciones.append((local(h, pag), c, nombre, nuevo, h, a, p))
            print(f"   {f} (hueco en p. {pag}): {nombre:<9} → local {local(h, pag):.0f} (antes {local(huecos, pag):.0f}), total {c:.0f}")
        mejor = min(opciones, key=lambda o: (o[0], o[1])) if opciones else None
        if mejor and mejor[0] < local(huecos, pag):
            _, costo, nombre, bs, huecos, anclas, pdf = mejor
            if nombre == "mover":
                distancia[f] = distancia.get(f, 0) + 1
            elif nombre == "anticipar":
                distancia[f] = distancia.get(f, 0) - 1
            print(f"  ✓ {f}: {nombre} (total {costo:.0f})")
        else:
            descartados.add((f, pag))
        archivo.write_text(cab + "\n" + "\n".join(bs), encoding="utf-8")
    archivo.write_text(cab + "\n" + "\n".join(bs), encoding="utf-8")
    print(f"costo final {costo:.0f}; huecos: { {k + 1: round(v) for k, v in huecos.items()} }")


if __name__ == "__main__":
    main()
